/**
 * V51.9.148 — Physics agent · template "pendulum": a simple pendulum of length L swings; its period is
 * T = 2π √(L ÷ g). The bob really swings on the board; then a pendulum four times as long swings beside it with
 * twice the period. Every number is computed here. (Idea of the scene: the pendulum simulation of physicshub, MIT.)
 */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { ellipse, label, newScene, num, pick, ring, sparkle, uid, type Bi, type Pt } from '../../kit';
import type { AgentTemplate } from '../../types';
import { checkSteps, gOf, inRange, round } from './common';

export type PendOp = 'show' | 'swing' | 'period' | 'compare';
export interface PendulumPlan {
  /** Length of the string, metres. */
  lengthM: number;
  g?: number;
  steps: Array<{ op: PendOp; say: Bi }>;
}
const ORDER: PendOp[] = ['show', 'swing', 'period', 'compare'];

export function pendFacts(p: PendulumPlan) {
  const g = gOf(p.g);
  const T = round(2 * Math.PI * Math.sqrt(p.lengthM / g));
  const T4 = round(2 * Math.PI * Math.sqrt((4 * p.lengthM) / g));
  return { g, T, T4, root: round(Math.sqrt(p.lengthM / g), 3) };
}

export function validatePendulum(x: unknown): string[] {
  const p = x as PendulumPlan;
  if (!p || typeof p !== 'object') return ['plan is not an object'];
  const e: string[] = [];
  if (!inRange(p.lengthM, 0.05, 50)) e.push('lengthM is the string length, 0.05–50 m');
  if (p.g !== undefined && gOf(p.g) !== p.g) e.push('g is 9.8 or 10');
  return [...e, ...checkSteps(p.steps, ORDER, ['period'])];
}

/** A pendulum that can swing: string + bob, both polygons (so they morph). */
function pendulum(m: ReturnType<typeof newScene>, px: number, py: number, len: number, t: number, color: string) {
  const s = uid('str');
  const b = uid('bob');
  const at = (a: number): Pt => [px + len * Math.sin(a), py + len * Math.cos(a)];
  const A = 0.38;
  m.poly(s, [[px, py], at(A)], t, { color: 'ink', closed: false, width: 2.5, dur: 400, z: 3, silent: true });
  m.poly(b, ellipse(...at(A), 16, 16, 20), t + 300, { color, fill: color, fillAlpha: 1, closed: true, width: 2, dur: 300, z: 5, silent: true });
  /** Swing for `half` half-periods, each `ms` long (a cosine in time, so it slows at the ends). */
  const swing = (t0: number, half: number, ms: number) => {
    const K = 10;
    for (let h = 0; h < half; h++) for (let k = 1; k <= K; k++) {
      const ph = (h + k / K) * Math.PI;
      const a = A * Math.cos(ph);
      const at0 = t0 + (h * K + k - 1) * (ms / K);
      m.morph(s, [[px, py], at(a)], at0, { dur: ms / K, e: (q) => q });
      m.morph(b, ellipse(...at(a), 16, 16, 20), at0, { dur: ms / K, e: (q) => q });
    }
    return t0 + half * ms;
  };
  return { swing, at, A };
}

