/**
 * V51.9.148 — Physics agent · template "projectile": a ball thrown at speed u and angle θ.
 * The velocity splits into uₓ = u cos θ and u_y = u sin θ; the ball flies along the parabola (drawn to scale and
 * flown by the ball); time of flight T = 2 u_y ÷ g, greatest height H = u_y² ÷ 2g, range R = uₓ × T.
 * Every number is computed here. (Idea of the scene: the projectile simulation of physicshub, MIT.)
 */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { ellipse, label, newScene, num, pick, ring, sparkle, uid, vec, type Bi, type Pt } from '../../kit';
import type { AgentTemplate } from '../../types';
import { checkSteps, gOf, inRange, ringW, round } from './common';

export type ProjOp = 'show' | 'split' | 'path' | 'time' | 'height' | 'range';
export interface ProjectilePlan {
  /** Speed of throw, m/s. */
  u: number;
  /** Angle above the ground, degrees. */
  angle: number;
  g?: number;
  steps: Array<{ op: ProjOp; say: Bi }>;
}
const ORDER: ProjOp[] = ['show', 'split', 'path', 'time', 'height', 'range'];

export function projFacts(p: ProjectilePlan) {
  const g = gOf(p.g);
  const th = (p.angle * Math.PI) / 180;
  const ux = round(p.u * Math.cos(th));
  const uy = round(p.u * Math.sin(th));
  const T = round((2 * uy) / g);
  const H = round((uy * uy) / (2 * g));
  const R = round(ux * T);
  return { g, ux, uy, T, H, R, th };
}

export function validateProjectile(x: unknown): string[] {
  const p = x as ProjectilePlan;
  if (!p || typeof p !== 'object') return ['plan is not an object'];
  const e: string[] = [];
  if (!inRange(p.u, 1, 100)) e.push('u is the speed of throw, 1–100 m/s');
  if (!inRange(p.angle, 10, 80)) e.push('angle is 10–80 degrees above the ground');
  if (p.g !== undefined && gOf(p.g) !== p.g) e.push('g is 9.8 or 10');
  return [...e, ...checkSteps(p.steps, ORDER)];
}

