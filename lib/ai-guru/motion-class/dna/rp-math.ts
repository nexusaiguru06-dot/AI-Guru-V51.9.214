/**
 * Maths and geometry for the ratio and percent DNA (V51.9.34): sharing a quantity in a ratio, a
 * percentage of a quantity, and a percentage increase or decrease, all as bar models. Every number
 * written and every block drawn comes from here, so the picture and the working always agree.
 */

import type { RatioKind, RatioPlan } from './types';

export type Pt = [number, number];
export type RoleR = 'a' | 'b' | 'c' | 'carry' | 'result' | 'ink';

export const RATIO_KINDS: RatioKind[] = ['share', 'percent', 'change'];
export const RATIO_OPS: Record<RatioKind, string[]> = {
  share: ['show', 'unit', 'parts', 'check'],
  percent: ['show', 'tenth', 'part', 'result'],
  change: ['show', 'change', 'result'],
};
export const PART_ROLES: RoleR[] = ['a', 'b', 'c'];
export const PART_LETTERS = ['A', 'B', 'C'];
export const UNITS = ['Rs', 'kg', 'm', 'cm', 'km', 'l'];

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export function ratioProblem(plan: RatioPlan, path: string): string | null {
  const k = plan?.kind;
  if (!RATIO_KINDS.includes(k)) return `${path}.kind must be one of ${RATIO_KINDS.join(', ')}.`;
  if (plan.unit !== undefined && !UNITS.includes(plan.unit)) return `${path}.unit must be one of ${UNITS.join(', ')}.`;
  if (k === 'share') {
    const p = plan.parts;
    if (!Array.isArray(p) || p.length < 2 || p.length > 3 || !p.every((x) => isInt(x) && x >= 1 && x <= 9)) return `${path}.parts must be 2 or 3 whole numbers from 1 to 9 (got ${JSON.stringify(p)}).`;
    const sum = p.reduce((a, b) => a + b, 0);
    if (sum > 20) return `${path}.parts add up to ${sum}; at most 20 blocks fit the bar.`;
    if (!isInt(plan.total) || plan.total < sum || plan.total > 5000) return `${path}.total must be a whole number from ${sum} to 5000.`;
    if (plan.total % sum !== 0) return `${path}: ${plan.total} cannot be shared in the ratio ${p.join(' : ')} in whole numbers (it must be a multiple of ${sum}).`;
    return null;
  }
  if (!isInt(plan.whole) || plan.whole < 10 || plan.whole > 5000) return `${path}.whole must be a whole number from 10 to 5000.`;
  const max = k === 'change' && plan.dir === 'down' ? 90 : 100;
  if (!isInt(plan.pct) || plan.pct < 1 || plan.pct > max) return `${path}.pct must be a whole number from 1 to ${max}.`;
  if ((plan.whole * plan.pct) % 100 !== 0) return `${path}: ${plan.pct}% of ${plan.whole} is not a whole number; choose numbers whose product is a multiple of 100.`;
  if (k === 'change' && plan.dir !== 'up' && plan.dir !== 'down') return `${path}.dir must be "up" or "down".`;
  return null;
}

/* ---------------- numbers ---------------- */

/** A number as written: whole, or up to two decimals without trailing zeros. */
export function fmtNum(n: number): string {
  const s = (Math.round(n * 100) / 100).toString();
  return s;
}
/** With its unit: "Rs 240", "30 kg", "90". */
export function withUnit(n: number | string, unit?: string): string {
  const v = typeof n === 'number' ? fmtNum(n) : n;
  if (!unit) return v;
  return unit === 'Rs' ? `Rs ${v}` : `${v} ${unit}`;
}

export interface RatioFacts {
  kind: RatioKind;
  /** share */
  sum: number;
  unitValue: number;
  partValues: number[];
  /** percent / change */
  tenth: number;
  amount: number;
  result: number;
}
export function ratioFacts(plan: RatioPlan): RatioFacts {
  if (plan.kind === 'share') {
    const parts = plan.parts ?? [];
    const sum = parts.reduce((a, b) => a + b, 0);
    const u = (plan.total ?? 0) / sum;
    return { kind: 'share', sum, unitValue: u, partValues: parts.map((p) => p * u), tenth: 0, amount: 0, result: 0 };
  }
  const W = plan.whole ?? 0;
  const c = (W * (plan.pct ?? 0)) / 100;
  return { kind: plan.kind, sum: 0, unitValue: 0, partValues: [], tenth: W / 10, amount: c, result: plan.kind === 'change' ? (plan.dir === 'down' ? W - c : W + c) : c };
}

/* ---------------- the lines written on the board ---------------- */

export type Line = [string, RoleR];

export function showLines(plan: RatioPlan): Line[] {
  const u = plan.unit;
  if (plan.kind === 'share') {
    const parts = plan.parts!;
    return [[`${parts.map((_, i) => PART_LETTERS[i]).join(' : ')} = ${parts.join(' : ')}`, 'ink'], [`Total = ${withUnit(plan.total!, u)}`, 'result']];
  }
  if (plan.kind === 'percent') return [[`100% = ${withUnit(plan.whole!, u)}`, 'ink'], [`Find ${plan.pct}%`, 'a']];
  return [[`100% = ${withUnit(plan.whole!, u)}`, 'ink'], [`${plan.dir === 'down' ? 'Decrease' : 'Increase'} by ${plan.pct}%`, plan.dir === 'down' ? 'b' : 'c']];
}

