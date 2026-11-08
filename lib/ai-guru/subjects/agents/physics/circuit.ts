/**
 * V51.9.148 — Physics agent · template "circuit": a battery and 1–4 resistors in series or in parallel.
 * The circuit is drawn; the total resistance is found (series R = R₁ + R₂ …, parallel 1/R = 1/R₁ + 1/R₂ …); the
 * current from Ohm's law I = V ÷ R flows round the loop (moving dots); then each resistor's share (series: the
 * voltage V = I R across each; parallel: the current I = V ÷ R through each); optionally the power P = V I.
 * Every number is computed here.
 */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { label, newScene, num, pick, rect, ring, sparkle, uid, type Bi, type Pt } from '../../kit';
import type { AgentTemplate } from '../../types';
import { checkSteps, inRange, ringW, round } from './common';

export type CircOp = 'show' | 'total' | 'current' | 'share' | 'power';
export interface CircuitPlan {
  /** Battery voltage, volts. */
  voltage: number;
  /** Resistances, ohms (1–4). */
  resistors: number[];
  connection: 'series' | 'parallel';
  steps: Array<{ op: CircOp; say: Bi }>;
}
const ORDER: CircOp[] = ['show', 'total', 'current', 'share', 'power'];

export function circuitFacts(p: CircuitPlan) {
  const R = p.connection === 'series' ? round(p.resistors.reduce((a, r) => a + r, 0), 3) : round(1 / p.resistors.reduce((a, r) => a + 1 / r, 0), 3);
  const I = round(p.voltage / R, 3);
  const share = p.resistors.map((r) => (p.connection === 'series' ? round(I * r, 3) : round(p.voltage / r, 3)));
  const P = round(p.voltage * I, 3);
  return { R, I, share, P };
}

export function validateCircuit(x: unknown): string[] {
  const p = x as CircuitPlan;
  if (!p || typeof p !== 'object') return ['plan is not an object'];
  const e: string[] = [];
  if (!inRange(p.voltage, 0.1, 1000)) e.push('voltage is the battery voltage, 0.1–1000 V');
  if (!Array.isArray(p.resistors) || p.resistors.length < 1 || p.resistors.length > 4 || !p.resistors.every((r) => inRange(r, 0.01, 1e6))) e.push('resistors: 1 to 4 resistances in ohms');
  if (p.connection !== 'series' && p.connection !== 'parallel') e.push('connection is "series" or "parallel"');
  return [...e, ...checkSteps(p.steps, ORDER, ['current'])];
}

const ohm = (r: number) => `${num(r)} Ω`;

