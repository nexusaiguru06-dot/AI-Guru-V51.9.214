/**
 * Maths and geometry for the solids DNA (V51.9.33): cuboid, right triangular prism, cylinder, cone and
 * sphere. Every number the board writes (base area, slant height, volume, surface area, each piece of
 * the net) and every point it draws (oblique 3-D projection with hidden edges, flat nets) comes from
 * here, so the picture and the working always agree whatever the plan says.
 *
 * Exact values: areas and volumes are whole numbers or a rational multiple of π; the decimal beside a
 * π value uses π ≈ 3.14 and is rounded to two places with integer arithmetic.
 */

import type { SolidKind, SolidPlan } from './types';

export type Pt = [number, number];
export type Role4 = 'a' | 'b' | 'c' | 'carry' | 'result' | 'ink';

export const SOLID_KINDS: SolidKind[] = ['cuboid', 'prism', 'cylinder', 'cone', 'sphere'];
export const SOLID_OPS: Record<SolidKind, string[]> = {
  cuboid: ['show', 'base', 'volume', 'net', 'surface'],
  prism: ['show', 'base', 'slant', 'volume', 'net', 'surface'],
  cylinder: ['show', 'base', 'volume', 'net', 'surface'],
  cone: ['show', 'base', 'slant', 'volume', 'net', 'surface'],
  sphere: ['show', 'volume', 'surface'],
};

const rad = (d: number) => (d * Math.PI) / 180;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

/** A whole number when the third side of the right triangle is whole, else 0. */
export function hypot(a: number, b: number): number {
  const c = Math.round(Math.sqrt(a * a + b * b));
  return c * c === a * a + b * b ? c : 0;
}
/** All (a, b) with a whole hypotenuse, both up to `max` (for the error message and the tests). */
export function triples(max: number): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (let a = 1; a <= max; a++) for (let b = a; b <= max; b++) { const c = hypot(a, b); if (c) out.push([a, b, c]); }
  return out;
}

/* ---------------- ranges and validation ---------------- */

export const BOX_MIN = 2;
export const BOX_MAX = 20;
export const LEG_MAX = 24;
export const CYL_R_MAX = 14;
export const CYL_H_MAX = 30;
export const CONE_MAX = 24;
export const SPH_R_MAX = 15;

export function solidProblem(plan: SolidPlan, path: string): string | null {
  const k = plan?.solid;
  if (!SOLID_KINDS.includes(k)) return `${path}.solid must be one of ${SOLID_KINDS.join(', ')}.`;
  if (plan.unit !== undefined && !['cm', 'm', 'mm'].includes(plan.unit)) return `${path}.unit must be "cm", "m" or "mm".`;
  const need = (key: 'a' | 'b' | 'h' | 'r', lo: number, hi: number): string | null => {
    const v = plan[key];
    return isInt(v) && v >= lo && v <= hi ? null : `${path}.${key} must be a whole number from ${lo} to ${hi} (got ${JSON.stringify(v)}).`;
  };
  const ratio = (vals: number[], max: number, what: string): string | null => (Math.max(...vals) / Math.min(...vals) > max ? `${path}: ${what} differ too much to draw (the biggest may be at most ${max} times the smallest).` : null);
  switch (k) {
    case 'cuboid':
      return need('a', BOX_MIN, BOX_MAX) || need('b', BOX_MIN, BOX_MAX) || need('h', BOX_MIN, BOX_MAX) || ratio([plan.a!, plan.b!, plan.h!], 4, 'length, width and height');
    case 'prism': {
      const e = need('a', 3, LEG_MAX) || need('b', 3, LEG_MAX) || need('h', BOX_MIN, BOX_MAX);
      if (e) return e;
      if (!hypot(plan.a!, plan.b!)) return `${path}: the triangle with legs ${plan.a} and ${plan.b} has no whole-number third side; use legs like 3 and 4, 5 and 12, 6 and 8, 8 and 15, 9 and 12, 7 and 24.`;
      return ratio([plan.a!, plan.b!, plan.h!], 5, 'the triangle legs and the length');
    }
    case 'cylinder': {
      const e = need('r', 1, CYL_R_MAX) || need('h', 2, CYL_H_MAX);
      if (e) return e;
      const q = (2 * plan.r!) / plan.h!;
      return q > 4 || q < 0.25 ? `${path}: the diameter and the height differ too much to draw (one may be at most 4 times the other).` : null;
    }
    case 'cone': {
      const e = need('r', 1, CONE_MAX) || need('h', 1, CONE_MAX);
      if (e) return e;
      if (!hypot(plan.r!, plan.h!)) return `${path}: the slant height for r = ${plan.r} and h = ${plan.h} is not a whole number; use r and h like 3 and 4, 6 and 8, 5 and 12, 8 and 15, 9 and 12, 12 and 5, 7 and 24.`;
      const q = (2 * plan.r!) / plan.h!;
      return q > 4 || q < 0.25 ? `${path}: the diameter and the height differ too much to draw.` : null;
    }
    case 'sphere':
      return need('r', 1, SPH_R_MAX);
  }
}

