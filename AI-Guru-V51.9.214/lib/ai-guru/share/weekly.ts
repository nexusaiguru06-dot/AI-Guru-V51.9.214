/** The weekly summary a parent can send or forward on WhatsApp. Pure: records in, text and numbers out. */
import { chilliesOf, type SessionRecord } from '../quiz/records';
import { istDay, streakOf } from './badges';

export type Lang = 'en' | 'ml';
export interface Weekly { days: number; quizzes: number; avgPct: number; toffees: number; chillies: number; redeemed: number; weak: string[]; streak: number; best: { section: string; pct: number } | null }

export function weeklyStats(records: SessionRecord[], today: string, days = 7): Weekly {
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const inWeek = records.filter((r) => istDay(r.at) >= from && istDay(r.at) <= today);
  const quizzes = inWeek.filter((r) => r.kind !== 'redo');
  const c = new Map<string, { right: number; all: number }>();
  for (const r of quizzes) for (const i of r.items) { const x = c.get(i.concept) ?? { right: 0, all: 0 }; x.all++; if (i.correct) x.right++; c.set(i.concept, x); }
  const top = [...quizzes].sort((a, b) => b.pct - a.pct)[0];
  return {
    days, quizzes: quizzes.length, avgPct: quizzes.length ? Math.round(quizzes.reduce((s, r) => s + r.pct, 0) / quizzes.length) : 0,
    toffees: inWeek.reduce((s, r) => s + r.toffees, 0), chillies: quizzes.reduce((s, r) => s + chilliesOf(r), 0), redeemed: inWeek.reduce((s, r) => s + (r.kind === 'redo' ? r.redeem?.length ?? 0 : 0), 0),
    weak: [...c.entries()].filter(([, v]) => v.all >= 2 && v.right / v.all < 0.6).sort((a, b) => a[1].right / a[1].all - b[1].right / b[1].all).slice(0, 3).map(([k]) => k),
    streak: streakOf(records, today).current, best: top ? { section: top.section || top.chapter || 'Quiz', pct: top.pct } : null,
  };
}

export function weeklyText(name: string, w: Weekly, link: string, lang: Lang): string {
  if (lang === 'ml') {
    if (!w.quizzes) return `${name} ഈ ആഴ്ച ഇതുവരെ ക്വിസ് എടുത്തിട്ടില്ല. ദിവസവും 5 മിനിറ്റ് മതി! 🍬\nAI Guru: ${link}`;
    return [`📘 ${name}ന്റെ ഈ ആഴ്ചത്തെ AI Guru റിപ്പോർട്ട്`, `• ക്വിസുകൾ: ${w.quizzes}${w.avgPct}%`, `• 🍬 ടോഫി: ${w.toffees}${w.chillies}${w.redeemed ? ` (${w.redeemed} എണ്ണം വീണ്ടും ചെയ്ത് ടോഫിയാക്കി)` : ''}`, w.streak > 1 ? `• 🔥 തുടർച്ചയായി ${w.streak} ദിവസം` : '', w.best ? `• ഏറ്റവും നല്ല ക്വിസ്: ${w.best.section} (${w.best.pct}%)` : '', w.weak.length ? `• കൂടുതൽ പരിശീലനം വേണ്ടത്: ${w.weak.join(', ')}` : '• എല്ലാ വിഷയവും നന്നായി പോകുന്നു 👏', `മലയാളത്തിൽ പഠിക്കാം, ക്വിസ് കളിക്കാം: ${link}`].filter(Boolean).join('\n');
  }
  if (!w.quizzes) return `${name} has not taken a quiz this week yet. Five minutes a day is enough! 🍬\nAI Guru: ${link}`;
  return [`📘 ${name}'s week on AI Guru`, `• Quizzes: ${w.quizzes} · average ${w.avgPct}%`, `• 🍬 Toffees: ${w.toffees}  ·  🌶️ Chillies: ${w.chillies}${w.redeemed ? ` (${w.redeemed} turned into toffees by redoing)` : ''}`, w.streak > 1 ? `• 🔥 ${w.streak}-day streak` : '', w.best ? `• Best quiz: ${w.best.section} (${w.best.pct}%)` : '', w.weak.length ? `• Needs a little more practice: ${w.weak.join(', ')}` : '• Every topic is going well 👏', `Learn in Malayalam and English, and play quizzes: ${link}`].filter(Boolean).join('\n');
}
