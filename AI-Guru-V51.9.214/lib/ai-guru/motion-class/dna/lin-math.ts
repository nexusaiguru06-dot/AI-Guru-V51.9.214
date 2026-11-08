/**
 * The algebra and geometry behind the linear-system DNA (V51.9.28): two equations
 * a₁x + b₁y = c₁ and a₂x + b₂y = c₂ with whole-number coefficients, solved by elimination or
 * substitution and drawn as two lines that meet at the solution.
 *
 * The planner gives the six numbers and chooses the order of the steps. Every line written on the
 * board (the multiplied equations, the sum or difference, the substituted equation, the check) and
 * every point drawn is computed here, so the board is true whatever the plan says. A system is only
 * accepted when it has ONE solution and that solution is a whole number inside the graph window, so
 * every intermediate line stays a clean whole-number equation.
 */

export type Var = 'x' | 'y';
export interface Eq {
  a: number;
  b: number;
  c: number;
}
export interface LinPlanNumbers {
  e1: Eq;
  e2: Eq;
}

export const COEF_MAX = 9;
export const RHS_MAX = 60;
export const SOL_MAX = 6;
/** The graph shows x and y from −WIN to WIN. */
export const WIN = 8;

export const COLOR1 = 'a'; // first equation / line: red
export const COLOR2 = 'c'; // second equation / line: green

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
export const fmt = (n: number) => String(n).replace('-', '−');

/** Why an equation cannot be used, or null. */
export function eqProblem(e: Eq | undefined, name: string): string | null {
  if (!e || !isInt(e.a) || !isInt(e.b) || !isInt(e.c)) return `${name} needs whole numbers a, b, c.`;
  if (e.a === 0 || e.b === 0 || Math.abs(e.a) > COEF_MAX || Math.abs(e.b) > COEF_MAX) return `${name}: a and b must be non-zero whole numbers from −${COEF_MAX} to ${COEF_MAX}.`;
  if (Math.abs(e.c) > RHS_MAX) return `${name}: c must be between −${RHS_MAX} and ${RHS_MAX}.`;
  return null;
}

export const det = (s: LinPlanNumbers) => s.e1.a * s.e2.b - s.e2.a * s.e1.b;

/** The one solution when it is a whole number inside ±SOL_MAX; otherwise a reason. */
export function solve(s: LinPlanNumbers): { x: number; y: number } | { error: string } {
  const d = det(s);
  if (d === 0) {
    const same = s.e1.a * s.e2.c === s.e2.a * s.e1.c && s.e1.b * s.e2.c === s.e2.b * s.e1.c;
    return { error: same ? 'the two equations describe the same line (infinitely many solutions)' : 'the two lines are parallel (no solution)' };
  }
  const x = (s.e1.c * s.e2.b - s.e2.c * s.e1.b) / d;
  const y = (s.e1.a * s.e2.c - s.e2.a * s.e1.c) / d;
  if (!Number.isInteger(x) || !Number.isInteger(y)) return { error: 'the solution is not a pair of whole numbers; choose numbers whose solution is whole' };
  if (Math.abs(x) > SOL_MAX || Math.abs(y) > SOL_MAX) return { error: `the solution must have x and y between −${SOL_MAX} and ${SOL_MAX} so it fits the graph` };
  return { x: x + 0, y: y + 0 };
}

/* ---------------- board text ---------------- */

/** "3x", "−x", "x" – the coefficient with its variable (sign only when negative). */
const coefVar = (c: number, v: string) => `${c === 1 ? '' : c === -1 ? '−' : fmt(c)}${v}`;
const joinTerms = (first: string, c2: number, second: string) => `${first} ${c2 < 0 ? '−' : '+'} ${c2 === 1 || c2 === -1 ? '' : Math.abs(c2)}${second}`;

/** "3x + 2y = 12", "−x − 4y = −6". */
export function eqText(e: Eq): string {
  return `${joinTerms(coefVar(e.a, 'x'), e.b, 'y')} = ${fmt(e.c)}`;
}
export const scaleEq = (e: Eq, k: number): Eq => ({ a: e.a * k, b: e.b * k, c: e.c * k });

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a: number, b: number) => (Math.abs(a) * Math.abs(b)) / gcd(a, b);

/* ---------------- elimination ---------------- */

export interface Elimination {
  var: Var;
  /** Multipliers applied to equations 1 and 2 (1 = unchanged). */
  m1: number;
  m2: number;
  s1: Eq;
  s2: Eq;
  /** '−' = subtract (the eliminated coefficients have the same sign), '+' = add. */
  op: '+' | '−';
  /** The equation left with one unknown: r·w = d. */
  left: Var;
  r: number;
  d: number;
  /** Text of the equation with one unknown ("7y = 14"). */
  text: string;
  /** The value of the remaining unknown. */
  value: number;
}

