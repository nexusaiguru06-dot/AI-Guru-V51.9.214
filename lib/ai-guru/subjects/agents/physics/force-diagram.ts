/**
 * Physics agent · template "force-diagram": a free-body diagram. An object, the forces on it as arrows
 * (length follows the size of the force), then the net force and the acceleration, all worked by the app.
 */

import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { isBi, label, newScene, num, pick, ring, rect, sparkle, uid, vec, ground, type Bi, type Pt } from '../../kit';
import type { AgentTemplate } from '../../types';

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface ForcePlan {
  object: { label: string; massKg?: number };
  forces: Array<{ sym: string; name: Bi; dir: Dir; n: number }>;
  steps: Array<{ op: 'show' | 'force' | 'net' | 'accel' | 'answer'; i?: number; say: Bi }>;
}

const DIRS: Dir[] = ['up', 'down', 'left', 'right'];
const COLORS = ['a', 'b', 'c', 'carry', 'accent'] as const;

export function validateForce(x: unknown): string[] {
  const p = x as ForcePlan;
  const e: string[] = [];
  if (!p || typeof p !== 'object') return ['plan is not an object'];
  if (!p.object || typeof p.object.label !== 'string' || !p.object.label.trim() || p.object.label.length > 14) e.push('object.label: 1–14 characters');
  if (p.object?.massKg !== undefined && !(p.object.massKg > 0 && p.object.massKg <= 100000)) e.push('object.massKg must be 0–100000');
  if (!Array.isArray(p.forces) || p.forces.length < 1 || p.forces.length > 5) return [...e, 'forces: 1 to 5'];
  p.forces.forEach((f, i) => {
    if (!f || typeof f.sym !== 'string' || !f.sym.trim() || f.sym.length > 4) e.push(`forces[${i}].sym: 1–4 characters`);
    if (!isBi(f?.name)) e.push(`forces[${i}].name needs en and ml`);
    if (!DIRS.includes(f?.dir)) e.push(`forces[${i}].dir: up, down, left or right`);
    if (!(f?.n > 0 && f.n <= 1e6)) e.push(`forces[${i}].n must be a positive number`);
  });
  if (!Array.isArray(p.steps) || !p.steps.length || p.steps.length > 12) return [...e, 'steps: 1 to 12'];
  if (p.steps[0].op !== 'show') e.push('the first step is "show"');
  p.steps.forEach((s, i) => {
    if (!['show', 'force', 'net', 'accel', 'answer'].includes(s.op)) e.push(`steps[${i}].op unknown`);
    if (!isBi(s.say)) e.push(`steps[${i}].say needs en and ml`);
    if (s.op === 'force' && !(Number.isInteger(s.i) && s.i! >= 0 && s.i! < p.forces.length)) e.push(`steps[${i}].i must index a force`);
    if ((s.op === 'accel' || s.op === 'answer') && p.object?.massKg === undefined) e.push(`steps[${i}]: "${s.op}" needs object.massKg`);
  });
  const seen = p.steps.filter((s) => s.op === 'force').map((s) => s.i);
  if (new Set(seen).size !== seen.length) e.push('each force once');
  return e;
}

/** Net force along each axis (right and up positive), with the written working. */
export function netForces(p: ForcePlan) {
  const sum = (dirs: Dir[], pos: Dir) => p.forces.filter((f) => dirs.includes(f.dir)).reduce((a, f) => a + (f.dir === pos ? f.n : -f.n), 0);
  const fx = sum(['left', 'right'], 'right');
  const fy = sum(['up', 'down'], 'up');
  const working = (dirs: Dir[], pos: Dir, unit = 'N') => {
    const fs = p.forces.filter((f) => dirs.includes(f.dir));
    if (!fs.length) return null;
    const ordered = [...fs.filter((f) => f.dir === pos), ...fs.filter((f) => f.dir !== pos)];
    const expr = ordered.map((f, i) => (i === 0 ? (f.dir === pos ? num(f.n) : `−${num(f.n)}`) : `${f.dir === pos ? '+' : '−'} ${num(f.n)}`)).join(' ');
    const val = sum(dirs, pos);
    return { expr, val, text: `${expr} = ${num(val)} ${unit}` };
  };
  return { fx, fy, h: working(['left', 'right'], 'right'), v: working(['up', 'down'], 'up') };
}

const DIR_ARROW: Record<Dir, string> = { up: '↑', down: '↓', left: '←', right: '→' };

