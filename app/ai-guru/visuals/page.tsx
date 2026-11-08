'use client';
/**
 * V51.9.96 — "Pictures for every lesson": a colourful gallery of open-source science and geography pictures —
 * biology drawings (Bioicons), molecules (SmilesDrawer), PhET simulations and maps (Natural Earth). Search in English or
 * Malayalam; tap a card for the big picture.
 */
import { useMemo, useState } from 'react';
import { CURATED, searchVisuals } from '@/lib/ai-guru/visuals/match';
import { SUBJECT_STYLE, type Visual, type VisualSubject } from '@/lib/ai-guru/visuals/types';
import { VisualCard, VisualModal } from '@/components/ai-guru/visuals/VisualView';
import { useBio } from '@/components/ai-guru/visuals/useVisuals';

const SUBJECTS = Object.keys(SUBJECT_STYLE) as VisualSubject[];
const PAGE = 48;

export default function VisualGallery() {
  const bio = useBio();
  const [subject, setSubject] = useState<VisualSubject | 'all'>('all');
  const [kind, setKind] = useState<'all' | Visual['kind']>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Visual | null>(null);
  const [shown, setShown] = useState(PAGE);
  // A colourful mix first: maps, simulations, drawings and molecules taken in turn.
  const all = useMemo(() => { const groups = [CURATED.filter((v) => v.kind === 'map'), CURATED.filter((v) => v.kind === 'phet'), bio, CURATED.filter((v) => v.kind === 'molecule')]; const total = CURATED.length + bio.length; const out: Visual[] = []; for (let i = 0; out.length < total && i < total; i++) for (const g of groups) { const n = g === bio ? 3 : 1; for (let k = 0; k < n; k++) { const x = g[i * n + k]; if (x) out.push(x); } } return out; }, [bio]);
  const list = useMemo(() => searchVisuals(all, q).filter((v) => (subject === 'all' || v.subject === subject) && (kind === 'all' || v.kind === kind)), [all, q, subject, kind]);
  const count = (s: VisualSubject) => all.filter((v) => v.subject === s).length;
  return (
    <main className="ag-light-native ag-light-page min-h-screen bg-gradient-to-br from-amber-50 via-sky-50 to-fuchsia-50 px-4 py-6 text-slate-900" style={{ fontFamily: '"Noto Sans", "Noto Sans Malayalam", system-ui, sans-serif' }}>
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="ag-keep-light overflow-hidden rounded-3xl p-6 text-white shadow-xl" style={{ background: 'linear-gradient(120deg, #22c55e, #06b6d4 35%, #6366f1 65%, #f97316)' }}>
          <a href="/ai-guru/classroom" className="text-xs font-bold text-white/85">← Classroom</a>
          <h1 className="mt-2 text-3xl font-black drop-shadow sm:text-4xl">Pictures for every lesson</h1>
          
          <p className="mt-1 max-w-2xl text-sm text-white/90">Biology drawings, molecules, science simulations and maps — {all.length.toLocaleString('en-IN')} pictures from open-source libraries. The classroom shows the ones that match the page you are reading.</p>
          <input value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Search: heart, glucose, lens, equator…" aria-label="Search pictures" className="mt-4 w-full max-w-xl rounded-2xl border-0 px-4 py-3 text-base font-semibold text-slate-900 shadow-inner outline-none ring-4 ring-white/40 focus:ring-white" />
        </header>
        <nav className="flex flex-wrap gap-2" aria-label="Subjects">
          <button onClick={() => { setSubject('all'); setShown(PAGE); }} aria-pressed={subject === 'all'} className={`rounded-full px-4 py-2 text-sm font-extrabold shadow-sm ${subject === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}>All ({all.length})</button>
          {SUBJECTS.map((s) => { const st = SUBJECT_STYLE[s]; const on = subject === s; return <button key={s} onClick={() => { setSubject(s); setShown(PAGE); }} aria-pressed={on} className="rounded-full px-4 py-2 text-sm font-extrabold shadow-sm transition" style={on ? { background: `linear-gradient(90deg, ${st.from}, ${st.to})`, color: '#fff' } : { background: '#fff', color: st.ink, border: `2px solid ${st.from}55` }}>{st.emoji} {st.label} · {st.ml} ({count(s)})</button>; })}
        </nav>
        <div className="flex flex-wrap gap-2 text-xs font-bold">{([['all', 'Everything'], ['bioicon', 'Drawings'], ['molecule', 'Molecules'], ['phet', 'Simulations'], ['map', 'Maps']] as const).map(([k, l]) => <button key={k} onClick={() => { setKind(k); setShown(PAGE); }} aria-pressed={kind === k} className={`rounded-full px-3 py-1.5 ${kind === k ? 'bg-indigo-600 text-white' : 'bg-white/80 text-slate-600'}`}>{l}</button>)}<span className="self-center text-slate-500">{list.length} found</span></div>
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{list.slice(0, shown).map((v) => <VisualCard key={v.id} v={v} onOpen={() => setOpen(v)} />)}</section>
        {list.length > shown && <div className="text-center"><button onClick={() => setShown((n) => n + PAGE)} className="rounded-full bg-white px-6 py-3 text-sm font-extrabold text-indigo-700 shadow">Show more</button></div>}
        {list.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-slate-500">No pictures for “{q}” yet.</p>}
        <footer className="pb-6 text-center text-xs text-slate-500">Open-source pictures with thanks to their makers · <a href="/ai-guru/visuals/credits" className="font-bold text-indigo-700 underline">Credits and licences</a></footer>
      </div>
      <VisualModal v={open} onClose={() => setOpen(null)} />
    </main>
  );
}
