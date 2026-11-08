/**
 * V51.9.149 — Biology agent · template "cell": a plant or an animal cell drawn part by part. Each part is ringed,
 * labelled and its job written beside it; then a plant-versus-animal comparison. The parts and their jobs come from
 * the app's own list (never from the plan), so names and functions are always right.
 * (Idea of the scene: the cell gallery of cell-architecture-studio, MIT; the drawing is the app's own.)
 */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { ellipse, isBi, label, newScene, pick, ring, sparkle, uid, type Bi, type Pt } from '../../kit';
import type { AgentTemplate } from '../../types';

export type CellPart = 'membrane' | 'wall' | 'nucleus' | 'cytoplasm' | 'mitochondria' | 'chloroplast' | 'vacuole' | 'er' | 'golgi' | 'ribosome';
export interface CellPlan {
  kind: 'plant' | 'animal';
  steps: Array<{ op: 'show' | 'part' | 'compare'; part?: CellPart; say: Bi }>;
}

const B = (en: string, ml: string): Bi => ({ en, ml });
export const PARTS: Record<CellPart, { name: Bi; job: Bi; plantOnly?: boolean }> = {
  membrane: { name: B('Cell membrane', 'കോശസ്തരം'), job: B('lets substances in and out', 'പദാർഥങ്ങളെ അകത്തേക്കും പുറത്തേക്കും കടത്തിവിടുന്നു') },
  wall: { name: B('Cell wall', 'കോശഭിത്തി'), job: B('gives shape and strength', 'ആകൃതിയും ബലവും നൽകുന്നു'), plantOnly: true },
  nucleus: { name: B('Nucleus', 'മർമം'), job: B('controls the cell; holds DNA', 'കോശത്തെ നിയന്ത്രിക്കുന്നു; DNA ഉൾക്കൊള്ളുന്നു') },
  cytoplasm: { name: B('Cytoplasm', 'കോശദ്രവ്യം'), job: B('jelly where reactions happen', 'രാസപ്രവർത്തനങ്ങൾ നടക്കുന്ന ദ്രാവകം') },
  mitochondria: { name: B('Mitochondria', 'മൈറ്റോകോൺഡ്രിയ'), job: B('release energy (respiration)', 'ഊർജ്ജം പുറത്തുവിടുന്നു (ശ്വസനം)') },
  chloroplast: { name: B('Chloroplast', 'ഹരിതകണം'), job: B('makes food by photosynthesis', 'പ്രകാശസംശ്ലേഷണത്തിലൂടെ ആഹാരം നിർമിക്കുന്നു'), plantOnly: true },
  vacuole: { name: B('Vacuole', 'ഫേനം'), job: B('stores water and salts', 'ജലവും ലവണങ്ങളും സംഭരിക്കുന്നു') },
  er: { name: B('Endoplasmic reticulum', 'എൻഡോപ്ലാസ്മിക് റെറ്റിക്കുലം'), job: B('carries materials inside the cell', 'കോശത്തിനുള്ളിൽ പദാർഥങ്ങൾ എത്തിക്കുന്നു') },
  golgi: { name: B('Golgi body', 'ഗോൾഗി വസ്തു'), job: B('packs and sends out materials', 'പദാർഥങ്ങളെ പൊതിഞ്ഞ് പുറത്തേക്ക് അയയ്ക്കുന്നു') },
  ribosome: { name: B('Ribosomes', 'റൈബോസോമുകൾ'), job: B('make proteins', 'പ്രോട്ടീൻ നിർമിക്കുന്നു') },
};
const ALL = Object.keys(PARTS) as CellPart[];

