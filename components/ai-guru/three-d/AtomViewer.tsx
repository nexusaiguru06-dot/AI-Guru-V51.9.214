'use client';
import { useState } from 'react';
import * as THREE from 'three';
import { ELEMENTS, MOLECULES, type Molecule } from '@/lib/ai-guru/three-d/science3d';
import { ThreeStage } from './ThreeStage';
import type { Lang } from './LabText';

const COL: Record<string, string> = { H: '#f1f5f9', C: '#64748b', N: '#3b82f6', O: '#ef4444' };
const sphere = (r: number, c: string) => new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }));

/** Atoms (shells and electrons 1 to 20) and ball-and-stick molecules, in 3D. */
export function AtomViewer({ lang }: { lang: Lang }) {
  const [mode, setMode] = useState<'atom' | 'molecule'>('atom');
  const [z, setZ] = useState(6);
  const [mol, setMol] = useState<Molecule>(MOLECULES[0]);
  const el = ELEMENTS[z - 1];
  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-2">{(['atom', 'molecule'] as const).map((m) => <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-full px-4 py-2 text-sm font-extrabold ${mode === m ? 'bg-cyan-400 text-[#04121f]' : 'border border-white/15 text-slate-200 hover:bg-white/5'}`}>{m === 'atom' ? (lang === 'ml' ? 'ആറ്റം' : 'Atom') : (lang === 'ml' ? 'തന്മാത്ര' : 'Molecule')}</button>)}</div>
      {mode === 'atom' ? <>
        <ThreeStage label={`${el.en} atom in 3D`} height={420} camera={[0, 4, 11]} deps={[z]} setup={({ scene, controls }) => {
          const nuc = sphere(0.55 + el.z * 0.012, el.colour); scene.add(nuc);
          const rings: Array<{ pivot: THREE.Group; speed: number }> = [];
          el.shells.forEach((n, i) => {
            const R = 1.6 + i * 1.15;
            const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.012, 8, 128), new THREE.MeshBasicMaterial({ color: 0x4b7da3 })); ring.rotation.x = Math.PI / 2; scene.add(ring);
            const pivot = new THREE.Group(); pivot.rotation.z = (i % 2 ? 1 : -1) * 0.25 * i; scene.add(pivot);
            const spin = new THREE.Group(); pivot.add(spin);
            for (let k = 0; k < n; k++) { const e = sphere(0.14, '#fde047'); const a = (k / n) * Math.PI * 2; e.position.set(R * Math.cos(a), 0, R * Math.sin(a)); spin.add(e); }
            ring.rotation.z = pivot.rotation.z;
            rings.push({ pivot: spin, speed: 0.9 / (i + 1) });
          });
          (scene.userData as { rings: typeof rings }).rings = rings; controls.autoRotate = false;
        }} tick={({ scene }, dt) => { for (const r of (scene.userData as { rings?: Array<{ pivot: THREE.Group; speed: number }> }).rings ?? []) r.pivot.rotation.y += r.speed * dt; }} />
        <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
          <label className="block text-sm text-slate-300"><span className="flex justify-between"><span>{lang === 'ml' ? 'ആറ്റോമിക സംഖ്യ' : 'Atomic number'}</span><b className="text-white">{el.z}</b></span><input aria-label="Atomic number" type="range" min={1} max={20} value={z} onChange={(e) => setZ(Number(e.target.value))} className="w-full accent-cyan-400" /></label>
          <p role="status" className="mt-2 text-lg font-extrabold">{el.symbol} · {lang === 'ml' ? el.ml : el.en}</p>
          <p className="text-sm text-slate-300">{lang === 'ml' ? `പ്രോട്ടോൺ ${el.z}, ഇലക്ട്രോൺ ${el.z}. ഇലക്ട്രോൺ വിന്യാസം: ${el.shells.join(', ')}` : `${el.z} protons, ${el.z} electrons. Electrons in shells: ${el.shells.join(', ')}`}</p>
        </section>
      </> : <>
        <ThreeStage label={`${mol.name.en} molecule in 3D`} height={420} camera={[0, 1.5, 6]} deps={[mol.id]} setup={({ scene, controls }) => {
          const g = new THREE.Group(); scene.add(g);
          mol.atoms.forEach((a) => { const m = sphere(a.el === 'H' ? 0.3 : 0.45, COL[a.el] ?? '#94a3b8'); m.position.set(...a.at); g.add(m); });
          for (const b of mol.bonds) {
            const p = new THREE.Vector3(...mol.atoms[b.a].at), q = new THREE.Vector3(...mol.atoms[b.b].at); const dir = q.clone().sub(p), len = dir.length();
            const off = b.order === 2 ? [-0.07, 0.07] : [0];
            const perp = new THREE.Vector3(0, 0, 1).cross(dir).normalize(); if (perp.lengthSq() < 1e-6) perp.set(0, 1, 0);
            for (const o of off) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 12), new THREE.MeshStandardMaterial({ color: 0xcbd5e1 })); c.position.copy(p.clone().add(q).multiplyScalar(0.5)).add(perp.clone().multiplyScalar(o)); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); g.add(c); }
          }
          g.scale.setScalar(1.6); controls.autoRotate = true; controls.autoRotateSpeed = 2;
        }} />
        <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
          <div className="flex flex-wrap gap-2">{MOLECULES.map((m) => <button key={m.id} aria-pressed={m.id === mol.id} onClick={() => setMol(m)} className={`rounded-lg px-3 py-2 text-sm font-bold ${m.id === mol.id ? 'bg-amber-300 text-black' : 'border border-white/15 hover:bg-white/5'}`}>{m.formula} · {m.name[lang]}</button>)}</div>
          <p role="status" className="mt-3 text-sm text-slate-200">{mol.note[lang]}</p>
        </section>
      </>}
    </div>
  );
}
