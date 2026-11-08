/** Earth agent · template "river": a river's long profile in three courses; the slope of each course (metres of fall per km) is computed. */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { isBi, label, newScene, num, pick, ring, sparkle, uid, type Bi, type Pt } from '../../kit';
import type { AgentTemplate } from '../../types';

export interface RiverPlan {
  title: Bi;
  /** Source to mouth. */
  courses: Array<{ name: Bi; landform: Bi; lengthKm: number; startM: number; endM: number }>;
  steps: Array<{ op: 'show' | 'course' | 'gradient' | 'answer'; i?: number; say: Bi }>;
}
export const slope = (c: { lengthKm: number; startM: number; endM: number }) => (c.startM - c.endM) / c.lengthKm;
export const steepest = (p: RiverPlan) => p.courses.reduce((b, c, i) => (slope(c) > slope(p.courses[b]) ? i : b), 0);

export function validateRiver(x: unknown): string[] {
  const p = x as RiverPlan;
  const e: string[] = [];
  if (!p || !Array.isArray(p.courses) || p.courses.length < 2 || p.courses.length > 4) return ['2 to 4 courses needed'];
  if (!isBi(p.title)) e.push('title needs en and ml');
  p.courses.forEach((c, i) => {
    if (!isBi(c?.name)) e.push(`courses[${i}].name needs en and ml`);
    if (!isBi(c?.landform)) e.push(`courses[${i}].landform needs en and ml`);
    if (typeof c?.lengthKm !== 'number' || !(c.lengthKm > 0)) e.push(`courses[${i}].lengthKm must be positive`);
    if (typeof c?.startM !== 'number' || typeof c?.endM !== 'number' || !(c.startM > c.endM)) e.push(`courses[${i}] must fall: startM above endM`);
    if (i > 0 && typeof c?.startM === 'number' && c.startM !== p.courses[i - 1].endM) e.push(`courses[${i}].startM must equal the previous endM`);
  });
  if (!Array.isArray(p.steps) || !p.steps.length) return [...e, 'steps needed'];
  p.steps.forEach((s, i) => {
    if (!['show', 'course', 'gradient', 'answer'].includes(s.op)) e.push(`steps[${i}].op unknown`);
    if (s.op === 'course' && !(Number.isInteger(s.i) && s.i! >= 0 && s.i! < p.courses.length)) e.push(`steps[${i}].i out of range`);
    if (!isBi(s.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  if (p.steps[0]?.op !== 'show') e.push('first step is "show"');
  return e;
}

export function buildRiver(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as RiverPlan;
  const m = newScene(title, 760);
  const X0 = 70, X1 = 660, Y0 = 150, Y1 = 470;
  const total = p.courses.reduce((a, c) => a + c.lengthKm, 0);
  const top = p.courses[0].startM, bottom = p.courses[p.courses.length - 1].endM;
  const yOf = (h: number) => Y0 + ((top - h) / Math.max(1, top - bottom)) * (Y1 - Y0);
  let x = X0;
  const seg = p.courses.map((c) => {
    const w = (c.lengthKm / total) * (X1 - X0);
    const g = { a: [x, yOf(c.startM)] as Pt, b: [x + w, yOf(c.endM)] as Pt };
    x += w;
    return g;
  });
  const cols = ['b', 'c', 'carry', 'a'] as const;
  const clampX = (v: number) => Math.max(105, Math.min(615, v));
  let t = 300;
  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      label(m, pick(p.title, lang), 360, 56, t, { size: 30, weight: '700' });
      m.rule(uid('ax'), X0, Y1, X1, Y1, t, { color: 'ink', width: 3 });
      seg.forEach((g, i) => m.poly(uid('rv'), [g.a, g.b], t + 500 * i, { color: cols[i % cols.length], closed: false, width: 8, dur: 600, z: 3, silent: true }));
      p.courses.forEach((c, i) => label(m, pick(c.name, lang), clampX((seg[i].a[0] + seg[i].b[0]) / 2), Y1 + 40, t + 500 * i + 300, { size: 20, color: cols[i % cols.length], weight: '700' }));
      t += 500 * seg.length + 900;
    } else if (st.op === 'course') {
      const c = p.courses[st.i!];
      const g = seg[st.i!];
      ring(m, clampX((g.a[0] + g.b[0]) / 2), (g.a[1] + g.b[1]) / 2, 60, 50, t, 'accent');
      label(m, `${pick(c.name, lang)} — ${pick(c.landform, lang)} (${num(c.lengthKm)} km, ${num(c.startM)} → ${num(c.endM)} m)`, 360, 580 + 34 * st.i!, t + 300, { size: 18, color: cols[st.i! % cols.length], weight: '700' });
      t += 2000;
    } else if (st.op === 'gradient') {
      p.courses.forEach((c, i) => label(m, `${num(slope(c))} m/km`, clampX((seg[i].a[0] + seg[i].b[0]) / 2), Y1 + 78, t + 400 * i, { size: 20, color: cols[i % cols.length], weight: '700' }));
      t += 400 * p.courses.length + 1200;
    } else if (st.op === 'answer') {
      const k = steepest(p);
      ring(m, clampX((seg[k].a[0] + seg[k].b[0]) / 2), Y1 + 78, 64, 24, t, 'tick');
      label(m, `${pick(p.courses[k].name, lang)}: ${num(slope(p.courses[k]))} m/km`, 360, 700, t + 200, { size: 26, color: 'tick', weight: '700' });
      sparkle(m, 360, 700, t + 400);
      t += 1800;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

const say = (en: string, ml: string) => ({ en, ml });
export const RIVER_EXAMPLE: RiverPlan = {
  title: say('The three courses of a river', 'നദിയുടെ മൂന്ന് ഗതികൾ'),
  courses: [
    { name: say('Upper course', 'ഉപരിഗതി'), landform: say('V-shaped valley, waterfalls', 'V ആകൃതിയിലുള്ള താഴ്വര, വെള്ളച്ചാട്ടം'), lengthKm: 100, startM: 3000, endM: 600 },
    { name: say('Middle course', 'മധ്യഗതി'), landform: say('Meanders', 'വളവുകൾ'), lengthKm: 300, startM: 600, endM: 100 },
    { name: say('Lower course', 'അധോഗതി'), landform: say('Floodplain, delta', 'വെള്ളപ്പൊക്ക സമതലം, ഡെൽറ്റ'), lengthKm: 600, startM: 100, endM: 0 },
  ],
  steps: [
    { op: 'show', say: say('A river runs from its source in the hills to the sea in three stages.', 'നദി മലകളിലെ ഉറവിടത്തിൽ നിന്ന് കടലിലേക്ക് മൂന്ന് ഘട്ടങ്ങളായി ഒഴുകുന്നു.') },
    { op: 'course', i: 0, say: say('In the upper course the river falls steeply and cuts deep valleys.', 'ഉപരിഗതിയിൽ നദി കുത്തനെ വീഴുകയും ആഴമുള്ള താഴ്വരകൾ കീറുകയും ചെയ്യുന്നു.') },
    { op: 'course', i: 2, say: say('In the lower course it is wide and slow and builds a delta.', 'അധോഗതിയിൽ നദി വീതിയേറിയതും മന്ദഗതിയിലുമാണ്; ഡെൽറ്റ ഉണ്ടാക്കുന്നു.') },
    { op: 'gradient', say: say('The fall in metres for every kilometre is the slope.', 'ഓരോ കിലോമീറ്ററിലും മീറ്ററിൽ ഉള്ള വീഴ്ചയാണ് ചരിവ്.') },
    { op: 'answer', say: say('The slope is steepest near the source.', 'ഉറവിടത്തിനടുത്താണ് ചരിവ് ഏറ്റവും കൂടുതൽ.') },
  ],
};
export const riverTemplate: AgentTemplate = { id: 'river', title: 'River courses and landforms', about: 'A river profile in courses; slope per course computed.', example: RIVER_EXAMPLE, validate: validateRiver, build: buildRiver };
