/**
 * Leaderboards that reward effort and improvement, not only the highest score, so weaker students are never shut out.
 * Points for the last 7 days (Indian time):
 *   effort       10 per quiz (at most 10 quizzes count)
 *   improvement  half of the rise in average score over the 4 weeks before (at most 25)
 *   redo         5 per chilli turned into a toffee
 *   streak       3 per day of the current streak (at most 7 days)
 */
import { type SessionRecord } from '../quiz/records';
import { istDay, streakOf } from './badges';

export interface Member { id: string; name: string }
export interface Row { id: string; name: string; short: string; points: number; quizzes: number; improvement: number; streak: number; rank: number }

const day = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/** "Anjali Menon" → "Anjali M." — what other students see. */
export const shortName = (n: string) => { const p = n.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || 'Student'; };

export function weekPoints(records: SessionRecord[], today: string): Omit<Row, 'id' | 'name' | 'short' | 'rank'> {
  const from = day(today, -6), prevFrom = day(today, -34);
  const quizzes = records.filter((r) => r.kind !== 'redo');
  const now = quizzes.filter((r) => istDay(r.at) >= from && istDay(r.at) <= today);
  const before = quizzes.filter((r) => istDay(r.at) >= prevFrom && istDay(r.at) < from);
  const avg = (rs: SessionRecord[]) => rs.reduce((s, r) => s + r.pct, 0) / rs.length;
  const improvement = now.length && before.length ? Math.max(0, Math.min(25, Math.round((avg(now) - avg(before)) / 2))) : 0;
  const redeemed = records.filter((r) => r.kind === 'redo' && istDay(r.at) >= from && istDay(r.at) <= today).reduce((s, r) => s + (r.redeem?.length ?? 0), 0);
  const streak = streakOf(records, today).current;
  return { quizzes: now.length, improvement, streak, points: Math.min(now.length, 10) * 10 + improvement + redeemed * 5 + Math.min(streak, 7) * 3 };
}

/** Members ranked by points (ties share a rank; equal points sort by name). */
export function leaderboard(members: Member[], records: SessionRecord[], today: string): Row[] {
  const rows = members.map((m) => ({ id: m.id, name: m.name, short: shortName(m.name), ...weekPoints(records.filter((r) => r.studentId === m.id), today) }));
  rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  let rank = 0, prev = -1;
  return rows.map((r, i) => { if (r.points !== prev) { rank = i + 1; prev = r.points; } return { ...r, rank }; });
}

export interface SchoolRow { school: string; members: number; active: number; avgPoints: number; rank: number }
/** Schools ranked by the average points of ALL their students (so a big school does not win just by being big). Needs 3 students. */
export function schoolBoard(students: Array<Member & { school: string }>, records: SessionRecord[], today: string, minMembers = 3): SchoolRow[] {
  const by = new Map<string, Row[]>();
  for (const s of students) { const k = s.school.trim(); if (!k) continue; by.set(k, [...(by.get(k) ?? []), { id: s.id, name: s.name, short: '', rank: 0, ...weekPoints(records.filter((r) => r.studentId === s.id), today) }]); }
  const rows = [...by.entries()].filter(([, r]) => r.length >= minMembers).map(([school, r]) => ({ school, members: r.length, active: r.filter((x) => x.quizzes > 0).length, avgPoints: Math.round((r.reduce((s, x) => s + x.points, 0) / r.length) * 10) / 10 }));
  rows.sort((a, b) => b.avgPoints - a.avgPoints || a.school.localeCompare(b.school));
  let rank = 0, prev = -1;
  return rows.map((r, i) => { if (r.avgPoints !== prev) { rank = i + 1; prev = r.avgPoints; } return { ...r, rank }; });
}
