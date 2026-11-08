/**
 * Chemistry agent · template "balance-equation": a chemical equation is balanced by counting atoms.
 * The plan only names the formulas; the app parses them, counts every atom on both sides and FINDS the
 * smallest whole-number coefficients itself (so the balanced equation is right by construction).
 */

import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { measure } from '../../../reels/motion/metrics';
const tokenWidth = (t: string, px: number) => measure(t, px, '700');
import { isBi, label, newScene, pick, ring, sparkle, uid, type Bi } from '../../kit';
import type { AgentTemplate } from '../../types';

export interface BalancePlan {
  reactants: string[];
  products: string[];
  steps: Array<{ op: 'show' | 'count' | 'balance' | 'check'; say: Bi }>;
}

const ELEMENTS = new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu'.split(' '));
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const toAscii = (s: string) => s.replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c)));
export const toSub = (s: string) => toAscii(s).replace(/(?<=[A-Za-z)])(\d+)/g, (d) => d.replace(/\d/g, (c) => SUB[Number(c)]));

/** Atom counts of a formula such as "Ca(OH)2" or "Fe2O3"; null when it is not a formula. */
export function parseFormula(raw: string): Map<string, number> | null {
  const f = toAscii(raw.trim());
  if (!/^[A-Za-z0-9()]+$/.test(f) || !/[A-Z]/.test(f)) return null;
  let i = 0;
  const parseGroup = (): Map<string, number> | null => {
    const out = new Map<string, number>();
    while (i < f.length && f[i] !== ')') {
      if (f[i] === '(') {
        i++;
        const inner = parseGroup();
        if (!inner || f[i] !== ')') return null;
        i++;
        let k = '';
        while (i < f.length && /\d/.test(f[i])) k += f[i++];
        const mult = k ? Number(k) : 1;
        for (const [e, n] of inner) out.set(e, (out.get(e) ?? 0) + n * mult);
      } else if (/[A-Z]/.test(f[i])) {
        let e = f[i++];
        if (i < f.length && /[a-z]/.test(f[i])) e += f[i++];
        if (!ELEMENTS.has(e)) return null;
        let k = '';
        while (i < f.length && /\d/.test(f[i])) k += f[i++];
        out.set(e, (out.get(e) ?? 0) + (k ? Number(k) : 1));
      } else return null;
    }
    return out;
  };
  const r = parseGroup();
  return r && i === f.length && r.size ? r : null;
}

/**
 * V51.9.147: the smallest whole-number coefficients that balance, found EXACTLY (the null space of the atom
 * matrix, in fractions), so equations such as 2KMnO4 + 16HCl → 2KCl + 2MnCl2 + 8H2O + 5Cl2 balance too.
 * Null when there is no balance, or more than one independent way to balance (two reactions written as one).
 * Checked against the test equations of kongnet/chem (MIT).
 */
