/** Streaks, badges and the printable certificate. Pure functions over a student's session records. Days are Indian time (IST). */
import { chilliesOf, rollup, type SessionRecord } from '../quiz/records';

export const istDay = (iso: string): string => new Date(Date.parse(iso) + 19_800_000).toISOString().slice(0, 10);
const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Days in a row with at least one quiz. The streak is still alive today if the last quiz was yesterday. */
export function streakOf(records: SessionRecord[], today: string): { current: number; best: number; days: number } {
  const days = new Set(records.filter((r) => r.kind !== 'redo').map((r) => istDay(r.at)));
  let current = 0;
  let d = days.has(today) ? today : addDays(today, -1);
  while (days.has(d)) { current++; d = addDays(d, -1); }
  let best = 0, run = 0, prev = '';
  for (const x of [...days].sort()) { run = prev && addDays(prev, 1) === x ? run + 1 : 1; best = Math.max(best, run); prev = x; }
  return { current, best, days: days.size };
}

export interface Stats { quizzes: number; toffees: number; perfect: number; bestStreak: number; redeemed: number }
export function statsOf(records: SessionRecord[], today: string): Stats {
  const t = rollup(records);
  const quizzes = records.filter((r) => r.kind !== 'redo');
  return { quizzes: t.sessions, toffees: t.toffees, perfect: quizzes.filter((r) => r.total >= 3 && r.correct === r.total).length, bestStreak: streakOf(records, today).best, redeemed: t.redeemed };
}

interface Def { id: string; icon: string; en: string; ml: string; goal: number; stat: keyof Stats; hintEn: string; hintMl: string }
export const BADGES: Def[] = [
  { id: 'first', icon: '🌱', en: 'First quiz', ml: 'ആദ്യ ക്വിസ്', goal: 1, stat: 'quizzes', hintEn: 'Finish your first quiz', hintMl: 'ആദ്യ ക്വിസ് പൂർത്തിയാക്കൂ' },
  { id: 'quiz5', icon: '📚', en: 'Quiz explorer', ml: 'ക്വിസ് പര്യവേക്ഷകൻ', goal: 5, stat: 'quizzes', hintEn: 'Finish 5 quizzes', hintMl: '5 ക്വിസ് പൂർത്തിയാക്കൂ' },
  { id: 'quiz25', icon: '🏫', en: 'Quiz champion', ml: 'ക്വിസ് ചാമ്പ്യൻ', goal: 25, stat: 'quizzes', hintEn: 'Finish 25 quizzes', hintMl: '25 ക്വിസ് പൂർത്തിയാക്കൂ' },
  { id: 'toffee50', icon: '🍬', en: '50 toffees', ml: '50 ടോഫി', goal: 50, stat: 'toffees', hintEn: 'Earn 50 toffees', hintMl: '50 ടോഫി നേടൂ' },
  { id: 'toffee100', icon: '🏅', en: '100 toffees', ml: '100 ടോഫി', goal: 100, stat: 'toffees', hintEn: 'Earn 100 toffees', hintMl: '100 ടോഫി നേടൂ' },
  { id: 'toffee250', icon: '🏆', en: '250 toffees', ml: '250 ടോഫി', goal: 250, stat: 'toffees', hintEn: 'Earn 250 toffees', hintMl: '250 ടോഫി നേടൂ' },
  { id: 'perfect', icon: '🎯', en: 'Perfect box', ml: 'പെർഫെക്റ്റ് ബോക്സ്', goal: 1, stat: 'perfect', hintEn: 'Get every answer right in a quiz', hintMl: 'ഒരു ക്വിസിൽ എല്ലാം ശരിയാക്കൂ' },
  { id: 'streak3', icon: '🔥', en: '3-day streak', ml: '3 ദിവസം തുടർച്ച', goal: 3, stat: 'bestStreak', hintEn: 'Take a quiz 3 days in a row', hintMl: 'തുടർച്ചയായി 3 ദിവസം ക്വിസ് എടുക്കൂ' },
  { id: 'streak7', icon: '⚡', en: '7-day streak', ml: '7 ദിവസം തുടർച്ച', goal: 7, stat: 'bestStreak', hintEn: 'Take a quiz 7 days in a row', hintMl: 'തുടർച്ചയായി 7 ദിവസം ക്വിസ് എടുക്കൂ' },
  { id: 'comeback', icon: '🌶️', en: 'Chilli master', ml: 'മുളക് മാസ്റ്റർ', goal: 5, stat: 'redeemed', hintEn: 'Turn 5 chillies into toffees by redoing questions', hintMl: 'ചോദ്യം വീണ്ടും ചെയ്ത് 5 മുളക് ടോഫിയാക്കൂ' },
];

export interface BadgeState { id: string; icon: string; en: string; ml: string; hintEn: string; hintMl: string; goal: number; value: number; earned: boolean }
export function badgesOf(records: SessionRecord[], today: string): { badges: BadgeState[]; stats: Stats; streak: ReturnType<typeof streakOf> } {
  const stats = statsOf(records, today);
  return { stats, streak: streakOf(records, today), badges: BADGES.map((b) => ({ id: b.id, icon: b.icon, en: b.en, ml: b.ml, hintEn: b.hintEn, hintMl: b.hintMl, goal: b.goal, value: Math.min(stats[b.stat], b.goal), earned: stats[b.stat] >= b.goal })) };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** A printable certificate (open in a new window and print). */
export function certificateHtml(o: { name: string; title: string; line: string; date: string; school?: string }): string {
  return `<!doctype html><meta charset="utf-8"><title>Certificate</title><style>@page{size:A4 landscape;margin:0}body{margin:0;font-family:Georgia,'Noto Serif Malayalam',serif;color:#14213d}.c{margin:14mm;border:6px double #c8860a;height:calc(100vh - 28mm);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 24mm;box-sizing:border-box}h1{font-size:44px;margin:0;color:#c8860a;letter-spacing:2px}h2{font-size:38px;margin:18px 0 6px}p{font-size:20px;margin:8px 0}.b{font-size:30px;font-weight:700;margin:14px 0;color:#b3120f}small{color:#555;font-size:15px}</style><div class="c"><h1>CERTIFICATE</h1><p>This is proudly given to</p><h2>${esc(o.name)}</h2><p>${esc(o.line)}</p><div class="b">${esc(o.title)}</div><p>${esc(o.school ?? '')}</p><small>AI Guru · ${esc(o.date)}</small></div><script>setTimeout(function(){window.print()},300)</script>`;
}
export { chilliesOf };