export function unitLines(plan: RatioPlan): Line[] {
  const f = ratioFacts(plan);
  const u = plan.unit;
  return [[`${plan.parts!.join(' + ')} = ${f.sum} parts`, 'ink'], [`1 part = ${withUnit(plan.total!, u)} ÷ ${f.sum}`, 'carry'], [`= ${withUnit(f.unitValue, u)}`, 'result']];
}
export function partsLines(plan: RatioPlan): Line[] {
  const f = ratioFacts(plan);
  const u = plan.unit;
  return plan.parts!.map((p, i) => [`${PART_LETTERS[i]} = ${p} × ${fmtNum(f.unitValue)} = ${withUnit(f.partValues[i], u)}`, PART_ROLES[i]] as Line);
}
export function checkLines(plan: RatioPlan): Line[] {
  const f = ratioFacts(plan);
  return [[`${f.partValues.map(fmtNum).join(' + ')} = ${withUnit(plan.total!, plan.unit)}`, 'result']];
}

export function tenthLines(plan: RatioPlan): Line[] {
  const f = ratioFacts(plan);
  return [['100% = 10 blocks', 'ink'], [`10% = ${withUnit(plan.whole!, plan.unit)} ÷ 10`, 'carry'], [`= ${withUnit(f.tenth, plan.unit)}`, 'result']];
}
export function partLines(plan: RatioPlan): Line[] {
  const f = ratioFacts(plan);
  return [[`${plan.pct}% of ${fmtNum(plan.whole!)}`, 'a'], [`= {${plan.pct}/100} × ${fmtNum(plan.whole!)}`, 'a'], [`= ${withUnit(f.amount, plan.unit)}`, 'result']];
}
export function resultLines(plan: RatioPlan): Line[] {
  const f = ratioFacts(plan);
  return [[`${plan.pct}% of ${fmtNum(plan.whole!)} = ${withUnit(f.amount, plan.unit)}`, 'result']];
}
export function changeLines(plan: RatioPlan): Line[] {
  const f = ratioFacts(plan);
  return [[`${plan.pct}% of ${fmtNum(plan.whole!)}`, plan.dir === 'down' ? 'b' : 'c'], [`= {${plan.pct}/100} × ${fmtNum(plan.whole!)}`, plan.dir === 'down' ? 'b' : 'c'], [`= ${withUnit(f.amount, plan.unit)}`, 'result']];
}
export function changeResultLines(plan: RatioPlan): Line[] {
  const f = ratioFacts(plan);
  const sign = plan.dir === 'down' ? '−' : '+';
  const pctNew = plan.dir === 'down' ? 100 - plan.pct! : 100 + plan.pct!;
  return [[`${fmtNum(plan.whole!)} ${sign} ${fmtNum(f.amount)} = ${withUnit(f.result, plan.unit)}`, 'result'], [`That is ${pctNew}% of ${fmtNum(plan.whole!)}`, 'ink']];
}

/* ---------------- geometry ---------------- */

export const BAR = { x0: 30, w: 380, y: 235, h: 56 };
export interface Block { x0: number; x1: number; part: number }
export interface RatioGeom {
  bar: { x0: number; y: number; w: number; h: number };
  /** share: one block per part of the ratio; percent: ten blocks. */
  blocks: Block[];
  /** share: one group per ratio part. */
  groups: Array<{ x0: number; x1: number; part: number }>;
  /** percent: the shaded part, from 0 to p%; change: the extra / removed piece. */
  fill?: { x0: number; x1: number };
  /** change: the original bar ends at x100; with "up" the extra piece follows it. */
  x100: number;
  /** The full width of what is drawn (change up: 100% + p%). */
  xEnd: number;
}

export function ratioGeometry(plan: RatioPlan): RatioGeom {
  const { x0, w, y, h } = BAR;
  const bar = { x0, y, w, h };
  if (plan.kind === 'share') {
    const parts = plan.parts!;
    const sum = parts.reduce((a, b) => a + b, 0);
    const bw = w / sum;
    const blocks: Block[] = [];
    const groups: RatioGeom['groups'] = [];
    let k = 0;
    parts.forEach((p, i) => {
      groups.push({ x0: x0 + k * bw, x1: x0 + (k + p) * bw, part: i });
      for (let j = 0; j < p; j++) { blocks.push({ x0: x0 + k * bw, x1: x0 + (k + 1) * bw, part: i }); k++; }
    });
    return { bar, blocks, groups, x100: x0 + w, xEnd: x0 + w };
  }
  const pct = plan.pct ?? 0;
  if (plan.kind === 'percent') {
    const blocks = Array.from({ length: 10 }, (_, i) => ({ x0: x0 + (w * i) / 10, x1: x0 + (w * (i + 1)) / 10, part: 0 }));
    return { bar, blocks, groups: [], fill: { x0, x1: x0 + (w * pct) / 100 }, x100: x0 + w, xEnd: x0 + w };
  }
  const up = plan.dir !== 'down';
  const unitW = up ? w / (1 + pct / 100) : w;
  const x100 = x0 + unitW;
  const blocks = Array.from({ length: 10 }, (_, i) => ({ x0: x0 + (unitW * i) / 10, x1: x0 + (unitW * (i + 1)) / 10, part: 0 }));
  const fill = up ? { x0: x100, x1: x100 + (unitW * pct) / 100 } : { x0: x100 - (unitW * pct) / 100, x1: x100 };
  return { bar: { x0, y, w: unitW, h }, blocks, groups: [], fill, x100, xEnd: up ? fill.x1 : x100 };
}
