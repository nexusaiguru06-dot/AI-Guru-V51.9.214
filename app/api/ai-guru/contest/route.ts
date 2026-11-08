import { NextResponse } from 'next/server';
import { studentFromRequest } from '@/lib/ai-guru/admin/auth';
import { readData } from '@/lib/ai-guru/admin/store';
import { shortName } from '@/lib/ai-guru/share/leaderboard';
import { CONTESTS, activeContests, contestYear } from '@/lib/ai-guru/public/contests';
import { addEntry, ranked, readEntries } from '@/lib/ai-guru/public/contest-store';
import { istToday } from '@/lib/ai-guru/public/daily';

export const dynamic = 'force-dynamic';

/** GET ?contest=<id>&year=<yyyy> — the top 10 (first name + last initial) and, for a signed-in student, their own place. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get('contest') ?? '', year = Number(q.get('year') ?? contestYear(istToday()));
  if (!CONTESTS.some((c) => c.id === id)) return NextResponse.json({ ok: false, error: 'No such contest' }, { status: 404 });
  const me = await studentFromRequest(req);
  const rows = ranked((await readEntries()).filter((e) => e.contest === id && e.year === year));
  const mine = rows.find((r) => r.studentId === me);
  return NextResponse.json({ ok: true, entries: rows.length, top: rows.slice(0, 10).map((r) => ({ rank: r.rank, short: shortName(r.name), school: r.school, correct: r.correct, seconds: r.seconds, you: r.studentId === me })), mine: mine ? { rank: mine.rank } : null });
}

/** POST { contest, correct, seconds } — a signed-in student enters. Only while the contest is open; one entry each (the best counts). */
export async function POST(req: Request) {
  const me = await studentFromRequest(req);
  if (!me) return NextResponse.json({ ok: false, error: 'Sign in to enter the contest' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const today = istToday();
  const c = activeContests(today).find((x) => x.id === b.contest);
  if (!c) return NextResponse.json({ ok: false, error: 'This contest is not open now' }, { status: 409 });
  const correct = Math.floor(Number(b.correct)), seconds = Math.round(Number(b.seconds));
  if (!(correct >= 0 && correct <= c.questions.length) || !(seconds >= 3 && seconds <= 3600)) return NextResponse.json({ ok: false, error: 'That result is not valid' }, { status: 400 });
  const st = (await readData()).students.find((s) => s.id === me);
  if (!st) return NextResponse.json({ ok: false }, { status: 401 });
  const result = await addEntry({ contest: c.id, year: contestYear(today), studentId: me, name: st.name, school: st.school ?? '', correct, seconds, at: new Date().toISOString() });
  const rows = ranked((await readEntries()).filter((e) => e.contest === c.id && e.year === contestYear(today)));
  return NextResponse.json({ ok: true, result, rank: rows.find((r) => r.studentId === me)?.rank ?? null, entries: rows.length });
}
