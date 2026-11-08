import { NextResponse } from 'next/server';
import { bad, denied } from '../guard';
import { readData, update } from '@/lib/ai-guru/admin/store';
import { accessOf, cleanAccess, cleanParts, dueOf, istToday, pricePreview, type AccessStatus } from '@/lib/ai-guru/admin/enrolment';
import { csvOf } from '@/lib/ai-guru/admin/fees';
import { planViewOf } from '@/lib/ai-guru/admin/content-access';
import { listDocuments, listMaterials, setDocumentFreeParts } from '@/lib/ai-guru/material-studio/store';
import { buildStudyParts, freePartsOf, partOfMaterial } from '@/lib/ai-guru/material-studio/parts';

import { ensurePartBills, openedParts, partPlanOf } from '@/lib/ai-guru/admin/part-plan';
export const dynamic = 'force-dynamic';

/**
 * V51.9.93 — free part (trial) and enrolment.
 * GET               — the lock setting and school-wide free parts; every book with its ten parts (pages, materials made,
 *                     free or locked); every student with how they came in (friend / class code / coupon / direct / office),
 *                     whether they are enrolled, and what they owe or would pay; totals
 * GET ?format=csv   — the student list as a spreadsheet
 */
export async function GET(req: Request) {
  const d = await denied(req); if (d) return d;
  const data = await readData();
  const today = istToday();
  const byId = new Map(data.students.map((s) => [s.id, s]));
  const rows = data.students.map((s) => {
    const a = accessOf(s, data.invoices, data.classes, today, planViewOf(data));
    const grp = s.classId ? data.classes.find((g) => g.id === s.classId) : undefined;
    const cp = data.coupons.find((c) => c.code === s.coupon && c.active);
    const via = s.referredBy ? 'friend' : s.schoolLink ? 'school' /* V51.9.195 */ : grp ? 'class' : s.coupon ? 'coupon' : s.source === 'self' ? 'direct' : 'office';
    return {
      id: s.id, name: s.name, studentCode: s.studentCode, standard: s.standard, school: s.school ?? '', joined: s.createdAt.slice(0, 10), source: s.source ?? 'office',
      via, referredBy: s.referredBy ? { id: s.referredBy, name: byId.get(s.referredBy)?.name ?? '(removed)', code: byId.get(s.referredBy)?.referralCode } : null,
      className: grp?.name ?? null, schoolLink: s.schoolLink ? { name: s.schoolLink.schoolName, discountPct: s.schoolLink.discountPct ?? 0, teacher: s.schoolLink.teacherName ?? '' } : null,
      partsPaid: partPlanOf(data.settings.access).enabled ? openedParts(s.id, data.invoices, data.settings.access.freeParts) : null, coupon: s.coupon ?? null, signupCode: s.signupCode ?? null, enrolledNote: s.enrolled?.note ?? null, ...a,
      due: dueOf(s.id, data.invoices), price: pricePreview(data.heads, s.standard, cp).pay,
    };
  }).sort((x, y) => y.joined.localeCompare(x.joined));
  const count = (st: AccessStatus) => rows.filter((r) => r.status === st).length;
  const selfJoined = rows.filter((r) => r.source === 'self');
  const totals = { students: rows.length, free: count('free'), enrolled: count('enrolled'), pilot: count('pilot'), lapsed: count('lapsed'), selfJoined: selfJoined.length, selfPaid: selfJoined.filter((r) => r.status === 'enrolled').length, viaFriend: rows.filter((r) => r.via === 'friend').length, viaFriendPaid: rows.filter((r) => r.via === 'friend' && r.status === 'enrolled').length };
  if (new URL(req.url).searchParams.get('format') === 'csv') {
    const out = [['Student', 'Student ID', 'Std', 'School', 'Joined', 'Came through', 'Referred by', 'Class', 'Code used', 'Status', 'Enrolled on', 'Enrolled by', 'Due', 'Fee after discount']]
      .concat(rows.map((r) => [r.name, r.studentCode ?? '', r.standard, r.school, r.joined, r.via, r.referredBy?.name ?? '', r.className ?? '', r.signupCode ?? r.coupon ?? '', r.status, r.enrolledOn ?? '', r.enrolledBy ?? '', String(r.due), String(r.price)]));
    return new NextResponse(csvOf(out), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="enrolment.csv"' } });
  }
  const [docs, mats] = await Promise.all([listDocuments(), listMaterials()]);
  const books = docs.map((doc) => {
    const parts = buildStudyParts(doc);
    const free = freePartsOf(doc, data.settings.access.freeParts);
    const mine = mats.filter((m) => m.documentId === doc.id);
    return {
      id: doc.id, fileName: doc.fileName, subject: doc.subject, grade: doc.grade, pageCount: doc.pageCount, ownFreeParts: Array.isArray(doc.freeParts) ? doc.freeParts : null,
      parts: parts.map((p) => ({ index: p.index, startPage: p.startPage, endPage: p.endPage, chapters: p.chapters.map((c) => c.title).slice(0, 6), free: free.includes(p.index), materials: mine.filter((m) => partOfMaterial(m, parts) === p.index).map((m) => m.type) })),
    };
  });
  return NextResponse.json({ ok: true, today, settings: data.settings.access, rows, totals, books });
}

/**
 * POST { action: 'settings', access: { enabled, freeParts } }     lock on/off and the school-wide free parts
 *      { action: 'book', documentId, freeParts: number[] | null }  a book's own free parts (null = the school-wide ones)
 *      { action: 'enrol', studentId, note? }                       enrol without a payment (scholarship, staff child, free seat)
 *      { action: 'unenrol', studentId }                            undo a hand enrolment (a recorded payment still counts)
 */
export async function POST(req: Request) {
  const d = await denied(req); if (d) return d;
  const b = await req.json().catch(() => ({}));
  if (b.action === 'settings') {
    const a = cleanAccess(b.access);
    if (typeof a === 'string') return bad(a);
    await update((data) => { data.settings.access = a; ensurePartBills(data); }); // V51.9.191: part bills for students who need them
    return NextResponse.json({ ok: true, settings: a });
  }
  if (b.action === 'book') {
    const parts = b.freeParts === null ? undefined : cleanParts(b.freeParts);
    if (typeof parts === 'string') return bad(parts);
    const doc = await setDocumentFreeParts(String(b.documentId ?? ''), parts);
    return doc ? NextResponse.json({ ok: true, freeParts: doc.freeParts ?? null }) : bad('Book not found', 404);
  }
  const r = await update((data) => {
    const s = data.students.find((x) => x.id === b.studentId);
    if (!s) return 'Student not found';
    if (b.action === 'enrol') { s.enrolled = { on: istToday(), by: 'admin', note: String(b.note ?? '').replace(/\s+/g, ' ').trim().slice(0, 120) || undefined }; return ''; }
    if (b.action === 'unenrol') { if (s.enrolled?.by !== 'admin') return 'Only a hand enrolment can be undone; this student has a recorded payment'; delete s.enrolled; return ''; }
    return 'Unknown action';
  });
  return r ? bad(r) : NextResponse.json({ ok: true });
}
