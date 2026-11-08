import { NextResponse } from 'next/server';
import { bad, denied } from '../guard';
import { getMaterial, listDocuments, listMaterials } from '@/lib/ai-guru/material-studio/store';
import { planStatus, planStep, serverGeminiKey } from '@/lib/ai-guru/material-studio/board-plan';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * V51.9.209 — office only. Whiteboard lesson plans made on the server (so students need no AI key of their own).
 * GET                    — every book with its materials and how many sections already have a plan
 * GET ?materialId=…      — that material's sections with their progress
 * POST {materialId, sectionIndex, step:"block"|"subjects", blockIndex?} — does ONE short step (about one AI call)
 */
export async function GET(req: Request) {
  const d = await denied(req); if (d) return d;
  const id = new URL(req.url).searchParams.get('materialId');
  if (id) {
    const m = await getMaterial(id);
    if (!m) return bad('Material not found', 404);
    return NextResponse.json({ ok: true, hasKey: !!(await serverGeminiKey()), sections: await planStatus(m) });
  }
  const books = await listDocuments();
  const mats = await listMaterials();
  return NextResponse.json({
    ok: true, hasKey: !!(await serverGeminiKey()),
    books: books.map((b) => ({ id: b.id, name: b.fileName, grade: b.grade, subject: b.subject, materials: mats.filter((m) => m.documentId === b.id && !m.school).map((m) => ({ id: m.id, title: m.title, type: m.type, sections: m.sections.length })) })).filter((b) => b.materials.length),
  });
}

export async function POST(req: Request) {
  const d = await denied(req); if (d) return d;
  const key = await serverGeminiKey();
  if (!key) return bad('No server AI key: add one in Study materials → Cloud settings, or set GEMINI_API_KEY on the server.', 400);
  let b: { materialId?: string; sectionIndex?: number; step?: string; blockIndex?: number };
  try { b = await req.json(); } catch { return bad('Send JSON'); }
  const m = b.materialId ? await getMaterial(String(b.materialId)) : null;
  if (!m) return bad('Material not found', 404);
  const i = Number(b.sectionIndex);
  if (!Number.isInteger(i) || i < 0 || i >= m.sections.length) return bad('No such section');
  const step = b.step === 'subjects' ? 'subjects' : 'block';
  try {
    const status = await planStep(m, i, step, Math.max(0, Number(b.blockIndex) || 0), key);
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    return bad(e instanceof Error ? e.message.slice(0, 300) : 'The plan could not be made', 502);
  }
}
