'use client';
/**
 * three.js renderer for the heading intro (Layer3d, kind "heading"). Everything is a pure function of the time `t`
 * (no running clocks), so the preview and the frame-by-frame MP4 export give exactly the same picture.
 *
 * Six different looks, so each heading surprises the student:
 *   0 Tunnel   – symbols rush through a blue grid tunnel
 *   1 Orbit    – symbols circle glowing rings (violet / cyan)
 *   2 Skyline  – a city of amber towers grows up behind the title
 *   3 Galaxy   – a spiral galaxy; the camera warps in and the title bursts out of the centre
 *   4 Cards    – a wall of cards flips over one by one, then the title lands
 *   5 Waves    – a rolling wave of dots with bubbles of symbols rising (coral / pink)
 * All share the same beat: key expression arrives ≈1.0–2.5 s, title lands ≈2.5 s, subtitle ≈3.2 s.
 */
import * as THREE from 'three';
import { setLayer3dRenderer, type Layer3d } from '../reels/motion/layer3d';

export const VARIANTS = 6;
const FONT = "'Noto Sans Malayalam','Noto Sans',system-ui,'Segoe UI',Arial,sans-serif";
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeIn = (x: number) => clamp01(x) ** 3;
const easeBack = (x: number) => { const c = 1.7, v = clamp01(x) - 1; return 1 + (c + 1) * v * v * v + c * v * v; };
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };

interface Pal { bg: number; text: string; glow: string; symA: string; symB: string; sub: string; accent: string }
const PAL: Pal[] = [
  { bg: 0x061833, text: '#ffffff', glow: '#4fa8ff', symA: '#cfe8ff', symB: '#6fb4ff', sub: '#bcd8ff', accent: '#ffd54a' },
  { bg: 0x0d0726, text: '#ffffff', glow: '#b07cff', symA: '#d9c8ff', symB: '#6ee7f2', sub: '#cdb8ff', accent: '#6ee7f2' },
  { bg: 0x1a0e04, text: '#fff6e5', glow: '#ff9a2e', symA: '#ffe2b0', symB: '#ffb347', sub: '#ffd9a0', accent: '#ffb347' },
  { bg: 0x05030f, text: '#ffffff', glow: '#ff5fd2', symA: '#ffd1f4', symB: '#9d8cff', sub: '#f0c8ff', accent: '#ff7ae0' },
  { bg: 0x03201a, text: '#f2fff9', glow: '#2fe39a', symA: '#c9ffe9', symB: '#58e0b0', sub: '#b8f5da', accent: '#7dffc6' },
  { bg: 0x2a0a1c, text: '#fff2f5', glow: '#ff6b8b', symA: '#ffd0da', symB: '#ffa07a', sub: '#ffd0d9', accent: '#ffb08a' },
];

