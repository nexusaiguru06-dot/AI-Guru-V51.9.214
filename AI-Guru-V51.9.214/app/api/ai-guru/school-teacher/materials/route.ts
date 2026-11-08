import { NextResponse } from 'next/server';
import { schoolTeacherFromRequest } from '@/lib/ai-guru/schools/session';
import { teacherMayUse } from '@/lib/ai-guru/schools/teacher-view';
import { audit, newRowId } from '@/lib/ai-guru/schools/store';
import { teacherCovers } from '@/lib/ai-guru/schools/rules';
import { deleteMaterial, getDocument, getMaterial, listDocuments, saveMaterial } from '@/lib/ai-guru/material-studio/store';
import { buildStudyParts, freePartsOf, partOfMaterial } from '@/lib/ai-guru/material-studio/parts';
import { readData } from '@/lib/ai-guru/admin/store';
import { MATERIAL_TYPES, type StudyMaterial, type StudyMaterialSection } from '@/lib/ai-guru/material-studio/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const clip = (x: unknown, n: number) => String(x ?? '').slice(0, n);
const noStore = { 'cache-control': 'no-store' };

/** A section as the teacher edited it (only the text fields; anything else is kept from the original). */
function cleanSection(raw: Record<string, unknown>, before?: StudyMaterialSection): StudyMaterialSection {
  const opts = Array.isArray(raw.options) ? raw.options.map((o) => clip(o, 300)).filter((o) => o.trim()).slice(0, 6) : before?.options;
  return {
    ...(before ?? { sourceIds: [], visuals: [] }),
    id: before?.id ?? newRowId('sec'),
    heading: clip(raw.heading, 600), content: clip(raw.content, 6000),
    ...(raw.contentTranslation !== undefined ? { contentTranslation: clip(raw.contentTranslation, 6000) } : {}),
    ...(opts && opts.length ? { options: opts } : { options: undefined }),
    ...(raw.answer !== undefined ? { answer: clip(raw.answer, 600) } : {}),
    ...(raw.activity !== undefined ? { activity: clip(raw.activity, 2000) } : {}),
  };
}

/**
 * V51.9.193 — a school teacher's study materials.
 * GET ?id=…            one material in full (an AI one of their books, or their school's teacher version).
 * POST { action: 'save', material: { id?, basedOn?, documentId, type, part?, title, overview, sections[] } }
 *      Editing an AI material makes the school's own copy (the AI one stays for everyone else; this school's students
 *      see the teacher's version instead). Editing their own version changes it. A new one needs a part (1–5).
 * POST { action: 'remove', id }   their own version only (the AI one shows again for their students).
 * Every change is recorded against the teacher (the office sees it on the Schools page).
 */
export async function GET(request: Request) {
  const t = await schoolTeacherFromRequest(request);
  if (!t) return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
  const m = await getMaterial(String(new URL(request.url).searchParams.get('id') ?? ''));
  if (!m || m.hidden || !(await teacherMayUse(t, t.school, m))) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404, headers: noStore });
  return NextResponse.json({ ok: true, material: m }, { headers: noStore });
}