/** Eliminates `v`: scale both equations to equal-size coefficients of v, then add or subtract. */
export function eliminate(s: LinPlanNumbers, v: Var): Elimination {
  const p1 = v === 'x' ? s.e1.a : s.e1.b;
  const p2 = v === 'x' ? s.e2.a : s.e2.b;
  const L = lcm(p1, p2);
  const m1 = L / Math.abs(p1);
  const m2 = L / Math.abs(p2);
  const s1 = scaleEq(s.e1, m1);
  const s2 = scaleEq(s.e2, m2);
  const q1 = v === 'x' ? s1.a : s1.b;
  const q2 = v === 'x' ? s2.a : s2.b;
  const op: '+' | '−' = Math.sign(q1) === Math.sign(q2) ? '−' : '+';
  const f = (u: number, w: number) => (op === '−' ? u - w : u + w);
  const left: Var = v === 'x' ? 'y' : 'x';
  const r = left === 'y' ? f(s1.b, s2.b) : f(s1.a, s2.a);
  const d = f(s1.c, s2.c);
  return { var: v, m1, m2, s1, s2, op, left, r, d, text: `${coefVar(r, left)} = ${fmt(d)}`, value: d / r + 0 };
}

/* ---------------- substitution ---------------- */

export interface Substitution {
  known: Var;
  knownValue: number;
  into: 1 | 2;
  /** The equation with the known value put in: "3x + 2(3) = 12". */
  line1: string;
  /** What is left: "3x = 6" (coefficient and right side). */
  line2: string;
  /** Coefficient of the unknown (line 2 has this form unless it is 1). */
  coef: number;
  rhs: number;
  left: Var;
  value: number;
}

const bracket = (v: number) => (v < 0 ? `(${fmt(v)})` : String(v));
/** "2(3)", "2(−3)", "3" for a coefficient ±1 – the coefficient times a known value. */
const timesValue = (c: number, val: number) => (Math.abs(c) === 1 ? bracket(val) : `${Math.abs(c)}(${fmt(val)})`);

export function substitute(s: LinPlanNumbers, known: Var, knownValue: number, into: 1 | 2): Substitution {
  const e = into === 1 ? s.e1 : s.e2;
  const left: Var = known === 'x' ? 'y' : 'x';
  const cl = known === 'x' ? e.b : e.a; // coefficient of the unknown
  const ck = known === 'x' ? e.a : e.b; // coefficient of the known
  const rhs = e.c - ck * knownValue;
  // Keep the order of the original equation: x term first, then y term.
  const sub = `${ck < 0 ? '−' : ''}${timesValue(ck, knownValue)}`;
  const line1 =
    known === 'y'
      ? `${coefVar(e.a, 'x')} ${ck < 0 ? '−' : '+'} ${timesValue(ck, knownValue)} = ${fmt(e.c)}`
      : `${sub} ${cl < 0 ? '−' : '+'} ${Math.abs(cl) === 1 ? '' : Math.abs(cl)}y = ${fmt(e.c)}`;
  return { known, knownValue, into, line1, line2: `${coefVar(cl, left)} = ${fmt(rhs)}`, coef: cl, rhs, left, value: rhs / cl + 0 };
}

/* ---------------- check ---------------- */

/** "3(2) + 2(3) = 12": the solution put into an equation (true by construction). */
export function checkText(e: Eq, x: number, y: number): string {
  const t1 = `${e.a < 0 ? '−' : ''}${timesValue(e.a, x)}`;
  const t2 = `${e.b < 0 ? '−' : '+'} ${timesValue(e.b, y)}`;
  return `${t1} ${t2} = ${fmt(e.c)}`;
}
export const checkHolds = (e: Eq, x: number, y: number) => e.a * x + e.b * y === e.c;

/* ---------------- the graph ---------------- */

export type Pt = [number, number];

/** The two ends of the line ax + by = c cut to the window [−WIN, WIN]². */
export function clipLine(e: Eq, w = WIN): [Pt, Pt] {
  const pts: Pt[] = [];
  const eps = 1e-9;
  for (const X of [-w, w]) {
    const y = (e.c - e.a * X) / e.b;
    if (y >= -w - eps && y <= w + eps) pts.push([X, y]);
  }
  for (const Y of [-w, w]) {
    const x = (e.c - e.b * Y) / e.a;
    if (x >= -w - eps && x <= w + eps) pts.push([x, Y]);
  }
  const uniq: Pt[] = [];
  for (const p of pts) if (!uniq.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6)) uniq.push(p);
  if (uniq.length < 2) {
    // the line only touches the window at a corner – cannot happen for |c| ≤ 60 with the solution inside, but stay safe
    const [p] = uniq.length ? uniq : [[0, 0] as Pt];
    return [p, p];
  }
  // order left → right
  uniq.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  return [uniq[0], uniq[uniq.length - 1]];
}

/** Does the line ax + by = c pass through every point it is drawn from, and is each end on the window? Used by tests. */
export const onLine = (e: Eq, p: Pt) => Math.abs(e.a * p[0] + e.b * p[1] - e.c) < 1e-9;
