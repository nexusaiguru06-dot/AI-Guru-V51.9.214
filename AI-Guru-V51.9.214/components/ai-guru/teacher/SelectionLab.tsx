'use client';
import { useMemo, useState } from 'react';
import { DNAS, DNA_BY_ID, selectDna } from '@/lib/ai-guru/motion-class/dna/registry';
import { allPins, pinnedDna, removePin, setPin } from '@/lib/ai-guru/motion-class/dna/teacher-dna';
import { learnedDnas } from '@/lib/ai-guru/motion-class/dna/learned';
import { problemBlock } from '@/lib/ai-guru/teacher/make-video';
import { pushTeacherDna } from '@/lib/ai-guru/teacher/sync';

const SAMPLES = ['Solve the pair of equations 2x + 3y = 12 and x − y = 1.', 'Find the HCF and LCM of 12 and 18.', 'The sum of the first 20 terms of the arithmetic sequence 3, 7, 11, … is to be found.', 'A bag has 3 red and 5 blue balls. One ball is drawn at random. Find the probability that it is red.', 'Find the area of a circle of radius 7 cm.'];

export const dnaLabel = (id: string): string => {
  if (id.startsWith('learned:')) return learnedDnas().find((l) => l.id === id.slice(8))?.name ?? id;
  return DNA_BY_ID.get(id)?.name ?? id;
};

/** "Which template will teach this problem?" — the same selector the classroom uses, shown with its reasons. */
export function SelectionLab({ version, onChange }: { version: number; onChange: () => void }) {
  const [text, setText] = useState(SAMPLES[0]);
  const [choice, setChoice] = useState('');
  const res = useMemo(() => (text.trim().length > 5 ? selectDna(problemBlock(text, 0), 'Teacher') : null), [text, version]);
  const pinned = text.trim() ? pinnedDna(text) : undefined;
  const options = useMemo(() => [...learnedDnas().map((l) => ({ id: `learned:${l.id}`, name: `${l.source === 'teacher-video' ? '🎬 ' : '✨ '}${l.name}` })), ...DNAS.filter((d) => !['bridge', 'section-intro', 'chapter-intro'].includes(d.id as string)).map((d) => ({ id: d.id as string, name: d.name }))], [version]);
  const apply = async () => { if (!choice) return; setPin(text, choice); onChange(); await pushTeacherDna(); };
  const clear = async () => { removePin(text); onChange(); await pushTeacherDna(); };
  const auto = res?.ranked[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <section className="space-y-3">
        <label className="block text-sm font-bold text-slate-300">A problem from your lesson
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 p-3 text-base outline-none focus:border-cyan-400" />
        </label>
        <div className="flex flex-wrap gap-2">{SAMPLES.map((s) => <button key={s} onClick={() => setText(s)} className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300 hover:bg-white/5">{s.slice(0, 34)}…</button>)}</div>
        <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
          <h3 className="font-extrabold">Choose the template yourself</h3>
          <p className="mt-1 text-xs text-slate-400">Your choice wins over the automatic one, in every class that has this exact problem.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Template" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#0b1426] px-3 py-2.5 text-sm">
              <option value="">Pick a template…</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <button onClick={apply} disabled={!choice || text.trim().length < 6} className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-extrabold text-[#04121f] disabled:opacity-40">Use it</button>
            {pinned && <button onClick={clear} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold">Back to automatic</button>}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {!res && <p className="text-slate-400">Type or paste a problem to see which template teaches it.</p>}
        {res && (
          <>
            <div className={`rounded-2xl border p-4 ${pinned ? 'border-amber-300/50 bg-amber-400/10' : 'border-emerald-400/40 bg-emerald-500/10'}`}>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{pinned ? 'Your choice' : 'Automatic choice'}</div>
              <div className="mt-1 text-xl font-extrabold">{dnaLabel(res.dna)}</div>
              <p className="mt-1 text-sm text-slate-300">{pinned ? 'You chose this template for this problem.' : res.needsAi ? 'No ready template fits this problem well. The AI will put one together from the drawing parts (or draw a free sketch).' : `Score ${res.score.toFixed(2)}: ${res.reason}.`}</p>
              {pinned && auto && <p className="mt-1 text-xs text-slate-400">The automatic choice would have been {dnaLabel(auto.id)} ({auto.score.toFixed(2)}).</p>}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
              <h3 className="mb-3 text-sm font-extrabold">How the templates scored</h3>
              {res.ranked.length === 0 && <p className="text-sm text-slate-400">No template matched any word of this problem.</p>}
              <ul className="space-y-2">{res.ranked.slice(0, 8).map((r) => (
                <li key={r.id} className="text-sm">
                  <div className="flex justify-between gap-3"><span className="truncate">{dnaLabel(r.id)}</span><span className="tabular-nums text-slate-400">{r.score.toFixed(2)}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-cyan-400/80" style={{ width: `${Math.round(r.score * 100)}%` }} /></div>
                </li>))}</ul>
              <p className="mt-3 text-xs text-slate-500">0.60 or more and the template is used straight away; below that the AI composes one.</p>
            </div>
          </>
        )}
        {allPins().length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <h3 className="mb-2 text-sm font-extrabold">Problems you have chosen a template for</h3>
            <ul className="space-y-2 text-sm">{allPins().map((p) => (
              <li key={p.key} className="flex items-center gap-3"><span className="min-w-0 flex-1 truncate text-slate-300">{p.preview}</span><span className="shrink-0 rounded-full bg-violet-400/15 px-2 py-0.5 text-xs text-violet-200">{dnaLabel(p.dna)}</span></li>))}</ul>
          </div>
        )}
      </section>
    </div>
  );
}
