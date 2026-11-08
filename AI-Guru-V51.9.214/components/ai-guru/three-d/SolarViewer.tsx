'use client';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { PLANETS, orbitAngle, orbitRadius, planetSize } from '@/lib/ai-guru/three-d/science3d';
import { ThreeStage } from './ThreeStage';
import type { Lang } from './LabText';

/** The solar system with real orbit periods: Earth takes `speed` seconds per year, so you can watch Mercury lap the Sun and Neptune barely move. */
export function SolarViewer({ lang }: { lang: Lang }) {
  const [speed, setSpeed] = useState(10);
  const [pick, setPick] = useState('earth');
  const sim = useRef({ years: 0, speed: 10 }); sim.current.speed = speed;
  const p = PLANETS.find((x) => x.id === pick)!;
  return (
    <div className="space-y-4">
      <ThreeStage label="Solar system in 3D" height={440} camera={[0, 16, 20]} deps={[]} setup={({ scene, controls }) => {
        const sun = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 24), new THREE.MeshBasicMaterial({ color: 0xfbbf24 })); scene.add(sun);
        scene.add(new THREE.PointLight(0xffffff, 60, 0, 1.2));
        const bodies: Array<{ m: THREE.Mesh; p: (typeof PLANETS)[number] }> = [];
        for (const pl of PLANETS) {
          const R = orbitRadius(pl.au);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.01, 6, 160), new THREE.MeshBasicMaterial({ color: 0x34566f })); ring.rotation.x = Math.PI / 2; scene.add(ring);
          const m = new THREE.Mesh(new THREE.SphereGeometry(planetSize(pl.radius), 24, 16), new THREE.MeshStandardMaterial({ color: pl.colour, roughness: 0.6 })); scene.add(m); bodies.push({ m, p: pl });
          if (pl.id === 'saturn') { const r = new THREE.Mesh(new THREE.RingGeometry(planetSize(pl.radius) * 1.3, planetSize(pl.radius) * 2, 48), new THREE.MeshBasicMaterial({ color: 0xd6c08a, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })); r.rotation.x = Math.PI / 2.4; m.add(r); }
        }
        (scene.userData as { bodies: typeof bodies }).bodies = bodies; controls.autoRotate = false;
      }} tick={({ scene }, dt) => {
        sim.current.years += (dt * sim.current.speed) / 10;
        for (const b of (scene.userData as { bodies?: Array<{ m: THREE.Mesh; p: (typeof PLANETS)[number] }> }).bodies ?? []) { const a = orbitAngle(b.p, sim.current.years), R = orbitRadius(b.p.au); b.m.position.set(R * Math.cos(a), 0, -R * Math.sin(a)); }
      }} />
      <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
        <label className="block text-sm text-slate-300"><span className="flex justify-between"><span>{lang === 'ml' ? 'വേഗത (ഭൂമി 1 വർഷം = 10 സെക്കൻഡ് × )' : 'Speed (1× = Earth’s year in 10 s)'}</span><b className="text-white">{speed / 10}×</b></span><input aria-label="Speed" type="range" min={0} max={50} step={5} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full accent-cyan-400" /></label>
        <div className="mt-3 flex flex-wrap gap-2">{PLANETS.map((x) => <button key={x.id} aria-pressed={x.id === pick} onClick={() => setPick(x.id)} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${x.id === pick ? 'bg-amber-300 text-black' : 'border border-white/15 hover:bg-white/5'}`}>{lang === 'ml' ? x.ml : x.en}</button>)}</div>
        <p role="status" className="mt-3 text-sm text-slate-200">{lang === 'ml' ? `${p.ml}: സൂര്യനിൽ നിന്ന് ${p.au} AU, ഒരു വലം വയ്ക്കാൻ ${p.years} ഭൗമവർഷം, വലുപ്പം ഭൂമിയുടെ ${p.radius} ഇരട്ടി.` : `${p.en}: ${p.au} AU from the Sun, one orbit takes ${p.years} Earth years, ${p.radius}× Earth’s size.`}</p>
        <p className="mt-1 text-xs text-slate-400">{lang === 'ml' ? 'ചിത്രത്തിൽ ദൂരം ചുരുക്കിയാണ് വരച്ചിരിക്കുന്നത്, വലുപ്പവും യഥാർഥ അനുപാതത്തിലല്ല. കാലം യഥാർഥമാണ്.' : 'Distances and sizes are squeezed so everything fits; the orbit times are real.'}</p>
      </section>
    </div>
  );
}