/* ---------------- exact values ---------------- */

export interface Q { n: number; d: number }
export const q = (n: number, d = 1): Q => { const g = gcd(n, d) || 1; return { n: n / g, d: d / g }; };
export interface Val { q: Q; pi: boolean }
export const num = (n: number): Val => ({ q: q(n), pi: false });
export const piVal = (n: number, d = 1): Val => ({ q: q(n, d), pi: true });

/** The text of a value, rich text: 63π, "{16/3} π" (the fraction is its own word), 40. */
export function valText(v: Val): string {
  const { n, d } = v.q;
  if (!v.pi) return d === 1 ? String(n) : `{${n}/${d}}`;
  if (d !== 1) return `{${n}/${d}} π`;
  return `${n === 1 ? '' : n}π`;
}
/** The decimal with π ≈ 3.14, two places, no trailing zeros (integer arithmetic, half up). */
export function approx(v: Val): string {
  const { n, d } = v.q;
  const hundredths = v.pi ? Math.floor((2 * n * 314 + d) / (2 * d)) : Math.round((n * 100) / d);
  const s = (hundredths / 100).toFixed(2);
  return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
export const valNumber = (v: Val): number => (v.q.n / v.q.d) * (v.pi ? Math.PI : 1);

export const sq = (u: string) => `${u}^2`;
export const cube = (u: string) => `${u}^3`;

export interface SolidFacts {
  kind: SolidKind;
  unit: string;
  /** Slant height (cone) or the hypotenuse of the triangle (prism); 0 otherwise. */
  slant: number;
  base: Val;
  volume: Val;
  surface: Val;
  /** The areas that make up the surface, for the net and the sum. */
  pieces: Array<{ name: string; count: number; area: Val; role: Role4 }>;
}

export function solidFacts(plan: SolidPlan): SolidFacts {
  const u = plan.unit ?? 'cm';
  const { a = 0, b = 0, h = 0, r = 0 } = plan;
  switch (plan.solid) {
    case 'cuboid':
      return {
        kind: 'cuboid', unit: u, slant: 0, base: num(a * b), volume: num(a * b * h), surface: num(2 * (a * b + b * h + a * h)),
        pieces: [
          { name: 'top and bottom', count: 2, area: num(a * b), role: 'a' },
          { name: 'two sides', count: 2, area: num(b * h), role: 'b' },
          { name: 'front and back', count: 2, area: num(a * h), role: 'c' },
        ],
      };
    case 'prism': {
      const c = hypot(a, b);
      const t = (a * b) / 2;
      return {
        kind: 'prism', unit: u, slant: c, base: num(t), volume: num(t * h), surface: num(2 * t + (a + b + c) * h),
        pieces: [
          { name: 'two triangles', count: 2, area: num(t), role: 'carry' },
          { name: 'rectangle a', count: 1, area: num(a * h), role: 'a' },
          { name: 'rectangle b', count: 1, area: num(b * h), role: 'b' },
          { name: 'rectangle c', count: 1, area: num(c * h), role: 'carry' },
        ],
      };
    }
    case 'cylinder':
      return {
        kind: 'cylinder', unit: u, slant: 0, base: piVal(r * r), volume: piVal(r * r * h), surface: piVal(2 * r * r + 2 * r * h),
        pieces: [
          { name: 'two circles', count: 2, area: piVal(r * r), role: 'a' },
          { name: 'curved part', count: 1, area: piVal(2 * r * h), role: 'c' },
        ],
      };
    case 'cone': {
      const l = hypot(r, h);
      return {
        kind: 'cone', unit: u, slant: l, base: piVal(r * r), volume: piVal(r * r * h, 3), surface: piVal(r * r + r * l),
        pieces: [
          { name: 'circle', count: 1, area: piVal(r * r), role: 'a' },
          { name: 'curved part', count: 1, area: piVal(r * l), role: 'carry' },
        ],
      };
    }
    case 'sphere':
      return {
        kind: 'sphere', unit: u, slant: 0, base: piVal(r * r), volume: piVal(4 * r * r * r, 3), surface: piVal(4 * r * r),
        pieces: [{ name: 'four great circles', count: 4, area: piVal(r * r), role: 'a' }],
      };
  }
}

/* ---------------- the lines written on the board ---------------- */

export type Line = [string, Role4];
const paren = (n: number) => `(${n})`;

export function legendLines(plan: SolidPlan): Line[] {
  const u = plan.unit ?? 'cm';
  const f = solidFacts(plan);
  const { a = 0, b = 0, h = 0, r = 0 } = plan;
  switch (plan.solid) {
    case 'cuboid': return [[`l = ${a} ${u}`, 'a'], [`w = ${b} ${u}`, 'b'], [`h = ${h} ${u}`, 'c']];
    case 'prism': return [[`a = ${a} ${u}`, 'a'], [`b = ${b} ${u}`, 'b'], [`h = ${h} ${u}`, 'c']];
    case 'cylinder': return [[`r = ${r} ${u}`, 'a'], [`h = ${h} ${u}`, 'c']];
    case 'cone': return [[`r = ${r} ${u}`, 'a'], [`h = ${h} ${u}`, 'c']];
    case 'sphere': void f; return [[`r = ${r} ${u}`, 'a']];
  }
}

export function baseLines(plan: SolidPlan): Line[] {
  const f = solidFacts(plan);
  const A = sq(f.unit);
  const { a = 0, b = 0, r = 0 } = plan;
  switch (plan.solid) {
    case 'cuboid': return [['Base = l × w', 'a'], [`= ${a} × ${b}`, 'a'], [`= ${valText(f.base)} ${A}`, 'result']];
    case 'prism': return [['Base = {1/2} × a × b', 'a'], [`= {1/2} × ${a} × ${b}`, 'a'], [`= ${valText(f.base)} ${A}`, 'result']];
    case 'cylinder':
    case 'cone': return [['Base = π r^2', 'a'], [`= π × ${paren(r)}^2`, 'a'], [`= ${valText(f.base)} ${A}`, 'result']];
    default: return [];
  }
}

export function slantLines(plan: SolidPlan): Line[] {
  const f = solidFacts(plan);
  const { a = 0, b = 0, r = 0, h = 0 } = plan;
  if (plan.solid === 'cone') return [['l^2 = r^2 + h^2', 'carry'], [`l^2 = ${r}^2 + ${h}^2 = ${r * r + h * h}`, 'carry'], [`l = ${f.slant} ${f.unit}`, 'result']];
  if (plan.solid === 'prism') return [['c^2 = a^2 + b^2', 'carry'], [`c^2 = ${a}^2 + ${b}^2 = ${a * a + b * b}`, 'carry'], [`c = ${f.slant} ${f.unit}`, 'result']];
  return [];
}

export function volumeLines(plan: SolidPlan, withBase: boolean): Line[] {
  const f = solidFacts(plan);
  const V = cube(f.unit);
  const { a = 0, b = 0, h = 0, r = 0 } = plan;
  const done = (): Line[] => (f.volume.pi ? [[`= ${valText(f.volume)} ${V}`, 'result'], [`≈ ${approx(f.volume)} ${V}`, 'ink']] : [[`= ${valText(f.volume)} ${V}`, 'result']]);
  switch (plan.solid) {
    case 'cuboid':
    case 'prism':
      if (withBase) return [['V = base × height', 'c'], [`= ${valText(f.base)} × ${h}`, 'c'], ...done()];
      return plan.solid === 'cuboid'
        ? [['V = l × w × h', 'c'], [`= ${a} × ${b} × ${h}`, 'c'], ...done()]
        : [['V = {1/2} a b × h', 'c'], [`= {1/2} × ${a} × ${b} × ${h}`, 'c'], ...done()];
    case 'cylinder': return [['V = π r^2 h', 'c'], [`= π × ${paren(r)}^2 × ${h}`, 'c'], ...done()];
    case 'cone': return [['V = {1/3} π r^2 h', 'c'], [`= {1/3} × π × ${paren(r)}^2 × ${h}`, 'c'], ...done()];
    case 'sphere': return [['V = {4/3} π r^3', 'c'], [`= {4/3} × π × ${paren(r)}^3`, 'c'], ...done()];
  }
}

export function netLines(plan: SolidPlan): Line[] {
  const f = solidFacts(plan);
  const { r = 0, h = 0 } = plan;
  const A = sq(f.unit);
  switch (plan.solid) {
    case 'cuboid': return f.pieces.map((p) => [`${p.name}: ${p.count} × ${valText(p.area)}`, p.role] as Line);
    case 'prism': return [[`Two triangles: 2 × ${valText(f.pieces[0].area)}`, 'carry'], ['Three rectangles, each × h:', 'ink'], [`${plan.a} × ${h}, ${plan.b} × ${h}, ${f.slant} × ${h}`, 'b']];
    case 'cylinder': return [[`Two circles: 2 × ${valText(f.pieces[0].area)}`, 'a'], ['The curved part is a rectangle:', 'ink'], [`2π r × h = 2π × ${paren(r)} × ${h}`, 'c'], [`= ${valText(f.pieces[1].area)} ${A}`, 'result']];
    case 'cone': return [[`Circle: π r^2 = ${valText(f.pieces[0].area)}`, 'a'], ['The curved part is a sector:', 'ink'], [`π r l = π × ${r} × ${f.slant}`, 'carry'], [`= ${valText(f.pieces[1].area)} ${A}`, 'result']];
    default: return [];
  }
}

export function surfaceLines(plan: SolidPlan): Line[] {
  const f = solidFacts(plan);
  const A = sq(f.unit);
  const S = f.surface;
  const { a = 0, b = 0, h = 0, r = 0 } = plan;
  const tail = (): Line[] => (S.pi ? [[`= ${valText(S)} ${A}`, 'result'], [`≈ ${approx(S)} ${A}`, 'ink']] : [[`= ${valText(S)} ${A}`, 'result']]);
  switch (plan.solid) {
    case 'cuboid': {
      const [p1, p2, p3] = f.pieces.map((p) => valText(p.area));
      return [['S = 2(l w + w h + l h)', 'ink'], [`= 2(${p1} + ${p2} + ${p3})`, 'ink'], ...tail()];
    }
    case 'prism': {
      const t = valText(f.base);
      return [['S = 2 × base + (a + b + c) × h', 'ink'], [`= 2 × ${t} + (${a} + ${b} + ${f.slant}) × ${h}`, 'ink'], [`= ${2 * (a * b / 2)} + ${(a + b + f.slant) * h}`, 'ink'], ...tail()];
    }
    case 'cylinder': return [['S = 2π r^2 + 2π r h', 'ink'], [`= 2π × ${paren(r)}^2 + 2π × ${paren(r)} × ${h}`, 'ink'], [`= ${valText(piVal(2 * r * r))} + ${valText(piVal(2 * r * h))}`, 'ink'], ...tail()];
    case 'cone': return [['S = π r^2 + π r l', 'ink'], [`= π × ${paren(r)}^2 + π × ${r} × ${f.slant}`, 'ink'], [`= ${valText(piVal(r * r))} + ${valText(piVal(r * f.slant))}`, 'ink'], ...tail()];
    case 'sphere': return [['S = 4π r^2', 'ink'], [`= 4 × π × ${paren(r)}^2`, 'ink'], ...tail()];
  }
}

/* ---------------- 3-D pictures: oblique projection ---------------- */

/** Depth direction on screen per unit of depth: right and up. */
export const DEPTH = { x: 0.42, y: 0.35 };
/** The area on the left of the board where the solid or its net is drawn (the text panel starts at x = 440). */
export const FIGURE = { cx: 220, cy: 268, w: 300, h: 240 };
export const NET_BOX = { x0: 30, x1: 410, y0: 130, y1: 405 };
/** Flattening of a circle seen from above. */
export const FLAT = 0.3;

export interface Label { text: string; at: Pt; role: Role4; size?: number }
export interface Edge { pts: Pt[]; dashed?: boolean; role?: Role4; width?: number }
export interface SolidGeom {
  scale: number;
  /** Visible outline, hidden (dashed) edges, the dimension lines drawn in colour. */
  edges: Edge[];
  labels: Label[];
  /** The base, as a polygon to shade. */
  base: Pt[];
  /** cone / prism: the slant side, drawn in the "carry" colour at the slant step, and where its label goes. */
  slantEdge?: Pt[];
  slantLabel?: Label;
  /** sphere: the four circles of the surface step. */
  circles?: Array<{ c: Pt; r: number }>;
  /** The points of the main shape the tests rely on. */
  key: Record<string, Pt>;
}

/** Points of an ellipse from screen angle t0 to t1 (radians, 0 = right, π/2 = bottom). */
export function ellipsePts(cx: number, cy: number, rx: number, ry: number, t0: number, t1: number, n = 40): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    out.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  return out;
}

