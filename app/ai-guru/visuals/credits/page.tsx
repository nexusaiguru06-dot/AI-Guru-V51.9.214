'use client';
/** V51.9.96: who made the pictures, and under which licence (CC BY needs this credit). */
import { useMemo } from 'react';
import { useBio } from '@/components/ai-guru/visuals/useVisuals';
import { PHET_CREDIT } from '@/lib/ai-guru/visuals/phet';

export default function VisualCredits() {
  const bio = useBio();
  const authors = useMemo(() => { const m = new Map<string, { author: string; licence: string; n: number }>(); for (const v of bio) if (v.kind === 'bioicon') { const k = `${v.author}|${v.licence}`; const x = m.get(k) ?? { author: v.author, licence: v.licence, n: 0 }; x.n++; m.set(k, x); } return [...m.values()].sort((a, b) => b.n - a.n); }, [bio]);
  return (
    <main className="ag-light-native ag-light-page min-h-screen bg-gradient-to-br from-amber-50 via-sky-50 to-fuchsia-50 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-5 rounded-3xl bg-white p-6 shadow-xl">
        <a href="/ai-guru/visuals" className="text-xs font-bold text-indigo-700">← Pictures</a>
        <h1 className="text-2xl font-black">Credits and licences</h1>
        <section><h2 className="font-extrabold text-emerald-700">🌿 Biology and lab drawings — Bioicons</h2><p className="text-sm text-slate-600">From the Bioicons library (bioicons.com). Only drawings under CC0, MIT, BSD, CC BY 3.0 or CC BY 4.0 are used; each drawing is credited to its maker below. Drawings were optimised in size, not changed in content.</p>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">{authors.map((a) => <li key={`${a.author}${a.licence}`}><b>{a.author}</b> · {a.licence} · {a.n} drawing{a.n === 1 ? '' : 's'}</li>)}</ul></section>
        <section><h2 className="font-extrabold text-orange-700">⚗️ Molecules — SmilesDrawer</h2><p className="text-sm text-slate-600">Drawn from SMILES in the browser by SmilesDrawer, © Reymond Research Group, MIT licence. Probst, D. &amp; Reymond, J.-L. (2018), J. Chem. Inf. Model. 58(1), doi:10.1021/acs.jcim.7b00425.</p></section>
        <section><h2 className="font-extrabold text-blue-700">⚡ Simulations — PhET</h2><p className="text-sm text-slate-600">{PHET_CREDIT}. HTML5 simulations under CC BY 4.0, opened from phet.colorado.edu. PhET is a trademark of the University of Colorado; AI Guru is not endorsed by PhET.</p></section>
        <section><h2 className="font-extrabold text-cyan-700">🌍 Maps — Natural Earth</h2><p className="text-sm text-slate-600">Made with Natural Earth (naturalearthdata.com), public domain: admin-0 countries in India&apos;s point-of-view edition, and admin-1 states. Drawn with d3-geo and topojson-client (ISC licence). For exam use, check boundaries against the Survey of India map.</p></section>
      </div>
    </main>
  );
}
