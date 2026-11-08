'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { Lang } from './LabText';

// three.js is loaded only when this page opens, so the rest of the app stays light.
const SolidViewer = dynamic(() => import('./SolidViewer').then((m) => m.SolidViewer), { ssr: false });
const AtomViewer = dynamic(() => import('./AtomViewer').then((m) => m.AtomViewer), { ssr: false });
const SolarViewer = dynamic(() => import('./SolarViewer').then((m) => m.SolarViewer), { ssr: false });

const TABS = [{ id: 'solids', en: 'Solids', ml: 'ഘനരൂപങ്ങൾ', sub: { en: 'Maths · volume and surface area', ml: 'കണക്ക്' } }, { id: 'atoms', en: 'Atoms & molecules', ml: 'ആറ്റവും തന്മാത്രയും', sub: { en: 'Science · structure of matter', ml: 'ശാസ്ത്രം' } }, { id: 'solar', en: 'Solar system', ml: 'സൗരയൂഥം', sub: { en: 'Science · orbits', ml: 'ശാസ്ത്രം' } }] as const;

/** The 3D Lab page body: three labs, English or Malayalam. */
export function Lab3D() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('solids');
  const [lang, setLang] = useState<Lang>('en');
  return (
    <main className="min-h-screen bg-[#06101c] px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="flex flex-wrap items-center gap-3"><a href="/ai-guru" className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold">← AI Guru</a><h1 className="text-2xl font-extrabold">3D Lab <span className="text-base font-normal text-slate-400">· {lang === 'ml' ? 'ത്രിമാന ലാബ്' : 'Turn it, slice it, see inside'}</span></h1>
          <div className="ml-auto flex gap-1" role="group" aria-label="Language">{(['en', 'ml'] as const).map((l) => <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)} className={`rounded-lg px-3 py-1.5 text-xs font-extrabold ${lang === l ? 'bg-cyan-400 text-[#04121f]' : 'border border-white/15'}`}>{l === 'en' ? 'English' : 'Malayalam'}</button>)}</div></header>
        <nav role="tablist" className="grid gap-2 sm:grid-cols-3">{TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`rounded-2xl border p-3 text-left ${tab === t.id ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/10 bg-white/[.04] hover:border-white/30'}`}><b>{t[lang]}</b><span className="block text-xs text-slate-400">{t.sub[lang]}</span></button>)}</nav>
        {tab === 'solids' && <SolidViewer lang={lang} />}
        {tab === 'atoms' && <AtomViewer lang={lang} />}
        {tab === 'solar' && <SolarViewer lang={lang} />}
      </div>
    </main>
  );
}
