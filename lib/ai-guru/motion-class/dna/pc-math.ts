/**
 * Maths and geometry for the pie chart DNA (V51.9.35): data → total → central angles → percentages.
 * Sectors run clockwise from the top. Every number written and every sector drawn comes from here.
 */

import type { PiePlan } from './types';

export type Pt = [number, number];
export const PIE_OPS = ['show', 'total', 'angle', 'percent', 'check'];
export const PIE_MIN = 2;
export const PIE_MAX = 6;
export const ANGLE_MIN = 15;
export const TOTAL_MAX = 1000;
export const PIE_COLORS = ['#d22d2d', '#9d3bc8', '#13a018', '#f08a00', '#1f6fd0', '#8a6a3b'];
export const PIE = { cx: 215, cy: 280, r: 95 };

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export function pieLabels(plan: PiePlan): string[] {
  return plan.values.map((_, i) => plan.labels?.[i] ?? String.fromCharCode(65 + i));
}

export function pieProblem(plan: PiePlan, path: string): string | null {
  const v = plan?.values;
  if (!Array.isArray(v) || v.length < PIE_MIN || v.length > PIE_MAX || !v.every((x) => isInt(x) && x >= 1)) return `${path}.values must be ${PIE_MIN} to ${PIE_MAX} whole numbers of at least 1 (got ${JSON.stringify(v)}).`;
  const total = v.reduce((a, b) => a + b, 0);
  if (total > TOTAL_MAX) return `${path}.values add up to ${total}; at most ${TOTAL_MAX}.`;
  const bad = v.findIndex((x) => (360 * x) % total !== 0);
  if (bad >= 0) return `${path}: the angle for ${v[bad]} out of ${total} is ${fmtNum((360 * v[bad]) / total)}°, not a whole number; choose values whose total divides 360 times every value (for example a total of 36, 40, 45, 60, 72, 90, 120, 180 or 360).`;
  const small = v.findIndex((x) => (360 * x) / total < ANGLE_MIN);
  if (small >= 0) return `${path}: the angle for ${v[small]} out of ${total} is ${(360 * v[small]) / total}°, below ${ANGLE_MIN}° (too thin to label).`;
  if (plan.labels !== undefined) {
    const L = plan.labels;
    if (!Array.isArray(L) || L.length !== v.length) return `${path}.labels must have one name for each value (${v.length}).`;
    if (!L.every((x) => typeof x === 'string' && x.trim().length >= 1 && x.length <= 10)) return `${path}.labels must be 1 to 10 characters each.`;
    if (new Set(L).size !== L.length) return `${path}.labels must all be different.`;
  }
  return null;
}

export function fmtNum(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

export interface PieFacts { total: number; angles: number[]; percents: number[] }
export function pieFacts(plan: PiePlan): PieFacts {
  const total = plan.values.reduce((a, b) => a + b, 0);
  return { total, angles: plan.values.map((x) => (360 * x) / total), percents: plan.values.map((x) => (100 * x) / total) };
}

export type Line = [string, string];

export function tableLines(plan: PiePlan): Line[] {
  const L = pieLabels(plan);
  return plan.values.map((v, i) => [`${L[i]} = ${v}`, PIE_COLORS[i]] as Line);
}
export function totalLines(plan: PiePlan): Line[] {
  const f = pieFacts(plan);
  return [...tableLines(plan), [`Total = ${plan.values.join(' + ')} = ${f.total}`, 'result']];
}
export function angleLines(plan: PiePlan): Line[] {
  const f = pieFacts(plan);
  const L = pieLabels(plan);
  return plan.values.map((v, i) => [`${L[i]}: {${v}/${f.total}} × 360° = ${f.angles[i]}°`, PIE_COLORS[i]] as Line);
}
export function percentLines(plan: PiePlan): Line[] {
  const f = pieFacts(plan);
  const L = pieLabels(plan);
  return plan.values.map((v, i) => [`${L[i]}: {${v}/${f.total}} × 100% ${(100 * v) % f.total === 0 ? '=' : '≈'} ${fmtNum(f.percents[i])}%`, PIE_COLORS[i]] as Line);
}
export function checkLines(plan: PiePlan): Line[] {
  const f = pieFacts(plan);
  return [[`${f.angles.map((a) => `${a}°`).join(' + ')} = 360°`, 'result']];
}

/* ---------------- geometry ---------------- */

/** Screen point at `deg` degrees clockwise from the top, distance r from the centre. */
export const onPie = (r: number, deg: number): Pt => [PIE.cx + r * Math.sin((deg * Math.PI) / 180), PIE.cy - r * Math.cos((deg * Math.PI) / 180)];

export interface Sector {
  start: number;
  end: number;
  mid: number;
  /** Closed outline: the centre, then the arc. */
  pts: Pt[];
  color: string;
  /** Where the degree / percent label goes (outside, staggered for thin sectors). */
  label: Pt;
  /** Where the name goes (inside), or null when the sector is too thin. */
  inside: Pt | null;
}
export function pieGeometry(plan: PiePlan): Sector[] {
  const f = pieFacts(plan);
  let a = 0;
  return f.angles.map((ang, i) => {
    const start = a;
    const end = a + ang;
    a = end;
    const mid = (start + end) / 2;
    const n = Math.max(2, Math.ceil(ang / 4));
    const pts: Pt[] = [[PIE.cx, PIE.cy]];
    for (let k = 0; k <= n; k++) pts.push(onPie(PIE.r, start + ((end - start) * k) / n));
    const out = PIE.r + 24 + (ang < 30 ? (i % 3) * 30 : 0);
    return { start, end, mid, pts, color: PIE_COLORS[i], label: onPie(out, mid), inside: ang >= 40 ? onPie(PIE.r * 0.6, mid) : null };
  });
}
