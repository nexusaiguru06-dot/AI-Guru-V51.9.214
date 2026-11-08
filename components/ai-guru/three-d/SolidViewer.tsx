'use client';
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import type { SolidKind } from '@/lib/ai-guru/motion-class/dna/types';
import { SOLID_INFO, facts3d, sectionAt, type SolidDims } from '@/lib/ai-guru/three-d/solids3d';
import { ThreeStage } from './ThreeStage';
import type { Lang } from './LabText';

const dimsOf = (k: SolidKind): SolidDims => { const { solid: _s, ...d } = SOLID_INFO[k].defaults; return d; };
const KINDS: SolidKind[] = ['cuboid', 'prism', 'cylinder', 'cone', 'sphere'];
const mat = (c: number, o = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.05, transparent: o < 1, opacity: o, side: THREE.DoubleSide });
const edges = (g: THREE.BufferGeometry) => new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), new THREE.LineBasicMaterial({ color: 0xe2f4ff }));

/** The solid as a three.js mesh whose base sits on y = 0, sized in the lab's units (1 unit = 1 cm, then scaled to fit the view). */
function body(kind: SolidKind, d: SolidDims): { geo: THREE.BufferGeometry; height: number; centre: THREE.Vector3 } {
  const { a = 1, b = 1, h = 1, r = 1 } = d;
  if (kind === 'cuboid') return { geo: new THREE.BoxGeometry(a, h, b), height: h, centre: new THREE.Vector3(0, h / 2, 0) };
  if (kind === 'cylinder') return { geo: new THREE.CylinderGeometry(r, r, h, 64), height: h, centre: new THREE.Vector3(0, h / 2, 0) };
  if (kind === 'cone') return { geo: new THREE.ConeGeometry(r, h, 64), height: h, centre: new THREE.Vector3(0, h / 2, 0) };
  if (kind === 'sphere') return { geo: new THREE.SphereGeometry(r, 48, 32), height: 2 * r, centre: new THREE.Vector3(0, r, 0) };
  // right triangular prism: legs a and b in the base plane (x, y), length h along z, then stood on a leg
  const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(a, 0), new THREE.Vector2(0, b)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }); g.translate(-a / 3, -b / 3, -h / 2);
  return { geo: g, height: b, centre: new THREE.Vector3(0, b / 3, 0) };
}

