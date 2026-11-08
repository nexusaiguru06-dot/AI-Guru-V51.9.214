/**
 * Numbers and geometry behind the unit-circle DNA (V51.9.27). Pure functions shared by the builder
 * (where every segment is drawn, what is written), the validator and the tests.
 *
 * On a circle of radius 1 with the point P at angle θ, the six trigonometric ratios are LENGTHS:
 *   cos θ = horizontal distance from the y-axis to P      sin θ = vertical distance from the x-axis to P
 *   the tangent to the circle at P meets the x-axis at X and the y-axis at Y:
 *   tan θ = |PX|   cot θ = |PY|   sec θ = |OX|   csc θ = |OY|
 * The app draws exactly these segments, so the picture can never disagree with the values.
 */

export type Pt = [number, number];
export type Ratio = 'cos' | 'sin' | 'tan' | 'cot' | 'sec' | 'csc';
export const RATIOS: Ratio[] = ['cos', 'sin', 'tan', 'cot', 'sec', 'csc'];
export const ANGLE_MIN = 20;
export const ANGLE_MAX = 70;
export const isAngle = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= ANGLE_MIN && v <= ANGLE_MAX;

export const rad = (deg: number) => (deg * Math.PI) / 180;

export function ratioValue(r: Ratio, deg: number): number {
  const a = rad(deg);
  switch (r) {
    case 'cos':
      return Math.cos(a);
    case 'sin':
      return Math.sin(a);
    case 'tan':
      return Math.tan(a);
    case 'cot':
      return 1 / Math.tan(a);
    case 'sec':
      return 1 / Math.cos(a);
    case 'csc':
      return 1 / Math.sin(a);
  }
}

/** Colours of the six ratios (the segment, its label and its formula share one colour). */
export const RATIO_COLOR: Record<Ratio, string> = {
  cos: '#3a9a3a',
  sin: '#d94a3d',
  tan: '#7a5fc4',
  cot: '#c99a00',
  sec: '#2f8fc8',
  csc: '#c24aa8',
};

/** Textbook exact values for 30°, 45°, 60° as board tokens ("{1/2}" is a stacked fraction, √ is drawn). */
export const EXACT: Record<30 | 45 | 60, Record<Ratio, string>> = {
  30: { sin: '{1/2}', cos: '{√3/2}', tan: '{1/√3}', cot: '√3', sec: '{2/√3}', csc: '2' },
  45: { sin: '{1/√2}', cos: '{1/√2}', tan: '1', cot: '1', sec: '√2', csc: '√2' },
  60: { sin: '{√3/2}', cos: '{1/2}', tan: '√3', cot: '{1/√3}', sec: '2', csc: '{2/√3}' },
};

export const isSpecial = (deg: number): deg is 30 | 45 | 60 => deg === 30 || deg === 45 || deg === 60;

/** The value written for a ratio at an angle: exact for special angles, else 2 decimals (trailing zeros dropped). */
export function valueToken(r: Ratio, deg: number): { text: string; exact: boolean } {
  if (isSpecial(deg)) return { text: EXACT[deg][r], exact: true };
  return { text: String(+ratioValue(r, deg).toFixed(2)), exact: false };
}

/** Numeric value of a board token like "{√3/2}", "√3", "{1/√3}", "2" (used by tests to prove the table). */
export function tokenNumber(tok: string): number {
  const one = (s: string) => (s.startsWith('√') ? Math.sqrt(Number(s.slice(1))) : Number(s));
  const m = /^\{(.+)\/(.+)\}$/.exec(tok);
  return m ? one(m[1]) / one(m[2]) : one(tok);
}

/** Left-hand side and right-hand side of each ratio's formula, as board tokens. */
export const FORMULA: Record<Ratio, { left: string; right: string }> = {
  cos: { left: 'cos(θ) =', right: 'x' },
  sin: { left: 'sin(θ) =', right: 'y' },
  tan: { left: 'tan(θ) =', right: '{sin(θ)/cos(θ)}' },
  cot: { left: 'cot(θ) =', right: '{cos(θ)/sin(θ)}' },
  sec: { left: 'sec(θ) =', right: '{1/cos(θ)}' },
  csc: { left: 'csc(θ) =', right: '{1/sin(θ)}' },
};

export const IDENTITY: Record<'pythagorean' | 'tan-sec' | 'cot-csc', string> = {
  pythagorean: 'sin^2(θ) + cos^2(θ) = 1',
  'tan-sec': '1 + tan^2(θ) = sec^2(θ)',
  'cot-csc': '1 + cot^2(θ) = csc^2(θ)',
};

