'use client';
/** Parent portal: this week in a few lines, ready to send on WhatsApp (English or Malayalam). */
import { useMemo, useState } from 'react';
import type { SessionRecord } from '@/lib/ai-guru/quiz/records';
import { istDay } from '@/lib/ai-guru/share/badges';
import { weeklyStats, weeklyText, type Lang } from '@/lib/ai-guru/share/weekly';

export function WeeklyPanel({ name, records }: { name: string; records: SessionRecord[] }) {
  const [lang, setLang] = useState<Lang>('en');
  const [copied, setCopied] = useState(false);
  const w = useMemo(() => weeklyStats(records, istDay(new Date().toISOString())), [records]);
  const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/ai-guru/student/signup`;
  const text = weeklyText(name.split(' ')[0] || name, w, link, lang);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt('Copy', text); } };
  return (
    <section aria-label="This week" className="space-y-3 rounded-3xl border border-emerald-400/25 bg-emerald-400/[.05] p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-extrabold">This week</h2><span className="text-xs text-slate-400">send it to family or the class group</span>
        <div className="ml-auto flex gap-1" role="group" aria-label="Language">{(['en', 'ml'] as const).map((l) => <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={`rounded-full px-3 py-1 text-xs font-extrabold ${lang === l ? 'bg-emerald-400 text-[#04121f]' : 'border border-white/15 text-slate-200'}`}>{l === 'en' ? 'English' : 'Malayalam'}</button>)}</div></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([['Quizzes', String(w.quizzes)], ['Average', w.quizzes ? `${w.avgPct}%` : '—'], ['Toffees', String(w.toffees)], ['Chillies', String(w.chillies)]] as const).map(([l, v]) => <div key={l} className="rounded-2xl border border-white/10 bg-white/[.04] p-3"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{l}</div><div className="mt-1 text-2xl font-black">{v}</div></div>)}
      </div>
      <pre className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-[#005c4b] p-4 font-sans text-sm leading-relaxed text-white">{text}</pre>
      <div className="flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-extrabold text-white">Send on WhatsApp</a>
        <button onClick={copy} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold">{copied ? 'Copied ✓' : 'Copy text'}</button>
      </div>
    </section>
  );
}
