/**
 * V51.9.148 — Physics agent · template "optics": an object in front of a lens or a mirror (convex lens, concave
 * lens, concave mirror, convex mirror). Two principal rays are drawn and meet at the image; the image is described
 * (real or virtual, inverted or erect, magnified or diminished); then the lens / mirror formula with the numbers and
 * the magnification. New Cartesian sign convention (light from the left; distances from the optical centre / pole,
 * positive to the right): lens 1/v − 1/u = 1/f, m = v/u; mirror 1/v + 1/u = 1/f, m = −v/u. Every number and every
 * ray is computed here. (Idea of the scene: the ray-optics pages of Physics-Notebook, MIT.)
 */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { label, newScene, num, pick, ring, sparkle, uid, vec, type Bi, type Pt } from '../../kit';
import type { AgentTemplate } from '../../types';
import { checkSteps, inRange, par, ringW, round } from './common';

export type OptKind = 'convex-lens' | 'concave-lens' | 'concave-mirror' | 'convex-mirror';
export type OptOp = 'show' | 'rays' | 'image' | 'formula' | 'magnification';
export interface OpticsPlan {
  kind: OptKind;
  /** Focal length, cm (a positive number; the sign comes from the kind). */
  focalCm: number;
  /** Object distance, cm (a positive number: the object is in front). */
  objectCm: number;
  /** Object height, cm (optional; for the image height). */
  heightCm?: number;
  steps: Array<{ op: OptOp; say: Bi }>;
}
const ORDER: OptOp[] = ['show', 'rays', 'image', 'formula', 'magnification'];
const KINDS: OptKind[] = ['convex-lens', 'concave-lens', 'concave-mirror', 'convex-mirror'];
const isLens = (k: OptKind) => k.endsWith('lens');

export function opticsFacts(p: OpticsPlan) {
  const lens = isLens(p.kind);
  const f = p.kind === 'convex-lens' || p.kind === 'convex-mirror' ? p.focalCm : -p.focalCm;
  const u = -p.objectCm;
  const v = lens ? 1 / (1 / f + 1 / u) : 1 / (1 / f - 1 / u);
  const mag = lens ? v / u : -v / u;
  const real = lens ? v > 0 : v < 0;
  return { lens, f, u, v: round(v), m: round(mag), real, erect: mag > 0, bigger: Math.abs(mag) > 1.0001, same: Math.abs(Math.abs(mag) - 1) < 1e-4, hImg: p.heightCm !== undefined ? round(mag * p.heightCm) : undefined };
}

export function validateOptics(x: unknown): string[] {
  const p = x as OpticsPlan;
  if (!p || typeof p !== 'object') return ['plan is not an object'];
  const e: string[] = [];
  if (!KINDS.includes(p.kind)) e.push(`kind is one of ${KINDS.join(', ')}`);
  if (!inRange(p.focalCm, 1, 200)) e.push('focalCm is the focal length, 1–200 cm (positive; the sign comes from the kind)');
  if (!inRange(p.objectCm, 1, 600)) e.push('objectCm is the object distance, 1–600 cm (positive)');
  if (p.heightCm !== undefined && !inRange(p.heightCm, 0.01, 1000)) e.push('heightCm is a positive height in cm');
  if (!e.length && (p.kind === 'convex-lens' || p.kind === 'concave-mirror') && Math.abs(p.objectCm - p.focalCm) < 1e-9) e.push('the object at the focus makes no image (it is at infinity); choose another distance');
  if (!e.length) {
    const ff = opticsFacts(p);
    if (Math.abs(ff.v) > 8 * p.focalCm || Math.abs(ff.m) > 6) e.push('the object is too close to the focus to draw (the image is very far); choose another distance');
  }
  return [...e, ...checkSteps(p.steps, ORDER, ['image'])];
}

