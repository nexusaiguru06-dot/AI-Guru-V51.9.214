'use client';
import { useMemo, useState } from 'react';
import { DNAS } from '@/lib/ai-guru/motion-class/dna/registry';
import { learnedDnas } from '@/lib/ai-guru/motion-class/dna/learned';
import { deleteTeacherTemplate } from '@/lib/ai-guru/teacher/sync';
import { dnaName, SEGMENT_DNAS } from '@/lib/ai-guru/teacher/video-style';

/** Every template the classroom can teach with, and the teacher's own video templates. */
export function DnaLibrary({ version, onChange }: { version: number; onChange: () => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const mine = useMemo(() => learnedDnas().filter((l) => l.source === 'teacher-video'), [version]);
  const ai = useMemo(() => learnedDnas().filter((l) => l.source !== 'teacher-video'), [version]);
  const list = useMemo(() => SEGMENT_DNAS.filter((d) => !q || `${d.id} ${d.name} ${d.description}`.toLowerCase().includes(q.toLowerCase())), [q]);
  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 text-lg font-extrabold">🎬 Your video templates <span className="text-sm font-normal text-slate-400">({mine.length})</span></h3>
        {mine.length === 0 ? <p className="text-sm text-slate-400">None yet. Upload a teaching video in “Learn from a video”.</p> : (
          <div className="grid gap-3 sm:grid-cols-2">{mine.map((t) => (
            <article key={t.id} className="rounded-2xl border border-amber-300/30 bg-amber-400/5 p-4">
              <div className="flex items-start gap-2"><h4 className="flex-1 font-extrabold">{t.name}</h4><button onClick={async () => { await deleteTeacherTemplate(t.id); onChange(); }} className="text-xs text-rose-300 hover:underline">Delete</button></div>
              <p className="mt-1 text-sm text-slate-300">{t.description}</p>
              <p className="mt-2 text-xs text-slate-400">Built from: {t.segments.map(dnaName).join(' → ')}</p>
              {t.sourceName && <p className="mt-1 text-xs text-slate-500">From “{t.sourceName}”</p>}
            </article>))}</div>
        )}
      </section>
      {ai.length > 0 && <section><h3 className="mb-3 text-lg font-extrabold">✨ Made by the AI <span className="text-sm font-normal text-slate-400">({ai.length}, in this browser)</span></h3><div className="grid gap-3 sm:grid-cols-2">{ai.map((t) => <article key={t.id} className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><h4 className="font-extrabold">{t.name}</h4><p className="mt-1 text-sm text-slate-300">{t.description}</p></article>)}</div></section>}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3"><h3 className="text-lg font-extrabold">Built-in templates <span className="text-sm font-normal text-slate-400">({list.length} of {DNAS.length})</span></h3><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search templates" className="ml-auto w-56 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-cyan-400" /></div>
        <div className="grid gap-3 sm:grid-cols-2">{list.map((d) => {
          const id = d.id as string; const on = open === id;
          return (
            <article key={id} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
              <h4 className="font-extrabold">{d.name}</h4>
              <p className={`mt-1 text-sm text-slate-300 ${on ? '' : 'line-clamp-3'}`}>{d.description}</p>
              <div className="mt-2 flex items-center gap-2"><span className="font-mono text-xs text-slate-500">{id}</span><button onClick={() => setOpen(on ? null : id)} className="ml-auto text-xs text-cyan-300 hover:underline">{on ? 'Less' : 'More'}</button></div>
            </article>);
        })}</div>
      </section>
    </div>
  );
}
