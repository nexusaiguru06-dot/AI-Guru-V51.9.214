/** Earth agent · template "plates": two plates meeting at a convergent, divergent or transform boundary; the drift over a million years is computed. */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { isBi, label, newScene, num, pick, rect, sparkle, uid, vec, type Bi } from '../../kit';
import type { AgentTemplate } from '../../types';

export type Boundary = 'convergent' | 'divergent' | 'transform';
export interface PlatesPlan {
  title: Bi;
  boundary: Boundary;
  left: Bi;
  right: Bi;
  /** How fast each plate pair moves in cm a year (the relative speed). */
  rate: number;
  /** What forms there (mountains, rift valley, earthquakes). */
  result: Bi;
  steps: Array<{ op: 'show' | 'move' | 'result' | 'answer'; say: Bi }>;
}
/** Kilometres moved in a million years at `rate` cm a year (1 cm × 1,000,000 = 10 km). */
export const driftKm = (rate: number, years = 1_000_000) => (rate * years) / 100_000;

export function validatePlates(x: unknown): string[] {
  const p = x as PlatesPlan;
  const e: string[] = [];
  if (!p || typeof p !== 'object') return ['plan needed'];
  if (!isBi(p.title)) e.push('title needs en and ml');
  if (!['convergent', 'divergent', 'transform'].includes(p.boundary)) e.push('boundary must be convergent, divergent or transform');
  if (!isBi(p.left) || !isBi(p.right)) e.push('left and right plate names need en and ml');
  if (!isBi(p.result)) e.push('result needs en and ml');
  if (typeof p.rate !== 'number' || !(p.rate >= 0.1 && p.rate <= 20)) e.push('rate must be 0.1 to 20 cm a year');
  if (!Array.isArray(p.steps) || !p.steps.length) return [...e, 'steps needed'];
  p.steps.forEach((s, i) => {
    if (!['show', 'move', 'result', 'answer'].includes(s.op)) e.push(`steps[${i}].op unknown`);
    if (!isBi(s.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  if (p.steps[0]?.op !== 'show') e.push('first step is "show"');
  return e;
}

export function buildPlates(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as PlatesPlan;
  const m = newScene(title, 760);
  const Y = 330;
  const H = 100;
  let t = 300;
  let left = '';
  let right = '';
  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      label(m, pick(p.title, lang), 360, 56, t, { size: 30, weight: '700' });
      rect(m, 40, Y + H, 640, 180, t, 'carry', { alpha: 0.28 });
      label(m, lang === 'ml' ? 'മാന്റിൽ' : 'Mantle', 360, Y + H + 140, t + 300, { size: 22, color: 'carry', weight: '700' });
      left = rect(m, 60, Y, 290, H, t + 300, 'b', { alpha: 0.4 });
      right = rect(m, 370, Y, 290, H, t + 600, 'c', { alpha: 0.4 });
      label(m, pick(p.left, lang), 205, Y + H / 2, t + 800, { size: 22, color: 'b', weight: '700' });
      label(m, pick(p.right, lang), 515, Y + H / 2, t + 900, { size: 22, color: 'c', weight: '700' });
      t += 1800;
    } else if (st.op === 'move') {
      const d = 36;
      if (p.boundary === 'convergent') {
        vec(m, [120, Y - 40], [240, Y - 40], t, 'accent');
        vec(m, [600, Y - 40], [480, Y - 40], t, 'accent');
        m.move(left, 205 + d, Y + H / 2, t + 200, { dur: 1400 });
        m.move(right, 515 - d, Y + H / 2, t + 200, { dur: 1400 });
      } else if (p.boundary === 'divergent') {
        vec(m, [300, Y - 40], [160, Y - 40], t, 'accent');
        vec(m, [420, Y - 40], [560, Y - 40], t, 'accent');
        m.move(left, 205 - d, Y + H / 2, t + 200, { dur: 1400 });
        m.move(right, 515 + d, Y + H / 2, t + 200, { dur: 1400 });
      } else {
        vec(m, [150, Y + H + 40], [150, Y + 10], t, 'accent');
        vec(m, [570, Y - 40], [570, Y + 20 + 40], t, 'accent');
        m.move(left, 205, Y + H / 2 - d, t + 200, { dur: 1400 });
        m.move(right, 515, Y + H / 2 + d, t + 200, { dur: 1400 });
      }
      label(m, `${num(p.rate)} cm / ${lang === 'ml' ? 'വർഷം' : 'year'}`, 360, Y - 150, t + 400, { size: 26, color: 'accent', weight: '700' });
      t += 2000;
    } else if (st.op === 'result') {
      const cx = 360;
      if (p.boundary === 'convergent') {
        m.poly(uid('mt'), [[cx - 80, Y], [cx, Y - 85], [cx + 80, Y]], t, { color: 'tick', fill: 'tick', fillAlpha: 0.35, width: 4, dur: 700, z: 3, silent: true });
      } else if (p.boundary === 'divergent') {
        m.poly(uid('rf'), [[cx - 36 - 14, Y], [cx + 36 + 14, Y], [cx + 20, Y + H], [cx - 20, Y + H]], t, { color: 'accent', fill: 'accent', fillAlpha: 0.55, width: 3, dur: 700, z: 1, silent: true });
      } else {
        m.poly(uid('zz'), [[cx, Y - 20], [cx - 22, Y + 25], [cx + 22, Y + 55], [cx, Y + H + 20]], t, { color: 'accent', closed: false, width: 6, dur: 800, z: 4, silent: true });
      }
      label(m, pick(p.result, lang), 360, Y - 200, t + 400, { size: 28, color: 'tick', weight: '700' });
      t += 1800;
    } else if (st.op === 'answer') {
      label(m, `${num(p.rate)} cm × 1,000,000 = ${num(driftKm(p.rate))} km`, 360, 640, t, { size: 26, color: 'tick', weight: '700' });
      label(m, lang === 'ml' ? 'ഒരു ദശലക്ഷം വർഷത്തിൽ' : 'in a million years', 360, 676, t + 200, { size: 22, color: 'ink' });
      sparkle(m, 360, 640, t + 300);
      t += 1600;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

const say = (en: string, ml: string) => ({ en, ml });
export const PLATES_EXAMPLE: PlatesPlan = {
  title: say('When plates collide', 'ഫലകങ്ങൾ കൂട്ടിമുട്ടുമ്പോൾ'),
  boundary: 'convergent',
  left: say('Indian plate', 'ഇന്ത്യൻ ഫലകം'),
  right: say('Eurasian plate', 'യുറേഷ്യൻ ഫലകം'),
  rate: 5,
  result: say('Fold mountains: the Himalayas', 'മടക്കുമലകൾ: ഹിമാലയം'),
  steps: [
    { op: 'show', say: say('The Earth’s crust is broken into huge plates that float on the mantle.', 'ഭൂവൽക്കം മാന്റിലിൽ പൊങ്ങിക്കിടക്കുന്ന വലിയ ഫലകങ്ങളായി പൊട്ടിയിരിക്കുന്നു.') },
    { op: 'move', say: say('The plates move towards each other very slowly.', 'ഫലകങ്ങൾ വളരെ പതുക്കെ പരസ്പരം അടുക്കുന്നു.') },
    { op: 'result', say: say('When they push together, the crust folds upward into mountains.', 'അവ തള്ളിക്കയറുമ്പോൾ ഭൂവൽക്കം മുകളിലേക്ക് മടങ്ങി മലകളാകുന്നു.') },
    { op: 'answer', say: say('Small yearly moves add up to a long distance.', 'ചെറിയ വാർഷിക ചലനങ്ങൾ കൂടി വലിയ ദൂരമാകുന്നു.') },
  ],
};
export const platesTemplate: AgentTemplate = { id: 'plates', title: 'Plate tectonics', about: 'Two plates at a convergent, divergent or transform boundary; drift per million years computed.', example: PLATES_EXAMPLE, validate: validatePlates, build: buildPlates };
