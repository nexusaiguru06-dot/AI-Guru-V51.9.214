/**
 * V51.9.148 — Physics agent · template "wave": a wave on the board (crests, troughs, amplitude, wavelength λ) that
 * really travels; then frequency f, period T = 1 ÷ f and speed v = f × λ. The plan gives any two of f, λ and v;
 * the third is computed here. (Idea of the scene: the wave pages of Physics-Notebook, MIT.)
 */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { label, newScene, num, pick, ring, sparkle, uid, vec, type Bi, type Pt } from '../../kit';
import type { AgentTemplate } from '../../types';
import { checkSteps, inRange, ringW, round } from './common';

export type WaveOp = 'show' | 'wavelength' | 'frequency' | 'period' | 'speed';
export interface WavePlan {
  /** Frequency, Hz. */
  f?: number;
  /** Wavelength, metres. */
  lambda?: number;
  /** Speed, m/s. */
  v?: number;
  /** "sound", "water", "light", "string" … — only the label. */
  kind?: string;
  steps: Array<{ op: WaveOp; say: Bi }>;
}
const ORDER: WaveOp[] = ['show', 'wavelength', 'frequency', 'period', 'speed'];

export function waveFacts(p: WavePlan) {
  const f = p.f ?? round(p.v! / p.lambda!, 4);
  const lambda = p.lambda ?? round(p.v! / p.f!, 4);
  const v = p.v ?? round(p.f! * p.lambda!, 4);
  const T = round(1 / f, 4);
  const unknown: 'f' | 'lambda' | 'v' = p.f === undefined ? 'f' : p.lambda === undefined ? 'lambda' : 'v';
  return { f, lambda, v, T, unknown };
}

export function validateWave(x: unknown): string[] {
  const p = x as WavePlan;
  if (!p || typeof p !== 'object') return ['plan is not an object'];
  const e: string[] = [];
  const given = (['f', 'lambda', 'v'] as const).filter((k) => p[k] !== undefined);
  if (given.length !== 2) e.push('give exactly two of f (Hz), lambda (m) and v (m/s); the app computes the third');
  if (p.f !== undefined && !inRange(p.f, 1e-3, 1e15)) e.push('f must be a positive number of hertz');
  if (p.lambda !== undefined && !inRange(p.lambda, 1e-12, 1e6)) e.push('lambda must be a positive number of metres');
  if (p.v !== undefined && !inRange(p.v, 1e-3, 3.1e8)) e.push('v must be a positive number of m/s (at most the speed of light)');
  return [...e, ...checkSteps(p.steps, ORDER, ['speed'])];
}

/** Numbers like 3 × 10⁸ for very big or small values. */
function sci(v: number): string {
  if (v === 0 || (Math.abs(v) >= 0.01 && Math.abs(v) < 1e6)) return num(round(v, 3));
  const e = Math.floor(Math.log10(Math.abs(v)));
  const sup = String(e).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
  return `${num(round(v / 10 ** e, 3))} × 10${sup}`;
}

