/**
 * V51.9.147 — Chemistry agent · template "periodic-table": one element found in the periodic table.
 * The table is drawn (every cell coloured by its family), the element's cell is found by its group (column) and
 * period (row), then its card (atomic number, symbol, mass), its electrons shell by shell (a Bohr picture: K, L, M …),
 * its configuration, and its valence electrons and valency. Every fact is computed from the element data, never
 * from the plan.
 */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { isBi, label, newScene, pick, ring, sparkle, uid, rect, ellipse, type Bi } from '../../kit';
import type { AgentTemplate } from '../../types';
import { ELEMENTS, FAMILY_NAME, findElement, fullConfig, nameIn, schoolMass, shells, SHELL_NAMES, valencyOf, type Element } from './elements';
import type { Family } from './elements-data';

export type TableOp = 'show' | 'locate' | 'card' | 'shells' | 'config' | 'valency';
export interface TablePlan {
  /** Symbol, English name or atomic number of the element. */
  element: string;
  steps: Array<{ op: TableOp; say: Bi }>;
}

const ORDER: TableOp[] = ['show', 'locate', 'card', 'shells', 'config', 'valency'];
const FAMILY_COLOR: Record<Family, string> = {
  alkali: '#e4572e', alkaline: '#f3a712', transition: '#c9a227', post: '#8d99ae', metalloid: '#29a19c',
  nonmetal: '#3a86ff', halogen: '#8338ec', noble: '#ff006e', lanthanide: '#06a77d', actinide: '#2a9d8f', unknown: '#9aa0a6',
};

/* layout: an 18 × 7 table with the two f-block rows below it */
const CELL = 34;
const X0 = (720 - 18 * CELL) / 2;
const Y0 = 30;
const F_GAP = 12;
function cellOf(e: Element): { x: number; y: number } {
  if (e.group === 0) {
    const first = e.period === 6 ? 57 : 89;
    return { x: X0 + (3 + (e.z - first)) * CELL, y: Y0 + 7 * CELL + F_GAP + (e.period === 6 ? 0 : 1) * CELL };
  }
  return { x: X0 + (e.group - 1) * CELL, y: Y0 + (e.period - 1) * CELL };
}

export function tableFacts(p: TablePlan) {
  const e = findElement(p.element)!;
  return { e, mass: schoolMass(e), shells: shells(e), config: fullConfig(e), val: valencyOf(e), cell: cellOf(e) };
}

export function validateTable(x: unknown): string[] {
  const p = x as TablePlan;
  if (!p || typeof p !== 'object') return ['plan is not an object'];
  const e: string[] = [];
  if (typeof p.element !== 'string' && typeof p.element !== 'number') e.push('element: a symbol (Na), a name (sodium) or an atomic number');
  else if (!findElement(p.element as string)) e.push(`element "${String(p.element)}" is not an element`);
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
  if (!e.length && p.steps.some((s) => s.op === 'valency') && !valencyOf(findElement(p.element as string)!)) e.push('valency is only taught for main-group elements (groups 1, 2 and 13–18)');
  return e;
}