export function buildCircuit(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as CircuitPlan;
  const f = circuitFacts(p);
  const ml = lang === 'ml';
  const m = newScene(title, 680);
  const n = p.resistors.length;
  const L = 110, Rt = 620, T = 90, B = 350; // the loop
  const resAt: Pt[] = [];
  let t = 300;
  let line = 0;
  const say = (text: string, at: number, color: string) => label(m, text, 360, 420 + 44 * line++, at, { size: 24, color, weight: '700' });
  const series = p.connection === 'series';
  // the loop as a path (for the moving current)
  const loop: Pt[] = [[L, B], [L, T], [Rt, T], [Rt, B], [L, B]];

  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      // battery on the left side
      const by = (T + B) / 2;
      m.rule(uid('w'), L, T, L, by - 22, t, { color: 'ink', width: 3 });
      m.rule(uid('w'), L, by + 22, L, B, t, { color: 'ink', width: 3 });
      m.rule(uid('bp'), L - 26, by - 10, L + 26, by - 10, t + 200, { color: 'a', width: 4 });
      m.rule(uid('bn'), L - 14, by + 10, L + 14, by + 10, t + 200, { color: 'ink', width: 6 });
      label(m, `${num(p.voltage)} V`, L - 62, by, t + 400, { size: 24, color: 'a', weight: '700' });
      m.rule(uid('w'), L, B, Rt, B, t + 300, { color: 'ink', width: 3 });
      m.rule(uid('w'), Rt, B, Rt, T, t + 300, { color: 'ink', width: 3 });
      if (series) {
        // resistors along the top wire
        const seg = (Rt - L) / n;
        let x = L;
        p.resistors.forEach((r, i) => {
          const cx = L + seg * (i + 0.5);
          m.rule(uid('w'), x, T, cx - 36, T, t + 500, { color: 'ink', width: 3 });
          rect(m, cx - 36, T - 14, 72, 28, t + 600 + i * 250, 'b', { alpha: 0.25, width: 3, z: 3 });
          label(m, `R${n > 1 ? i + 1 : ''} = ${ohm(r)}`, cx, T - 34, t + 700 + i * 250, { size: 22, color: 'b', weight: '700' });
          resAt.push([cx, T]);
          x = cx + 36;
        });
        m.rule(uid('w'), x, T, Rt, T, t + 500, { color: 'ink', width: 3 });
      } else {
        // branches between two nodes on the top
        const nx0 = 240, nx1 = 500;
        m.rule(uid('w'), L, T, nx0, T, t + 500, { color: 'ink', width: 3 });
        m.rule(uid('w'), nx1, T, Rt, T, t + 500, { color: 'ink', width: 3 });
        const gap = Math.min(70, 220 / Math.max(1, n - 1));
        p.resistors.forEach((r, i) => {
          const y = T + (i - (n - 1) / 2) * gap + (n > 1 ? (n - 1) * gap / 2 : 0);
          const cx = (nx0 + nx1) / 2;
          m.rule(uid('w'), nx0, y, cx - 36, y, t + 500, { color: 'ink', width: 3 });
          m.rule(uid('w'), cx + 36, y, nx1, y, t + 500, { color: 'ink', width: 3 });
          rect(m, cx - 36, y - 14, 72, 28, t + 600 + i * 250, 'b', { alpha: 0.25, width: 3, z: 3 });
          label(m, ohm(r), cx - 84, y - 16, t + 700 + i * 250, { size: 18, color: 'b', weight: '700', z: 6 });
          resAt.push([cx, y]);
        });
        const yLast = T + (n - 1) * gap;
        if (n > 1) {
          m.rule(uid('w'), nx0, T, nx0, yLast, t + 500, { color: 'ink', width: 3 });
          m.rule(uid('w'), nx1, T, nx1, yLast, t + 500, { color: 'ink', width: 3 });
        }
      }
      label(m, ml ? (series ? 'ശ്രേണീ രീതി' : 'സമാന്തര രീതി') : series ? 'in series' : 'in parallel', 360, B + 34, t + 900, { size: 22, color: 'done' });
      t += 1700 + n * 250;
    } else if (st.op === 'total') {
      const text = series
        ? `R = ${p.resistors.map(ohm).join(' + ')} = ${ohm(f.R)}`
        : `1/R = ${p.resistors.map((r) => `1/${num(r)}`).join(' + ')}  →  R = ${ohm(f.R)}`;
      const rings = resAt.map(([x, y], i) => ring(m, x, y, 50, 26, t + i * 200, 'carry'));
      m.fadeOut(rings, t + 1700, 400);
      say(text, t + 400, 'carry');
      t += 2000;
    } else if (st.op === 'current') {
      say(`I = V ÷ R = ${num(p.voltage)} ÷ ${num(f.R)} = ${num(f.I)} A`, t, 'accent');
      // electrons? no — conventional current: dots go round from + through the circuit
      const per = loop.slice(0, 4).map((a, i) => Math.hypot(loop[i + 1][0] - a[0], loop[i + 1][1] - a[1]));
      const total = per.reduce((a, b) => a + b, 0);
      const posAt = (d: number): Pt => { let k = 0; while (d > per[k]) { d -= per[k]; k = (k + 1) % 4; } const a = loop[k], b = loop[k + 1]; const q = d / per[k]; return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q]; };
      for (let i = 0; i < 8; i++) {
        const id = uid('cur');
        const start = (total * i) / 8;
        const [x, y] = posAt(start);
        m.dot(id, x, y, t + 300, { color: 'carry', r: 5 });
        for (let k = 1; k <= 12; k++) { const [nx, ny] = posAt((start + (total * k) / 24) % total); m.move(id, nx, ny, t + 300 + (k - 1) * 150, { dur: 150, sound: false }); }
        m.fadeOut(id, t + 300 + 12 * 150, 300);
      }
      t += 300 + 12 * 150 + 400;
    } else if (st.op === 'share') {
      p.resistors.forEach((r, i) => {
        const [x, y] = resAt[i];
        const txt = series ? `${num(f.share[i])} V` : `${num(f.share[i])} A`;
        label(m, txt, series ? x : x + 82, series ? y + 34 : y, t + i * 400, { size: 22, color: 'c', weight: '700' });
        void r;
      });
      say(series
        ? `${ml ? 'ഓരോന്നിലും' : 'across each'}: V = I × R  →  ${f.share.map((v) => `${num(v)} V`).join(' + ')} = ${num(round(f.share.reduce((a, b) => a + b, 0), 3))} V`
        : `${ml ? 'ഓരോന്നിലൂടെയും' : 'through each'}: I = V ÷ R  →  ${f.share.map((v) => `${num(v)} A`).join(' + ')} = ${num(round(f.share.reduce((a, b) => a + b, 0), 3))} A`, t + n * 400, 'c');
      t += n * 400 + 1800;
    } else if (st.op === 'power') {
      const y = 420 + 44 * line;
      const pt = `P = V × I = ${num(p.voltage)} × ${num(f.I)} = ${num(f.P)} W`;
      say(pt, t, 'tick');
      ring(m, 360, y, ringW(pt), 24, t + 800, 'tick');
      sparkle(m, 360, y, t + 1000);
      t += 2000;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

export const CIRCUIT_EXAMPLE: CircuitPlan = {
  voltage: 12,
  resistors: [2, 4],
  connection: 'series',
  steps: [
    { op: 'show', say: { en: 'A 12 volt battery with a 2 ohm and a 4 ohm resistor in series.', ml: '12 വോൾട്ട് ബാറ്ററിയും ശ്രേണിയിൽ 2 ഓം, 4 ഓം പ്രതിരോധകങ്ങളും.' } },
    { op: 'total', say: { en: 'In series the resistances simply add up.', ml: 'ശ്രേണിയിൽ പ്രതിരോധങ്ങൾ കൂട്ടിയാൽ മതി.' } },
    { op: 'current', say: { en: "Ohm's law: current is voltage divided by resistance.", ml: 'ഓം നിയമം: കറന്റ് = വോൾട്ടത ÷ പ്രതിരോധം.' } },
    { op: 'share', say: { en: 'The same current flows through both, so the bigger resistor takes more of the voltage.', ml: 'രണ്ടിലൂടെയും ഒരേ കറന്റ്; വലിയ പ്രതിരോധകത്തിന് കൂടുതൽ വോൾട്ടത.' } },
    { op: 'power', say: { en: 'The power used is voltage times current.', ml: 'ഉപയോഗിക്കുന്ന പവർ = വോൾട്ടത × കറന്റ്.' } },
  ],
};

export const circuitTemplate: AgentTemplate = {
  id: 'circuit',
  title: "Circuits: Ohm's law",
  about: 'A battery with resistors in series or parallel: total resistance, current I = V/R flowing round the loop, each resistor’s share, and power P = VI.',
  example: CIRCUIT_EXAMPLE,
  validate: validateCircuit,
  build: buildCircuit,
};
