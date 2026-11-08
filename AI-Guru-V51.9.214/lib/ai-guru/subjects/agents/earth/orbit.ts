/** Earth agent · template "orbit": the Earth at four places round the Sun with its axis tilted the same way (seasons, day and night). */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { ellipse, isBi, label, newScene, num, pick, ring, sparkle, uid, vec, type Bi, type Pt } from '../../kit';
import type { AgentTemplate } from '../../types';

export interface OrbitPlan {
  title: Bi;
  tilt: number;
  /** Four places, starting at the right and going round (counter-clockwise on the page). */
  places: Array<{ name: Bi; when: Bi }>;
  steps: Array<{ op: 'show' | 'place' | 'tilt' | 'answer'; i?: number; say: Bi }>;
}

const CX = 360;
const CY = 380;
const RX = 250;
const RY = 140;
export const placePos = (i: number): Pt => {
  const a = -(i / 4) * Math.PI * 2;
  return [CX + RX * Math.cos(a), CY + RY * Math.sin(a)];
};
/** Days between two neighbouring places (a quarter of a year) and degrees moved per day. */
export const daysPerQuarter = (year = 365) => Math.round((year / 4) * 10) / 10;
export const degPerDay = (year = 365) => Math.round((360 / year) * 100) / 100;

export function validateOrbit(x: unknown): string[] {
  const p = x as OrbitPlan;
  const e: string[] = [];
  if (!p || !Array.isArray(p.places) || p.places.length !== 4) return ['exactly 4 places needed'];
  if (!isBi(p.title)) e.push('title needs en and ml');
  if (typeof p.tilt !== 'number' || !(p.tilt > 0 && p.tilt < 90)) e.push('tilt must be between 0 and 90');
  p.places.forEach((s, i) => {
    if (!isBi(s?.name)) e.push(`places[${i}].name needs en and ml`);
    if (!isBi(s?.when)) e.push(`places[${i}].when needs en and ml`);
  });
  if (!Array.isArray(p.steps) || !p.steps.length) return [...e, 'steps needed'];
  p.steps.forEach((s, i) => {
    if (!['show', 'place', 'tilt', 'answer'].includes(s.op)) e.push(`steps[${i}].op unknown`);
    if (s.op === 'place' && !(Number.isInteger(s.i) && s.i! >= 0 && s.i! < 4)) e.push(`steps[${i}].i out of range`);
    if (!isBi(s.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  if (p.steps[0]?.op !== 'show') e.push('first step is "show"');
  return e;
}

export function buildOrbit(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as OrbitPlan;
  const m = newScene(title, 740);
  let t = 300;
  const axis = (c: Pt, at: number) => {
    const a = (p.tilt * Math.PI) / 180;
    const L = 46;
    m.poly(uid('ax'), [[c[0] - Math.sin(a) * L, c[1] + Math.cos(a) * L], [c[0] + Math.sin(a) * L, c[1] - Math.cos(a) * L]], at, { color: 'tick', closed: false, width: 4, dur: 400, z: 4, silent: true });
  };
  const earth = (c: Pt, i: number, at: number) => {
    m.dot(uid('ea'), c[0], c[1], at, { color: 'b', r: 17 });
    axis(c, at + 150);
    const out: Pt = [c[0] + (c[0] - CX) * 0.01, c[1] + (c[1] > CY ? 92 : c[1] < CY ? -88 : 0)];
    const lx = c[0] + (c[0] > CX + 10 ? 60 : c[0] < CX - 10 ? -60 : 0);
    const ly = Math.abs(c[1] - CY) < 5 ? c[1] + 70 : out[1];
    label(m, pick(p.places[i].name, lang), lx, ly, at + 250, { size: 21, weight: '700', color: 'b' });
    label(m, pick(p.places[i].when, lang), lx, ly + 26, at + 350, { size: 18, color: 'ink' });
  };
  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      label(m, pick(p.title, lang), 360, 56, t, { size: 30, weight: '700' });
      m.poly(uid('or'), ellipse(CX, CY, RX, RY, 48), t, { color: 'ink', closed: true, width: 2.4, dur: 900, z: 1, dashed: true, silent: true });
      m.dot(uid('sun'), CX, CY, t + 300, { color: 'accent', r: 34 });
      label(m, lang === 'ml' ? 'സൂര്യൻ' : 'Sun', CX, CY, t + 500, { size: 20, weight: '700', color: 'ink' });
      t += 1600;
    } else if (st.op === 'place') {
      const c = placePos(st.i!);
      earth(c, st.i!, t);
      ring(m, c[0], c[1], 34, 34, t + 200, 'accent');
      t += 1800;
    } else if (st.op === 'tilt') {
      for (let i = 0; i < 4; i++) {
        const c = placePos(i);
        vec(m, [c[0], c[1] - 80], [c[0] + Math.sin((p.tilt * Math.PI) / 180) * 40, c[1] - 80 - Math.cos((p.tilt * Math.PI) / 180) * 40], t + 250 * i, 'tick', 3);
      }
      label(m, `${num(p.tilt)}°`, CX, CY + 62, t + 500, { size: 34, weight: '700', color: 'tick' });
      t += 1800;
    } else if (st.op === 'answer') {
      label(m, `≈ ${num(daysPerQuarter())} ${lang === 'ml' ? 'ദിവസം വീതം' : 'days each'} · ${num(degPerDay())}° ${lang === 'ml' ? 'ഒരു ദിവസം' : 'a day'}`, 360, 690, t, { size: 26, color: 'tick', weight: '700' });
      sparkle(m, 360, 690, t + 300);
      t += 1600;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

const say = (en: string, ml: string) => ({ en, ml });
export const SEASONS: OrbitPlan = {
  title: say('Why we have seasons', 'ഋതുക്കൾ ഉണ്ടാകുന്നത് എന്തുകൊണ്ട്'),
  tilt: 23.5,
  places: [
    { name: say('Autumn equinox', 'ശരത്കാല വിഷുവം'), when: say('23 September', 'സെപ്റ്റംബർ 23') },
    { name: say('Northern summer', 'ഉത്തരാർദ്ധ ഗ്രീഷ്മം'), when: say('21 June', 'ജൂൺ 21') },
    { name: say('Spring equinox', 'വസന്ത വിഷുവം'), when: say('21 March', 'മാർച്ച് 21') },
    { name: say('Northern winter', 'ഉത്തരാർദ്ധ ശിശിരം'), when: say('22 December', 'ഡിസംബർ 22') },
  ],
  steps: [
    { op: 'show', say: say('The Earth goes round the Sun along a path called its orbit.', 'ഭൂമി സൂര്യനെ ചുറ്റുന്ന പാതയാണ് പരിക്രമണപഥം.') },
    { op: 'place', i: 1, say: say('In June the northern half leans towards the Sun: summer there.', 'ജൂണിൽ ഉത്തരാർദ്ധം സൂര്യന് നേരെ ചരിയുന്നു; അവിടെ വേനൽ.') },
    { op: 'place', i: 3, say: say('In December it leans away, so the north has winter.', 'ഡിസംബറിൽ അത് അകന്നു ചരിയുന്നു; വടക്ക് ശൈത്യകാലം.') },
    { op: 'tilt', say: say('The axis always points the same way, tilted by this angle.', 'അക്ഷം എപ്പോഴും ഒരേ ദിശയിൽ ഈ കോണിൽ ചരിഞ്ഞിരിക്കുന്നു.') },
    { op: 'answer', say: say('One year is four equal steps, so each season lasts about this long.', 'ഒരു വർഷം നാല് തുല്യ ഘട്ടങ്ങൾ; ഓരോ ഋതുവും ഇത്ര നീളും.') },
  ],
};
export const orbitTemplate: AgentTemplate = { id: 'orbit', title: 'Orbit and seasons', about: 'Earth at four places round the Sun with a tilted axis; days per season computed.', example: SEASONS, validate: validateOrbit, build: buildOrbit };
