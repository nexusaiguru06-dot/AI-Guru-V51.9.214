'use client';
/** V51.9.96: a molecule drawn from SMILES with SmilesDrawer (MIT), in bright atom colours. Runs only in the browser. */
import { useEffect, useRef, useState } from 'react';

const THEME = {
  FOREGROUND: '#1e1b4b', BACKGROUND: 'transparent',
  C: '#1e1b4b', O: '#ef4444', N: '#2563eb', F: '#16a34a', CL: '#16a34a', BR: '#b45309', I: '#7c3aed', P: '#ea580c', S: '#ca8a04', B: '#f97316', SI: '#d97706', H: '#64748b',
  NA: '#8b5cf6', CA: '#0d9488', CU: '#c2410c', K: '#a855f7',
};

type SD = { SvgDrawer: new (o: object) => { draw: (tree: unknown, target: SVGSVGElement, theme: string) => void }; parse: (s: string, ok: (t: unknown) => void, bad: (e: unknown) => void) => void };

export function MoleculeView({ smiles, size = 300, title }: { smiles: string; size?: number; title?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let off = false;
    void (async () => {
      try {
        const mod = (await import('smiles-drawer')) as unknown as { default?: SD } & SD;
        const SmilesDrawer = (mod.default ?? mod) as SD;
        const drawer = new SmilesDrawer.SvgDrawer({ width: size, height: size, bondThickness: size > 200 ? 2.2 : 1.4, bondLength: size > 200 ? 26 : 16, fontSizeLarge: size > 200 ? 14 : 9, fontSizeSmall: size > 200 ? 10 : 7, padding: size > 200 ? 26 : 10, terminalCarbons: true, explicitHydrogens: true, compactDrawing: false, themes: { aiguru: THEME } });
        SmilesDrawer.parse(smiles, (tree) => { if (!off && ref.current) { ref.current.innerHTML = ''; drawer.draw(tree, ref.current, 'aiguru'); } }, () => setErr('Could not draw this molecule'));
      } catch { setErr('Could not load the molecule drawer'); }
    })();
    return () => { off = true; };
  }, [smiles, size]);
  return err ? <p className="p-4 text-sm text-rose-300">{err}</p> : <svg ref={ref} role="img" aria-label={title ?? `Molecule ${smiles}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="h-auto max-w-full" />;
}
