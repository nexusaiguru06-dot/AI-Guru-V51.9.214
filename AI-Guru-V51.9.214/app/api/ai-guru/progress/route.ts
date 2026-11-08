import { NextResponse } from 'next/server';
import { addRecord, readAll } from '@/lib/ai-guru/quiz/server-store';
import { rollup } from '@/lib/ai-guru/quiz/records';
import { teacherGate } from '@/lib/ai-guru/admin/auth';

export const dynamic = 'force-dynamic';

/** POST { record } — a finished quiz session. */
export async function POST(request: Request) {
  try {
    const b = await request.json();
    const rec = await addRecord(b.record);
    return rec ? NextResponse.json({ ok: true, id: rec.id }) : NextResponse.json({ ok: false, error: 'bad record' }, { status: 400 });
  } catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 }); }
}

/**
 * GET ?role=teacher            — every student (list with totals) and the latest sessions
 * GET ?role=parent&code=ABC123 — one child's sessions (the code is shown to the student)
 * V51.9.173: the teacher view needs the teacher's (or the admin's) sign-in; the parent view needs the child's code.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const all = await readAll();
  if (q.get('role') === 'parent') {
    const code = (q.get('code') || '').trim().toUpperCase();
    const mine = code ? all.filter((r) => r.code === code) : [];
    return NextResponse.json({ ok: true, ...rollup(mine), studentName: mine.at(-1)?.studentName ?? null });
  }
  const no = await teacherGate(request); if (no) return no;
  const byStudent = new Map<string, typeof all>();
  for (const r of all) byStudent.set(r.studentId, [...(byStudent.get(r.studentId) ?? []), r]);
  const students = [...byStudent.values()].map((rs) => { const t = rollup(rs); return { studentId: rs[0].studentId, code: rs[0].code, name: rs.at(-1)!.studentName, sessions: t.sessions, toffees: t.toffees, chillies: t.chillies, pct: t.pct, last: t.recent[0].at, weak: t.weak.slice(0, 3) }; }).sort((a, b) => b.last.localeCompare(a.last));
  return NextResponse.json({ ok: true, students, recent: all.slice(-60).reverse(), ...(q.get('all') === '1' ? { records: all.slice(-3000) } : {}) });
}