export function buildProjectile(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as ProjectilePlan;
  const f = projFacts(p);
  const ml = lang === 'ml';
  const m = newScene(title, 680);
  // the flight drawn to scale in a 560 × 250 box
  const ox = 90, oy = 340;
  const s = Math.min(560 / Math.max(f.R, 1), 200 / Math.max(f.H, 1));
  const P = (x: number, y: number): Pt => [ox + x * s, oy - y * s];
  const pathAt = (k: number): Pt => { const tt = f.T * k; return P(f.ux * tt, f.uy * tt - 0.5 * f.g * tt * tt); };
  const ball = uid('ball');
  const ballAt = (c: Pt) => ellipse(c[0], c[1], 11, 11, 18);
  let t = 300;
  const yText = 410;
  let line = 0;
  const say = (text: string, at: number, color: string) => label(m, text, 360, yText + 44 * line++, at, { size: 24, color, weight: '700' });

  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      m.rule(uid('gr'), 40, oy, 690, oy, t, { color: 'ink', width: 4 });
      m.poly(ball, ballAt(P(0, 0)), t + 200, { color: 'a', fill: 'a', fillAlpha: 1, closed: true, width: 2, dur: 300, z: 6, silent: true });
      const tip: Pt = [ox + Math.cos(f.th) * 120, oy - Math.sin(f.th) * 120];
      vec(m, [ox, oy], tip, t + 500, 'accent', 5);
      // the angle
      const arc: Pt[] = Array.from({ length: 12 }, (_, i) => { const a = (f.th * i) / 11; return [ox + 48 * Math.cos(a), oy - 48 * Math.sin(a)]; });
      m.poly(uid('ang'), arc, t + 900, { color: 'b', closed: false, width: 3, dur: 400, z: 4, silent: true });
      label(m, `${num(p.angle)}°`, ox + 76 * Math.cos(f.th / 2), oy - 76 * Math.sin(f.th / 2), t + 1100, { size: 22, color: 'b', weight: '700' });
      label(m, `u = ${num(p.u)} m/s`, tip[0] + 70, tip[1] - 10, t + 900, { size: 24, color: 'accent', weight: '700' });
      t += 1900;
    } else if (st.op === 'split') {
      const L = 120;
      vec(m, [ox, oy], [ox + L * Math.cos(f.th), oy], t, 'c', 4);
      vec(m, [ox, oy], [ox, oy - L * Math.sin(f.th)], t + 500, 'carry', 4);
      label(m, 'u cos θ', ox + L * Math.cos(f.th) + 10, oy + 22, t + 300, { size: 20, color: 'c', weight: '700' });
      label(m, 'u sin θ', ox - 48, oy - L * Math.sin(f.th), t + 700, { size: 20, color: 'carry', weight: '700' });
      say(`u cos θ = ${num(p.u)} × cos ${num(p.angle)}° = ${num(f.ux)} m/s`, t + 900, 'c');
      say(`u sin θ = ${num(p.u)} × sin ${num(p.angle)}° = ${num(f.uy)} m/s`, t + 1300, 'carry');
      t += 2200;
    } else if (st.op === 'path') {
      const pts = Array.from({ length: 41 }, (_, i) => pathAt(i / 40));
      m.poly(uid('path'), pts, t, { color: 'b', closed: false, width: 3, dashed: true, dur: 1800, z: 3, silent: true });
      // the ball flies along it
      for (let i = 1; i <= 20; i++) m.morph(ball, ballAt(pathAt(i / 20)), t + (i - 1) * 90, { dur: 90, e: (q) => q });
      t += 20 * 90 + 600;
    } else if (st.op === 'time') {
      say(`T = 2u sin θ ÷ g = 2 × ${num(f.uy)} ÷ ${num(f.g)} = ${num(f.T)} s`, t, 'accent');
      t += 1800;
    } else if (st.op === 'height') {
      const top = pathAt(0.5);
      m.rule(uid('hl'), top[0], top[1], top[0], oy, t, { color: 'carry', width: 2 });
      label(m, `H`, top[0] + 18, (top[1] + oy) / 2, t + 300, { size: 24, color: 'carry', weight: '700' });
      say(`H = (u sin θ)² ÷ 2g = ${num(f.uy)}² ÷ ${num(2 * f.g)} = ${num(f.H)} m`, t + 400, 'carry');
      t += 2000;
    } else if (st.op === 'range') {
      const end = pathAt(1);
      vec(m, [ox, oy + 26], [end[0], oy + 26], t, 'c', 3);
      label(m, 'R', (ox + end[0]) / 2, oy + 48, t + 300, { size: 24, color: 'c', weight: '700' });
      const rt = `R = u cos θ × T = ${num(f.ux)} × ${num(f.T)} = ${num(f.R)} m`;
      const ry = yText + 44 * line;
      say(rt, t + 400, 'tick');
      ring(m, 360, ry, ringW(rt), 24, t + 1000, 'tick');
      sparkle(m, end[0], oy, t + 1200);
      t += 2200;
    }
    t += 150;
    m.hold(t);
  }
  void ml;
  m.hold(t + 1400);
  return [m.build()];
}

export const PROJECTILE_EXAMPLE: ProjectilePlan = {
  u: 20,
  angle: 30,
  steps: [
    { op: 'show', say: { en: 'A ball is thrown at 20 metres per second, 30 degrees above the ground.', ml: 'ഒരു പന്ത് 20 m/s വേഗത്തിൽ, നിലത്തുനിന്ന് 30° കോണിൽ എറിയുന്നു.' } },
    { op: 'split', say: { en: 'Split the velocity into a sideways part and an upward part.', ml: 'പ്രവേഗത്തെ തിരശ്ചീന ഭാഗവും ലംബ ഭാഗവുമായി വിഭജിക്കുക.' } },
    { op: 'path', say: { en: 'Gravity pulls the upward part down, so the ball flies along a parabola.', ml: 'ഗുരുത്വം ലംബ ഭാഗത്തെ കുറയ്ക്കുന്നു; പന്ത് ഒരു പരാബോള പാതയിൽ സഞ്ചരിക്കുന്നു.' } },
    { op: 'time', say: { en: 'Time of flight: the time to go up and come back down.', ml: 'പറക്കൽ സമയം: മുകളിലേക്ക് പോയി തിരിച്ചുവരാനുള്ള സമയം.' } },
    { op: 'height', say: { en: 'The greatest height is reached halfway, when the upward speed is zero.', ml: 'പകുതി സമയത്ത്, ലംബ വേഗം പൂജ്യമാകുമ്പോൾ, ഏറ്റവും കൂടിയ ഉയരം.' } },
    { op: 'range', say: { en: 'The range is the sideways speed multiplied by the time of flight.', ml: 'പരിധി = തിരശ്ചീന വേഗം × പറക്കൽ സമയം.' } },
  ],
};

export const projectileTemplate: AgentTemplate = {
  id: 'projectile',
  title: 'Projectile motion',
  about: 'A throw at speed u and angle θ: components, the parabola, time of flight, greatest height and range, all computed and drawn to scale.',
  example: PROJECTILE_EXAMPLE,
  validate: validateProjectile,
  build: buildProjectile,
};