export function buildPendulum(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as PendulumPlan;
  const f = pendFacts(p);
  const ml = lang === 'ml';
  const m = newScene(title, 680);
  const px = 230, py = 90, len = 230;
  let t = 300;
  let pend: ReturnType<typeof pendulum> | null = null;
  const clear: string[] = [];
  // the board's half-swing: ~0.9 s for this pendulum (the 4× pendulum takes twice as long)
  const HALF = 900;

  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      m.rule(uid('sup'), px - 90, py, px + 90, py, t, { color: 'ink', width: 6 });
      pend = pendulum(m, px, py, len, t + 300, 'a');
      m.rule(uid('vl'), px, py, px, py + len + 30, t + 700, { color: 'done', width: 1.5 });
      label(m, `L = ${num(p.lengthM)} m`, px - 70, py + len / 2, t + 900, { size: 24, color: 'b', weight: '700' });
      t += 1700;
    } else if (st.op === 'swing') {
      const end = pend!.swing(t, 4, HALF);
      const [lx, ly] = pend!.at(pend!.A);
      clear.push(label(m, ml ? 'ഒരു പൂർണ ദോലനം = ഒരു പീരിയഡ്' : 'one full swing (there and back) = one period', 360, py + len + 80, t + 400, { size: 22, color: 'carry' }));
      ring(m, lx, ly, 26, 26, t, 'carry');
      t = end + 300;
    } else if (st.op === 'period') {
      clear.push(label(m, 'T = 2π √(L ÷ g)', 520, 170, t, { size: 30, color: 'ink', weight: '700' }));
      clear.push(label(m, `= 2 × 3.14 × √(${num(p.lengthM)} ÷ ${num(f.g)})`, 520, 215, t + 600, { size: 24, color: 'b' }));
      clear.push(label(m, `= ${num(f.T)} s`, 520, 258, t + 1200, { size: 32, color: 'accent', weight: '700' }));
      clear.push(ring(m, 520, 258, 80, 28, t + 1700, 'tick'));
      if (pend) pend.swing(t, 2, HALF);
      t += 2400;
    } else if (st.op === 'compare') {
      if (clear.length) m.fadeOut(clear, t, 400);
      label(m, `T = ${num(f.T)} s`, px, py + len + 60, t + 300, { size: 26, color: 'a', weight: '700' });
      const p2x = 540, len2 = Math.min(400, len * 1.6);
      m.rule(uid('sup2'), p2x - 70, py, p2x + 70, py, t, { color: 'ink', width: 6 });
      const pend2 = pendulum(m, p2x, py, len2, t + 300, 'c');
      label(m, ml ? `4 × നീളം → T = ${num(f.T4)} s` : `4 × longer → T = ${num(f.T4)} s`, p2x, py + len2 + 50, t + 800, { size: 24, color: 'c', weight: '700' });
      // the long one swings at half the pace: one of its swings for two of the short one's
      const t0 = t + 900;
      pend2.swing(t0, 2, HALF * 2);
      if (pend) pend.swing(t0, 4, HALF);
      label(m, ml ? 'നീളം 4 മടങ്ങ് → പീരിയഡ് 2 മടങ്ങ്' : 'length × 4  →  period × 2', 360, py + len2 + 100, t0 + 3800, { size: 26, color: 'tick', weight: '700' });
      sparkle(m, 360, py + len2 + 100, t0 + 4000);
      t = t0 + 4 * HALF + 600;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

export const PENDULUM_EXAMPLE: PendulumPlan = {
  lengthM: 1,
  steps: [
    { op: 'show', say: { en: 'A simple pendulum: a small bob hanging on a string one metre long.', ml: 'ഒരു ലഘു പെൻഡുലം: ഒരു മീറ്റർ നീളമുള്ള ചരടിൽ തൂങ്ങുന്ന ഒരു ചെറിയ ഗോളം.' } },
    { op: 'swing', say: { en: 'Pull it aside and let go. It swings there and back again and again.', ml: 'ഒരു വശത്തേക്ക് മാറ്റി വിട്ടാൽ അത് ആവർത്തിച്ച് ആടുന്നു.' } },
    { op: 'period', say: { en: 'The time for one full swing is the period. It depends only on the length and g.', ml: 'ഒരു പൂർണ ദോലനത്തിനുള്ള സമയമാണ് പീരിയഡ്. അത് നീളത്തെയും g-യെയും മാത്രം ആശ്രയിക്കുന്നു.' } },
    { op: 'compare', say: { en: 'Make the string four times longer and the period doubles.', ml: 'ചരടിന്റെ നീളം നാലു മടങ്ങാക്കിയാൽ പീരിയഡ് ഇരട്ടിയാകും.' } },
  ],
};

export const pendulumTemplate: AgentTemplate = {
  id: 'pendulum',
  title: 'Simple pendulum',
  about: 'A pendulum swings; its period T = 2π √(L/g) is computed, and a pendulum four times as long swings with twice the period.',
  example: PENDULUM_EXAMPLE,
  validate: validatePendulum,
  build: buildPendulum,
};
