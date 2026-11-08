'use client';
/** V51.9.96: "Pictures for this page" — the colourful pictures that match the paragraph being taught, under the board. */
import { useState } from 'react';
import type { Visual } from '@/lib/ai-guru/visuals/types';
import { SUBJECT_STYLE } from '@/lib/ai-guru/visuals/types';
import { VisualModal, VisualThumb } from './VisualView';
import { useVisualsFor } from './useVisuals';

export function ClassroomVisuals({ text, subject, malayalam }: { text: string; subject?: string; malayalam?: boolean }) {
  const matches = useVisualsFor(text, subject, 8);
  const [open, setOpen] = useState<Visual | null>(null);
  if (!matches.length) return null;
  return (
    <section className="mx-2.5 mb-2.5 rounded-xl border border-fuchsia-300/20 bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-fuchsia-500/10" aria-label="Pictures for this page">
      <div className="flex items-center justify-between px-4 pt-2.5"><span className="text-sm font-semibold">🎨 Pictures for this page </span><a href="/ai-guru/visuals" className="text-[10px] font-bold text-fuchsia-200 hover:text-white">All pictures →</a></div>
      <div className="flex gap-2 overflow-x-auto p-2.5">
        {matches.map(({ visual: v }) => { const s = SUBJECT_STYLE[v.subject]; return (
          <button key={v.id} onClick={() => setOpen(v)} className="flex w-36 shrink-0 flex-col overflow-hidden rounded-xl border-2 bg-white text-left shadow transition hover:-translate-y-0.5" style={{ borderColor: s.from }} title={v.title}>
            <div className="flex h-24 w-full items-center justify-center overflow-hidden bg-gradient-to-br from-white to-sky-50"><VisualThumb v={v} /></div>
            <div className="w-full truncate px-2 py-1 text-[11px] font-extrabold text-slate-800" style={{ background: `linear-gradient(90deg, ${s.from}33, ${s.to}33)` }}>{s.emoji} {'ml' in v && v.ml && malayalam ? v.ml : v.title}</div>
          </button>); })}
      </div>
      <VisualModal v={open} onClose={() => setOpen(null)} locale={malayalam ? 'ml' : 'en'} />
    </section>
  );
}
