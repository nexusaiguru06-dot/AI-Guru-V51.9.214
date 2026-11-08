'use client';
/** V51.9.96: one picture, large or as a card — biology drawing, molecule, map or PhET simulation. */
import { useState } from 'react';
import type { Visual } from '@/lib/ai-guru/visuals/types';
import { SUBJECT_STYLE } from '@/lib/ai-guru/visuals/types';
import { PHET_CREDIT, phetUrl } from '@/lib/ai-guru/visuals/phet';
import { MoleculeView } from './MoleculeView';
import { MapView } from './MapView';

export function VisualThumb({ v }: { v: Visual }) {
  const s = SUBJECT_STYLE[v.subject];
  if (v.kind === 'bioicon') return <img src={v.file} alt={v.title} loading="lazy" className="h-full w-full object-contain p-2" />; // eslint-disable-line @next/next/no-img-element
  if (v.kind === 'molecule') return <MoleculeView smiles={v.smiles} size={150} title={v.title} />;
  if (v.kind === 'map') return <MapView spec={v.map} width={300} compact />;
  return <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center" style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }}><span className="text-4xl drop-shadow">▶</span><span className="px-2 text-xs font-extrabold text-white drop-shadow">{v.title}</span><span className="text-[10px] font-bold text-white/90">Simulation</span></div>;
}

export function VisualCard({ v, onOpen }: { v: Visual; onOpen: () => void }) {
  const s = SUBJECT_STYLE[v.subject];
  return (
    <button onClick={onOpen} className="ag-keep-light group flex w-full flex-col overflow-hidden rounded-2xl border-2 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-4" style={{ borderColor: `${s.from}55` }}>
      <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-white to-slate-50">{<VisualThumb v={v} />}</div>
      <div className="w-full px-3 py-2" style={{ background: `linear-gradient(90deg, ${s.from}22, ${s.to}22)` }}>
        <div className="truncate text-sm font-extrabold text-slate-800">{v.title}</div>
        <div className="truncate text-[11px] font-semibold" style={{ color: s.ink }}>{'ml' in v && v.ml ? `${v.ml} · ` : ''}{v.kind === 'molecule' ? v.formula : v.kind === 'bioicon' ? v.category : v.kind === 'phet' ? 'Interactive simulation' : 'Map'}</div>
      </div>
    </button>
  );
}

export function VisualLarge({ v, locale = 'en' }: { v: Visual; locale?: string }) {
  const [run, setRun] = useState(false);
  const s = SUBJECT_STYLE[v.subject];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-2"><span className="rounded-full px-3 py-1 text-xs font-extrabold text-white" style={{ background: `linear-gradient(90deg, ${s.from}, ${s.to})` }}>{s.emoji} {s.label}</span><h3 className="text-xl font-extrabold text-slate-900">{v.title}</h3>{'ml' in v && v.ml && <span className="text-base font-bold text-slate-600">{v.ml}</span>}{v.kind === 'molecule' && <span className="font-mono text-lg font-bold text-indigo-700">{v.formula}</span>}</div>
      <div className="flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-sky-50 via-white to-amber-50 p-2">
        {v.kind === 'bioicon' && <img src={v.file} alt={v.title} className="max-h-[60vh] w-full object-contain" />}{/* eslint-disable-line @next/next/no-img-element */}
        {v.kind === 'molecule' && <MoleculeView smiles={v.smiles} size={420} title={v.title} />}
        {v.kind === 'map' && <MapView spec={v.map} width={760} />}
        {v.kind === 'phet' && (run ? <iframe title={v.title} src={phetUrl(v.slug, locale)} className="aspect-video w-full rounded-xl border-0 bg-white" allowFullScreen /> : <button onClick={() => setRun(true)} className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }}><span className="text-6xl">▶</span><span className="text-lg font-extrabold">Start the simulation</span><span className="text-xs text-white/85">Opens from phet.colorado.edu · needs internet</span></button>)}
      </div>
      <p className="text-xs text-slate-500">{v.kind === 'bioicon' ? <>Drawing: {v.author} · {v.licence} · via Bioicons</> : v.kind === 'phet' ? <>Simulation: {PHET_CREDIT} · CC BY 4.0</> : v.kind === 'map' ? <>Map data: Natural Earth (public domain), India point of view · drawn with d3-geo</> : <>Drawn from SMILES with SmilesDrawer (MIT)</>} · <a className="underline" href="/ai-guru/visuals/credits">credits</a></p>
    </div>
  );
}

export function VisualModal({ v, onClose, locale }: { v: Visual | null; onClose: () => void; locale?: string }) {
  if (!v) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={v.title} className="fixed inset-0 z-[80] grid place-items-center bg-slate-900/70 p-3" onClick={onClose}>
      <div className="ag-keep-light max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex justify-end"><button onClick={onClose} className="rounded-full bg-slate-100 px-4 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-200">Close ✕</button></div>
        <VisualLarge v={v} locale={locale} />
      </div>
    </div>
  );
}
