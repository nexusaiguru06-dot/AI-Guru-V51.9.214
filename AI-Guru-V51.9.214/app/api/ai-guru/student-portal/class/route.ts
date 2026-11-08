import { NextResponse } from 'next/server';
import { studentFromRequest } from '@/lib/ai-guru/admin/auth';
import { readData } from '@/lib/ai-guru/admin/store';
import { readAll } from '@/lib/ai-guru/quiz/server-store';
import { istDay } from '@/lib/ai-guru/share/badges';
import { leaderboard, schoolBoard } from '@/lib/ai-guru/share/leaderboard';

export const dynamic = 'force-dynamic';

/** GET — the signed-in student's class board (first name + last initial only) and where their school stands. */
export async function GET(req: Request) {
  const id = await studentFromRequest(req);
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  const data = await readData();
  const me = data.students.find((s) => s.id === id);
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const records = await readAll(), today = istDay(new Date().toISOString());
  const qid = (s: typeof me) => s.quizId ?? `student:${s.id}`;
  const g = me.classId ? data.classes.find((x) => x.id === me.classId) : undefined;
  let cls = null;
  if (g) {
    const board = leaderboard(data.students.filter((s) => s.classId === g.id).map((s) => ({ id: qid(s), name: s.name })), records, today);
    const mine = board.find((r) => r.id === qid(me));
    cls = { serial: me.classSerial ?? null, name: g.name, teacher: g.teacherName || undefined, kind: g.kind, size: board.length, mine: mine ? { rank: mine.rank, points: mine.points } : null, top: board.slice(0, 5).map((r) => ({ short: r.short, points: r.points, rank: r.rank, you: r.id === qid(me) })) };
  }
  const sb = schoolBoard(data.students.map((s) => ({ id: qid(s), name: s.name, school: s.school ?? '' })), records, today);
  const mySchool = (me.school ?? '').trim();
  const row = sb.find((r) => r.school === mySchool);
  return NextResponse.json({ ok: true, class: cls, school: row ? { name: row.school, rank: row.rank, of: sb.length, members: row.members } : null, schoolTop: sb.slice(0, 5) });
}
