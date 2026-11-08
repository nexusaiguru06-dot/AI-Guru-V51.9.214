import { NextResponse } from 'next/server';
import { bad, denied } from '../guard';
import { readData, update } from '@/lib/ai-guru/admin/store';
import { deleteDocument, deleteMaterial, listDocuments, listMaterials, updateDocument, updateMaterial } from '@/lib/ai-guru/material-studio/store';
import { buildStudyParts, partOfMaterial } from '@/lib/ai-guru/material-studio/parts';
import { MEDIUMS, mediumOf, SYLLABI, syllabusKey } from '@/lib/ai-guru/library/catalog';
import { cleanLibrarySettings, maskKey } from '@/lib/ai-guru/library/settings';
import { jobsFor } from '@/lib/ai-guru/library/cloud';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * V51.9.95 — the study-material library for the admin.
 * GET — cloud settings (the key masked), every book (hidden ones too) with who uploaded it, its syllabus / standard /
 *       medium, its ten parts and the materials in each, how many students downloaded it, and the cloud jobs.
 */
export async function GET(req: Request) {
  const d = await denied(req); if (d) return d;
  const data = await readData();
  const [docs, mats] = await Promise.all([listDocuments(), listMaterials()]);
  const lib = data.settings.library;
  const downloads = (id: string) => data.students.filter((s) => s.library?.some((x) => x.documentId === id)).length;
  const books = docs.map((doc) => {
    const parts = buildStudyParts(doc);
    const ms = mats.filter((m) => m.documentId === doc.id);
    return {
      id: doc.id, fileName: doc.fileName, subject: doc.subject, grade: doc.grade, syllabus: syllabusKey(doc.syllabus), medium: mediumOf(doc), teachingLanguage: doc.teachingLanguage, pageCount: doc.pageCount, indexedAt: doc.indexedAt,
      owner: doc.owner ?? { kind: 'admin' }, hidden: !!doc.hidden, downloads: downloads(doc.id),
      parts: parts.map((p) => ({ index: p.index, startPage: p.startPage, endPage: p.endPage, readable: p.sourceIds.length > 0, materials: ms.filter((m) => partOfMaterial(m, parts) === p.index).map((m) => ({ id: m.id, type: m.type, title: m.title, owner: m.owner ?? { kind: 'admin' }, hidden: !!m.hidden, score: m.qa?.score ?? null, createdAt: m.createdAt })) })),
    };
  });
  return NextResponse.json({
    ok: true,
    settings: { ...lib, cloudKey: maskKey(lib.cloudKey), hasEnvKey: !!process.env.GEMINI_API_KEY },
    options: { syllabi: SYLLABI, mediums: MEDIUMS },
    books, jobs: (await jobsFor({ kind: 'admin' })).slice(0, 60),
    totals: { books: books.length, materials: mats.length, byStudents: mats.filter((m) => m.owner?.kind === 'student').length, hidden: books.filter((b) => b.hidden).length + mats.filter((m) => m.hidden).length, students: data.students.length, studentsWithBooks: data.students.filter((s) => s.library?.length).length },
  }, { headers: { 'cache-control': 'no-store' } });
}

/**
 * POST { action: 'settings', library: { cloudKey?, studentsMayCreate, dailyLimit, reviewStudentWork } }   (cloudKey null removes it)
 *      { action: 'book', id, hidden?, subject?, grade?, syllabus?, medium? }   show/hide a book or fix its details (matching uses them)
 *      { action: 'material', id, hidden }                                       show/hide one material
 *      { action: 'deleteMaterial', id }   { action: 'deleteBook', id }          remove for good (the book with its PDF and materials)
 */
export async function POST(req: Request) {
  const d = await denied(req); if (d) return d;
  const b = await req.json().catch(() => ({}));
  if (b.action === 'settings') {
    const cur = (await readData()).settings.library;
    const s = cleanLibrarySettings(b.library, cur);
    if (typeof s === 'string') return bad(s);
    await update((data) => { data.settings.library = s; });
    return NextResponse.json({ ok: true, settings: { ...s, cloudKey: maskKey(s.cloudKey) } });
  }
  if (b.action === 'book') {
    const patch: Record<string, unknown> = {};
    if (typeof b.hidden === 'boolean') patch.hidden = b.hidden;
    if (typeof b.subject === 'string') patch.subject = b.subject.trim().slice(0, 60);
    if (typeof b.grade === 'string') patch.grade = b.grade.trim().slice(0, 8);
    if (typeof b.syllabus === 'string') { if (!SYLLABI.some(([v]) => v === b.syllabus)) return bad('Unknown syllabus'); patch.syllabus = b.syllabus; }
    if (typeof b.medium === 'string') { if (!MEDIUMS.some(([v]) => v === b.medium)) return bad('Unknown medium'); patch.sourceLanguage = b.medium; }
    const doc = await updateDocument(String(b.id ?? ''), patch);
    return doc ? NextResponse.json({ ok: true }) : bad('Book not found', 404);
  }
  if (b.action === 'material') { const m = await updateMaterial(String(b.id ?? ''), { hidden: !!b.hidden }); return m ? NextResponse.json({ ok: true }) : bad('Material not found', 404); }
  if (b.action === 'deleteMaterial') return (await deleteMaterial(String(b.id ?? ''))) ? NextResponse.json({ ok: true }) : bad('Material not found', 404);
  if (b.action === 'deleteBook') {
    const id = String(b.id ?? '');
    if (!(await deleteDocument(id))) return bad('Book not found', 404);
    await update((data) => { for (const s of data.students) if (s.library) s.library = s.library.filter((x) => x.documentId !== id); });
    return NextResponse.json({ ok: true });
  }
  return bad('Unknown action');
}