export function solveCoefficients(left: Array<Map<string, number>>, right: Array<Map<string, number>>, maxCoef = 999): number[] | null {
  const all = [...left, ...right];
  const n = all.length;
  if (n < 2 || n > 12) return null;
  const els = [...new Set(all.flatMap((m) => [...m.keys()]))];
  const Z0 = BigInt(0), Z1 = BigInt(1);
  type Q = [bigint, bigint]; // numerator, denominator (> 0)
  const gcd = (a: bigint, b: bigint): bigint => { a = a < Z0 ? -a : a; b = b < Z0 ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
  const q = (a: bigint, b: bigint = Z1): Q => { if (b < Z0) { a = -a; b = -b; } const g = gcd(a, b) || Z1; return [a / g, b / g]; };
  const sub = (x: Q, y: Q): Q => q(x[0] * y[1] - y[0] * x[1], x[1] * y[1]);
  const mul = (x: Q, y: Q): Q => q(x[0] * y[0], x[1] * y[1]);
  const div = (x: Q, y: Q): Q => q(x[0] * y[1], x[1] * y[0]);
  const M: Q[][] = els.map((e) => all.map((m, j) => q(BigInt((m.get(e) ?? 0) * (j < left.length ? 1 : -1)))));
  // reduced row echelon form
  const pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < n && r < M.length; c++) {
    const p = M.findIndex((row, i) => i >= r && row[c][0] !== Z0);
    if (p < 0) continue;
    [M[r], M[p]] = [M[p], M[r]];
    const pv = M[r][c];
    M[r] = M[r].map((x) => div(x, pv));
    for (let i = 0; i < M.length; i++) {
      if (i === r || M[i][c][0] === Z0) continue;
      const f = M[i][c];
      M[i] = M[i].map((x, j) => sub(x, mul(f, M[r][j])));
    }
    pivots.push(c);
    r++;
  }
  const free = Array.from({ length: n }, (_, j) => j).filter((j) => !pivots.includes(j));
  if (free.length !== 1) return null; // no balance, or more than one independent way
  const v: Q[] = new Array(n).fill(q(Z0));
  v[free[0]] = q(Z1);
  pivots.forEach((c, i) => { v[c] = q(-M[i][free[0]][0], M[i][free[0]][1]); });
  const lcm = v.reduce((l, x) => (l * x[1]) / gcd(l, x[1]), Z1);
  let ints = v.map((x) => (x[0] * lcm) / x[1]);
  if (ints.every((x) => x < Z0)) ints = ints.map((x) => -x);
  if (!ints.every((x) => x > Z0)) return null;
  const g = ints.reduce((a, x) => gcd(a, x), Z0);
  const out = ints.map((x) => Number(x / g));
  return out.every((x) => x <= maxCoef) ? out : null;
}

export function balanceFacts(p: BalancePlan) {
  const L = p.reactants.map((f) => parseFormula(f)!);
  const R = p.products.map((f) => parseFormula(f)!);
  const coef = solveCoefficients(L, R)!;
  const els = [...new Set([...L, ...R].flatMap((m) => [...m.keys()]))];
  const count = (side: Array<Map<string, number>>, cs: number[], e: string) => side.reduce((a, m, i) => a + (m.get(e) ?? 0) * cs[i], 0);
  const ones = new Array(L.length + R.length).fill(1);
  const rows = els.map((e) => ({
    el: e,
    before: [count(L, ones.slice(0, L.length), e), count(R, ones.slice(L.length), e)] as [number, number],
    after: [count(L, coef.slice(0, L.length), e), count(R, coef.slice(L.length), e)] as [number, number],
  }));
  return { L, R, coef, els, rows };
}

