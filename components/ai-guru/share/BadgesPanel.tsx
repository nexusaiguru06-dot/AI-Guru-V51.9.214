'use client';
import { certificateHtml, type BadgeState } from '@/lib/ai-guru/share/badges';

/** Streak flame and the badge shelf. Earned badges are lit; the rest show how far to go. Earned ones can be printed as a certificate. */
export function BadgesPanel({ badges, streak, name, school }: { badges: BadgeState[]; streak: { current: number; best: number }; name: string; school?: string }) {
  const earned = badges.filter((b) => b.earned).length;
  const cert = (b: BadgeState) => { const w = window.open('', '_blank', 'width=1000,height=700'); if (!w) return; w.document.write(certificateHtml({ name, title: `${b.icon} ${b.en}`, line: 'for earning the badge', date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), school })); w.document.close(); };
  return (
    <section aria-label="Streak and badges" className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-extrabold">Streak &amp; badges</h2>
        <span className="rounded-full bg-orange-400/15 px-3 py-1 text-sm font-extrabold text-orange-300" title="Days in a row with a quiz">🔥 {streak.current} day{streak.current === 1 ? '' : 's'} <span className="font-normal text-orange-200/70">· best {streak.best}</span></span>
        <span className="text-xs text-slate-400">{earned} of {badges.length} badges</span>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {badges.map((b) => (
          <li key={b.id} className={`rounded-2xl border p-3 text-center ${b.earned ? 'border-amber-300/50 bg-amber-400/10' : 'border-white/10 bg-white/[.03]'}`}>
            <div className={`text-3xl ${b.earned ? '' : 'opacity-30 grayscale'}`} aria-hidden>{b.icon}</div>
            <div className={`mt-1 text-sm font-extrabold ${b.earned ? 'text-amber-200' : 'text-slate-300'}`}>{b.en}</div>
            {b.earned ? <button onClick={() => cert(b)} className="mt-2 rounded-lg border border-amber-300/40 px-2 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-300/10">Certificate</button>
              : <><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={b.value} aria-valuemax={b.goal} aria-label={b.en}><div className="h-full rounded-full bg-cyan-400/70" style={{ width: `${(b.value / b.goal) * 100}%` }} /></div><div className="mt-1 text-[10px] text-slate-500">{b.value}/{b.goal} · {b.hintEn}</div></>}
          </li>))}
      </ul>
    </section>
  );
}
