import { NextResponse } from 'next/server';
import { getDocument, getMaterial } from '@/lib/ai-guru/material-studio/store';
import { contentAccessFor, fullFor, mayView } from '@/lib/ai-guru/admin/content-access';
import { lockedPartsOf } from '@/lib/ai-guru/material-studio/locks';
import { buildStudyParts, partOfMaterial } from '@/lib/ai-guru/material-studio/parts';
import { readBoardPlan } from '@/lib/ai-guru/material-studio/board-plan';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * V51.9.209 — the whiteboard lesson plan the server made for one section, for the classroom. Whoever may open the
 * material may have its plan; a part that is not opened yet (locked) gets none. 404 = no plan: the classroom plans itself.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const none = () => NextResponse.json({ ok: false }, { status: 404, headers: { 'cache-control': 'private, no-store' } });
  const m = await getMaterial(String(q.get('materialId') || ''));
  const hash = Number(q.get('h'));
  if (!m || !Number.isFinite(hash)) return none();
  const a = await contentAccessFor(req);
  const doc = await getDocument(m.documentId);
  if (!doc || !mayView(m, a) || !mayView(doc, a)) return none();
  if (!a.isAdmin) {
    const locked = lockedPartsOf(doc, a.freeParts, fullFor(doc, a), a.paidParts).lockedParts;
    if (locked.includes(partOfMaterial(m, buildStudyParts(doc)))) return none();
  }
  const plan = await readBoardPlan(m, String(q.get('sectionId') || ''), hash);
  if (!plan) return none();
  return NextResponse.json({ ok: true, ...plan }, { headers: { 'cache-control': 'private, no-store' } });
}