export function validateBalance(x: unknown): string[] {
  const p = x as BalancePlan;
  const e: string[] = [];
  if (!p || typeof p !== 'object') return ['plan is not an object'];
  const okList = (a: unknown, name: string) => {
    if (!Array.isArray(a) || a.length < 1 || a.length > 4) return void e.push(`${name}: 1 to 4 formulas`);
    a.forEach((f, i) => {
      if (typeof f !== 'string' || !parseFormula(f)) e.push(`${name}[${i}] "${String(f)}" is not a chemical formula (write CH4, H2O, Ca(OH)2 …, no coefficients)`);
    });
  };
  okList(p.reactants, 'reactants');
  okList(p.products, 'products');
  if (e.length) return e;
  const L = p.reactants.map((f) => parseFormula(f)!);
  const R = p.products.map((f) => parseFormula(f)!);
  const a = new Set(L.flatMap((m) => [...m.keys()]));
  const b = new Set(R.flatMap((m) => [...m.keys()]));
  if ([...a].some((x2) => !b.has(x2)) || [...b].some((x2) => !a.has(x2))) e.push('the same elements must appear on both sides');
  else if (!solveCoefficients(L, R, 40)) e.push('no single whole-number balance (coefficients up to 40) exists for this equation');
  if (!Array.isArray(p.steps) || !p.steps.length) return [...e, 'steps needed'];
  const order = ['show', 'count', 'balance', 'check'];
  let last = -1;
  p.steps.forEach((s, i) => {
    const k = order.indexOf(s.op);
    if (k <= last) e.push(`steps[${i}]: order is ${order.join(', ')}, each once`);
    last = Math.max(last, k);
    if (!isBi(s.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  if (p.steps[0]?.op !== 'show') e.push('the first step is "show"');
  return e;
}

export function buildBalance(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as BalancePlan;
  const f = balanceFacts(p);
  const H = 700;
  const m = newScene(title, H);
  // V51.9.147: a long equation (5–8 formulas) is written smaller so it fits the board
  const species0 = [...p.reactants, ...p.products];
  const width46 = species0.reduce((a, sp, i) => a + tokenWidth(toSub(sp), 46) + (f.coef[i] > 1 ? tokenWidth(String(f.coef[i]), 46) + 6 : 0) + 18, 0) + (species0.length - 1) * (tokenWidth('+', 46) + 18);
  const SZ = Math.max(26, Math.min(46, Math.floor((46 * 900) / width46)));
  const arrowW = tokenWidth('→', SZ);
  const plusW = tokenWidth('+', SZ);
  const gap = 18;
  // final layout of the equation: [coef][formula] + ... → ...
  type Slot = { kind: 'sp'; i: number; cx: number; coefX: number; fw: number; cw: number } | { kind: 'op'; text: string; cx: number };
  const slots: Slot[] = [];
  const species = [...p.reactants, ...p.products];
  let total = 0;
  const widths = species.map((s, i) => ({ fw: tokenWidth(toSub(s), SZ), cw: f.coef[i] > 1 ? tokenWidth(String(f.coef[i]), SZ) + 6 : 0 }));
  const seq: Array<{ t: 'sp'; i: number } | { t: 'op'; text: string; w: number }> = [];
  species.forEach((_, i) => {
    if (i > 0 && i !== p.reactants.length) seq.push({ t: 'op', text: '+', w: plusW });
    if (i === p.reactants.length) seq.push({ t: 'op', text: '→', w: arrowW });
    seq.push({ t: 'sp', i });
  });
  for (const s of seq) total += (s.t === 'sp' ? widths[s.i].fw + widths[s.i].cw : s.w) + gap;
  total -= gap;
  let x = 360 - total / 2;
  for (const s of seq) {
    if (s.t === 'op') {
      slots.push({ kind: 'op', text: s.text, cx: x + s.w / 2 });
      x += s.w + gap;
    } else {
      const w = widths[s.i];
      slots.push({ kind: 'sp', i: s.i, coefX: x + w.cw / 2 - 3, cx: x + w.cw + w.fw / 2, fw: w.fw, cw: w.cw });
      x += w.fw + w.cw + gap;
    }
  }
  const EQY = 120;
  const colors = ['a', 'b', 'c', 'carry', 'accent', 'result'] as const;
  let t = 300;
  const coefIds: string[] = [];
  let unbal = '';
  const rings: string[] = [];
  const cells: Array<{ before: string[]; marks: string[] }> = [];
  const mark = (id: string) => id;
  void mark;

  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      for (const s of slots) {
        if (s.kind === 'op') label(m, s.text, s.cx, EQY, t, { size: SZ, color: 'ink' });
        else label(m, toSub(species[s.i]), s.cx, EQY, t + 150 * s.i, { size: SZ, color: colors[s.i % colors.length], weight: '700' });
      }
      unbal = label(m, lang === 'ml' ? 'സന്തുലിതമല്ലാത്ത സമവാക്യം' : 'Unbalanced equation', 360, 50, t + 400, { size: 24, color: 'carry' });
      t += 1600;
    } else if (st.op === 'count') {
      const y0 = 250;
      label(m, lang === 'ml' ? 'ആറ്റങ്ങൾ' : 'Atoms', 250, y0 - 52, t, { size: 24, color: 'ink' });
      label(m, lang === 'ml' ? 'ഇടത്' : 'Left', 380, y0 - 52, t, { size: 24, color: 'ink' });
      label(m, lang === 'ml' ? 'വലത്' : 'Right', 500, y0 - 52, t, { size: 24, color: 'ink' });
      f.rows.forEach((r, k) => {
        const y = y0 + k * 62;
        label(m, r.el, 250, y, t + 300 * k, { size: 38, color: 'ink', weight: '700' });
        const l = uid('cl');
        const rr = uid('cr');
        const mk = uid('mk');
        m.text(l, String(r.before[0]), 380, y, { size: 38, color: 'a', z: 5 });
        m.text(rr, String(r.before[1]), 500, y, { size: 38, color: 'c', z: 5 });
        const bad = r.before[0] !== r.before[1];
        m.text(mk, bad ? '≠' : '=', 590, y, { size: 36, color: bad ? 'accent' : 'tick', z: 5 });
        m.appear([l, rr, mk], t + 300 * k + 150, 120, false);
        cells.push({ before: [l, rr], marks: [mk] });
      });
      t += 300 * f.rows.length + 900;
      f.rows.forEach((r, k) => {
        if (r.before[0] !== r.before[1]) rings.push(ring(m, 445, 250 + k * 62, 120, 30, t, 'accent'));
      });
      t += 900;
    } else if (st.op === 'balance') {
      species.forEach((_, i) => {
        const c = f.coef[i];
        const s = slots.find((q) => q.kind === 'sp' && q.i === i) as Extract<Slot, { kind: 'sp' }>;
        if (c > 1) {
          const id = label(m, String(c), s.coefX, EQY, t, { size: SZ, color: 'accent', weight: '700' });
          coefIds.push(id);
          t += 500;
        }
      });
      if (unbal) m.fadeOut([unbal, ...rings], t, 300);
      f.rows.forEach((r, k) => {
        m.swap(cells[k].before[0], String(r.after[0]), t + 200 * k, 'a');
        m.swap(cells[k].before[1], String(r.after[1]), t + 200 * k, 'c');
        m.swap(cells[k].marks[0], '=', t + 200 * k + 150, 'tick');
      });
      t += 200 * f.rows.length + 1000;
      label(m, lang === 'ml' ? 'സന്തുലിതമായ സമവാക്യം' : 'Balanced equation', 360, 50, t - 600, { size: 24, color: 'tick' });
    } else if (st.op === 'check') {
      ring(m, 360, EQY, total / 2 + 24, 44, t, 'tick');
      sparkle(m, 360, EQY, t + 200);
      t += 1600;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

export const BALANCE_EXAMPLE: BalancePlan = {
  reactants: ['CH4', 'O2'],
  products: ['CO2', 'H2O'],
  steps: [
    { op: 'show', say: { en: 'Methane burns in oxygen to make carbon dioxide and water.', ml: 'മീഥേൻ ഓക്സിജനിൽ കത്തി കാർബൺ ഡയോക്സൈഡും ജലവും ഉണ്ടാകുന്നു.' } },
    { op: 'count', say: { en: 'Count the atoms of each element on both sides. The oxygen and hydrogen do not match.', ml: 'ഇരുവശത്തെയും ഓരോ മൂലകത്തിന്റെയും ആറ്റങ്ങൾ എണ്ണുക. ഓക്സിജനും ഹൈഡ്രജനും തുല്യമല്ല.' } },
    { op: 'balance', say: { en: 'Put numbers in front of the formulas until every count matches.', ml: 'എല്ലാ എണ്ണവും തുല്യമാകുന്നതുവരെ സൂത്രവാക്യങ്ങൾക്ക് മുന്നിൽ സംഖ്യകൾ ചേർക്കുക.' } },
    { op: 'check', say: { en: 'Both sides now have the same atoms. The equation is balanced.', ml: 'ഇപ്പോൾ ഇരുവശത്തും ഒരേ ആറ്റങ്ങൾ. സമവാക്യം സന്തുലിതം.' } },
  ],
};

export const balanceTemplate: AgentTemplate = {
  id: 'balance-equation',
  title: 'Balance a chemical equation',
  about: 'Atoms are counted on both sides and the app finds the coefficients that balance them.',
  example: BALANCE_EXAMPLE,
  validate: validateBalance,
  build: buildBalance,
};