function textTexture(text: string, px: number, color: string, glow: string | null, weight = 700): { tex: THREE.CanvasTexture; aspect: number } {
  const c = document.createElement('canvas'); const ctx = c.getContext('2d')!;
  ctx.font = `${weight} ${px}px ${FONT}`;
  const pad = glow ? px * 0.6 : px * 0.2;
  const w = Math.ceil(ctx.measureText(text).width + pad * 2), h = Math.ceil(px * 1.5 + pad * 2);
  c.width = Math.min(4096, w); c.height = h;
  ctx.font = `${weight} ${px}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = px * 0.45; }
  ctx.fillStyle = color; ctx.fillText(text, c.width / 2, c.height / 2 + px * 0.04);
  if (glow) { ctx.shadowBlur = px * 0.15; ctx.fillText(text, c.width / 2, c.height / 2 + px * 0.04); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { tex, aspect: c.width / c.height };
}
function plane(text: string, px: number, color: string, glow: string | null, height: number, weight = 700, maxW = 15): THREE.Mesh {
  const { tex, aspect } = textTexture(text, px, color, glow, weight);
  const h = Math.min(height, maxW / aspect);
  return new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
}
function radialTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(190,220,255,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}

type Entry = 'side' | 'spin' | 'slide' | 'pop' | 'rise';
type Land = 'back' | 'drop' | 'burst' | 'zoom' | 'rise';
interface Anim { camera(t: number, portrait: boolean): void; update(t: number, portrait: boolean): void; entry: Entry; land: Land; exprMax: number; titleMax: number }
interface Built {
  key: string; scene: THREE.Scene; camera: THREE.PerspectiveCamera; anim: Anim;
  expr: THREE.Mesh | null; title: THREE.Mesh; sub: THREE.Mesh | null; flare: THREE.Sprite; sparks: THREE.Points; sparkSeed: Float32Array;
}
const keyOf = (s: Layer3d) => JSON.stringify([s.heading, s.sub, s.expr, s.seed, s.accent, s.symbols, s.variant]);

let gl: THREE.WebGLRenderer | null = null;
let built: Built | null = null;

function dispose(b: Built | null): void {
  if (!b) return;
  b.scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => { (x as THREE.MeshBasicMaterial).map?.dispose(); x.dispose(); }); });
}

/** Symbol sprites (billboards, shared textures). */
function makeSymbols(scene: THREE.Scene, spec: Layer3d, pal: Pal, n: number, r: () => number, hMin = 0.8, hMax = 1.6): THREE.Mesh[] {
  const syms = spec.symbols.length ? spec.symbols : ['x'];
  const cache = new Map<string, { tex: THREE.CanvasTexture; aspect: number }>();
  const out: THREE.Mesh[] = [];
  for (let i = 0; i < n; i++) {
    const s = syms[i % syms.length];
    if (!cache.has(s)) cache.set(s, textTexture(s, 96, i % 3 === 0 ? pal.symA : pal.symB, pal.glow, 600));
    const { tex, aspect } = cache.get(s)!;
    const h = hMin + r() * (hMax - hMin);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    scene.add(m); out.push(m);
  }
  return out;
}
const setOp = (m: THREE.Mesh, o: number) => { (m.material as THREE.Material).opacity = o; };
const fadeAfterTitle = (t: number, floor = 0.35) => 1 - clamp01((t - 2.6) / 1.2) * (1 - floor);

function build(spec: Layer3d): Built {
  const variant = ((spec.variant ?? spec.seed) % VARIANTS + VARIANTS) % VARIANTS;
  const pal = PAL[variant];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(pal.bg); scene.fog = new THREE.Fog(pal.bg, 14, 46);
  const camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 120);
  const r = rng(spec.seed * 7 + variant);
  const col = new THREE.Color(pal.accent);

  let anim: Anim;
  const face = (m: THREE.Object3D) => m.quaternion.copy(camera.quaternion);

  if (variant === 0) {
    const floor = new THREE.GridHelper(80, 40, 0x2f86d6, 0x15406e); floor.position.y = -4.2; scene.add(floor);
    const wall = new THREE.GridHelper(80, 40, 0x2f86d6, 0x123a66); wall.rotation.x = Math.PI / 2; wall.position.z = -38; scene.add(wall);
    const ceil = new THREE.GridHelper(80, 40, 0x1f5fa0, 0x0f2f55); ceil.position.y = 6.5; scene.add(ceil);
    const ms = makeSymbols(scene, spec, pal, 44, r);
    const st = ms.map(() => ({ x: (r() < 0.5 ? -1 : 1) * (2.6 + r() * 9), y: -3.4 + r() * 9, z0: r() * 46, speed: 7 + r() * 8, rot: (r() - 0.5) * 0.6 }));
    anim = {
      entry: 'side', land: 'back', exprMax: 12.5, titleMax: 10.5,
      camera: (t, pt) => { camera.position.set(Math.sin(t * 0.5) * 0.5, 0.6 + Math.sin(t * 0.7) * 0.15, (pt ? 11.5 : 9) - Math.min(t, 5) * 0.35); camera.lookAt(0, 0.3, 0); },
      update: (t, pt) => ms.forEach((m, i) => { const s = st[i]; const z = ((s.z0 + s.speed * t) % 50) - 42; m.position.set(s.x * (pt ? 0.55 : 1), s.y, z); m.rotation.set(0, 0, s.rot); setOp(m, Math.min(clamp01((8 - z) / 6), clamp01((z + 42) / 8)) * 0.85 * fadeAfterTitle(t, 0.35) * clamp01(t / 0.3)); }),
    };
  } else if (variant === 1) {
    const rings = [0, 1, 2].map((k) => { const m = new THREE.Mesh(new THREE.TorusGeometry(5 + k * 1.7, 0.03, 8, 160), new THREE.MeshBasicMaterial({ color: k === 1 ? 0x6ee7f2 : 0xb07cff, transparent: true, opacity: 0.7 })); m.position.z = -5; scene.add(m); return m; });
    const grid = new THREE.GridHelper(80, 40, 0x4b2a8f, 0x24124f); grid.position.y = -5; scene.add(grid);
    const ms = makeSymbols(scene, spec, pal, 36, r, 0.8, 1.4);
    const ph = ms.map((_, i) => ({ k: i % 3, a: i * 2.4 + r() * 0.8, y: (r() - 0.5) * 1.8 }));
    anim = {
      entry: 'spin', land: 'burst', exprMax: 12, titleMax: 10.5,
      camera: (t, pt) => { camera.position.set(Math.sin(t * 0.6) * 1.6, 1.0 + Math.sin(t * 0.8) * 0.3, (pt ? 12.5 : 10.5) - Math.min(t, 5) * 0.4); camera.lookAt(0, 0.2, -4); },
      update: (t) => {
        rings.forEach((m, k) => { m.rotation.set(1.15 + k * 0.25 + Math.sin(t * 0.5 + k) * 0.1, t * 0.35 * (k % 2 ? -1 : 1), t * 0.3 + k); const g = clamp01(t / 0.9); m.scale.setScalar(0.3 + 0.7 * easeOut(g)); (m.material as THREE.Material).opacity = 0.75 * fadeAfterTitle(t, 0.15); });
        ms.forEach((m, i) => { const p = ph[i]; const a = p.a + t * (0.55 + p.k * 0.22) * (p.k % 2 ? -1 : 1), rad = 5 + p.k * 1.7; m.position.set(Math.cos(a) * rad, p.y + (p.k - 1) * 1.2, -5 + Math.sin(a) * rad * 0.8); face(m); setOp(m, clamp01((t - 0.1 - i * 0.02) / 0.5) * 0.9 * fadeAfterTitle(t, 0.4) * (0.55 + 0.45 * clamp01((m.position.z + 14) / 10))); });
      },
    };
  } else if (variant === 2) {
    const floor = new THREE.GridHelper(80, 40, 0xb36a16, 0x4a2a08); floor.position.y = -4; scene.add(floor);
    const bs: Array<{ m: THREE.Mesh; h: number; d: number }> = [];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 22; i++) {
      const x = -17 + i * 1.6 + (r() - 0.5) * 0.4, h = 1.2 + r() * (row === 0 ? 5.5 : 4), z = -9 - row * 6;
      const g = new THREE.BoxGeometry(1.1, 1, 1.1); g.translate(0, 0.5, 0);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.07 + r() * 0.04, 0.9, 0.18 + r() * 0.12), transparent: true, opacity: 0.55 }));
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0xffa83a, transparent: true, opacity: 0.8 })));
      m.position.set(x, -4, z); scene.add(m); bs.push({ m, h, d: 0.1 + r() * 0.9 });
    }
    const ms = makeSymbols(scene, spec, pal, 22, r, 0.8, 1.3);
    const sp = ms.map((_, i) => ({ x: -12 + (i / 22) * 24 + (r() - 0.5), y: 1.5 + r() * 4, z: -4 - r() * 5, b: r() * 6 }));
    anim = {
      entry: 'slide', land: 'drop', exprMax: 12, titleMax: 10.5,
      camera: (t, pt) => { camera.position.set(Math.sin(t * 0.35) * 1.5, 0.2 + Math.min(t, 4) * 0.5, (pt ? 12.5 : 10.5) - Math.min(t, 5) * 0.3); camera.lookAt(0, 0.3, -6); },
      update: (t) => {
        const fade = fadeAfterTitle(t, 0.5);
        bs.forEach((b) => { b.m.scale.set(1, Math.max(0.01, b.h * easeOut((t - b.d * 1.3) / 1.0)), 1); const o = 0.55 * (1 - 0.45 * clamp01((t - 2.5) / 1)); (b.m.material as THREE.Material).opacity = o; });
        ms.forEach((m, i) => { const s = sp[i]; m.position.set(s.x, s.y + Math.sin(t * 1.3 + s.b) * 0.35, s.z); face(m); setOp(m, clamp01((t - 0.5 - i * 0.05) / 0.5) * 0.9 * fade); });
      },
    };
  } else if (variant === 3) {
    const N = 2200, pos = new Float32Array(N * 3), colr = new Float32Array(N * 3);
    const c1 = new THREE.Color('#ff5fd2'), c2 = new THREE.Color('#7d8cff'), cc = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const arm = i % 3, rad = Math.sqrt(r()) * 15, ang = arm * (Math.PI * 2 / 3) + rad * 0.55 + (r() - 0.5) * 0.6;
      pos.set([Math.cos(ang) * rad, (r() - 0.5) * 0.7 * (1 - rad / 17), Math.sin(ang) * rad], i * 3);
      cc.copy(c1).lerp(c2, rad / 15); colr.set([cc.r, cc.g, cc.b], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.3, vertexColors: true, map: radialTexture(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    const grp = new THREE.Group(); grp.add(pts); grp.position.z = -8; scene.add(grp);
    const ms = makeSymbols(scene, spec, pal, 24, r, 0.7, 1.3);
    const sp = ms.map((_, i) => ({ a: i * 0.9 + r(), rad: 4 + r() * 8 }));
    anim = {
      entry: 'pop', land: 'burst', exprMax: 11.5, titleMax: 10,
      camera: (t, pt) => { camera.position.set(0, 3.2, (pt ? 36 : 32) - easeOut(t / 3.2) * (pt ? 24 : 23)); camera.lookAt(0, 0, -8); },
      update: (t) => {
        grp.rotation.set(-1.1 + Math.sin(t * 0.4) * 0.05, 0, t * 0.32); (pts.material as THREE.Material).opacity = 0.35 + 0.65 * clamp01(t / 0.6);
        ms.forEach((m, i) => { const s = sp[i], a = s.a + t * 0.32; m.position.set(Math.cos(a) * s.rad, Math.sin(a) * s.rad * 0.25 + 1, -8 + Math.sin(a) * s.rad * 0.55); face(m); setOp(m, clamp01((t - 0.4 - i * 0.04) / 0.5) * 0.9 * fadeAfterTitle(t, 0.3)); });
      },
    };
  } else if (variant === 4) {
    const floor = new THREE.GridHelper(80, 40, 0x1fae7a, 0x0b4a36); floor.position.y = -4.4; scene.add(floor);
    const syms = spec.symbols.length ? spec.symbols : ['x'];
    const cards: Array<{ g: THREE.Group; d: number; x: number; y: number }> = [];
    const cache = new Map<string, { tex: THREE.CanvasTexture; aspect: number }>();
    const COLS = 9, ROWS = 4;
    for (let c = 0; c < COLS; c++) for (let rw = 0; rw < ROWS; rw++) {
      const s = syms[(c * ROWS + rw) % syms.length];
      if (!cache.has(s)) cache.set(s, textTexture(s, 110, '#eafff5', '#2fe39a', 600));
      const { tex, aspect } = cache.get(s)!;
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.06), new THREE.MeshBasicMaterial({ color: (c + rw) % 2 ? 0x0c5a44 : 0x0a7a58 })));
      const hh = Math.min(1.1, 1.3 / aspect);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(hh * aspect, hh), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })); f.position.z = 0.04; grp.add(f);
      const x = (c - (COLS - 1) / 2) * 1.85, y = (rw - (ROWS - 1) / 2) * 1.85 + 0.3;
      grp.position.set(x, y, -4); scene.add(grp); cards.push({ g: grp, d: 0.1 + r() * 1.5, x, y });
    }
    anim = {
      entry: 'pop', land: 'rise', exprMax: 11, titleMax: 10,
      camera: (t, pt) => { camera.position.set(Math.sin(t * 0.4) * 0.8, 0.5, (pt ? 15 : 11) - Math.min(t, 5) * 0.3); camera.lookAt(0, 0.3, -2); },
      update: (t, pt) => cards.forEach((c) => {
        const flip = easeOut((t - c.d) / 0.7), away = easeIn((t - 2.4) / 1.0);
        c.g.rotation.set(0, Math.PI * (1 - flip) + Math.sin(t * 0.8 + c.x) * 0.05, 0);
        c.g.position.set(c.x * (pt ? 0.6 : 1), c.y - away * 1.5, -4 - away * 6 + Math.sin(flip * Math.PI) * 1.2);
        c.g.scale.setScalar(Math.max(0.01, 0.6 + 0.4 * flip) * (pt ? 0.7 : 1));
      }),
    };
  } else {
    const W = 72, D = 40, N = W * D, pos = new Float32Array(N * 3), base: number[] = [];
    for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) { const k = i * D + j; const x = (i / (W - 1) - 0.5) * 40, z = -j * 1.2 + 2; base.push(x, z); pos.set([x, 0, z], k * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.17, color: new THREE.Color('#ff7a98'), map: radialTexture(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    pts.frustumCulled = false; scene.add(pts);
    const ms = makeSymbols(scene, spec, pal, 28, r, 0.8, 1.5);
    const bb = ms.map(() => ({ x: (r() - 0.5) * 20, z: -2 - r() * 14, sp: 0.8 + r() * 1.2, off: r() * 10, sw: r() * 6 }));
    anim = {
      entry: 'rise', land: 'zoom', exprMax: 12, titleMax: 10.5,
      camera: (t, pt) => { camera.position.set(Math.sin(t * 0.45) * 1.2, 0.6 + Math.sin(t * 0.6) * 0.2, (pt ? 12 : 9) - Math.min(t, 5) * 0.3); camera.lookAt(0, -0.2, -2); },
      update: (t) => {
        const a = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
        const amp = 0.25 + 0.75 * clamp01(t / 0.8);
        for (let k = 0; k < N; k++) { const x = base[k * 2], z = base[k * 2 + 1]; a.setY(k, -3.4 + amp * (Math.sin(x * 0.45 + t * 1.8) * 0.55 + Math.sin(z * 0.38 - t * 1.4) * 0.55)); }
        a.needsUpdate = true;
        ms.forEach((m, i) => { const s = bb[i]; const rise = ((t * s.sp + s.off) % 10); m.position.set(s.x + Math.sin(t * 1.1 + s.sw) * 0.5, -3 + rise, s.z); face(m); setOp(m, Math.min(clamp01(rise / 1.2), clamp01((9.2 - rise) / 1.5)) * 0.9 * clamp01(t / 0.4) * fadeAfterTitle(t, 0.45)); });
      },
    };
  }

  const expr = spec.expr ? plane(spec.expr, 120, pal.text, pal.glow, 1.5, 600, anim.exprMax) : null; if (expr) scene.add(expr);
  const title = plane(spec.heading, 190, pal.text, pal.glow, 3.1, 800, anim.titleMax); scene.add(title);
  const sub = spec.sub ? plane(spec.sub, 80, pal.sub, null, 0.8, 500, 13) : null; if (sub) scene.add(sub);
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); scene.add(flare);
  const N = 150, pos = new Float32Array(N * 3), seeds = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { seeds[i * 3] = r(); seeds[i * 3 + 1] = r(); seeds[i * 3 + 2] = r(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sparks = new THREE.Points(g, new THREE.PointsMaterial({ map: radialTexture(), size: 0.42, color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  sparks.frustumCulled = false; scene.add(sparks);
  return { key: keyOf(spec), scene, camera, anim, expr, title, sub, flare, sparks, sparkSeed: seeds };
}

/** Draws the intro at time `tMs` and returns the canvas holding the picture. */
export function renderHeadingIntro(spec: Layer3d, tMs: number, w: number, h: number): HTMLCanvasElement {
  if (!gl) { gl = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); gl.outputColorSpace = THREE.SRGBColorSpace; }
  if (!built || built.key !== keyOf(spec)) { dispose(built); built = build(spec); }
  const b = built, an = b.anim;
  const W = Math.max(2, Math.round(w)), H = Math.max(2, Math.round(h));
  const size = gl.getSize(new THREE.Vector2());
  if (size.x !== W || size.y !== H) gl.setSize(W, H, false);
  b.camera.aspect = W / H; b.camera.updateProjectionMatrix();
  const t = tMs / 1000, portrait = H > W, fitK = portrait ? 0.62 : 1;

  an.camera(t, portrait);
  b.camera.updateMatrixWorld();
  an.update(t, portrait);

  // key expression
  const fly = easeOut((t - 1.0) / 1.5), rise = easeOut((t - 2.4) / 1.0), k = 1 - fly;
  if (b.expr) {
    let x = 0, y = 0, z = 0, ry = 0, rz = 0, sc = 0.9 + 0.1 * fly;
    if (an.entry === 'side') { x = k * 14; z = -k * 6; ry = -k * 1.1; }
    else if (an.entry === 'spin') { y = k * 8; z = -k * 8; rz = k * Math.PI * 3; sc = Math.max(0.01, fly); }
    else if (an.entry === 'slide') { x = -k * 16; ry = k * 0.9; }
    else if (an.entry === 'pop') { sc = Math.max(0.01, easeBack((t - 1.0) / 1.0)); }
    else { y = -k * 8; }
    b.expr.visible = t > 0.95;
    b.expr.position.set(x, 0.3 + y + rise * 2.2 * fitK, z); b.expr.rotation.set(0, ry, rz);
    b.expr.scale.setScalar(Math.max(0.01, sc * (1 - 0.22 * rise) * fitK));
    (b.expr.material as THREE.MeshBasicMaterial).opacity = clamp01((t - 1.0) / 0.4);
  }

  // sparks that sweep in and settle on the expression
  const pos = b.sparks.geometry.getAttribute('position') as THREE.BufferAttribute, sp = b.sparkSeed, sparkT = (t - 1.1) / 1.6;
  for (let i = 0; i < pos.count; i++) {
    const lane = i % 3, u = clamp01(sparkT - sp[i * 3] * 0.35), e = easeOut(u);
    const tx = (sp[i * 3 + 1] - 0.5) * 11 * fitK, ty = 0.3 + (sp[i * 3 + 2] - 0.5) * 0.9;
    const sx = (lane - 1) * 6 + 12, sy = (lane - 1) * 3.5, sz = -7;
    pos.setXYZ(i, sx + (tx - sx) * e, sy + (ty - sy) * e + Math.sin(e * Math.PI * 2 + lane) * 1.1 * (1 - e), sz + (0 - sz) * e);
  }
  pos.needsUpdate = true;
  (b.sparks.material as THREE.PointsMaterial).opacity = b.expr ? clamp01((t - 1.1) / 0.2) * (1 - clamp01((t - 2.5) / 0.5)) : 0;

  // the title lands
  const lv = (t - 2.5) / 0.9, back = easeBack(lv), eo = easeOut(lv);
  let ty = (b.expr ? -0.5 : 0.2) * fitK, tz = 0, ts = 1, trz = 0;
  if (an.land === 'back') { tz = -(1 - clamp01(back)) * 5; ts = 0.35 + 0.65 * back; }
  else if (an.land === 'drop') { ty += (1 - back) * 7; }
  else if (an.land === 'burst') { ts = Math.max(0.01, back); trz = (1 - eo) * 0.5; }
  else if (an.land === 'zoom') { tz = -(1 - eo) * 18; ts = 0.3 + 0.7 * eo; }
  else { ty -= (1 - eo) * 6; }
  b.title.visible = t > 2.45;
  b.title.position.set(0, ty, tz); b.title.rotation.z = trz; b.title.scale.setScalar(Math.max(0.01, ts * fitK));
  (b.title.material as THREE.MeshBasicMaterial).opacity = clamp01((t - 2.5) / 0.3);
  const flash = Math.exp(-Math.pow((t - 2.65) / 0.22, 2));
  b.flare.position.set(0, ty, 0.5); b.flare.scale.setScalar(5 + flash * 11); (b.flare.material as THREE.SpriteMaterial).opacity = flash * 0.5;

  // the subtitle
  if (b.sub) { const a = clamp01((t - 3.2) / 0.8); b.sub.position.set(0, (b.expr ? -2.4 : -2.0) * fitK - (1 - a) * 0.4, 0); b.sub.scale.setScalar(fitK); (b.sub.material as THREE.MeshBasicMaterial).opacity = a; }

  gl.render(b.scene, b.camera);
  return gl.domElement;
}

/** Makes the 3D layer available to drawMotionFrame. Safe to call more than once. */
export function installHeadingIntro3d(): void { setLayer3dRenderer((spec, t, w, h) => (spec.kind === 'heading' ? renderHeadingIntro(spec, t, w, h) : null)); }
