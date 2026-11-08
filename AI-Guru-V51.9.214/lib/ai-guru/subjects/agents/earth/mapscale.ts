/** Earth agent · template "mapscale": a distance measured on a map in cm becomes a real distance; 1 : denominator is applied by the app. */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { isBi, label, newScene, num, pick, ring, sparkle, uid, vec, type Bi } from '../../kit';
import type { AgentTemplate } from '../../types';

export interface MapScalePlan {
  title: Bi;
  /** Scale 1 : denominator (50000 means 1 cm on the map is 50,000 cm = 0.5 km on the ground). */
  denominator: number;
  mapCm: number;
  from: Bi;
  to: Bi;
  steps: Array<{ op: 'show' | 'ruler' | 'convert' | 'answer'; say: Bi }>;
}
/** Kilometres on the ground for 1 cm on the map. */
export const kmPerCm = (denominator: number) => denominator / 100_000;
export const groundKm = (p: Pick<MapScalePlan, 'denominator' | 'mapCm'>) => Math.round(p.mapCm * kmPerCm(p.denominator) * 1000) / 1000;

export function validateMapScale(x: unknown): string[] {
  const p = x as MapScalePlan;
  const e: string[] = [];
  if (!p || typeof p !== 'object') return ['plan needed'];
  if (!isBi(p.title)) e.push('title needs en and ml');
  if (!isBi(p.from) || !isBi(p.to)) e.push('from and to need en and ml');
  if (typeof p.denominator !== 'number' || !(p.denominator >= 1000 && p.denominator <= 100_000_000)) e.push('denominator must be 1,000 to 100,000,000');
  if (typeof p.mapCm !== 'number' || !(p.mapCm > 0 && p.mapCm <= 12)) e.push('mapCm must be above 0 and at most 12');
  if (!Array.isArray(p.steps) || !p.steps.length) return [...e, 'steps needed'];
  p.steps.forEach((s, i) => {
    if (!['show', 'ruler', 'convert', 'answer'].includes(s.op)) e.push(`steps[${i}].op unknown`);
    if (!isBi(s.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  if (p.steps[0]?.op !== 'show') e.push('first step is "show"');
  return e;
}

export function buildMapScale(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as MapScalePlan;
  const m = newScene(title, 720);
  const unit = 50;
  const x0 = 360 - (p.mapCm * unit) / 2;
  const x1 = x0 + p.mapCm * unit;
  const Y = 300;
  const kpc = kmPerCm(p.denominator);
  let t = 300;
  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      label(m, pick(p.title, lang), 360, 56, t, { size: 30, weight: '700' });
      label(m, `1 : ${p.denominator.toLocaleString('en-US')}`, 360, 120, t + 200, { size: 34, color: 'accent', weight: '700' });
      m.poly(uid('mp'), [[40, 170], [680, 170], [680, 420], [40, 420]], t, { color: 'carry', fill: 'carry', fillAlpha: 0.15, width: 3, dur: 600, z: 1, silent: true });
      m.dot(uid('pa'), x0, Y, t + 400, { color: 'b', r: 10 });
      m.dot(uid('pb'), x1, Y, t + 600, { color: 'c', r: 10 });
      label(m, pick(p.from, lang), x0, Y - 34, t + 700, { size: 22, color: 'b', weight: '700' });
      label(m, pick(p.to, lang), x1, Y - 34, t + 800, { size: 22, color: 'c', weight: '700' });
      t += 1800;
    } else if (st.op === 'ruler') {
      m.rule(uid('rl'), x0, Y + 40, x1, Y + 40, t, { color: 'accent', width: 5 });
      for (let i = 0; i <= Math.floor(p.mapCm); i++) m.rule(uid('tk'), x0 + i * unit, Y + 30, x0 + i * unit, Y + 50, t + 100 * i, { color: 'accent', width: 3 });
      label(m, `${num(p.mapCm)} cm`, 360, Y + 80, t + 400, { size: 28, color: 'accent', weight: '700' });
      t += 1800;
    } else if (st.op === 'convert') {
      label(m, `1 cm = ${num(kpc)} km`, 360, 480, t, { size: 28, color: 'tick', weight: '700' });
      label(m, `${num(p.mapCm)} × ${num(kpc)}`, 360, 530, t + 500, { size: 28, color: 'ink', weight: '700' });
      t += 2000;
    } else if (st.op === 'answer') {
      vec(m, [x0, 590], [x1, 590], t, 'tick', 6);
      ring(m, 360, 640, 130, 36, t + 300, 'tick');
      label(m, `= ${num(groundKm(p))} km`, 360, 640, t + 400, { size: 34, color: 'tick', weight: '700' });
      sparkle(m, 360, 640, t + 600);
      t += 1800;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

const say = (en: string, ml: string) => ({ en, ml });
export const MAPSCALE_EXAMPLE: MapScalePlan = {
  title: say('Reading the map scale', 'ഭൂപട സ്കെയിൽ വായിക്കാം'),
  denominator: 50000,
  mapCm: 6,
  from: say('School', 'സ്കൂൾ'),
  to: say('Market', 'ചന്ത'),
  steps: [
    { op: 'show', say: say('A map shrinks the real world by a fixed scale.', 'ഭൂപടം യഥാർത്ഥ ലോകത്തെ ഒരു നിശ്ചിത സ്കെയിലിൽ ചെറുതാക്കുന്നു.') },
    { op: 'ruler', say: say('Measure the distance between the two places with a ruler.', 'രണ്ട് സ്ഥലങ്ങൾ തമ്മിലുള്ള ദൂരം സ്കെയിൽ കൊണ്ട് അളക്കുക.') },
    { op: 'convert', say: say('Find what one centimetre stands for, then multiply.', 'ഒരു സെന്റിമീറ്റർ എത്രയാണെന്ന് കണ്ടെത്തി ഗുണിക്കുക.') },
    { op: 'answer', say: say('That gives the real distance on the ground.', 'ഇത് ഭൂമിയിലെ യഥാർത്ഥ ദൂരം നൽകുന്നു.') },
  ],
};
export const mapScaleTemplate: AgentTemplate = { id: 'mapscale', title: 'Map scale', about: 'Map distance in cm to ground distance; 1 : n applied by the app.', example: MAPSCALE_EXAMPLE, validate: validateMapScale, build: buildMapScale };
