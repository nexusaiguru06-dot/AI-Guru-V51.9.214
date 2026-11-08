/**
 * The reward counters a student always sees: toffees (right answers, bottom left) and chillies (wrong answers, bottom right).
 * Kept per student in the browser so they show at once and work offline; the server's records (finished quizzes) are the
 * truth, so on load the counters are raised to the server total if that is higher. They never go down.
 */
export interface Rewards { toffees: number; chillies: number; /** Chillies turned into toffees by redoing a missed question. Shown chillies = chillies - redeemed. */ redeemed: number }
/** The chillies to show. */
export const shownChillies = (r: Rewards): number => Math.max(0, r.chillies - r.redeemed);
const KEY = 'ai-guru:rewards:v1:';
const EVENT = 'ai-guru:rewards';
const none = (): Rewards => ({ toffees: 0, chillies: 0, redeemed: 0 });

const clean = (v: unknown): Rewards => {
  const o = (v ?? {}) as Partial<Rewards>;
  const n = (x: unknown) => Math.max(0, Math.min(1e6, Math.round(Number(x) || 0)));
  return { toffees: n(o.toffees), chillies: n(o.chillies), redeemed: n(o.redeemed) };
};

export function readRewards(studentId: string, store: Pick<Storage, 'getItem'> | null = safe()): Rewards {
  try { return store ? clean(JSON.parse(store.getItem(KEY + studentId) || 'null')) : none(); } catch { return none(); }
}
function write(studentId: string, r: Rewards, store: Pick<Storage, 'setItem'> | null = safe()) {
  try { store?.setItem(KEY + studentId, JSON.stringify(r)); } catch { /* storage blocked: counters just show this visit */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: studentId }));
}
function safe(): Storage | null { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }

/** V51.9.117: how a reward was earned, for the celebration (the flying chilli / toffee, its sound and voice). */
export interface RewardMeta {
  /** 'ml' speaks in Malayalam when the device has a Malayalam voice. */
  lang?: 'en' | 'ml';
  /** The answer is sent to the teacher and the parent (the card says so, with the parent code). */
  reported?: boolean;
  /** No celebration (counters still move). */
  quiet?: boolean;
}
export interface RewardGain { studentId: string; toffees: number; chillies: number; redeemed: number; meta: RewardMeta }
export const REWARD_GAINED_EVENT = 'ai-guru:reward-gained';

/** A right answer adds its toffees, a wrong one adds its chilli. Returns the new totals. */
export function addReward(studentId: string, d: Partial<Rewards>, meta: RewardMeta = {}): Rewards {
  const cur = readRewards(studentId);
  const next = clean({ toffees: cur.toffees + (d.toffees ?? 0), chillies: cur.chillies + (d.chillies ?? 0), redeemed: cur.redeemed + (d.redeemed ?? 0) });
  write(studentId, next);
  // V51.9.117: every reward is celebrated (RewardCelebration, on every AI Guru page)
  const gain: RewardGain = { studentId, toffees: next.toffees - cur.toffees, chillies: next.chillies - cur.chillies, redeemed: next.redeemed - cur.redeemed, meta };
  if (!meta.quiet && (gain.toffees > 0 || gain.chillies > 0) && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<RewardGain>(REWARD_GAINED_EVENT, { detail: gain }));
  return next;
}

/** Raise the local counters to what the server has recorded (never lower them). */
export function seedRewards(studentId: string, server: Partial<Rewards>): Rewards {
  const cur = readRewards(studentId), s = clean(server);
  const next = { toffees: Math.max(cur.toffees, s.toffees), chillies: Math.max(cur.chillies, s.chillies), redeemed: Math.max(cur.redeemed, s.redeemed) };
  if (next.toffees !== cur.toffees || next.chillies !== cur.chillies || next.redeemed !== cur.redeemed) write(studentId, next);
  return next;
}

export const REWARDS_EVENT = EVENT;