export function validateCell(x: unknown): string[] {
  const p = x as CellPlan;
  if (!p || typeof p !== 'object') return ['plan is not an object'];
  const e: string[] = [];
  if (p.kind !== 'plant' && p.kind !== 'animal') e.push('kind is "plant" or "animal"');
  if (!Array.isArray(p.steps) || !p.steps.length || p.steps.length > 12) return [...e, 'steps: 1 to 12'];
  if (p.steps[0]?.op !== 'show') e.push('the first step is "show"');
  const seen = new Set<string>();
  p.steps.forEach((s, i) => {
    if (!['show', 'part', 'compare'].includes(s?.op)) e.push(`steps[${i}].op is show, part or compare`);
    if (s?.op === 'part') {
      if (!s.part || !ALL.includes(s.part)) e.push(`steps[${i}].part is one of ${ALL.join(', ')}`);
      else if (PARTS[s.part].plantOnly && p.kind === 'animal') e.push(`steps[${i}]: an animal cell has no ${s.part}`);
      else if (seen.has(s.part)) e.push(`steps[${i}]: ${s.part} twice`);
      else seen.add(s.part);
    }
    if (s?.op === 'compare' && i !== p.steps.length - 1) e.push('"compare" is the last step');
    if (!isBi(s?.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  return e;
}

/** Where each part sits (and is ringed) in the drawing. */
function layout(plant: boolean) {
  const cx = 250, cy = 290;
  return {
    cx, cy, plant,
    membrane: [cx - (plant ? 168 : 175), cy] as Pt,
    wall: [cx - 180, cy - 120] as Pt,
    nucleus: [cx + 20, cy - 10] as Pt,
    cytoplasm: [cx - 90, cy + 90] as Pt,
    mitochondria: [cx - 100, cy - 70] as Pt,
    chloroplast: [cx + 110, cy + 90] as Pt,
    vacuole: plant ? ([cx - 30, cy + 40] as Pt) : ([cx + 100, cy + 70] as Pt),
    er: [cx + 75, cy - 40] as Pt,
    golgi: [cx - 60, cy + 110] as Pt,
    ribosome: [cx + 120, cy - 90] as Pt,
  };
}

export function buildCell(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as CellPlan;
  const plant = p.kind === 'plant';
  const L = layout(plant);
  const { cx, cy } = L;
  const m = newScene(title, 640);
  let t = 300;
  const ml = lang === 'ml';
  let row = 0;
  const parts = new Map<CellPart, string[]>();
  const add = (k: CellPart, id: string) => { parts.set(k, [...(parts.get(k) ?? []), id]); return id; };

  const drawCell = (t0: number) => {
    if (plant) {
      const r = (w: number, h: number): Pt[] => [[cx - w, cy - h], [cx + w, cy - h], [cx + w, cy + h], [cx - w, cy + h]];
      m.poly(add('wall', uid('wall')), r(180, 150), t0, { color: 'c', fill: 'c', fillAlpha: 0.12, closed: true, width: 6, dur: 700, z: 1, silent: true });
      m.poly(add('membrane', uid('mem')), r(168, 138), t0 + 300, { color: 'b', closed: true, width: 2.5, dur: 700, z: 2, silent: true });
      // big central vacuole
      m.poly(add('vacuole', uid('vac')), ellipse(cx - 30, cy + 40, 90, 60, 30), t0 + 700, { color: '#5aa9e6', fill: '#5aa9e6', fillAlpha: 0.25, closed: true, width: 2, dur: 600, z: 2, silent: true });
    } else {
      m.poly(add('membrane', uid('mem')), ellipse(cx, cy, 175, 140, 40), t0, { color: 'b', fill: 'carry', fillAlpha: 0.1, closed: true, width: 3, dur: 800, z: 1, silent: true });
      m.poly(add('vacuole', uid('vac')), ellipse(cx + 100, cy + 70, 22, 16, 18), t0 + 700, { color: '#5aa9e6', fill: '#5aa9e6', fillAlpha: 0.3, closed: true, width: 2, dur: 400, z: 2, silent: true });
    }
    // nucleus with nucleolus
    m.poly(add('nucleus', uid('nuc')), ellipse(cx + 20, cy - 10, 46, 40, 26), t0 + 900, { color: 'b', fill: 'b', fillAlpha: 0.3, closed: true, width: 3, dur: 500, z: 3, silent: true });
    m.poly(add('nucleus', uid('nuo')), ellipse(cx + 28, cy - 14, 13, 11, 14), t0 + 1100, { color: 'b', fill: 'b', fillAlpha: 0.8, closed: true, width: 1.5, dur: 300, z: 4, silent: true });
    // mitochondria (two), with folds
    for (const [mx, my] of [[cx - 100, cy - 70], [cx + 40, cy + 95]] as Pt[]) {
      m.poly(add('mitochondria', uid('mi')), ellipse(mx, my, 30, 14, 20), t0 + 1300, { color: 'a', fill: 'a', fillAlpha: 0.25, closed: true, width: 2, dur: 400, z: 3, silent: true });
      m.poly(add('mitochondria', uid('mf')), Array.from({ length: 9 }, (_, i): Pt => [mx - 22 + i * 5.5, my + (i % 2 ? 7 : -7)]), t0 + 1500, { color: 'a', closed: false, width: 1.5, dur: 300, z: 4, silent: true });
    }
    if (plant) for (const [qx, qy] of [[cx + 110, cy + 90], [cx - 120, cy - 10], [cx + 120, cy - 30]] as Pt[]) {
      m.poly(add('chloroplast', uid('ch')), ellipse(qx, qy, 24, 12, 18), t0 + 1600, { color: 'c', fill: 'c', fillAlpha: 0.55, closed: true, width: 2, dur: 400, z: 3, silent: true });
      for (let k = -1; k <= 1; k++) m.rule(add('chloroplast', uid('cl')), qx - 14, qy + k * 4, qx + 14, qy + k * 4, t0 + 1800, { color: 'c', width: 1 });
    }
    // endoplasmic reticulum: wavy lines beside the nucleus
    for (let k = 0; k < 3; k++) m.poly(add('er', uid('er')), Array.from({ length: 10 }, (_, i): Pt => [cx + 72 + k * 9 + Math.sin(i) * 4, cy - 62 + i * 6]), t0 + 1900, { color: 'carry', closed: false, width: 2, dur: 400, z: 3, silent: true });
    // golgi: stacked arcs
    for (let k = 0; k < 4; k++) m.poly(add('golgi', uid('go')), Array.from({ length: 8 }, (_, i): Pt => [cx - 84 + i * 7, cy + 102 + k * 6 - Math.sin((i / 7) * Math.PI) * 6]), t0 + 2000, { color: '#c77dff', closed: false, width: 2.2, dur: 300, z: 3, silent: true });
    // ribosomes: dots
    for (let k = 0; k < 10; k++) m.dot(add('ribosome', uid('rb')), cx + 95 + (k % 5) * 10, cy - 100 + Math.floor(k / 5) * 14 + (k % 2) * 4, t0 + 2100 + k * 20, { color: 'ink', r: 2.4 });
    return t0 + 2400;
  };

  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      t = drawCell(t);
      label(m, ml ? (plant ? 'സസ്യകോശം' : 'ജന്തുകോശം') : plant ? 'Plant cell' : 'Animal cell', cx, cy - 175, t - 1800, { size: 26, color: 'ink', weight: '700' });
    } else if (st.op === 'part' && st.part) {
      const k = st.part;
      const at = L[k] as Pt;
      m.focus(parts.get(k) ?? [], t);
      const rg = ring(m, at[0], at[1], k === 'membrane' || k === 'wall' ? 22 : 48, k === 'membrane' || k === 'wall' ? 22 : 36, t, 'accent');
      m.fadeOut(rg, t + 2200, 400);
      const y = 110 + row * 58;
      row++;
      m.rule(uid('lead'), at[0] + 30, at[1], 470, y, t + 300, { color: 'done', width: 1.2 });
      label(m, pick(PARTS[k].name, lang), 585, y - 12, t + 400, { size: 22, color: 'accent', weight: '700' });
      label(m, pick(PARTS[k].job, lang), 585, y + 12, t + 600, { size: 16, color: 'ink' });
      t += 1600;
    } else if (st.op === 'compare') {
      const y0 = 110 + row * 58 + 10;
      const rows: Array<[Bi, string, string]> = [
        [B('Cell wall', 'കോശഭിത്തി'), ml ? 'ഉണ്ട്' : 'yes', ml ? 'ഇല്ല' : 'no'],
        [B('Chloroplasts', 'ഹരിതകണങ്ങൾ'), ml ? 'ഉണ്ട്' : 'yes', ml ? 'ഇല്ല' : 'no'],
        [B('Vacuole', 'ഫേനം'), ml ? 'വലുത്' : 'large', ml ? 'ചെറുത്' : 'small'],
      ];
      label(m, ml ? 'സസ്യം' : 'Plant', 600, y0, t, { size: 18, color: 'c', weight: '700' });
      label(m, ml ? 'ജന്തു' : 'Animal', 670, y0, t, { size: 18, color: 'carry', weight: '700' });
      rows.forEach(([n, a, b], i) => {
        const y = y0 + 30 + i * 28;
        label(m, pick(n, lang), 510, y, t + 300 + i * 300, { size: 17, color: 'ink' });
        label(m, a, 600, y, t + 400 + i * 300, { size: 18, color: 'c', weight: '700' });
        label(m, b, 670, y, t + 500 + i * 300, { size: 18, color: 'carry', weight: '700' });
      });
      sparkle(m, 600, y0 + 60, t + 1400);
      t += 2200;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

export const CELL_EXAMPLE: CellPlan = {
  kind: 'plant',
  steps: [
    { op: 'show', say: B('This is a plant cell, as seen under a microscope.', 'സൂക്ഷ്മദർശിനിയിലൂടെ കാണുന്ന ഒരു സസ്യകോശം.') },
    { op: 'part', part: 'wall', say: B('Outside is the cell wall, which keeps the shape of the plant cell.', 'പുറത്ത് കോശഭിത്തി; അത് സസ്യകോശത്തിന് ആകൃതി നൽകുന്നു.') },
    { op: 'part', part: 'membrane', say: B('Inside the wall, the cell membrane controls what enters and leaves.', 'ഭിത്തിക്കുള്ളിൽ കോശസ്തരം; അകത്തേക്കും പുറത്തേക്കും പോകുന്നവയെ നിയന്ത്രിക്കുന്നു.') },
    { op: 'part', part: 'nucleus', say: B('The nucleus is the control centre of the cell.', 'മർമമാണ് കോശത്തിന്റെ നിയന്ത്രണകേന്ദ്രം.') },
    { op: 'part', part: 'chloroplast', say: B('Chloroplasts make food using sunlight.', 'ഹരിതകണങ്ങൾ സൂര്യപ്രകാശം ഉപയോഗിച്ച് ആഹാരം നിർമിക്കുന്നു.') },
    { op: 'part', part: 'vacuole', say: B('A large vacuole stores water.', 'വലിയ ഫേനം ജലം സംഭരിക്കുന്നു.') },
    { op: 'part', part: 'mitochondria', say: B('Mitochondria release energy from food.', 'മൈറ്റോകോൺഡ്രിയ ആഹാരത്തിൽ നിന്ന് ഊർജ്ജം പുറത്തുവിടുന്നു.') },
    { op: 'compare', say: B('Plant cells have a wall, chloroplasts and a big vacuole; animal cells do not.', 'സസ്യകോശങ്ങൾക്ക് ഭിത്തിയും ഹരിതകണങ്ങളും വലിയ ഫേനവുമുണ്ട്; ജന്തുകോശങ്ങൾക്കില്ല.') },
  ],
};

export const cellTemplate: AgentTemplate = {
  id: 'cell',
  title: 'Plant and animal cells',
  about: 'A plant or animal cell drawn part by part: each organelle ringed, named and its job written; then plant versus animal.',
  example: CELL_EXAMPLE,
  validate: validateCell,
  build: buildCell,
};