/** Does the identity hold numerically at this angle? (It always should; the builder and tests rely on it.) */
export function identityHolds(which: keyof typeof IDENTITY, deg: number): boolean {
  const v = (r: Ratio) => ratioValue(r, deg);
  const [l, r] =
    which === 'pythagorean' ? [v('sin') ** 2 + v('cos') ** 2, 1] : which === 'tan-sec' ? [1 + v('tan') ** 2, v('sec') ** 2] : [1 + v('cot') ** 2, v('csc') ** 2];
  return Math.abs(l - r) < 1e-9 * Math.max(1, Math.abs(r));
}

/* ---------------- geometry ---------------- */

export const CENTER: Pt = [250, 232];
export const MAX_R = 105;
export const ROOM_UP = 175;
export const ROOM_RIGHT = 195;

/** Largest circle radius (px) so that every segment at every given angle stays on the board. */
export function fitRadius(angles: number[]): number {
  let r = MAX_R;
  for (const d of angles) {
    r = Math.min(r, ROOM_UP / Math.max(1, ratioValue('csc', d)), ROOM_RIGHT / Math.max(1, ratioValue('sec', d)));
  }
  return Math.floor(r);
}

export interface TrigGeometry {
  O: Pt;
  R: number;
  P: Pt;
  /** Foot of the vertical leg, on the x-axis. */
  foot: Pt;
  /** Where the tangent at P meets the x-axis and the y-axis. */
  X: Pt;
  Y: Pt;
  /** The segment of each ratio, [from, to]. */
  seg: Record<Ratio, [Pt, Pt]>;
  /** The angle arc at O (open polyline, 18 vertices) and where θ is written. */
  arc: Pt[];
  thetaAt: Pt;
}

export function geometry(deg: number, R: number, O: Pt = CENTER): TrigGeometry {
  const a = rad(deg);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const P: Pt = [O[0] + R * c, O[1] - R * s];
  const foot: Pt = [P[0], O[1]];
  const X: Pt = [O[0] + R / c, O[1]];
  const Y: Pt = [O[0], O[1] - R / s];
  const arcR = Math.max(22, R * 0.28);
  const arc: Pt[] = [];
  for (let i = 0; i <= 17; i++) {
    const t = (a * i) / 17;
    arc.push([O[0] + arcR * Math.cos(t), O[1] - arcR * Math.sin(t)]);
  }
  return {
    O,
    R,
    P,
    foot,
    X,
    Y,
    seg: {
      cos: [[O[0], P[1]], P],
      sin: [foot, P],
      tan: [P, X],
      cot: [P, Y],
      sec: [O, X],
      csc: [O, Y],
    },
    arc,
    thetaAt: [O[0] + (arcR + 16) * Math.cos(a / 2), O[1] - (arcR + 16) * Math.sin(a / 2)],
  };
}

export const segLength = (g: TrigGeometry, r: Ratio) => Math.hypot(g.seg[r][1][0] - g.seg[r][0][0], g.seg[r][1][1] - g.seg[r][0][1]);

/** Where a ratio's label goes and how it is rotated so it reads along its segment (never upside down). */
export function labelPlace(g: TrigGeometry, r: Ratio): { at: Pt; rot: number } {
  const [p, q] = g.seg[r];
  const mx = (p[0] + q[0]) / 2;
  const my = (p[1] + q[1]) / 2;
  let ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
  if (ang > Math.PI / 2) ang -= Math.PI;
  if (ang < -Math.PI / 2) ang += Math.PI;
  const gap = 15;
  switch (r) {
    case 'cos':
      return { at: [mx, my - gap], rot: 0 };
    case 'sin':
      // Inside the big triangle, left of the leg: the right side is where the tangent line runs.
      return { at: [mx - gap + 1, my], rot: -Math.PI / 2 };
    case 'sec':
      // Under the part of the axis beyond the foot of the leg (the leg's own label "x" sits under the rest).
      return { at: [Math.max((g.foot[0] + q[0]) / 2, g.foot[0] + 30), my + gap + 2], rot: 0 };
    case 'csc':
      return { at: [mx - gap, my], rot: -Math.PI / 2 };
    default: {
      // tan, cot: on the side of the tangent line away from the centre.
      let nx = -Math.sin(ang);
      let ny = Math.cos(ang);
      if ((mx - g.O[0]) * nx + (my - g.O[1]) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      return { at: [mx + nx * gap, my + ny * gap], rot: ang };
    }
  }
}