export function buildTable(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as TablePlan;
  const f = tableFacts(p);
  const { e } = f;
  const m = newScene(title, 720);
  const ml = lang === 'ml';
  let t = 300;
  const cellIds = new Map<number, string>();
  const fadeLater: string[] = [];
  // the lower half: card (left), Bohr picture (middle), shells (right)
  const LOW = Y0 + 9 * CELL + F_GAP + 26; // ≈ 392
  const BX = 420;
  const BY = LOW + 112;

  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      // every cell, row by row (a quick wave)
      ELEMENTS.forEach((el) => {
        const c = cellOf(el);
        const id = rect(m, c.x + 1, c.y + 1, CELL - 2, CELL - 2, t + el.period * 90 + (el.group || 10) * 12, FAMILY_COLOR[el.family], { alpha: 0.28, width: 1.2, z: 1 });
        const sy = label(m, el.symbol, c.x + CELL / 2, c.y + CELL / 2 + 2, t + el.period * 90 + (el.group || 10) * 12 + 150, { size: 13, color: 'ink' });
        cellIds.set(el.z, id);
        void sy;
      });
      for (let g = 1; g <= 18; g++) label(m, String(g), X0 + (g - 0.5) * CELL, Y0 - 12, t + 900, { size: 11, color: 'done' });
      for (let r = 1; r <= 7; r++) label(m, String(r), X0 - 12, Y0 + (r - 0.5) * CELL, t + 900, { size: 11, color: 'done' });
      t += 7 * 90 + 18 * 12 + 900;
    } else if (st.op === 'locate') {
      const c = f.cell;
      // the period's row and the group's column light up, then the cell
      if (e.group > 0) {
        fadeLater.push(rect(m, X0, c.y, 18 * CELL, CELL, t, 'carry', { alpha: 0.12, width: 2, z: 2 }));
        fadeLater.push(rect(m, c.x, Y0, CELL, 7 * CELL, t + 500, 'b', { alpha: 0.12, width: 2, z: 2 }));
      }
      ring(m, c.x + CELL / 2, c.y + CELL / 2, CELL * 0.75, CELL * 0.75, t + 1000, 'accent');
      rect(m, c.x - 1, c.y - 1, CELL + 2, CELL + 2, t + 1000, 'accent', { alpha: 0.5, width: 3, z: 3 });
      label(m, e.group > 0 ? (ml ? `ഗ്രൂപ്പ് ${e.group} · പീരിയഡ് ${e.period}` : `Group ${e.group} · Period ${e.period}`) : (ml ? `${FAMILY_NAME[e.family].ml} നിര · പീരിയഡ് ${e.period}` : `${FAMILY_NAME[e.family].en} row · Period ${e.period}`), 360, LOW - 18, t + 1200, { size: 24, color: 'accent', weight: '700' });
      t += 2200;
      if (fadeLater.length) m.fadeOut(fadeLater, t, 400);
    } else if (st.op === 'card') {
      const x = 40, y = LOW + 6, w = 180, h = 200;
      rect(m, x, y, w, h, t, FAMILY_COLOR[e.family], { alpha: 0.18, width: 3, z: 2 });
      label(m, String(e.z), x + 24, y + 26, t + 200, { size: 24, color: 'ink', weight: '700' });
      label(m, e.symbol, x + w / 2, y + 84, t + 350, { size: 68, color: 'accent', weight: '700' });
      label(m, nameIn(e, lang), x + w / 2, y + 136, t + 500, { size: 22, color: 'ink' });
      label(m, ml ? `അറ്റോമിക മാസ് ${f.mass}` : `Atomic mass ${f.mass}`, x + w / 2, y + 164, t + 650, { size: 18, color: 'ink' });
      label(m, ml ? FAMILY_NAME[e.family].ml : FAMILY_NAME[e.family].en, x + w / 2, y + 186, t + 800, { size: 16, color: 'done' });
      // atomic number = protons = electrons
      label(m, ml ? `${e.z} പ്രോട്ടോൺ · ${e.z} ഇലക്ട്രോൺ` : `${e.z} protons · ${e.z} electrons`, x + w / 2, y + h + 22, t + 1100, { size: 17, color: 'carry' });
      t += 1900;
    } else if (st.op === 'shells') {
      const sh = f.shells;
      const n = sh.length;
      const r0 = 24;
      const step = Math.min(24, (100 - r0) / n);
      const nuc = uid('nu');
      m.poly(nuc, ellipse(BX, BY, r0 * 0.8, r0 * 0.8, 24), t, { color: 'a', fill: 'a', fillAlpha: 0.85, closed: true, width: 2, dur: 300, z: 4, silent: true });
      label(m, `${e.z}+`, BX, BY + 1, t + 200, { size: 14, color: 'paper', weight: '700', z: 6 });
      sh.forEach((cnt, k) => {
        const r = r0 + step * (k + 1);
        const at = t + 400 + k * 700;
        m.poly(uid('sh'), ellipse(BX, BY, r, r, 48), at, { color: 'b', closed: true, width: 1.6, dur: 450, z: 2, silent: true });
        // the electrons of this shell, spread round it (as many as fit; the count is written next to it)
        const show = Math.min(cnt, Math.max(2, Math.floor((2 * Math.PI * r) / 11)));
        for (let i = 0; i < show; i++) {
          const a = -Math.PI / 2 + (i / show) * Math.PI * 2;
          m.dot(uid('el'), BX + r * Math.cos(a), BY + r * Math.sin(a), at + 250 + i * 25, { color: k === n - 1 ? 'carry' : 'c', r: 4.2 });
        }
        label(m, `${SHELL_NAMES[k]} ${cnt}`, 610, BY - ((n - 1) * 26) / 2 + k * 26, at + 300, { size: 22, color: k === n - 1 ? 'carry' : 'ink', weight: '700' });
      });
      t += 400 + n * 700 + 500;
      label(m, sh.join(', '), 610, BY + ((n + 1) * 26) / 2 + 8, t, { size: 22, color: 'accent', weight: '700' });
      t += 900;
    } else if (st.op === 'config') {
      label(m, f.config, 360, LOW + 258, t, { size: f.config.length > 40 ? 18 : 24, color: 'b', weight: '700' });
      t += 1600;
    } else if (st.op === 'valency') {
      const v = f.val!;
      const sh = f.shells;
      const r = 24 + Math.min(24, (100 - 24) / sh.length) * sh.length;
      ring(m, BX, BY, r + 10, r + 10, t, 'carry');
      const txt = ml
        ? `ബാഹ്യതമ ഷെല്ലിൽ ${v.valence} ഇലക്ട്രോൺ → സംയോജകത ${v.valency}`
        : `${v.valence} electron${v.valence === 1 ? '' : 's'} in the outer shell → valency ${v.valency}`;
      label(m, txt, 360, LOW + 258 + (p.steps.some((s) => s.op === 'config') ? 36 : 0), t + 500, { size: 22, color: 'tick', weight: '700' });
      sparkle(m, BX, BY, t + 900);
      t += 2000;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

export const TABLE_EXAMPLE: TablePlan = {
  element: 'Na',
  steps: [
    { op: 'show', say: { en: 'This is the periodic table. Elements are arranged by atomic number, in rows and columns.', ml: 'ഇതാണ് ആവർത്തനപ്പട്ടിക. മൂലകങ്ങൾ അറ്റോമിക നമ്പർ അനുസരിച്ച് വരികളിലും നിരകളിലുമായി ക്രമീകരിച്ചിരിക്കുന്നു.' } },
    { op: 'locate', say: { en: 'Sodium is in group 1, the first column, and in period 3, the third row.', ml: 'സോഡിയം ഗ്രൂപ്പ് 1-ലും പീരിയഡ് 3-ലുമാണ്.' } },
    { op: 'card', say: { en: 'Its atomic number is 11, so a sodium atom has 11 protons and 11 electrons.', ml: 'അറ്റോമിക നമ്പർ 11, അതിനാൽ സോഡിയം ആറ്റത്തിൽ 11 പ്രോട്ടോണും 11 ഇലക്ട്രോണും ഉണ്ട്.' } },
    { op: 'shells', say: { en: 'The electrons fill the shells in order: two in K, eight in L, and one in M.', ml: 'ഇലക്ട്രോണുകൾ ക്രമത്തിൽ ഷെല്ലുകളിൽ നിറയുന്നു: K-യിൽ രണ്ട്, L-ൽ എട്ട്, M-ൽ ഒന്ന്.' } },
    { op: 'config', say: { en: 'Written by sub-shells, the configuration is 1s² 2s² 2p⁶ 3s¹.', ml: 'സബ്ഷെൽ ക്രമത്തിൽ എഴുതിയാൽ 1s² 2s² 2p⁶ 3s¹.' } },
    { op: 'valency', say: { en: 'One electron in the outer shell: sodium gives it away, so its valency is one.', ml: 'ബാഹ്യതമ ഷെല്ലിൽ ഒരു ഇലക്ട്രോൺ; സോഡിയം അത് വിട്ടുകൊടുക്കുന്നു, അതിനാൽ സംയോജകത ഒന്ന്.' } },
  ],
};

export const tableTemplate: AgentTemplate = {
  id: 'periodic-table',
  title: 'An element in the periodic table',
  about: 'Find an element by its group and period, then its atomic number, its electrons shell by shell, its configuration and its valency.',
  example: TABLE_EXAMPLE,
  validate: validateTable,
  build: buildTable,
};
