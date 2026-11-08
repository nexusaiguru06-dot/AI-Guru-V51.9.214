/**
 * V51.9.147 — Chemistry agent · template "molar-mass": the molecular mass of a compound, atom by atom.
 * The formula is split into its elements; each row is "atoms × atomic mass"; the rows are added. With a given mass
 * the number of moles follows (n = m ÷ M), and with "particles" the number of molecules (n × 6.022 × 10²³).
 * Every number on the board is computed here (school atomic masses: H 1, C 12, O 16, Na 23, Cl 35.5 …).
 */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { isBi, label, newScene, num, pick, ring, sparkle, uid, type Bi } from '../../kit';
import type { AgentTemplate } from '../../types';
import { parseFormula, toSub } from './balance-equation';
import { findElement, schoolMass } from './elements';

export type MassOp = 'show' | 'atoms' | 'multiply' | 'add' | 'moles' | 'particles';
export interface MassPlan {
  formula: string;
  /** A mass in grams, for "how many moles are in 49 g of H2SO4?". */
  massG?: number;
  steps: Array<{ op: MassOp; say: Bi }>;
}
const ORDER: MassOp[] = ['show', 'atoms', 'multiply', 'add', 'moles', 'particles'];
const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

export function massFacts(p: MassPlan) {
  const counts = parseFormula(p.formula)!;
  const rows = [...counts].map(([sym, n]) => {
    const e = findElement(sym)!;
    const am = schoolMass(e);
    return { sym, n, am, sub: round(n * am, 2) };
  });
  const M = round(rows.reduce((a, r) => a + r.sub, 0), 2);
  const moles = p.massG !== undefined ? round(p.massG / M, 4) : undefined;
  return { rows, M, moles };
}