const sizeText = (n: number, u: string) => `${n} ${u}`;

export function solidGeometry(plan: SolidPlan): SolidGeom {
  const u = plan.unit ?? 'cm';
  const { a = 0, b = 0, h = 0, r = 0 } = plan;
  const f = solidFacts(plan);
  switch (plan.solid) {
    case 'cuboid':
    case 'prism': {
      const isBox = plan.solid === 'cuboid';
      const wd = a; // along x
      const dp = isBox ? b : h; // depth (y)
      const ht = isBox ? h : b; // up (z)
      const bw = wd + DEPTH.x * dp;
      const bh = ht + DEPTH.y * dp;
      const s = Math.min(FIGURE.w / bw, FIGURE.h / bh, 38);
      const x0 = FIGURE.cx - (bw * s) / 2;
      const yBase = FIGURE.cy + (bh * s) / 2;
      const P = (x: number, y: number, z: number): Pt => [x0 + s * (x + DEPTH.x * y), yBase - s * (z + DEPTH.y * y)];
      const key: Record<string, Pt> = {};
      const edges: Edge[] = [];
      const labels: Label[] = [];
      let base: Pt[];
      let slantEdge: Pt[] | undefined;
      let slantLabel: Label | undefined;
      if (isBox) {
        const f00 = P(0, 0, 0), f10 = P(a, 0, 0), f11 = P(a, 0, h), f01 = P(0, 0, h);
        const b00 = P(0, b, 0), b10 = P(a, b, 0), b11 = P(a, b, h), b01 = P(0, b, h);
        Object.assign(key, { f00, f10, f11, f01, b00, b10, b11, b01 });
        edges.push({ pts: [f00, f10, f11, f01, f00] }, { pts: [f01, b01, b11, b10, f10] }, { pts: [f11, b11] });
        edges.push({ pts: [f00, b00], dashed: true }, { pts: [b00, b10], dashed: true }, { pts: [b00, b01], dashed: true });
        labels.push(
          { text: sizeText(a, u), at: [(f00[0] + f10[0]) / 2, f00[1] + 20], role: 'a' },
          { text: sizeText(h, u), at: [f00[0] - 26, (f00[1] + f01[1]) / 2], role: 'c' },
          { text: sizeText(b, u), at: [(f10[0] + b10[0]) / 2 + 28, (f10[1] + b10[1]) / 2 + 6], role: 'b' },
        );
        base = [f00, f10, b10, b00];
      } else {
        const f0 = P(0, 0, 0), f1 = P(a, 0, 0), f2 = P(0, 0, b);
        const b0 = P(0, h, 0), b1 = P(a, h, 0), b2 = P(0, h, b);
        Object.assign(key, { f0, f1, f2, b0, b1, b2 });
        edges.push({ pts: [f0, f1, f2, f0] }, { pts: [f2, b2, b1, f1] });
        edges.push({ pts: [f0, b0], dashed: true }, { pts: [b0, b1], dashed: true }, { pts: [b0, b2], dashed: true });
        labels.push(
          { text: sizeText(a, u), at: [(f0[0] + f1[0]) / 2, f0[1] + 20], role: 'a' },
          { text: sizeText(b, u), at: [f0[0] - 26, (f0[1] + f2[1]) / 2], role: 'b' },
          { text: sizeText(h, u), at: [(f1[0] + b1[0]) / 2 + 28, (f1[1] + b1[1]) / 2 + 6], role: 'c' },
        );
        base = [f0, f1, f2];
        slantEdge = [f1, f2];
        slantLabel = { text: sizeText(f.slant, u), at: [(f1[0] + f2[0]) / 2 + 24, (f1[1] + f2[1]) / 2 - 14], role: 'carry' };
      }
      return { scale: s, edges, labels, base, slantEdge, slantLabel, key };
    }
    case 'cylinder':
    case 'cone': {
      const cyl = plan.solid === 'cylinder';
      const s = Math.min(FIGURE.w / (2 * r), FIGURE.h / (h + (cyl ? 2 : 1) * FLAT * r), 30);
      const R = s * r;
      const ry = FLAT * R;
      const H = s * h;
      const total = H + (cyl ? 2 : 1) * ry;
      const top = FIGURE.cy - total / 2 + (cyl ? ry : 0);
      const bottom = top + H;
      const cx = FIGURE.cx - 10;
      const key: Record<string, Pt> = {};
      const edges: Edge[] = [];
      const labels: Label[] = [];
      let slantEdge: Pt[] | undefined;
      let slantLabel: Label | undefined;
      Object.assign(key, { topC: [cx, top], botC: [cx, bottom], botR: [cx + R, bottom], botL: [cx - R, bottom] });
      if (cyl) {
        edges.push({ pts: ellipsePts(cx, top, R, ry, 0, Math.PI * 2, 64) });
        edges.push({ pts: [[cx - R, top], [cx - R, bottom]] }, { pts: [[cx + R, top], [cx + R, bottom]] });
        edges.push({ pts: ellipsePts(cx, bottom, R, ry, 0, Math.PI) });
        edges.push({ pts: ellipsePts(cx, bottom, R, ry, Math.PI, Math.PI * 2), dashed: true });
        edges.push({ pts: [[cx, top], [cx + R, top]], role: 'a', width: 3.5 });
        edges.push({ pts: [[cx, top], [cx, bottom]], dashed: true, role: 'c', width: 3.5 });
        labels.push({ text: sizeText(r, u), at: [cx + R / 2, top + 15], role: 'a' }, { text: sizeText(h, u), at: [cx + 40, (top + bottom) / 2], role: 'c' });
      } else {
        const apex: Pt = [cx, top];
        Object.assign(key, { apex });
        edges.push({ pts: [[cx - R, bottom], apex, [cx + R, bottom]] });
        edges.push({ pts: ellipsePts(cx, bottom, R, ry, 0, Math.PI) });
        edges.push({ pts: ellipsePts(cx, bottom, R, ry, Math.PI, Math.PI * 2), dashed: true });
        edges.push({ pts: [apex, [cx, bottom]], dashed: true, role: 'c', width: 3.5 });
        edges.push({ pts: [[cx, bottom], [cx + R, bottom]], dashed: true, role: 'a', width: 3.5 });
        labels.push({ text: sizeText(r, u), at: [cx + R / 2, bottom + ry + 16], role: 'a' }, { text: sizeText(h, u), at: [cx - 32, top + 0.72 * H], role: 'c' });
        slantEdge = [apex, [cx + R, bottom]];
        slantLabel = { text: sizeText(f.slant, u), at: [cx + R / 2 + 34, (top + bottom) / 2 - 6], role: 'carry' };
      }
      return { scale: s, edges, labels, base: ellipsePts(cx, bottom, R, ry, 0, Math.PI * 2, 64), slantEdge, slantLabel, key };
    }
    case 'sphere': {
      const R = 95;
      const c: Pt = [170, FIGURE.cy];
      const ry = FLAT * R;
      const edges: Edge[] = [
        { pts: ellipsePts(c[0], c[1], R, R, 0, Math.PI * 2, 96) },
        { pts: ellipsePts(c[0], c[1], R, ry, 0, Math.PI) },
        { pts: ellipsePts(c[0], c[1], R, ry, Math.PI, Math.PI * 2), dashed: true },
        { pts: [c, [c[0] + R, c[1]]], role: 'a', width: 3.5 },
      ];
      const labels: Label[] = [{ text: sizeText(r, u), at: [c[0] + R + 34, c[1]], role: 'a' }];
      const circles = [[330, 225], [392, 225], [330, 295], [392, 295]].map(([x, y]) => ({ c: [x, y] as Pt, r: 30 }));
      return { scale: 1, edges, labels, base: [], circles, key: { c, right: [c[0] + R, c[1]] } };
    }
  }
}