export async function POST(request: Request) {
  const t = await schoolTeacherFromRequest(request);
  if (!t) return NextResponse.json({ ok: false, error: 'Sign in first' }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (b.action === 'remove') {
    const m = await getMaterial(String(b.id ?? ''));
    if (!m || m.school !== t.schoolId || m.teacher?.id !== t.id) return NextResponse.json({ ok: false, error: 'Only your own versions can be removed' }, { status: 403 });
    await deleteMaterial(m.id);
    await audit({ schoolId: t.schoolId, teacherId: t.id, action: 'material-remove', what: `Removed “${m.title}”${m.basedOn ? ' (the AI version shows again)' : ''}`, materialId: m.id, documentId: m.documentId });
    return NextResponse.json({ ok: true });
  }
  if (b.action !== 'save') return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  const raw = (b.material ?? {}) as Record<string, unknown>;
  const doc = await getDocument(String(raw.documentId ?? ''));
  if (!doc || doc.hidden || !teacherCovers(t, doc, t.school.syllabus)) return NextResponse.json({ ok: false, error: `This book is not in your subject and standards (${t.subject}, Std ${t.standards.join(', ')}).` }, { status: 403 });
  const title = clip(raw.title, 160).trim();
  const sectionsRaw = Array.isArray(raw.sections) ? (raw.sections as Record<string, unknown>[]).slice(0, 200) : [];
  if (!title) return NextResponse.json({ ok: false, error: 'A title is needed' }, { status: 400 });
  if (!sectionsRaw.length) return NextResponse.json({ ok: false, error: 'Add at least one section or question' }, { status: 400 });
  const now = new Date().toISOString();
  const existing = raw.id ? await getMaterial(String(raw.id)) : null;
  const all = await listDocuments();
  if (existing && existing.documentId !== doc.id) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 }); // V51.9.196
  if (existing && !(await teacherMayUse(t, t.school, existing, all))) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  const own = existing && existing.school === t.schoolId && existing.teacher?.id === t.id;
  if (existing && existing.school && !own) return NextResponse.json({ ok: false, error: 'This is another teacher’s version. Make your own copy from the AI material.' }, { status: 403 });
  // the base: an AI material (copy for this school), the teacher's own (edit in place), or nothing (a new material for a part)
  const base = existing ?? null;
  let sources = base?.sources ?? [];
  if (!base) {
    const part = buildStudyParts(doc).find((p) => p.index === Number(raw.part));
    if (!part) return NextResponse.json({ ok: false, error: 'Choose the part (1–5) this material is for' }, { status: 400 });
    sources = doc.sources.filter((s) => part.sourceIds.includes(s.id)).slice(0, 40);
  }
  const type = (MATERIAL_TYPES as readonly string[]).includes(String(raw.type)) ? raw.type as StudyMaterial['type'] : base?.type ?? 'revision-notes';
  const sections = sectionsRaw.map((s, i) => cleanSection(s, base?.sections.find((x) => x.id === s.id) ?? (own ? undefined : base?.sections[i])));
  const m: StudyMaterial = {
    ...(base ?? { model: 'teacher', materialLanguages: [doc.teachingLanguage || 'english'], teachingLanguage: doc.teachingLanguage || 'english', createdAt: now }),
    id: own ? base!.id : newRowId('tchm'), documentId: doc.id, type, title, overview: clip(raw.overview, 4000), sections, sources,
    qa: { status: 'passed', score: 100, issues: [], checkedAt: now }, updatedAt: now, createdAt: own ? base!.createdAt : now,
    owner: { kind: 'admin', name: t.name, via: 'studio' }, school: t.schoolId, teacher: { id: t.id, name: t.name, subject: t.subject },
    ...(own ? (base!.basedOn ? { basedOn: base!.basedOn } : {}) : base && !base.school ? { basedOn: base.id } : {}),
  } as StudyMaterial;
  delete (m as { hidden?: boolean }).hidden;
  await saveMaterial(m);
  // V51.9.195 (review): the record says WHAT changed, not only that something did
  const changed = base ? changesOf(base, m) : '';
  await audit({ schoolId: t.schoolId, teacherId: t.id, action: own ? 'material-edit' : 'material-new', what: (own ? `Edited “${title}”` : base ? `Made the school’s version of “${base.title}” → “${title}”` : `Added “${title}” (${type}, Part ${raw.part}, ${sections.length} section${sections.length === 1 ? '' : 's'})`) + (changed ? `: ${changed}` : ''), materialId: m.id, documentId: doc.id });
  // V51.9.195: who sees it — a part that is not free shows only to students who have paid for it
  const part = partOfMaterial(m, buildStudyParts(doc));
  const free = freePartsOf(doc, (await readData()).settings.access.freeParts);
  const seenBy = part && !free.includes(part) ? `Your students see it in Part ${part} once they have paid for Part ${part}.` : 'All your students of this standard see it now.';
  return NextResponse.json({ ok: true, material: m, seenBy });
}

/** A short summary of what changed between two versions (title, overview, sections added / removed / changed). */
function changesOf(a: StudyMaterial, b: StudyMaterial): string {
  const out: string[] = [];
  if (a.title !== b.title) out.push(`title “${a.title}” → “${b.title}”`);
  if ((a.overview ?? '') !== (b.overview ?? '')) out.push('overview changed');
  const key = (x: StudyMaterialSection) => JSON.stringify(x);
  const byId = new Map(a.sections.map((x) => [x.id, x]));
  const ids = new Set(b.sections.map((x) => x.id));
  const added = b.sections.filter((x) => !byId.has(x.id));
  const removed = a.sections.filter((x) => !ids.has(x.id));
  const edited = b.sections.filter((x) => byId.has(x.id) && key(byId.get(x.id)!) !== key(x));
  const name = (x: StudyMaterialSection) => `“${String((x as { title?: string; heading?: string }).title ?? (x as { heading?: string }).heading ?? x.id).slice(0, 40)}”`;
  if (edited.length) out.push(`changed ${edited.length} section${edited.length === 1 ? '' : 's'} (${edited.slice(0, 3).map(name).join(', ')}${edited.length > 3 ? ' …' : ''})`);
  if (added.length) out.push(`added ${added.length} (${added.slice(0, 3).map(name).join(', ')})`);
  if (removed.length) out.push(`removed ${removed.length} (${removed.slice(0, 3).map(name).join(', ')})`);
  return out.join('; ') || 'no change';
}
