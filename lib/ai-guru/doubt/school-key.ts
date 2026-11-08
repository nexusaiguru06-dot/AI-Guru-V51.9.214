/**
 * V51.9.188 — free doubt clearing in the trial, on the school's (app) key, with limits.
 *
 * Doubts normally use the student's own free Gemini key. During the trial — the first `days` after joining (the joining
 * day is day 1), while the student is not yet enrolled — a signed-in student without a key can still use the camera,
 * voice and typed doubt pane: the server gives the browser a one-use Gemini Live token, good for one session of at most
 * `minutes`, and at most `perDay` sessions a day (the office sets all three). The school's key itself never leaves the
 * server. A student who has their own key uses it first. After the trial, it is the smaller daily allowance (or their own key). V51.9.195: paying does not end the trial early.
 */
import { docs } from '../storage';
import { addDays } from '../admin/plans';
import { istToday } from '../admin/enrolment';
import { trialDoubtsOf, type TrialDoubts, type LibrarySettings } from '../library/settings';
import { partPlanOf, type PartPlan } from '../admin/part-plan';

/**
 * V51.9.195 — one trial. When paying by part is on, the free doubt trial is the part plan's free trial (same days, same
 * last day), so the two can never drift apart. Paying does not cut the trial short.
 */
export function doubtLimitsOf(s: { library: Pick<LibrarySettings, 'trialDoubts'>; access: { partPlan?: Partial<PartPlan> } }): TrialDoubts {
  const t = trialDoubtsOf(s.library);
  const plan = partPlanOf(s.access);
  return plan.enabled ? { ...t, days: plan.trialDays } : t;
}

export interface DoubtWindow {
  /** Trial days the office allows (0 = off). */
  days: number;
  /** Which day this is since joining (1 = the joining day). */
  dayNo: number;
  /** Trial days still left, today included (0 when over). */
  left: number;
  /** The last trial day. */
  until: string;
  /** Enrolled students use their own key. */
  enrolled: boolean;
  open: boolean;
}

const between = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** Pure: where this student stands. `joinedAt` is an ISO time; days are India days. */
export function doubtWindow(joinedAt: string, days: number, today: string, enrolled = false): DoubtWindow {
  const joined = istToday(Date.parse(joinedAt) || Date.now());
  const dayNo = Math.max(1, between(joined, today) + 1);
  const n = Math.max(0, Math.floor(days || 0));
  const inDays = n > 0 && dayNo <= n;
  const open = inDays; // V51.9.195: enrolling or paying no longer ends the free trial early
  return { days: n, dayNo, left: inDays ? n - dayNo + 1 : 0, until: n > 0 ? addDays(joined, n - 1) : joined, enrolled, open };
}

const DIR = 'data/ai-guru/doubt/school-sessions';
const fileOf = (id: string) => `${DIR}/${id.replace(/[^a-z0-9_-]/gi, '')}.json`;

/** Sessions used today. */
export async function usedToday(studentId: string, today: string): Promise<number> {
  const cur = await docs.get<{ date: string; count: number }>(fileOf(studentId));
  return cur && cur.date === today ? cur.count : 0;
}

/** V51.9.195: gives back a session that could not start (the token was not made), so a failure does not use the allowance. */
export async function untakeSession(studentId: string, today: string): Promise<void> {
  await drop(fileOf(studentId), today);
  await drop(ALL, today);
}

const ALL = `${DIR}/_all.json`;
const minFile = (id: string) => `${DIR}/min-${id.replace(/[^a-z0-9_-]/gi, '')}.json`;

/** V51.9.211: minutes of free doubt clearing used today (after the trial: the office sets `dailyMinutes`). */
export async function minutesUsedToday(studentId: string, today: string): Promise<number> {
  const cur = await docs.get<{ date: string; minutes: number }>(minFile(studentId));
  return cur && cur.date === today ? cur.minutes : 0;
}

/**
 * Takes the next slice (at most `chunk` minutes) of the student's daily minutes. Returns the minutes granted (0 = used up),
 * or 'all' when AI Guru's key has given all its free sessions for the day to all students together.
 */
export async function takeMinutes(studentId: string, today: string, dailyMinutes: number, chunk: number, schoolPerDay = 0): Promise<number | 'all'> {
  const granted = await docs.update<{ date: string; minutes: number }, number>(minFile(studentId), (cur) => {
    const used = cur && cur.date === today ? cur.minutes : 0;
    const g = Math.min(chunk, dailyMinutes - used);
    if (g <= 0) return { value: cur ?? undefined, result: 0 };
    return { value: { date: today, minutes: used + g }, result: g };
  });
  if (granted <= 0) return 0;
  if (!(await bump(ALL, today, schoolPerDay))) { await giveBackMinutes(studentId, today, granted); return 'all'; }
  return granted;
}
export const giveBackMinutes = async (studentId: string, today: string, g: number) => {
  await docs.update<{ date: string; minutes: number }, null>(minFile(studentId), (cur) => ({ value: cur && cur.date === today ? { date: today, minutes: Math.max(0, cur.minutes - g) } : cur ?? undefined, result: null }));
  await drop(ALL, today);
};
const bump = (file: string, today: string, cap: number) => docs.update<{ date: string; count: number }, boolean>(file, (cur) => {
  const count = cur && cur.date === today ? cur.count : 0;
  if (cap > 0 && count >= cap) return { value: cur ?? undefined, result: false };
  return { value: { date: today, count: count + 1 }, result: true };
});
const drop = (file: string, today: string) => docs.update<{ date: string; count: number }, null>(file, (cur) => ({
  value: cur && cur.date === today ? { date: today, count: Math.max(0, cur.count - 1) } : cur ?? undefined, result: null,
}));

/**
 * Counts one session for today: 'ok', 'mine' when this student's allowance is used up, or 'all' when AI Guru's key has
 * given its free sessions for the day to all students together (V51.9.195, `schoolPerDay`; 0 = no cap).
 */
export async function takeSession(studentId: string, today: string, perDay: number, schoolPerDay = 0): Promise<'ok' | 'mine' | 'all'> {
  if (perDay <= 0 || !(await bump(fileOf(studentId), today, perDay))) return 'mine';
  if (schoolPerDay > 0 && !(await bump(ALL, today, schoolPerDay))) { await drop(fileOf(studentId), today); return 'all'; }
  if (schoolPerDay <= 0) await bump(ALL, today, 0); // still counted, for the office
  return 'ok';
}

type Mint = (key: string, minutes: number) => Promise<string>;
/** A one-use Gemini Live token from the school key: the session must start within 1 minute and ends after `minutes`. */
const googleMint: Mint = async (key, minutes) => {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: 'v1alpha' } });
  const now = Date.now();
  const t = await ai.authTokens.create({ config: { uses: 1, expireTime: new Date(now + minutes * 60_000).toISOString(), newSessionExpireTime: new Date(now + 60_000).toISOString(), httpOptions: { apiVersion: 'v1alpha' } } });
  if (!t.name) throw new Error('Google did not return a token');
  return t.name;
};
let mint: Mint = googleMint;
/** Tests replace the call to Google. */
export const setMint = (m: Mint | null) => { mint = m ?? googleMint; };
export const mintToken = (key: string, limits: Pick<TrialDoubts, 'minutes'>) => mint(key, limits.minutes);
export type { TrialDoubts };