export function buildWave(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as WavePlan;
  const f = waveFacts(p);
  const ml = lang === 'ml';
  const m = newScene(title, 680);
  const x0 = 70, x1 = 650, y0 = 230, A = 70, LPX = 200; // one wavelength = 200 px on the board
  const wave = (phase: number): Pt[] => Array.from({ length: 97 }, (_, i) => { const x = x0 + ((x1 - x0) * i) / 96; return [x, y0 - A * Math.sin(((x - x0) / LPX) * 2 * Math.PI - phase)]; });
  const wid = uid('wave');
  let t = 300;
  let line = 0;
  const say = (text: string, at: number, color: string) => label(m, text, 360, 400 + 44 * line++, at, { size: 24, color, weight: '700' });

  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      m.rule(uid('ax'), x0 - 10, y0, x1 + 10, y0, t, { color: 'done', width: 1.5 });
      m.poly(wid, wave(0), t + 200, { color: 'b', closed: false, width: 4, dur: 1400, z: 3, silent: true });
      const crest = x0 + LPX / 4, trough = x0 + (3 * LPX) / 4;
      label(m, ml ? 'ശൃംഗം' : 'crest', crest, y0 - A - 26, t + 1500, { size: 22, color: 'a', weight: '700' });
      label(m, ml ? 'ഗർത്തം' : 'trough', trough, y0 + A + 28, t + 1700, { size: 22, color: 'c', weight: '700' });
      vec(m, [crest, y0], [crest, y0 - A], t + 1900, 'carry', 3);
      label(m, ml ? 'ആയതി' : 'amplitude', crest - 4, y0 + 22, t + 2100, { size: 20, color: 'carry' });
      if (p.kind) label(m, p.kind, 360, 70, t + 300, { size: 24, color: 'ink' });
      t += 2700;
    } else if (st.op === 'wavelength') {
      const a = x0 + LPX * 1.25, b = a + LPX;
      m.rule(uid('l1'), a, y0 - A, a, y0 - A - 50, t, { color: 'accent', width: 2 });
      m.rule(uid('l2'), b, y0 - A, b, y0 - A - 50, t, { color: 'accent', width: 2 });
      vec(m, [(a + b) / 2, y0 - A - 40], [b, y0 - A - 40], t + 300, 'accent', 3);
      vec(m, [(a + b) / 2, y0 - A - 40], [a, y0 - A - 40], t + 300, 'accent', 3);
      label(m, 'λ', (a + b) / 2, y0 - A - 64, t + 600, { size: 30, color: 'accent', weight: '700' });
      say(`λ = ${sci(f.lambda)} m${f.unknown === 'lambda' ? (ml ? '  (കണ്ടെത്തണം)' : '  (to find)') : ''}`, t + 800, 'accent');
      t += 1900;
    } else if (st.op === 'frequency') {
      // the wave travels: one wavelength passes a marker each period
      const mk = x0 + LPX * 2.75;
      m.rule(uid('mk'), mk, y0 - A - 20, mk, y0 + A + 20, t, { color: 'carry', width: 3 });
      for (let k = 1; k <= 16; k++) m.morph(wid, wave((k * Math.PI) / 4), t + (k - 1) * 160, { dur: 160, e: (q) => q });
      say(`f = ${sci(f.f)} Hz${f.unknown === 'f' ? (ml ? '  (കണ്ടെത്തണം)' : '  (to find)') : ml ? ' — ഓരോ സെക്കൻഡിലും കടന്നുപോകുന്ന തരംഗങ്ങൾ' : ' — waves passing each second'}`, t + 300, 'carry');
      t += 16 * 160 + 400;
    } else if (st.op === 'period') {
      say(`T = 1 ÷ f = 1 ÷ ${sci(f.f)} = ${sci(f.T)} s`, t, 'b');
      t += 1800;
    } else if (st.op === 'speed') {
      const text =
        f.unknown === 'v' ? `v = f × λ = ${sci(f.f)} × ${sci(f.lambda)} = ${sci(f.v)} m/s`
        : f.unknown === 'f' ? `f = v ÷ λ = ${sci(f.v)} ÷ ${sci(f.lambda)} = ${sci(f.f)} Hz`
        : `λ = v ÷ f = ${sci(f.v)} ÷ ${sci(f.f)} = ${sci(f.lambda)} m`;
      const y = 400 + 44 * line;
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

export const WAVE_EXAMPLE: WavePlan = {
  f: 500,
  lambda: 0.68,
  kind: 'Sound wave',
  steps: [
    { op: 'show', say: { en: 'A wave: crests and troughs, and the amplitude is the height of a crest.', ml: 'ഒരു തരംഗം: ശൃംഗങ്ങളും ഗർത്തങ്ങളും; ശൃംഗത്തിന്റെ ഉയരമാണ് ആയതി.' } },
    { op: 'wavelength', say: { en: 'The distance from one crest to the next is the wavelength.', ml: 'ഒരു ശൃംഗത്തിൽ നിന്ന് അടുത്തതിലേക്കുള്ള ദൂരമാണ് തരംഗദൈർഘ്യം.' } },
    { op: 'frequency', say: { en: 'The frequency is how many waves pass a point every second.', ml: 'ഒരു സെക്കൻഡിൽ ഒരു ബിന്ദുവിലൂടെ കടന്നുപോകുന്ന തരംഗങ്ങളുടെ എണ്ണമാണ് ആവൃത്തി.' } },
    { op: 'period', say: { en: 'The time for one wave to pass is the period, one over the frequency.', ml: 'ഒരു തരംഗം കടന്നുപോകാനുള്ള സമയമാണ് പീരിയഡ്; അത് 1 ÷ ആവൃത്തി.' } },
    { op: 'speed', say: { en: 'Speed of the wave equals frequency times wavelength.', ml: 'തരംഗവേഗം = ആവൃത്തി × തരംഗദൈർഘ്യം.' } },
  ],
};

export const waveTemplate: AgentTemplate = {
  id: 'wave',
  title: 'Waves: v = f λ',
  about: 'A travelling wave with crest, trough, amplitude and wavelength; frequency, period and speed v = f λ (any two given, the third computed).',
  example: WAVE_EXAMPLE,
  validate: validateWave,
  build: buildWave,
};