export function buildForce(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as ForcePlan;
  const H = 640;
  const m = newScene(title, H);
  const cx = 360;
  const cy = 250;
  const maxN = Math.max(...p.forces.map((f) => f.n));
  const lenOf = (n: number) => 50 + 100 * (n / maxN);
  const net = netForces(p);
  let t = 300;
  const objId = { box: '', text: '' };
  const vecIds: string[][] = [];
  const marks: string[] = [];
  const rows: string[] = [];
  let rowY = 440;

  const tip = (f: ForcePlan['forces'][number]): Pt => {
    const L = lenOf(f.n);
    return f.dir === 'right' ? [cx + 80 + L, cy] : f.dir === 'left' ? [cx - 80 - L, cy] : f.dir === 'up' ? [cx, cy - 45 - L] : [cx, cy + 45 + L];
  };
  const origin = (f: ForcePlan['forces'][number]): Pt => (f.dir === 'right' ? [cx + 80, cy] : f.dir === 'left' ? [cx - 80, cy] : f.dir === 'up' ? [cx, cy - 45] : [cx, cy + 45]);

  const row = (text: string, color: string, size = 34) => {
    const id = label(m, text, cx, rowY, t, { size, color });
    for (const r of rows) m.dim([r], t);
    rows.push(id);
    rowY += 56;
    t += 700;
    return id;
  };

  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      ground(m, cy + 45, t);
      const id = rect(m, cx - 80, cy - 45, 160, 90, t + 200, 'result', { alpha: 0.18 });
      objId.box = id;
      const mass = p.object.massKg !== undefined ? `${p.object.label}  ${num(p.object.massKg)} kg` : p.object.label;
      objId.text = label(m, mass, cx, cy, t + 500, { size: 26, color: 'result', weight: '700' });
      t += 1400;
    } else if (st.op === 'force') {
      const f = p.forces[st.i!];
      const color = COLORS[st.i! % COLORS.length];
      const o = origin(f);
      const e = tip(f);
      m.focus([objId.box], t, false);
      const ids = vec(m, o, e, t + 200, color);
      vecIds[st.i!] = ids;
      const txt = `${f.sym} = ${num(f.n)} N`;
      const lx = f.dir === 'right' ? (o[0] + e[0]) / 2 : f.dir === 'left' ? (o[0] + e[0]) / 2 : cx + 90;
      const ly = f.dir === 'up' ? (o[1] + e[1]) / 2 : f.dir === 'down' ? (o[1] + e[1]) / 2 : cy - 30;
      label(m, txt, lx, ly, t + 800, { size: 24, color, weight: '700' });
      t += 1500;
    } else if (st.op === 'net') {
      if (net.h) {
        const id = row(`ΣF ${net.h.val >= 0 ? '→' : '←'} :  ${net.h.text}`, 'result');
        marks.push(ring(m, cx, rowY - 56, 230, 26, t - 500, 'accent'));
        void id;
      }
      if (net.v) row(net.v.val === 0 ? `ΣF ↕ :  ${net.v.text}  (balanced)` : `ΣF ↕ :  ${net.v.text}`, 'carry');
      t += 400;
    } else if (st.op === 'accel') {
      const mass = p.object.massKg!;
      const F = net.h && net.h.val !== 0 ? net.h.val : net.v?.val ?? 0;
      const a = F / mass;
      row(`a = F ÷ m = ${num(Math.abs(F))} ÷ ${num(mass)} = ${num(Math.abs(a))} m/s²`, 'c');
    } else if (st.op === 'answer') {
      const mass = p.object.massKg!;
      const F = net.h && net.h.val !== 0 ? net.h.val : net.v?.val ?? 0;
      const a = F / mass;
      const id = row(`a = ${num(Math.abs(a))} m/s²  ${F === 0 ? '(no acceleration)' : DIR_ARROW[net.h && net.h.val !== 0 ? (net.h.val > 0 ? 'right' : 'left') : (F > 0 ? 'up' : 'down')]}`, 'accent', 38);
      void id;
      marks.push(ring(m, cx, rowY - 56, 210, 28, t - 500, 'accent'));
      sparkle(m, cx, rowY - 56, t - 300);
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  void uid;
  return [m.build()];
}

export const FORCE_EXAMPLE: ForcePlan = {
  object: { label: 'Block', massKg: 5 },
  forces: [
    { sym: 'F', name: { en: 'push', ml: 'തള്ളൽ' }, dir: 'right', n: 20 },
    { sym: 'f', name: { en: 'friction', ml: 'ഘർഷണം' }, dir: 'left', n: 5 },
    { sym: 'W', name: { en: 'weight', ml: 'ഭാരം' }, dir: 'down', n: 50 },
    { sym: 'N', name: { en: 'normal force', ml: 'ലംബബലം' }, dir: 'up', n: 50 },
  ],
  steps: [
    { op: 'show', say: { en: 'A 5 kg block sits on a table. Let us find every force on it.', ml: '5 kg ഭാരമുള്ള ഒരു കട്ട മേശപ്പുറത്തുണ്ട്. അതിൽ ഉള്ള ബലങ്ങളെല്ലാം കണ്ടെത്താം.' } },
    { op: 'force', i: 0, say: { en: 'A push of 20 N to the right.', ml: 'വലത്തേക്ക് 20 N തള്ളൽ.' } },
    { op: 'force', i: 1, say: { en: 'Friction pulls back with 5 N.', ml: 'ഘർഷണം 5 N പിന്നോട്ട് വലിക്കുന്നു.' } },
    { op: 'force', i: 2, say: { en: 'Weight pulls down with 50 N.', ml: 'ഭാരം 50 N താഴേക്ക്.' } },
    { op: 'force', i: 3, say: { en: 'The table pushes up with 50 N.', ml: 'മേശ 50 N മുകളിലേക്ക് തള്ളുന്നു.' } },
    { op: 'net', say: { en: 'Add the forces on each line. Up and down cancel. Sideways, 20 minus 5 is 15 N.', ml: 'ഓരോ വരിയിലെയും ബലങ്ങൾ കൂട്ടുക. മുകളിലും താഴെയും ഇല്ലാതാകും. വശത്തേക്ക് 20 − 5 = 15 N.' } },
    { op: 'accel', say: { en: 'Acceleration is force divided by mass.', ml: 'ത്വരണം = ബലം ÷ പിണ്ഡം.' } },
    { op: 'answer', say: { en: 'The block speeds up at 3 metres per second every second.', ml: 'കട്ട സെക്കൻഡിൽ 3 മീറ്റർ വീതം വേഗം കൂട്ടുന്നു.' } },
  ],
};

export const forceTemplate: AgentTemplate = {
  id: 'force-diagram',
  title: 'Forces on an object',
  about: 'Free-body diagram: force arrows sized by strength, net force and acceleration worked by the app.',
  example: FORCE_EXAMPLE,
  validate: validateForce,
  build: buildForce,
};