/** Solid Lab: turn any solid in 3D, change its size, slice it, and see the volume and surface area worked out. */
export function SolidViewer({ lang }: { lang: Lang }) {
  const [kind, setKind] = useState<SolidKind>('cuboid');
  const [dims, setDims] = useState<SolidDims>(dimsOf('cuboid'));
  const [cut, setCut] = useState(0.5);
  const [slice, setSlice] = useState(false);
  const [wire, setWire] = useState(false);
  const info = SOLID_INFO[kind];
  const f = useMemo(() => facts3d(kind, dims), [kind, dims]);
  const sec = sectionAt(kind, dims, cut);
  const pick = (k: SolidKind) => { setKind(k); setDims(dimsOf(k)); setCut(0.5); };
  const big = Math.max(...Object.values(dims).map((x) => x ?? 0), 1);
  const k = 5 / Math.max(big, 4); // fit the view whatever the size
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={lang === 'ml' ? 'രൂപം' : 'Solid'} className="flex flex-wrap gap-2">{KINDS.map((x) => <button key={x} role="tab" aria-selected={x === kind} onClick={() => pick(x)} className={`rounded-full px-4 py-2 text-sm font-extrabold ${x === kind ? 'bg-cyan-400 text-[#04121f]' : 'border border-white/15 text-slate-200 hover:bg-white/5'}`}>{SOLID_INFO[x].name[lang]}</button>)}</div>
      <ThreeStage label={`${info.name.en} in 3D`} height={420} camera={[8, 6.5, 11]} deps={[kind, dims, slice, cut, wire]} setup={({ scene, controls }) => {
        const { geo, height, centre } = body(kind, dims);
        const group = new THREE.Group(); group.scale.setScalar(k);
        const solid = new THREE.Mesh(geo, mat(0x22d3ee, wire ? 0.18 : slice ? 0.35 : 0.92)); solid.position.copy(centre);
        group.add(solid); const e = edges(geo); e.position.copy(centre); group.add(e);
        if (slice) {
          const y = (kind === 'sphere' ? cut * 2 * (dims.r ?? 1) : cut * height);
          const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
          const span = kind === 'sphere' ? Math.sqrt(Math.max(0, (dims.r ?? 1) ** 2 - ((cut * 2 - 1) * (dims.r ?? 1)) ** 2)) * 2 : kind === 'cone' ? 2 * (dims.r ?? 1) * (1 - cut) : kind === 'cylinder' ? 2 * (dims.r ?? 1) : kind === 'prism' ? (dims.a ?? 1) * (1 - cut) : (dims.a ?? 1);
          const depth = kind === 'cuboid' ? (dims.b ?? 1) : kind === 'prism' ? (dims.h ?? 1) : span;
          plane.rotation.x = -Math.PI / 2; plane.scale.set(Math.max(0.01, span), Math.max(0.01, depth), 1); plane.position.set(kind === 'prism' ? -(dims.a ?? 1) / 3 + span / 2 : 0, y, 0);
          if (kind === 'cylinder' || kind === 'cone' || kind === 'sphere') { const disc = new THREE.Mesh(new THREE.CircleGeometry(Math.max(0.01, span / 2), 64), new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide })); disc.rotation.x = -Math.PI / 2; disc.position.set(0, y, 0); group.add(disc); } else group.add(plane);
        }
        const grid = new THREE.GridHelper(14, 14, 0x3b6a8f, 0x1d3a55); (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.6;
        scene.add(grid); scene.add(group);
        controls.target.set(0, (height * k) / 2, 0); controls.autoRotate = !slice; controls.autoRotateSpeed = 1.2;
      }} />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
          <h2 className="font-extrabold">{lang === 'ml' ? 'വലുപ്പം (സെ.മീ)' : 'Size (cm)'}</h2>
          <div className="mt-2 space-y-2">{info.params.map((p) => <label key={p.key} className="block text-sm text-slate-300"><span className="flex justify-between"><span>{p.label[lang]}</span><b className="text-white">{dims[p.key]}</b></span><input aria-label={p.label.en} type="range" min={p.min} max={p.max} step={1} value={dims[p.key] ?? p.min} onChange={(e) => setDims({ ...dims, [p.key]: Number(e.target.value) })} className="w-full accent-cyan-400" /></label>)}</div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={slice} onChange={(e) => setSlice(e.target.checked)} />{lang === 'ml' ? 'മുറിച്ചു നോക്കാം' : 'Slice it'}</label><label className="flex items-center gap-2"><input type="checkbox" checked={wire} onChange={(e) => setWire(e.target.checked)} />{lang === 'ml' ? 'സുതാര്യം' : 'See-through'}</label></div>
          {slice && <label className="mt-3 block text-sm text-slate-300">{lang === 'ml' ? 'മുറിക്കുന്ന ഉയരം' : 'Height of the cut'}<input aria-label="cut" type="range" min={0} max={1} step={0.05} value={cut} onChange={(e) => setCut(Number(e.target.value))} className="w-full accent-amber-300" /><span role="status" className="mt-1 block text-amber-200">{sec.text[lang]}</span></label>}
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4" aria-label="Working">
          <h2 className="font-extrabold">{lang === 'ml' ? 'കണക്ക്' : 'The working'}</h2>
          {f.problem ? <p className="mt-2 text-sm text-rose-300">{f.problem}</p> : <dl className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-300">{lang === 'ml' ? 'അടിത്തറയുടെ വിസ്തീർണം' : 'Base area'}</dt><dd className="font-bold">{f.base} cm²</dd></div>
            {f.slant > 0 && <div className="flex justify-between"><dt className="text-slate-300">{lang === 'ml' ? 'ചരിവുയരം / കർണം' : 'Slant / hypotenuse'}</dt><dd className="font-bold">{f.slant} cm</dd></div>}
            <div className="flex justify-between"><dt className="text-slate-300">{lang === 'ml' ? 'ഘനഫലം' : 'Volume'}</dt><dd className="font-bold text-emerald-300">{f.volume} cm³{f.volumeApprox ? ` (${f.volumeApprox})` : ''}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-300">{lang === 'ml' ? 'ഉപരിതല വിസ്തീർണം' : 'Surface area'}</dt><dd className="font-bold text-amber-300">{f.surface} cm²{f.surfaceApprox ? ` (${f.surfaceApprox})` : ''}</dd></div>
          </dl>}
          <p className="mt-3 text-xs text-slate-400">{lang === 'ml' ? 'പാഠത്തിലെ അതേ സൂത്രവാക്യങ്ങളാണ് ഇവിടെയും. തിരിക്കാൻ വലിക്കുക, വലുതാക്കാൻ സ്ക്രോൾ ചെയ്യുക.' : 'Same formulas as the lesson. Drag to turn, scroll or pinch to zoom.'}</p>
        </section>
      </div>
    </div>
  );
}