export function buildOptics(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as OpticsPlan;
  const F = opticsFacts(p);
  const ml = lang === 'ml';
  const m = newScene(title, 680);
  const x0 = 360, y0 = 230;
  const ext = Math.max(p.objectCm, Math.abs(F.v), 2 * p.focalCm) * 1.12;
  const S = 320 / ext; // px per cm
  const X = (d: number) => x0 + d * S;
  const h0 = Math.min(70, 150 / Math.max(1, Math.abs(F.m)));
  const obj: Pt = [X(F.u), y0 - h0];
  const img: Pt = [X(F.v), y0 - h0 * F.m];
  let t = 300;
  let line = 0;
  const say = (text: string, at: number, color: string) => label(m, text, 360, 420 + 44 * line++, at, { size: 24, color, weight: '700' });
  /** A ray from a to b, then on along the same line to the board's edge (x between 20 and 700). */
  const onward = (a: Pt, b: Pt): Pt => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const xe = dx >= 0 ? 700 : 20;
    const k = dx === 0 ? 1 : (xe - a[0]) / dx;
    let pt: Pt = [a[0] + dx * k, a[1] + dy * k];
    if (pt[1] < 20 || pt[1] > 400) { const yE = pt[1] < 20 ? 20 : 400; const k2 = (yE - a[1]) / dy; pt = [a[0] + dx * k2, yE]; }
    return pt;
  };
  const ray = (pts: Pt[], at: number, color: string, dashed = false) => m.poly(uid('ray'), pts, at, { color, closed: false, width: dashed ? 2 : 3, dashed, dur: 700, z: 4, silent: true });

  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      m.rule(uid('ax'), 20, y0, 700, y0, t, { color: 'done', width: 1.5 });
      const H = 150;
      if (F.lens) {
        // biconvex: thick in the middle; biconcave: thin in the middle, thick at the edges
        const half = (yy: number) => (p.kind === 'convex-lens' ? 3 + 16 * (1 - (yy / H) ** 2) : 4 + 14 * (yy / H) ** 2);
        const side = (sgn: number): Pt[] => Array.from({ length: 13 }, (_, i) => { const yy = -H + (2 * H * i) / 12; return [x0 + sgn * half(yy), y0 + yy]; });
        m.poly(uid('lens'), [...side(1), ...side(-1).reverse()], t, { color: 'b', fill: 'b', fillAlpha: 0.15, closed: true, width: 2.5, dur: 600, z: 2, silent: true });
      } else {
        const c = p.kind === 'concave-mirror' ? -1 : 1;
        const arc: Pt[] = Array.from({ length: 21 }, (_, i) => { const yy = -H + (2 * H * i) / 20; return [x0 + c * 22 * (yy / H) ** 2, y0 + yy]; });
        m.poly(uid('mir'), arc, t, { color: 'b', closed: false, width: 4, dur: 600, z: 2, silent: true });
        // the back of the mirror (hatching)
        for (let i = 0; i < 9; i++) { const yy = -H + 20 + i * 32; const xx = x0 + c * 22 * (yy / H) ** 2; m.rule(uid('h'), xx + 2, y0 + yy, xx + 14, y0 + yy - 10, t + 400, { color: 'done', width: 1.5 }); }
      }
      // focal points (and 2F / C)
      const marks = F.lens ? [-1, 1, -2, 2] : [p.kind === 'concave-mirror' ? -1 : 1, p.kind === 'concave-mirror' ? -2 : 2];
      for (const k of marks) {
        const xx = X(k * p.focalCm);
        if (xx < 20 || xx > 700) continue;
        m.dot(uid('fp'), xx, y0, t + 500, { color: 'ink', r: 4 });
        label(m, Math.abs(k) === 1 ? 'F' : F.lens ? '2F' : 'C', xx, y0 + 24, t + 600, { size: 20, color: 'ink', weight: '700' });
      }
      vec(m, [obj[0], y0], obj, t + 800, 'a', 5);
      label(m, ml ? 'വസ്തു' : 'object', obj[0], obj[1] - 22, t + 1000, { size: 20, color: 'a' });
      say(`u = ${num(F.u)} cm   ·   f = ${F.f > 0 ? '+' : ''}${num(F.f)} cm`, t + 1100, 'ink');
      t += 2000;
    } else if (st.op === 'rays') {
      const hit: Pt = [x0, obj[1]]; // ray 1 meets the lens / mirror at the object's height
      // ray 1: parallel to the axis …
      ray([obj, hit], t, 'carry');
      if (F.lens) {
        const Fp: Pt = [X(F.f), y0]; // convex: F on the right (+f); concave: F on the left (−f)
        if (p.kind === 'convex-lens') ray([hit, onward(hit, Fp)], t + 700, 'carry');
        else { const dir: Pt = [hit[0] + (hit[0] - Fp[0]), hit[1] + (hit[1] - Fp[1])]; ray([hit, onward(hit, dir)], t + 700, 'carry'); ray([hit, Fp], t + 900, 'carry', true); }
        // ray 2: through the optical centre, straight on
        const c: Pt = [x0, y0];
        ray([obj, c], t + 1400, 'c');
        ray([c, onward(obj, c)], t + 2000, 'c');
        if (!F.real) ray([c, onward(c, obj)], t + 2300, 'c', true);
      } else {
        const Fp: Pt = [X(F.f), y0]; // concave: F in front (left); convex: behind (right)
        if (p.kind === 'concave-mirror') ray([hit, onward(hit, Fp)], t + 700, 'carry');
        else { const dir: Pt = [hit[0] - (Fp[0] - hit[0]), hit[1] - (Fp[1] - hit[1])]; ray([hit, onward(hit, dir)], t + 700, 'carry'); ray([hit, Fp], t + 900, 'carry', true); }
        // ray 2: to the pole, reflected at the same angle
        const P: Pt = [x0, y0];
        ray([obj, P], t + 1400, 'c');
        const back: Pt = [obj[0], 2 * y0 - obj[1]];
        ray([P, onward(P, back)], t + 2000, 'c');
        if (!F.real) ray([P, onward(P, [2 * P[0] - back[0], 2 * P[1] - back[1]])], t + 2300, 'c', true);
      }
      // a virtual image: the rays only seem to come from it; when the lens's own ray 1 continues back, extend it too
      if (!F.real && p.kind === 'convex-lens') ray([hit, onward([X(F.f), y0], hit)], t + 2300, 'carry', true);
      if (!F.real && p.kind === 'concave-mirror') ray([hit, onward([X(F.f), y0], hit)], t + 2300, 'carry', true);
      t += 3100;
    } else if (st.op === 'image') {
      vec(m, [img[0], y0], img, t, F.real ? 'accent' : 'b', 5);
      ring(m, img[0], img[1], 26, 26, t + 400, 'accent');
      const w = [
        F.real ? (ml ? 'യഥാർത്ഥം' : 'real') : ml ? 'മിഥ്യ' : 'virtual',
        F.erect ? (ml ? 'നിവർന്നത്' : 'erect') : ml ? 'തലകീഴായത്' : 'inverted',
        F.same ? (ml ? 'അതേ വലുപ്പം' : 'same size') : F.bigger ? (ml ? 'വലുതായത്' : 'magnified') : ml ? 'ചെറുതായത്' : 'diminished',
      ];
      label(m, ml ? 'പ്രതിബിംബം' : 'image', img[0], F.erect ? img[1] - 22 : img[1] + 26, t + 300, { size: 20, color: 'accent' });
      say(w.join(' · '), t + 600, 'accent');
      t += 2000;
    } else if (st.op === 'formula') {
      const text = F.lens
        ? `1/v = 1/f + 1/u = 1/${par(F.f, num)} + 1/${par(F.u, num)}  →  v = ${num(F.v)} cm`
        : `1/v = 1/f − 1/u = 1/${par(F.f, num)} − 1/${par(F.u, num)}  →  v = ${num(F.v)} cm`;
      say(text, t, 'b');
      t += 2200;
    } else if (st.op === 'magnification') {
      const y = 420 + 44 * line;
      const text = `m = ${F.lens ? 'v ÷ u' : '−v ÷ u'} = ${F.lens ? '' : '−'}${par(F.v, num)} ÷ ${par(F.u, num)} = ${num(F.m)}${F.hImg !== undefined ? `   ·   h′ = ${num(F.hImg)} cm` : ''}`;
      say(text, t, 'tick');
      ring(m, 360, y, ringW(text), 24, t + 900, 'tick');
      sparkle(m, 360, y, t + 1100);
      t += 2200;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

export const OPTICS_EXAMPLE: OpticsPlan = {
  kind: 'convex-lens',
  focalCm: 10,
  objectCm: 30,
  heightCm: 3,
  steps: [
    { op: 'show', say: { en: 'An object 30 centimetres in front of a convex lens of focal length 10 centimetres.', ml: 'ഫോക്കസ് ദൂരം 10 സെ.മീ. ആയ കോൺവെക്സ് ലെൻസിന് മുന്നിൽ 30 സെ.മീ. അകലെ ഒരു വസ്തു.' } },
    { op: 'rays', say: { en: 'A ray parallel to the axis bends through the focus; a ray through the centre goes straight on.', ml: 'അക്ഷത്തിന് സമാന്തരമായ രശ്മി ഫോക്കസിലൂടെ പോകുന്നു; കേന്ദ്രത്തിലൂടെയുള്ളത് നേരെ പോകുന്നു.' } },
    { op: 'image', say: { en: 'Where the two rays meet, the image forms.', ml: 'രണ്ടു രശ്മികളും കൂടിച്ചേരുന്നിടത്ത് പ്രതിബിംബം രൂപപ്പെടുന്നു.' } },
    { op: 'formula', say: { en: 'The lens formula gives the image distance.', ml: 'ലെൻസ് സമവാക്യം പ്രതിബിംബ ദൂരം നൽകുന്നു.' } },
    { op: 'magnification', say: { en: 'Magnification tells how big the image is, and the minus sign means inverted.', ml: 'ആവർധനം പ്രതിബിംബത്തിന്റെ വലുപ്പം പറയുന്നു; ന്യൂന ചിഹ്നം തലകീഴായതിനെ സൂചിപ്പിക്കുന്നു.' } },
  ],
};

export const opticsTemplate: AgentTemplate = {
  id: 'optics',
  title: 'Lenses and mirrors',
  about: 'A convex/concave lens or mirror: two principal rays meet at the image; real or virtual, erect or inverted, magnified or diminished; the lens/mirror formula and the magnification, all computed (Cartesian signs).',
  example: OPTICS_EXAMPLE,
  validate: validateOptics,
  build: buildOptics,
};
