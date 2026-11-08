/** Earth agent · template "layers": stacked bands whose heights are proportional to the thickness; totals and percentages are computed. */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { isBi, label, newScene, num, pick, rect, ring, sparkle, type Bi } from '../../kit';
import type { AgentTemplate } from '../../types';

export interface LayersPlan {
  title: Bi;
  unit: string;
  /** Outermost first. */
  layers: Array<{ name: Bi; thickness: number; note?: Bi }>;
  steps: Array<{ op: 'show' | 'layer' | 'total' | 'answer'; i?: number; say: Bi }>;
}
export const layersTotal = (p: LayersPlan) => p.layers.reduce((a, l) => a + l.thickness, 0);
export const layerPct = (p: LayersPlan, i: number) => (p.layers[i].thickness / layersTotal(p)) * 100;

export function validateLayers(x: unknown): string[] {
  const p = x as LayersPlan;
  const e: string[] = [];
  if (!p || !Array.isArray(p.layers) || p.layers.length < 2 || p.layers.length > 6) return ['2 to 6 layers needed'];
  if (!isBi(p.title)) e.push('title needs en and ml');
  if (typeof p.unit !== 'string' || !p.unit) e.push('unit needed (km)');
  p.layers.forEach((l, i) => {
    if (!isBi(l?.name)) e.push(`layers[${i}].name needs en and ml`);
    if (typeof l?.thickness !== 'number' || !(l.thickness > 0)) e.push(`layers[${i}].thickness must be positive`);
  });
  if (!Array.isArray(p.steps) || !p.steps.length) return [...e, 'steps needed'];
  p.steps.forEach((s, i) => {
    if (!['show', 'layer', 'total', 'answer'].includes(s.op)) e.push(`steps[${i}].op unknown`);
    if (s.op === 'layer' && !(Number.isInteger(s.i) && s.i! >= 0 && s.i! < p.layers.length)) e.push(`steps[${i}].i out of range`);
    if (!isBi(s.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  if (p.steps[0]?.op !== 'show') e.push('first step is "show"');
  return e;
}

export function buildLayers(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as LayersPlan;
  const total = layersTotal(p);
  const H = 800;
  const m = newScene(title, H);
  const top = 120;
  const full = 520;
  const cols = ['b', 'c', 'carry', 'a', 'accent', 'result'] as const;
  let y = top;
  const geo = p.layers.map((l, i) => {
    const h = Math.max(46, (l.thickness / total) * full);
    const g = { y, h, i };
    y += h;
    return g;
  });
  const bottom = y;
  let t = 300;
  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      label(m, pick(p.title, lang), 360, 56, t, { size: 30, weight: '700' });
      geo.forEach((g) => rect(m, 90, g.y, 300, g.h, t + 300 * g.i, cols[g.i % cols.length], { alpha: 0.28 }));
      geo.forEach((g) => label(m, pick(p.layers[g.i].name, lang), 240, g.y + g.h / 2, t + 300 * g.i + 200, { size: 24, weight: '700', color: cols[g.i % cols.length] }));
      t += 300 * geo.length + 800;
    } else if (st.op === 'layer') {
      const g = geo[st.i!];
      const rg = ring(m, 240, g.y + g.h / 2, 165, Math.min(g.h / 2 + 6, 34), t, 'accent');
      m.fadeOut([rg], t + 1500, 300);
      label(m, `${num(p.layers[g.i].thickness)} ${p.unit}`, 540, g.y + g.h / 2 - 12, t + 200, { size: 28, color: 'ink', weight: '700' });
      label(m, `${num(layerPct(p, g.i))}%`, 540, g.y + g.h / 2 + 22, t + 400, { size: 22, color: 'accent' });
      t += 1800;
    } else if (st.op === 'total') {
      m.rule(`br${t}`, 70, top, 70, bottom, t, { color: 'tick', width: 4 });
      label(m, `${num(total)} ${p.unit}`, 640, (top + bottom) / 2, t + 300, { size: 32, color: 'tick', weight: '700' });
      t += 1600;
    } else if (st.op === 'answer') {
      ring(m, 360, bottom + 60, 200, 34, t, 'tick');
      label(m, `Σ = ${num(total)} ${p.unit}`, 360, bottom + 60, t + 100, { size: 32, color: 'tick', weight: '700' });
      sparkle(m, 360, bottom + 60, t + 300);
      t += 1600;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

const say = (en: string, ml: string) => ({ en, ml });
export const LAYERS_EXAMPLE: LayersPlan = {
  title: say('Layers of the Earth', 'ഭൂമിയുടെ പാളികൾ'),
  unit: 'km',
  layers: [
    { name: say('Crust', 'ഭൂവൽക്കം'), thickness: 35 },
    { name: say('Mantle', 'മാന്റിൽ'), thickness: 2865 },
    { name: say('Outer core', 'ബാഹ്യകാമ്പ്'), thickness: 2300 },
    { name: say('Inner core', 'ആന്തരകാമ്പ്'), thickness: 1170 },
  ],
  steps: [
    { op: 'show', say: say('The Earth is made of layers, from the thin crust inward to the core.', 'ഭൂമി പാളികളാൽ നിർമ്മിതം: നേർത്ത ഭൂവൽക്കം മുതൽ കാമ്പ് വരെ.') },
    { op: 'layer', i: 0, say: say('The crust is very thin compared with the others.', 'മറ്റു പാളികളെ അപേക്ഷിച്ച് ഭൂവൽക്കം വളരെ നേർത്തതാണ്.') },
    { op: 'layer', i: 1, say: say('The mantle is the thickest layer.', 'ഏറ്റവും കട്ടിയുള്ള പാളി മാന്റിൽ ആണ്.') },
    { op: 'total', say: say('Add the thicknesses to get the distance from the surface to the centre.', 'കനങ്ങൾ കൂട്ടിയാൽ ഉപരിതലത്തിൽ നിന്ന് കേന്ദ്രത്തിലേക്കുള്ള ദൂരം കിട്ടും.') },
    { op: 'answer', say: say('So the centre of the Earth is about this far below us.', 'അങ്ങനെ ഭൂമിയുടെ കേന്ദ്രം നമുക്ക് ഇത്രയും താഴെയാണ്.') },
  ],
};
export const layersTemplate: AgentTemplate = { id: 'layers', title: 'Layers (Earth, atmosphere)', about: 'Stacked bands drawn to scale; totals and percentages computed.', example: LAYERS_EXAMPLE, validate: validateLayers, build: buildLayers };
