import type { AdminData } from './store';
import type { ClassGroup } from './groups';
import { membersOf, tierProgress } from './groups';
import { leaderboard } from '../share/leaderboard';
import type { SessionRecord } from '../quiz/records';

/** Everything the admin and the teacher see about one class or centre (the key hash is never included). */
export function groupView(g: ClassGroup, data: AdminData, records: SessionRecord[], today: string) {
  const ms = membersOf(g, data.students);
  const board = leaderboard(ms.map((s) => ({ id: s.quizId ?? `student:${s.id}`, name: s.name })), records, today);
  const { key: _k, ...rest } = g;
  const pilotActive = !!g.pilotUntil && g.pilotUntil >= today;
  return { ...rest, joined: ms.length, activeThisWeek: board.filter((r) => r.quizzes > 0).length, tiers: tierProgress(ms.length, data.settings.groups.tiers, g.rewardsGiven), pilotActive, board };
}
