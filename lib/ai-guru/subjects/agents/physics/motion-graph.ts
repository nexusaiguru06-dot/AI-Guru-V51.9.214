/**
 * Physics agent · template "motion-graph": uniform acceleration shown on a velocity–time graph.
 * Given u, a and t the app works out v = u + a t, the slope (a) and the area under the line (the distance
 * s = ½ (u + v) t), draws the graph to scale and moves a trolley the same way.
 */

import { type MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { isBi, label, newScene, num, pick, ring, sparkle, uid, type Bi, type Pt } from '../../kit';
import type { AgentTemplate } from '../../types';

export interface MotionPlan {
  /** Starting speed, m/s. */
  u: number;
  /** Acceleration, m/s² (negative = slowing down). */
  a: number;
  /** Time, s. */
  t: number;
  steps: Array<{ op: 'show' | 'graph' | 'slope' | 'area' | 'answer'; say: Bi }>;
}

export function validateMotion(x: unknown): string[] {
  const p = x as MotionPlan;
  const e: string[] = [];
  if (!p || typeof p !== 'object') return ['plan is not an object'];
  if (!(Number.isFinite(p.u) && p.u >= 0 && p.u <= 100)) e.push('u must be 0–100 m/s');
  if (!(Number.isFinite(p.a) && p.a !== 0 && Math.abs(p.a) <= 30)) e.push('a must be a non-zero number within ±30');
  if (!(Number.isInteger(p.t) && p.t >= 1 && p.t <= 30)) e.push('t must be a whole number from 1 to 30');
  if (Number.isFinite(p.u + p.a * p.t) && p.u + p.a * p.t < 0) e.push('the object would stop before t (v < 0); use the time it takes to stop');
  if (!Array.isArray(p.steps) || !p.steps.length || p.steps.length > 8) return [...e, 'steps: 1 to 8'];
  if (p.steps[0].op !== 'show') e.push('the first step is "show"');
  const order = ['show', 'graph', 'slope', 'area', 'answer'];
  let last = -1;
  p.steps.forEach((s, i) => {
    const k = order.indexOf(s.op);
    if (k < 0) e.push(`steps[${i}].op unknown`);
    else if (k <= last) e.push(`steps[${i}]: steps run in the order ${order.join(', ')}, each once`);
    last = Math.max(last, k);
    if (!isBi(s.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  return e;
}

export const motionFacts = (p: MotionPlan) => {
  const v = p.u + p.a * p.t;
  const s = ((p.u + v) / 2) * p.t;
  return { v, s };
};

export function buildMotion(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as MotionPlan;
  const { v, s } = motionFacts(p);
  const H = 680;
  const m = newScene(title, H);
  const ox = 120;
  const oy = 470;
  const gw = 480;
  const gh = 240;
  const vmax = Math.max(p.u, v, 1) * 1.15;
  const X = (time: number): number => ox + (time / p.t) * gw;
  const Y = (speed: number): number => oy - (speed / vmax) * gh;
  let t = 300;

  const trolley = uid('tr');
  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      // a track with a trolley
      m.rule(uid('trk'), 60, 140, 660, 140, t, { color: 'ink', width: 4 });
      m.poly(trolley, [[60, 96], [130, 96], [130, 136], [60, 136]], t + 300, { color: 'a', fill: 'a', fillAlpha: 0.3, closed: true, width: 3, dur: 400, z: 4, silent: true });
      label(m, `u = ${num(p.u)} m/s,  a = ${num(p.a)} m/s²,  t = ${num(p.t)} s`, 360, 200, t + 600, { size: 30, color: 'result', weight: '700' });
      t += 1600;
    } else if (st.op === 'graph') {
      // axes
      m.rule(uid('ax'), ox, oy, ox + gw + 20, oy, t, { color: 'ink', width: 3 });
      m.rule(uid('ay'), ox, oy, ox, oy - gh - 30, t + 200, { color: 'ink', width: 3 });
      label(m, 'time (s)', ox + gw / 2, oy + 56, t + 500, { size: 22, color: 'ink' });
      label(m, 'v (m/s)', ox + 10, oy - gh - 44, t + 500, { size: 22, color: 'ink' });
      label(m, '0', ox - 16, oy + 18, t + 500, { size: 20 });
      label(m, num(p.t), X(p.t), oy + 22, t + 600, { size: 22 });
      label(m, num(p.u), ox - 28, Y(p.u), t + 600, { size: 22, color: 'a' });
      label(m, num(v), ox - 28, Y(v), t + 700, { size: 22, color: 'c' });
      const line = uid('ln');
      m.poly(line, [[X(0), Y(p.u)], [X(p.t), Y(v)]], t + 800, { color: 'accent', closed: false, width: 5, dur: 900, z: 4, silent: true });
      // the trolley moves the same way: it covers s in t seconds
      m.morph(trolley, [[530, 96], [600, 96], [600, 136], [530, 136]], t + 600, { dur: 2200, e: (q) => q * q });
      t += 2000;
    } else if (st.op === 'slope') {
      const mid: Pt = [X(p.t * 0.5), Y(p.u + (p.a * p.t) / 2)];
      const r = ring(m, mid[0], mid[1] - 28, 120, 30, t, 'b');
      label(m, `a = (${num(v)} − ${num(p.u)}) ÷ ${num(p.t)} = ${num(p.a)} m/s²`, mid[0] + 20, mid[1] - 28, t + 400, { size: 26, color: 'b', weight: '700' });
      void r;
      t += 1800;
    } else if (st.op === 'area') {
      const poly = uid('ar');
      m.poly(poly, [[X(0), oy], [X(0), Y(p.u)], [X(p.t), Y(v)], [X(p.t), oy]], t, { color: 'c', fill: 'c', fillAlpha: 0.3, closed: true, width: 2, dur: 900, z: 1, silent: true });
      label(m, `s = ½ (${num(p.u)} + ${num(v)}) × ${num(p.t)} = ${num(s)} m`, 360, oy + 100, t + 800, { size: 30, color: 'c', weight: '700' });
      t += 2000;
    } else if (st.op === 'answer') {
      const tx = 360;
      ring(m, tx, oy + 100, 250, 34, t, 'accent');
      sparkle(m, tx, oy + 100, t + 200);
      t += 1400;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

export const MOTION_EXAMPLE: MotionPlan = {
  u: 4,
  a: 2,
  t: 6,
  steps: [
    { op: 'show', say: { en: 'A trolley starts at 4 m/s and speeds up by 2 m/s every second, for 6 seconds.', ml: 'ഒരു ട്രോളി 4 m/s വേഗത്തിൽ തുടങ്ങി ഓരോ സെക്കൻഡിലും 2 m/s വീതം കൂട്ടുന്നു, 6 സെക്കൻഡ് നേരം.' } },
    { op: 'graph', say: { en: 'On a speed–time graph this is a straight line going up.', ml: 'വേഗം–സമയ ഗ്രാഫിൽ ഇത് മുകളിലേക്കുള്ള ഒരു നേർരേഖയാണ്.' } },
    { op: 'slope', say: { en: 'The slope of the line is the acceleration.', ml: 'രേഖയുടെ ചരിവ് ത്വരണമാണ്.' } },
    { op: 'area', say: { en: 'The area under the line is the distance travelled.', ml: 'രേഖയ്ക്ക് താഴെയുള്ള പരപ്പളവ് സഞ്ചരിച്ച ദൂരമാണ്.' } },
    { op: 'answer', say: { en: 'So the trolley travels 60 metres.', ml: 'അതിനാൽ ട്രോളി 60 മീറ്റർ സഞ്ചരിക്കുന്നു.' } },
  ],
};

export const motionTemplate: AgentTemplate = {
  id: 'motion-graph',
  title: 'Speed–time graph',
  about: 'Uniform acceleration: v = u + at, slope = a, area = distance, all computed and drawn to scale.',
  example: MOTION_EXAMPLE,
  validate: validateMotion,
  build: buildMotion,
};