export function validateMass(x: unknown): string[] {
  const p = x as MassPlan;
  if (!p || typeof p !== 'object') return ['plan is not an object'];
  const e: string[] = [];
  if (typeof p.formula !== 'string' || !parseFormula(p.formula)) e.push(`formula "${String(p.formula)}" is not a chemical formula (write H2SO4, Ca(OH)2 …)`);
  else if (parseFormula(p.formula)!.size > 6) e.push('at most 6 different elements');
  if (p.massG !== undefined && !(typeof p.massG === 'number' && p.massG > 0 && p.massG < 1e6)) e.push('massG is a positive number of grams');
  if (!Array.isArray(p.steps) || !p.steps.length) return [...e, 'steps needed'];
  let last = -1;
  p.steps.forEach((s, i) => {
    const k = ORDER.indexOf(s?.op);
    if (k < 0) e.push(`steps[${i}].op must be one of ${ORDER.join(', ')}`);
    else if (k <= last) e.push(`steps[${i}]: the order is ${ORDER.join(', ')}, each at most once`);
    last = Math.max(last, k);
    if (!isBi(s?.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  if (p.steps[0]?.op !== 'show') e.push('the first step is "show"');
  if (!p.steps.some((s) => s.op === 'add')) e.push('an "add" step is needed (it writes the molecular mass)');
  if (p.steps.some((s) => s.op === 'moles') && p.massG === undefined) e.push('"moles" needs massG');
  if (p.steps.some((s) => s.op === 'particles') && !p.steps.some((s) => s.op === 'moles') && p.massG === undefined) e.push('"particles" needs massG');
  return e;
}

export function buildMass(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as MassPlan;
  const f = massFacts(p);
  const ml = lang === 'ml';
  const m = newScene(title, 720);
  let t = 300;
  const X = { el: 170, n: 290, x1: 350, am: 430, eq: 510, sub: 600 };
  const Y0 = 200;
  const RH = Math.min(56, 300 / f.rows.length);
  const subIds: string[] = [];
  const rowY = (i: number) => Y0 + i * RH;
  let formulaId = '';
  const sumY = rowY(f.rows.length) + 30;

  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      formulaId = label(m, toSub(p.formula), 360, 70, t, { size: 56, color: 'accent', weight: '700' });
      if (p.massG !== undefined) label(m, ml ? `നൽകിയ മാസ് ${num(p.massG)} g` : `Given mass ${num(p.massG)} g`, 360, 122, t + 400, { size: 24, color: 'carry' });
      t += 1400;
    } else if (st.op === 'atoms') {
      label(m, ml ? 'മൂലകം' : 'Element', X.el, Y0 - 50, t, { size: 20, color: 'done' });
      label(m, ml ? 'ആറ്റങ്ങൾ' : 'Atoms', X.n, Y0 - 50, t, { size: 20, color: 'done' });
      label(m, ml ? 'അറ്റോമിക മാസ്' : 'Atomic mass', X.am, Y0 - 50, t, { size: 20, color: 'done' });
      f.rows.forEach((r, i) => {
        const at = t + 300 + i * 450;
        label(m, r.sym, X.el, rowY(i), at, { size: 34, color: 'b', weight: '700' });
        label(m, String(r.n), X.n, rowY(i), at + 150, { size: 34, color: 'a', weight: '700' });
      });
      ring(m, 360, 70, 30 + toSub(p.formula).length * 15, 40, t + 200, 'carry');
      t += 300 + f.rows.length * 450 + 700;
    } else if (st.op === 'multiply') {
      f.rows.forEach((r, i) => {
        const at = t + i * 650;
        label(m, '×', X.x1, rowY(i), at, { size: 30, color: 'ink' });
        label(m, num(r.am), X.am, rowY(i), at + 150, { size: 34, color: 'c', weight: '700' });
        label(m, '=', X.eq, rowY(i), at + 300, { size: 30, color: 'ink' });
        subIds.push(label(m, num(r.sub), X.sub, rowY(i), at + 450, { size: 34, color: 'result', weight: '700' }));
      });
      t += f.rows.length * 650 + 700;
    } else if (st.op === 'add') {
      m.rule(uid('ln'), 120, sumY - 26, 660, sumY - 26, t, { color: 'ink', width: 3 });
      if (subIds.length) m.focus(subIds, t + 200);
      const sumText = f.rows.map((r) => num(r.sub)).join(' + ');
      label(m, sumText.length < 40 ? `${sumText} = ${num(f.M)}` : num(f.M), 360, sumY + 10, t + 700, { size: 30, color: 'ink', weight: '700' });
      label(m, ml ? `തന്മാത്രാ മാസ് = ${num(f.M)} u   ·   1 മോൾ = ${num(f.M)} g` : `Molecular mass = ${num(f.M)} u   ·   1 mole = ${num(f.M)} g`, 360, sumY + 62, t + 1300, { size: 26, color: 'tick', weight: '700' });
      t += 2400;
      if (!p.steps.some((s) => s.op === 'moles')) sparkle(m, 360, sumY + 62, t - 400);
    } else if (st.op === 'moles') {
      const y = sumY + 112;
      label(m, `n = m ÷ M = ${num(p.massG!)} ÷ ${num(f.M)} = ${num(f.moles!)} ${ml ? 'മോൾ' : 'mol'}`, 360, y, t, { size: 30, color: 'accent', weight: '700' });
      ring(m, 360, y, 260, 30, t + 900, 'tick');
      t += 2000;
    } else if (st.op === 'particles') {
      const y = sumY + 160;
      const n = f.moles ?? 1;
      const v = n * 6.022;
      const exp = v >= 10 ? 24 : 23;
      const mant = round(v >= 10 ? v / 10 : v, 3);
      label(m, `${num(n)} × 6.022 × 10²³ = ${mant} × 10${exp === 24 ? '²⁴' : '²³'} ${ml ? 'തന്മാത്രകൾ' : 'molecules'}`, 360, y, t, { size: 26, color: 'b', weight: '700' });
      sparkle(m, 360, y, t + 800);
      t += 2000;
    }
    t += 150;
    m.hold(t);
  }
  void formulaId;
  m.hold(t + 1400);
  return [m.build()];
}

export const MASS_EXAMPLE: MassPlan = {
  formula: 'H2SO4',
  massG: 49,
  steps: [
    { op: 'show', say: { en: 'How many moles are there in 49 grams of sulphuric acid, H2SO4?', ml: '49 ഗ്രാം സൾഫ്യൂറിക് ആസിഡിൽ (H2SO4) എത്ര മോൾ ഉണ്ട്?' } },
    { op: 'atoms', say: { en: 'First count the atoms of each element in one molecule.', ml: 'ആദ്യം ഒരു തന്മാത്രയിലെ ഓരോ മൂലകത്തിന്റെയും ആറ്റങ്ങൾ എണ്ണുക.' } },
    { op: 'multiply', say: { en: 'Multiply each count by the atomic mass of that element.', ml: 'ഓരോ എണ്ണത്തെയും ആ മൂലകത്തിന്റെ അറ്റോമിക മാസ് കൊണ്ട് ഗുണിക്കുക.' } },
    { op: 'add', say: { en: 'Add them: that is the molecular mass. One mole weighs that many grams.', ml: 'ഇവ കൂട്ടുക: അതാണ് തന്മാത്രാ മാസ്. ഒരു മോളിന് അത്രയും ഗ്രാം.' } },
    { op: 'moles', say: { en: 'Number of moles is the given mass divided by the molar mass.', ml: 'മോളുകളുടെ എണ്ണം = നൽകിയ മാസ് ÷ മോളാർ മാസ്.' } },
    { op: 'particles', say: { en: 'Each mole has 6.022 × 10²³ molecules, the Avogadro number.', ml: 'ഓരോ മോളിലും 6.022 × 10²³ തന്മാത്രകൾ — അവോഗാഡ്രോ സംഖ്യ.' } },
  ],
};

export const massTemplate: AgentTemplate = {
  id: 'molar-mass',
  title: 'Molecular mass and moles',
  about: 'Count the atoms, multiply by atomic masses, add for the molecular mass; then moles = mass ÷ molar mass and molecules = moles × 6.022 × 10²³.',
  example: MASS_EXAMPLE,
  validate: validateMass,
  build: buildMass,
};
