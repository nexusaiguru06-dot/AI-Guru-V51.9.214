import { NextResponse } from 'next/server';
import { bad, denied } from '../guard';
import { readData } from '@/lib/ai-guru/admin/store';
import { csvOf } from '@/lib/ai-guru/admin/fees';
import { istToday } from '@/lib/ai-guru/admin/enrolment';
import { listDocuments, listMaterials } from '@/lib/ai-guru/material-studio/store';
import { readSessions } from '@/lib/ai-guru/attendance/server-store';
import { readLastRun, sendDueNotices } from '@/lib/ai-guru/messages/notify';
import { activityRows, affiliateRows, csvRows, dueRows, feeRows, filterOptions, matches, SHEETS, studentRows, type RegisterFilter, type Sheet } from '@/lib/ai-guru/admin/registers';

export const dynamic = 'force-dynamic';

/**
 * V51.9.184 — the office's four student-management registers.
 * GET ?sheet=students|activities|fees|affiliate&country=&state=&district=&school=&teacher=&q=  → rows + dropdown choices
 * add &format=csv to download the same rows as a spreadsheet.
 */
export async function GET(req: Request) {
  const d = await denied(req); if (d) return d;
  const q = new URL(req.url).searchParams;
  const sheet = q.get('sheet') as Sheet;
  if (!SHEETS.includes(sheet)) return bad('Choose a register: students, activities, fees or affiliate');
  const f: RegisterFilter = { country: q.get('country') || '', state: q.get('state') || '', district: q.get('district') || '', school: q.get('school') || '', teacher: q.get('teacher') || '', q: (q.get('q') || '').trim().slice(0, 60) };
  const data = await readData();
  const inScope = (s: (typeof data.students)[number]) => matches(s, f, data.classes);
  const students = data.students.filter(inScope);
  let rows: unknown[];
  if (sheet === 'students') rows = studentRows(students, data.classes);
  else if (sheet === 'fees') rows = feeRows(students, data.invoices);
  else if (sheet === 'affiliate') rows = affiliateRows(data.students, data.invoices, istToday(), inScope);
  else if (sheet === 'dues') {
    // V51.9.185: opening "Fees due" also sends any reminders that are due (each bill and stage only once)
    if (q.get('format') !== 'csv') await sendDueNotices(data, istToday()).catch(() => 0);
    rows = dueRows(students, data.invoices, [...data.yearly, ...data.monthly], istToday(), data.settings.plans.graceDays, data.classes);
  }
  else {
    const [docs, mats, attendance] = await Promise.all([listDocuments(), listMaterials(), readSessions()]);
    const books = new Map(docs.map((x) => [x.id, x.fileName || x.id]));
    const created = mats.filter((m) => m.owner?.kind === 'student' && m.owner.id).map((m) => ({ ownerStudentId: m.owner!.id!, createdAt: m.createdAt, type: String(m.type), title: m.title || books.get(m.documentId) || '' }));
    rows = activityRows(students, { books, created, attendance });
  }
  if (q.get('format') === 'csv') {
    return new NextResponse(csvOf(csvRows(sheet, rows)), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="ai-guru-${sheet}-${istToday()}.csv"` } });
  }
  // V51.9.186: on Fees due, when the daily reminder run last happened (null: not set up yet — reminders then go only when pages are opened)
  const daily = sheet === 'dues' ? await readLastRun() : undefined;
  return NextResponse.json({ ok: true, sheet, filter: f, options: filterOptions(data.students, data.classes, f), count: rows.length, rows, ...(sheet === 'dues' ? { daily: daily ?? null } : {}) });
}