/* ---------------- nets ---------------- */

export interface NetPiece {
  id: string;
  /** Closed outline. */
  pts: Pt[];
  role: Role4;
  /** Text written inside: the area. */
  text: string;
  at: Pt;
  /** The area as a number, to check against the pictures (π = 3.14159…). */
  area: number;
}
export interface NetGeom {
  scale: number;
  pieces: NetPiece[];
  labels: Label[];
}

/** Fits points given in "net units" (x right, y down) into NET_BOX; returns the mapper and scale. */
function fitNet(all: Pt[]): { map: (p: Pt) => Pt; scale: number } {
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const w = NET_BOX.x1 - NET_BOX.x0;
  const hgt = NET_BOX.y1 - NET_BOX.y0;
  const scale = Math.min(w / (x1 - x0), hgt / (y1 - y0), 30);
  const ox = NET_BOX.x0 + w / 2 - ((x0 + x1) / 2) * scale;
  const oy = NET_BOX.y0 + hgt / 2 - ((y0 + y1) / 2) * scale;
  return { map: (p) => [ox + p[0] * scale, oy + p[1] * scale], scale };
}

export function netGeometry(plan: SolidPlan): NetGeom | null {
  const f = solidFacts(plan);
  const { a = 0, b = 0, h = 0, r = 0 } = plan;
  const rect = (x: number, y: number, w: number, hh: number): Pt[] => [[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]];
  type Raw = { id: string; pts: Pt[]; role: Role4; text: string; at: Pt; area: number };
  const raw: Raw[] = [];
  const labelsRaw: Array<{ text: string; at: Pt; role: Role4; dx?: number; dy?: number }> = [];
  switch (plan.solid) {
    case 'cuboid': {
      // a cross: a row of four side faces with the top above and the bottom below the first
      const T = valText(num(a * b)), S = valText(num(b * h)), F = valText(num(a * h));
      raw.push({ id: 'top', pts: rect(0, 0, a, b), role: 'a', text: T, at: [a / 2, b / 2], area: a * b });
      raw.push({ id: 'f1', pts: rect(0, b, a, h), role: 'c', text: F, at: [a / 2, b + h / 2], area: a * h });
      raw.push({ id: 's1', pts: rect(a, b, b, h), role: 'b', text: S, at: [a + b / 2, b + h / 2], area: b * h });
      raw.push({ id: 'f2', pts: rect(a + b, b, a, h), role: 'c', text: F, at: [a + b + a / 2, b + h / 2], area: a * h });
      raw.push({ id: 's2', pts: rect(2 * a + b, b, b, h), role: 'b', text: S, at: [2 * a + b + b / 2, b + h / 2], area: b * h });
      raw.push({ id: 'bot', pts: rect(0, b + h, a, b), role: 'a', text: T, at: [a / 2, b + h + b / 2], area: a * b });
      break;
    }
    case 'prism': {
      const c = f.slant;
      const tri = valText(f.base);
      raw.push({ id: 'tt', pts: [[0, 0], [a, 0], [0, -b]], role: 'carry', text: tri, at: [a / 3, -b / 3], area: (a * b) / 2 });
      raw.push({ id: 'ra', pts: rect(0, 0, a, h), role: 'a', text: valText(num(a * h)), at: [a / 2, h / 2], area: a * h });
      raw.push({ id: 'rb', pts: rect(a, 0, b, h), role: 'b', text: valText(num(b * h)), at: [a + b / 2, h / 2], area: b * h });
      raw.push({ id: 'rc', pts: rect(a + b, 0, c, h), role: 'carry', text: valText(num(c * h)), at: [a + b + c / 2, h / 2], area: c * h });
      raw.push({ id: 'bt', pts: [[0, h], [a, h], [0, h + b]], role: 'carry', text: tri, at: [a / 3, h + b / 3], area: (a * b) / 2 });
      break;
    }
    case 'cylinder': {
      const W = 2 * Math.PI * r;
      const ci = (cx: number, cy: number): Pt[] => ellipsePts(cx, cy, r, r, 0, Math.PI * 2, 72);
      raw.push({ id: 'c1', pts: ci(W / 2, r), role: 'a', text: valText(piVal(r * r)), at: [W / 2, r], area: Math.PI * r * r });
      raw.push({ id: 'rc', pts: rect(0, 2 * r, W, h), role: 'c', text: valText(piVal(2 * r * h)), at: [W / 2, 2 * r + h / 2], area: 2 * Math.PI * r * h });
      raw.push({ id: 'c2', pts: ci(W / 2, 3 * r + h), role: 'a', text: valText(piVal(r * r)), at: [W / 2, 3 * r + h], area: Math.PI * r * r });
      labelsRaw.push({ text: '2π r', at: [W * 0.17, 2 * r], role: 'c', dy: -14 }, { text: `${h} ${f.unit}`, at: [0, 2 * r + h / 2], role: 'c', dx: -34 });
      break;
    }
    case 'cone': {
      const l = f.slant;
      const phi = (2 * Math.PI * r) / l; // sector angle in radians
      const arc = ellipsePts(0, 0, l, l, Math.PI / 2 - phi / 2, Math.PI / 2 + phi / 2, 60);
      raw.push({ id: 'sec', pts: [[0, 0], ...arc], role: 'carry', text: valText(piVal(r * l)), at: [0, l * 0.6], area: 0.5 * l * l * phi });
      raw.push({ id: 'cir', pts: ellipsePts(0, l + r, r, r, 0, Math.PI * 2, 72), role: 'a', text: valText(piVal(r * r)), at: [0, l + r], area: Math.PI * r * r });
      labelsRaw.push({ text: `${l} ${f.unit}`, at: [-Math.sin(phi / 2) * l * 0.5, Math.cos(phi / 2) * l * 0.5], role: 'carry', dx: -8, dy: -18 });
      break;
    }
    default:
      return null;
  }
  const all = raw.flatMap((p) => p.pts);
  const { map, scale } = fitNet(all);
  const pieces: NetPiece[] = raw.map((p) => ({ id: p.id, pts: p.pts.map(map), role: p.role, text: p.text, at: map(p.at), area: p.area }));
  const labels: Label[] = labelsRaw.map((l) => { const m = map(l.at); return { text: l.text, at: [m[0] + (l.dx ?? 0), m[1] + (l.dy ?? 0)], role: l.role }; });
  return { scale, pieces, labels };
}

/** Polygon area (shoelace), for the tests. */
export function polyArea(pts: Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i]; const [x1, y1] = pts[(i + 1) % pts.length]; s += x0 * y1 - x1 * y0; }
  return Math.abs(s) / 2;
}
export { rad };
