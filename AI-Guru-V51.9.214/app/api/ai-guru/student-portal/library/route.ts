import { NextResponse } from 'next/server';
import { isAdmin, studentFromRequest } from '@/lib/ai-guru/admin/auth';
import { readData, update } from '@/lib/ai-guru/admin/store';
import { entitlement, istToday } from '@/lib/ai-guru/admin/enrolment';
import { planViewOf } from '@/lib/ai-guru/admin/content-access';
import { listDocuments, listMaterials } from '@/lib/ai-guru/material-studio/store';
import { buildStudyParts, partOfMaterial } from '@/lib/ai-guru/material-studio/parts';
import { lockedPartsOf } from '@/lib/ai-guru/material-studio/locks';
import { bookMatches, MEDIUMS, mediumOf, ownerLabel, SYLLABI } from '@/lib/ai-guru/library/catalog';
import { ownsBook } from '@/lib/ai-guru/library/requester';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * V51.9.95 — "Download your study materials".
 * GET  — the student's syllabus / medium / standard, the books in the library that match them (made by the admin or by
 *        other students), the books already downloaded, and whether they may create on the cloud. ?all=1 lists every
 *        syllabus (for a student who wants a book of another standard).
 * POST { action: 'profile', syllabus, medium } | { action: 'add', documentId } | { action: 'remove', documentId }
 */
export async function GET(req: Request) {
  const asId = new URL(req.url).searchParams.get('as');
  const id = asId && (await isAdmin(req)) ? asId : await studentFromRequest(req);
  if (!id) return NextResponse.json({ ok: false, error: 'Sign in first' }, { status: 401 });
  const data = await readData();
  const st = data.students.find((s) => s.id === id);
  if (!st) return NextResponse.json({ ok: false }, { status: 401 });
  const all = new URL(req.url).searchParams.get('all') === '1';
  const e = entitlement({ settings: data.settings.access, isAdmin: false, student: st, invoices: data.invoices, classes: data.classes, today: istToday(), plan: planViewOf(data) });
  const [docs, mats] = await Promise.all([listDocuments(), listMaterials()]);
  const mine = new Set((st.library ?? []).map((x) => x.documentId));
  const books = docs.filter((d) => (!d.hidden || ownsBook(d, st.id)) && (all || mine.has(d.id) || ownsBook(d, st.id) || bookMatches(d, st))).map((d) => {
    const parts = buildStudyParts(d);
    const own = ownsBook(d, st.id);
    const { lockedParts, freeParts } = lockedPartsOf(d, data.settings.access.freeParts, e.full || own, e.paidParts);
    // V51.9.193: a school teacher's materials only for that school's students, replacing the AI ones they were made from
    const mySchool = st.schoolLink?.schoolId;
    const seen = mats.filter((m) => m.documentId === d.id && (!m.school || m.school === mySchool) && (!m.hidden || (m.owner?.kind === 'student' && m.owner.id === st.id)));
    const replaced = new Set(seen.filter((m) => m.school && m.basedOn).map((m) => m.basedOn!));
    const ms = seen.filter((m) => !replaced.has(m.id));
    return {
      id: d.id, fileName: d.fileName, subject: d.subject, grade: d.grade, syllabus: d.syllabus, medium: mediumOf(d), pageCount: d.pageCount, indexedAt: d.indexedAt,
      by: own ? 'You' : ownerLabel(d.owner), own, inLibrary: mine.has(d.id), matches: bookMatches(d, st), mediumMatch: !!st.medium && mediumOf(d) === st.medium,
      parts: parts.map((p) => ({ index: p.index, startPage: p.startPage, endPage: p.endPage, free: freeParts.includes(p.index) && !(e.paidParts ?? []).includes(p.index), paid: (e.paidParts ?? []).includes(p.index) /* V51.9.195: a paid part is not "free" */, locked: lockedParts.includes(p.index), materials: ms.filter((m) => partOfMaterial(m, parts) === p.index).map((m) => ({ id: m.id, type: m.type, by: m.owner?.kind === 'student' ? (m.owner.id === st.id ? 'You' : 'A student') : 'AI Guru' })) })),
      materialCount: ms.length,
    };
  }).sort((a, b) => Number(b.matches) - Number(a.matches) || Number(b.mediumMatch) - Number(a.mediumMatch) || Number(a.by !== 'AI Guru') - Number(b.by !== 'AI Guru') || b.materialCount - a.materialCount);
  const lib = data.settings.library;
  const used = mats.filter((m) => m.owner?.kind === 'student' && m.owner.id === st.id && m.owner.via === 'cloud' && istToday(Date.parse(m.createdAt)) === istToday()).length;
  return NextResponse.json({
    ok: true,
    profile: { name: st.name, standard: st.standard, syllabus: st.syllabus ?? '', medium: st.medium ?? '', full: e.full },
    options: { syllabi: SYLLABI, mediums: MEDIUMS },
    books, library: (st.library ?? []).map((x) => x.documentId),
    cloud: { allowed: false, // V51.9.187: students create with their own key only
      dailyLimit: lib.dailyLimit, left: Math.max(0, lib.dailyLimit - used) },
  }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: Request) {
  const id = await studentFromRequest(req);
  if (!id) return NextResponse.json({ ok: false, error: 'Sign in first' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b.action === 'profile') {
    const syllabus = SYLLABI.some(([v]) => v === b.syllabus) ? String(b.syllabus) : '';
    const medium = MEDIUMS.some(([v]) => v === b.medium) ? String(b.medium) : '';
    if (!syllabus || !medium) return NextResponse.json({ ok: false, error: 'Choose your syllabus and medium' }, { status: 400 });
    await update((d) => { const s = d.students.find((x) => x.id === id); if (s) { s.syllabus = syllabus; s.medium = medium; } });
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'add' || b.action === 'remove') {
    const docId = String(b.documentId ?? '');
    const doc = (await listDocuments()).find((d) => d.id === docId);
    if (b.action === 'add' && (!doc || (doc.hidden && !ownsBook(doc, id)))) return NextResponse.json({ ok: false, error: 'Book not found' }, { status: 404 });
    await update((d) => {
      const s = d.students.find((x) => x.id === id); if (!s) return;
      const list = (s.library ?? []).filter((x) => x.documentId !== docId);
      s.library = b.action === 'add' ? [...list, { documentId: docId, at: new Date().toISOString() }] : list;
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
}

