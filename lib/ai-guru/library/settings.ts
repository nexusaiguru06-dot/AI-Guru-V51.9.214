/** V51.9.95: settings of the study-material cloud (pure). */
import { isValidGeminiKey } from '@/lib/student-key';
export interface LibrarySettings {
  /** Gemini key used for creating on the cloud (server only; never sent to a browser). Empty = GEMINI_API_KEY from the server env. */
  cloudKey?: string;
  /** Students may create study materials on the AI Guru cloud (with the cloud key, no key of their own). */
  studentsMayCreate: boolean;
  /** Materials a student may create on the cloud per day. */
  dailyLimit: number;
  /** New books and materials made by students stay hidden until the admin shows them. Off = shared at once. */
  reviewStudentWork: boolean;
  /** V51.9.183: when the office uploads a textbook, make every study-material type for its free part(s) at once (on the
   *  cloud key), so every subject has a complete free trial — notes, PPT, MCQ, revision and the rest. On by default. */
  autoFreeParts?: boolean;
  /** V51.9.188: free doubt clearing in the trial — the camera / voice / typed doubt pane on the school key, for `days`
   *  from joining (the joining day is day 1) while the student is not yet enrolled; at most `perDay` sessions a day of
   *  `minutes` each. days 0 = off. After the trial, and once enrolled, doubts use the student's own key. */
  trialDoubts?: TrialDoubts;
  /** V51.9.187: the school key makes only the common study materials (office uploads, the free part). Students make
   *  materials, and clear doubts (camera, voice, typed), with their own free Gemini key. */
}
/** V51.9.189: after the trial (and for enrolled students) a student without a key still gets a smaller allowance:
 *  `afterPerDay` sessions a day of `afterMinutes` each (0 = none: their own key only). */
export interface TrialDoubts { days: number; perDay: number; minutes: number; afterPerDay: number; afterMinutes: number; /** V51.9.211: free doubt MINUTES a day for a student without their own key (0 = own key only). afterPerDay/afterMinutes are worked out from it (sessions of up to 5 minutes). */ dailyMinutes: number; /** V51.9.195: free sessions a day for ALL students together on AI Guru's key (0 = no cap) */ schoolPerDay: number }
export const DEFAULT_TRIAL_DOUBTS: TrialDoubts = { days: 7, perDay: 5, minutes: 10, afterPerDay: 2, afterMinutes: 5, dailyMinutes: 10, schoolPerDay: 200 };
export const trialDoubtsOf = (s: Pick<LibrarySettings, 'trialDoubts'>): TrialDoubts => {
  const t = { ...DEFAULT_TRIAL_DOUBTS, ...(s.trialDoubts ?? {}) };
  const d = Math.max(0, Math.round(Number(t.dailyMinutes) || 0)), chunk = Math.min(5, d || 5);
  return { ...t, dailyMinutes: d, afterMinutes: chunk, afterPerDay: d > 0 ? Math.ceil(d / chunk) : 0 }; // V51.9.211: sessions of up to 5 minutes make up the daily minutes
};

export const DEFAULT_LIBRARY: LibrarySettings = { studentsMayCreate: false, dailyLimit: 5, reviewStudentWork: false };

export const maskKey = (k?: string) => (k ? `${k.slice(0, 4)}…${k.slice(-4)}` : '');

export function cleanLibrarySettings(raw: unknown, current: LibrarySettings): LibrarySettings | string {
  const a = (raw ?? {}) as Partial<LibrarySettings> & { cloudKey?: string | null };
  const dailyLimit = Math.round(Number(a.dailyLimit ?? current.dailyLimit));
  if (!(dailyLimit >= 0 && dailyLimit <= 200)) return 'Daily limit must be between 0 and 200';
  let cloudKey = current.cloudKey;
  if (a.cloudKey === null || a.cloudKey === '') cloudKey = undefined; // removed
  else if (typeof a.cloudKey === 'string' && !a.cloudKey.includes('…')) {
    const k = a.cloudKey.trim();
    if (!isValidGeminiKey(k)) return 'That does not look like a Gemini API key';
    cloudKey = k;
  }
  // V51.9.187: students create study materials with their own key only — the school cloud is for the office
  const td = { ...trialDoubtsOf(current), ...((a.trialDoubts ?? {}) as Partial<TrialDoubts>) };
  const trialDoubts = { days: Math.round(Number(td.days)), perDay: Math.round(Number(td.perDay)), minutes: Math.round(Number(td.minutes)), afterPerDay: 0, afterMinutes: 5, dailyMinutes: Math.round(Number(td.dailyMinutes)), schoolPerDay: Math.round(Number(td.schoolPerDay)) };
  if (!(trialDoubts.dailyMinutes === 0 || (trialDoubts.dailyMinutes >= 2 && trialDoubts.dailyMinutes <= 120))) return 'Free doubt minutes a day must be 0 (own key only) or between 2 and 120';
  trialDoubts.afterMinutes = Math.min(5, trialDoubts.dailyMinutes || 5);
  trialDoubts.afterPerDay = trialDoubts.dailyMinutes > 0 ? Math.ceil(trialDoubts.dailyMinutes / trialDoubts.afterMinutes) : 0;
  if (!(trialDoubts.schoolPerDay >= 0 && trialDoubts.schoolPerDay <= 100000)) return 'Free sessions a day for everyone must be between 0 (no cap) and 1,00,000';
  if (!(trialDoubts.days >= 0 && trialDoubts.days <= 90)) return 'Trial doubt days must be between 0 and 90';
  if (!(trialDoubts.perDay >= 1 && trialDoubts.perDay <= 50)) return 'Doubt sessions a day must be between 1 and 50';
  if (!(trialDoubts.minutes >= 2 && trialDoubts.minutes <= 30)) return 'Minutes a session must be between 2 and 30';
  return { trialDoubts, cloudKey, studentsMayCreate: false, dailyLimit, reviewStudentWork: !!(a.reviewStudentWork ?? current.reviewStudentWork), autoFreeParts: (a.autoFreeParts ?? current.autoFreeParts ?? true) !== false };
}
