/** Earth agent · template "cycle": 3–6 stages round a ring, joined by labelled arrows (water, rock, carbon cycles). */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { ellipse, isBi, label, newScene, pick, sparkle, uid, vec, ring, type Bi, type Pt } from '../../kit';
import type { AgentTemplate } from '../../types';

export interface CyclePlan {
  title: Bi;
  /** In order round the cycle; `process` is what carries the stage on to the next (the last one returns to the first). */
  stages: Array<{ name: Bi; process: Bi }>;
  steps: Array<{ op: 'show' | 'flow' | 'loop' | 'answer'; i?: number; say: Bi }>;
}

const CX = 360;
const CY = 400;
const R = 230;
const RX = 96;
const RY = 38;
/** Centre of stage i of n; the first stage sits at the top and the rest go clockwise. */
export const stagePos = (i: number, n: number): Pt => {
  const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
  return [CX + R * Math.cos(a) * 1.0, CY + R * Math.sin(a) * 0.95];
};

export function validateCycle(x: unknown): string[] {
  const p = x as CyclePlan;
  const e: string[] = [];
  if (!p || !Array.isArray(p.stages) || p.stages.length < 3 || p.stages.length > 6) return ['3 to 6 stages needed'];
  if (!isBi(p.title)) e.push('title needs en and ml');
  p.stages.forEach((s, i) => {
    if (!isBi(s?.name)) e.push(`stages[${i}].name needs en and ml`);
    if (!isBi(s?.process)) e.push(`stages[${i}].process needs en and ml`);
  });
  if (!Array.isArray(p.steps) || !p.steps.length) return [...e, 'steps needed'];
  p.steps.forEach((s, i) => {
    if (!['show', 'flow', 'loop', 'answer'].includes(s.op)) e.push(`steps[${i}].op unknown`);
    if (s.op === 'flow' && !(Number.isInteger(s.i) && s.i! >= 0 && s.i! < p.stages.length)) e.push(`steps[${i}].i out of range`);
    if (!isBi(s.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  if (p.steps[0]?.op !== 'show') e.push('first step is "show"');
  return e;
}

export function buildCycle(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as CyclePlan;
  const n = p.stages.length;
  const m = newScene(title, 780);
  const cols = ['b', 'c', 'carry', 'a', 'accent', 'result'] as const;
  const pos = p.stages.map((_, i) => stagePos(i, n));
  /** Arrow from stage i to i+1, trimmed so it starts and ends outside the two ovals. */
  const edge = (i: number): [Pt, Pt, Pt] => {
    const a = pos[i];
    const b = pos[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    const trim = (ux: number, uy: number) => 1 / Math.sqrt((ux / RX) ** 2 + (uy / RY) ** 2) + 10;
    const ux = dx / L;
    const uy = dy / L;
    const t0 = trim(ux, uy);
    return [[a[0] + ux * t0, a[1] + uy * t0], [b[0] - ux * t0, b[1] - uy * t0], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]];
  };
  let t = 300;
  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      label(m, pick(p.title, lang), 360, 56, t, { size: 30, weight: '700' });
      pos.forEach((c, i) => {
        const col = cols[i % cols.length];
        m.poly(uid('nd'), ellipse(c[0], c[1], RX, RY), t + 300 * i, { color: col, fill: col, fillAlpha: 0.25, closed: true, width: 3, dur: 450, z: 2, silent: true });
        label(m, pick(p.stages[i].name, lang), c[0], c[1], t + 300 * i + 200, { size: 22, weight: '700', color: col });
      });
      t += 300 * n + 800;
    } else if (st.op === 'flow') {
      const i = st.i!;
      const [a, b, mid] = edge(i);
      vec(m, a, b, t, 'accent');
      const out: Pt = [mid[0] + (mid[0] - CX) * 0.22, mid[1] + (mid[1] - CY) * 0.2];
      label(m, pick(p.stages[i].process, lang), out[0], out[1], t + 400, { size: 20, color: 'accent', weight: '700' });
      t += 1800;
    } else if (st.op === 'loop') {
      for (let i = 0; i < n; i++) {
        const [a, b, mid] = edge(i);
        vec(m, a, b, t + 450 * i, 'accent');
        const out: Pt = [mid[0] + (mid[0] - CX) * 0.22, mid[1] + (mid[1] - CY) * 0.2];
        label(m, pick(p.stages[i].process, lang), out[0], out[1], t + 450 * i + 250, { size: 20, color: 'accent', weight: '700' });
      }
      t += 450 * n + 600;
      const id = uid('trav');
      m.dot(id, pos[0][0], pos[0][1], t, { color: 'tick', r: 10 });
      for (let i = 1; i <= n; i++) m.move(id, pos[i % n][0], pos[i % n][1], t + 700 * i, { dur: 650, sound: false });
      m.fadeOut(id, t + 700 * n + 700, 300);
      t += 700 * n + 1000;
    } else if (st.op === 'answer') {
      const rg = ring(m, CX, CY, 78, 40, t, 'tick');
      label(m, lang === 'ml' ? `${n} ഘട്ടം ↻` : `${n} stages ↻`, CX, CY, t + 100, { size: 22, color: 'tick', weight: '700' });
      sparkle(m, CX, CY, t + 300);
      void rg;
      t += 1600;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

const say = (en: string, ml: string) => ({ en, ml });
export const WATER_CYCLE: CyclePlan = {
  title: say('The water cycle', 'ജലചക്രം'),
  stages: [
    { name: say('Sea and rivers', 'കടൽ, നദി'), process: say('evaporation', 'ബാഷ്പീകരണം') },
    { name: say('Water vapour', 'നീരാവി'), process: say('condensation', 'സാന്ദ്രീകരണം') },
    { name: say('Clouds', 'മേഘങ്ങൾ'), process: say('precipitation', 'വർഷണം') },
    { name: say('Rain and snow', 'മഴ, മഞ്ഞ്'), process: say('runoff', 'ഒഴുക്ക്') },
  ],
  steps: [
    { op: 'show', say: say('Water moves round and round: from the Earth to the sky and back.', 'ജലം ഭൂമിയിൽ നിന്ന് ആകാശത്തേക്കും തിരിച്ചും ചുറ്റിക്കൊണ്ടിരിക്കുന്നു.') },
    { op: 'flow', i: 0, say: say('The Sun heats water and it rises as vapour.', 'സൂര്യൻ ജലത്തെ ചൂടാക്കുമ്പോൾ അത് നീരാവിയായി ഉയരുന്നു.') },
    { op: 'flow', i: 1, say: say('High up the vapour cools and forms tiny droplets.', 'ഉയരത്തിൽ നീരാവി തണുത്ത് ചെറു തുള്ളികളാകുന്നു.') },
    { op: 'loop', say: say('Rain flows back to rivers and the sea, and the cycle starts again.', 'മഴ നദികളിലേക്കും കടലിലേക്കും ഒഴുകി; ചക്രം വീണ്ടും തുടങ്ങുന്നു.') },
    { op: 'answer', say: say('The cycle never stops, so the water is used again and again.', 'ചക്രം നിലയ്ക്കുന്നില്ല; അതിനാൽ ജലം വീണ്ടും വീണ്ടും ഉപയോഗിക്കപ്പെടുന്നു.') },
  ],
};
export const ROCK_CYCLE: CyclePlan = {
  title: say('The rock cycle', 'ശിലാചക്രം'),
  stages: [
    { name: say('Igneous rock', 'ആഗ്നേയശില'), process: say('weathering', 'അപക്ഷയം') },
    { name: say('Sediments', 'അവസാദങ്ങൾ'), process: say('compaction', 'സമ്മർദ്ദനം') },
    { name: say('Sedimentary rock', 'അവസാദശില'), process: say('heat and pressure', 'ചൂടും മർദ്ദവും') },
    { name: say('Metamorphic rock', 'കായാന്തരശില'), process: say('melting', 'ഉരുകൽ') },
    { name: say('Magma', 'മാഗ്മ'), process: say('cooling', 'തണുക്കൽ') },
  ],
  steps: [
    { op: 'show', say: say('Rocks change from one kind to another over millions of years.', 'ദശലക്ഷക്കണക്കിന് വർഷങ്ങൾ കൊണ്ട് ശിലകൾ ഒരു തരത്തിൽ നിന്ന് മറ്റൊന്നായി മാറുന്നു.') },
    { op: 'flow', i: 0, say: say('Wind and water break rock into small pieces.', 'കാറ്റും ജലവും ശിലയെ ചെറു കഷണങ്ങളാക്കുന്നു.') },
    { op: 'flow', i: 2, say: say('Deep in the Earth heat and pressure change the rock.', 'ഭൂമിക്കടിയിലെ ചൂടും മർദ്ദവും ശിലയെ മാറ്റുന്നു.') },
    { op: 'loop', say: say('Melted rock cools into igneous rock and the cycle goes on.', 'ഉരുകിയ ശില തണുത്ത് ആഗ്നേയശിലയാകുന്നു; ചക്രം തുടരുന്നു.') },
    { op: 'answer', say: say('Every rock type can become any other through this cycle.', 'ഈ ചക്രത്തിലൂടെ ഏതു ശിലയും മറ്റേതു ശിലയുമാകാം.') },
  ],
};
export const CARBON_CYCLE: CyclePlan = {
  title: say('The carbon cycle', 'കാർബൺ ചക്രം'),
  stages: [
    { name: say('Carbon dioxide in air', 'വായുവിലെ കാർബൺ ഡൈ ഓക്സൈഡ്'), process: say('photosynthesis', 'പ്രകാശസംശ്ലേഷണം') },
    { name: say('Plants', 'സസ്യങ്ങൾ'), process: say('eating', 'ഭക്ഷിക്കൽ') },
    { name: say('Animals', 'ജന്തുക്കൾ'), process: say('respiration and decay', 'ശ്വസനവും ജീർണ്ണനവും') },
  ],
  steps: [
    { op: 'show', say: say('Carbon moves between the air, plants and animals.', 'കാർബൺ വായു, സസ്യങ്ങൾ, ജന്തുക്കൾ എന്നിവയ്ക്കിടയിൽ സഞ്ചരിക്കുന്നു.') },
    { op: 'flow', i: 0, say: say('Plants take in carbon dioxide to make food.', 'ആഹാരം ഉണ്ടാക്കാൻ സസ്യങ്ങൾ കാർബൺ ഡൈ ഓക്സൈഡ് സ്വീകരിക്കുന്നു.') },
    { op: 'loop', say: say('Animals eat plants, then breathing and decay return the carbon to the air.', 'ജന്തുക്കൾ സസ്യങ്ങളെ ഭക്ഷിക്കുന്നു; ശ്വസനവും ജീർണ്ണനവും കാർബണിനെ വായുവിൽ തിരികെയെത്തിക്കുന്നു.') },
    { op: 'answer', say: say('The same carbon keeps going round in a closed loop.', 'ഒരേ കാർബൺ അടഞ്ഞ ചക്രത്തിൽ ചുറ്റിക്കൊണ്ടിരിക്കുന്നു.') },
  ],
};
export const cycleTemplate: AgentTemplate = { id: 'cycle', title: 'Cycle (water, rock, carbon)', about: 'Stages round a ring joined by labelled arrows; a dot travels the full loop.', example: WATER_CYCLE, validate: validateCycle, build: buildCycle };
