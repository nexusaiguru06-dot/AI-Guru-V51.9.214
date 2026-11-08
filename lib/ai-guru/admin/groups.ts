/**
 * Classes and tuition centres. Each has a join code (it is also a coupon, so a student who joins with it gets the group's
 * discount and is counted for the teacher) and a private teacher key (6 digits) that opens the teacher's class page.
 * Teachers earn rewards as more students join (tiers set by the admin). Pure rules, no I/O.
 */
import { referralCodeFor } from './affiliate';
import type { Coupon, Student } from './fees';

export interface RewardTier { at: number; reward: string }
export interface GroupSettings { discountPct: number; tiers: RewardTier[] }
export const DEFAULT_GROUPS: GroupSettings = { discountPct: 10, tiers: [{ at: 10, reward: 'A thank-you gift for the teacher' }, { at: 25, reward: 'A thank-you gift for the teacher and a class certificate' }, { at: 50, reward: 'A thank-you gift for the teacher and a school thank-you plaque' }] };

export interface ClassGroup {
  id: string; kind: 'class' | 'centre'; name: string; code: string;
  /** TE-34-26: the teacher's own number (one per teacher, shared by all their classes). */
  teacherCode?: string;
  /** Last roll number given in this class (1, 2, 3 …, never reused). */
  serialCounter?: number;
  teacherName: string; teacherPhone?: string; school?: string; standard?: string;
  createdAt: string; active: boolean; discountPct: number;
  /** Hash of the teacher's private key (the key itself is shown once, when it is made). */
  key: { salt: string; hash: string };
  /** Tuition centre pilot: free until this date. */
  pilotUntil?: string; testimonial?: string;
  /** Tiers (`at` values) already given to the teacher. */
  rewardsGiven: number[];
}

export const groupCodeFor = (name: string, taken: Set<string>, rand?: () => number) => referralCodeFor(name, taken, rand);
export const groupCoupon = (g: ClassGroup): Coupon => ({ code: g.code, kind: 'percent', value: g.discountPct, used: 0, active: g.active, note: `${g.kind === 'centre' ? 'Centre' : 'Class'} code of ${g.name}`, ownerClassId: g.id });

export const membersOf = (g: Pick<ClassGroup, 'id'>, students: Student[]) => students.filter((s) => s.classId === g.id);

export interface TierState { at: number; reward: string; status: 'given' | 'earned' | 'locked'; left: number }
/** Where the teacher stands: `earned` = reached but not yet given by the admin. */
export function tierProgress(joined: number, tiers: RewardTier[], given: number[]): { tiers: TierState[]; next: TierState | null } {
  const ts = [...tiers].sort((a, b) => a.at - b.at).map((t): TierState => ({ ...t, left: Math.max(0, t.at - joined), status: given.includes(t.at) ? 'given' : joined >= t.at ? 'earned' : 'locked' }));
  return { tiers: ts, next: ts.find((t) => t.status === 'locked') ?? null };
}

/** Checks tiers from the settings form. */
export function cleanTiers(raw: unknown): RewardTier[] | string {
  if (!Array.isArray(raw)) return 'Reward tiers must be a list';
  const out = raw.slice(0, 8).map((t) => ({ at: Math.round(Number((t as RewardTier)?.at)), reward: String((t as RewardTier)?.reward ?? '').replace(/\s+/g, ' ').trim().slice(0, 120) }));
  if (out.some((t) => !(t.at >= 1 && t.at <= 5000) || !t.reward)) return 'Each reward needs a student count (1 to 5000) and a description';
  if (new Set(out.map((t) => t.at)).size !== out.length) return 'Two rewards cannot have the same student count';
  return out.sort((a, b) => a.at - b.at);
}

/** The text version of a poster/message that invites students into a group. */
export const inviteText = (g: Pick<ClassGroup, 'name' | 'kind'>, link: string) => `Join ${g.name} on AI Guru: free lessons in Malayalam and English, quizzes with toffees, and a fee discount with this link: ${link}`;
