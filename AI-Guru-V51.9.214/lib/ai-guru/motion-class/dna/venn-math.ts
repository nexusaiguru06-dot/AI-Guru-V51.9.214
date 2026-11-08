/**
 * Set algebra for the venn-sets DNA (V51.9.26). Pure functions shared by the builder (what is
 * shaded and written), the validator (what a plan may claim) and the tests.
 *
 * Every Venn diagram of n ≤ 3 sets has 2^n basic regions. A region is named by its membership
 * code (bit i set = inside set i; code 0 = outside every set but inside the universe). Any set
 * expression is therefore just the set of region codes where it is true, a small bitmask, so the
 * app can decide whether two expressions are the same set (De Morgan, distribution …) by comparing
 * masks, and can reject a false "identity" before it is ever drawn.
 */

export const SET_NAMES = ['A', 'B', 'C'] as const;

export type Expr =
  | { t: 'set'; i: number }
  | { t: 'not'; e: Expr }
  | { t: 'bin'; op: '∪' | '∩' | '−'; a: Expr; b: Expr };

/** Normalises ASCII spellings the planner might use: U, u, ^, - , \, ', ^c, ᶜ, ′. */
function tokenise(src: string): string[] {
  const s = src
    .replace(/\s+/g, '')
    .replace(/U/g, '∪')
    .replace(/[−\-\\]/g, '−')
    .replace(/\^c|ᶜ|′|’/g, "'");
  const out: string[] = [];
  for (const ch of s) out.push(ch);
  return out;
}

/**
 * Parses "A∩B", "A'∪B'", "(A∩B)'", "A−B", "A∩B∩C". Mixing two different binary operators without
 * brackets is an error (people read "A ∪ B ∩ C" differently); the same operator may be chained.
 */
export function parseSetExpr(src: string, nSets: number): { expr?: Expr; error?: string } {
  const toks = tokenise(src);
  let k = 0;
  const err: (m: string) => never = (m) => {
    throw new Error(m);
  };
  const atom = (): Expr => {
    let e: Expr;
    const c = toks[k];
    if (c === '(') {
      k++;
      e = chain();
      if (toks[k] !== ')') err('missing ")"');
      k++;
    } else if (c && SET_NAMES.includes(c as 'A')) {
      const i = SET_NAMES.indexOf(c as 'A');
      if (i >= nSets) err(`set ${c} does not exist (only ${SET_NAMES.slice(0, nSets).join(', ')})`);
      e = { t: 'set', i };
      k++;
    } else err(c ? `unexpected "${c}"` : 'expression ends too early');
    while (toks[k] === "'") {
      e = { t: 'not', e };
      k++;
    }
    return e;
  };
  const chain = (): Expr => {
    let e = atom();
    let op: '∪' | '∩' | '−' | null = null;
    while (toks[k] === '∪' || toks[k] === '∩' || toks[k] === '−') {
      const o = toks[k] as '∪' | '∩' | '−';
      if (op && op !== o) err('mixing ∪, ∩ and − needs brackets');
      if (o === '−' && op === '−') err('A − B − C is ambiguous; use brackets');
      op = o;
      k++;
      e = { t: 'bin', op: o, a: e, b: atom() };
    }
    return e;
  };
  try {
    if (!toks.length) err('empty expression');
    const expr = chain();
    if (k < toks.length) err(`unexpected "${toks[k]}"`);
    return { expr };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** All region codes of n sets as a bitmask over codes (bit c set = region c is included). */
export const universeMask = (n: number) => (1 << (1 << n)) - 1;
const setMask = (i: number, n: number) => {
  let m = 0;
  for (let c = 0; c < 1 << n; c++) if ((c >> i) & 1) m |= 1 << c;
  return m;
};

/** The regions (as a bitmask over region codes) where the expression is true. */
export function evalMask(e: Expr, n: number): number {
  switch (e.t) {
    case 'set':
      return setMask(e.i, n);
    case 'not':
      return universeMask(n) & ~evalMask(e.e, n);
    case 'bin': {
      const a = evalMask(e.a, n);
      const b = evalMask(e.b, n);
      return e.op === '∪' ? a | b : e.op === '∩' ? a & b : a & ~b;
    }
  }
}

export const maskCodes = (mask: number, n: number): number[] => {
  const out: number[] = [];
  for (let c = 0; c < 1 << n; c++) if ((mask >> c) & 1) out.push(c);
  return out;
};

/** Region of an expression string: codes, or an error. */
export function regionOf(src: string, n: number): { codes?: number[]; mask?: number; expr?: Expr; error?: string } {
  const p = parseSetExpr(src, n);
  if (!p.expr) return { error: p.error };
  const mask = evalMask(p.expr, n);
  return { codes: maskCodes(mask, n), mask, expr: p.expr };
}

/** Do two expressions describe the same set for every choice of sets? Returns the regions where they differ. */
export function sameSet(a: string, b: string, n: number): { same: boolean; differ?: number[]; error?: string } {
  const ra = regionOf(a, n);
  const rb = regionOf(b, n);
  if (ra.error) return { same: false, error: `"${a}": ${ra.error}` };
  if (rb.error) return { same: false, error: `"${b}": ${rb.error}` };
  const diff = ra.mask! ^ rb.mask!;
  return { same: diff === 0, differ: maskCodes(diff, n) };
}

/** Board text for an expression: "A^c ∪ B^c", "(A ∩ B)^c", "A − B". Letters, ∪ ∩ and − only. */
export function exprText(e: Expr, top = true): string {
  switch (e.t) {
    case 'set':
      return SET_NAMES[e.i];
    case 'not': {
      const inner = e.e.t === 'bin' ? `(${exprText(e.e, true)})` : exprText(e.e, false);
      return `${inner}^c`;
    }
    case 'bin': {
      const side = (x: Expr) => (x.t === 'bin' && x.op !== e.op ? `(${exprText(x, true)})` : exprText(x, false));
      void top;
      return `${side(e.a)} ${e.op} ${side(e.b)}`;
    }
  }
}

/** Name of a region code for words: "only A", "A and B", "outside". */
export function codeName(code: number, n: number): string {
  const ins = SET_NAMES.slice(0, n).filter((_, i) => (code >> i) & 1);
  if (!ins.length) return 'outside';
  if (ins.length === 1) return `only ${ins[0]}`;
  return ins.join(' and ');
}

/* ---------------- elements ---------------- */

export type Elem = string | number;

export interface ElementSets {
  /** Elements of each set (in the plan's order). */
  sets: Elem[][];
  /** Elements of the universe that belong to no set. */
  outside: Elem[];
}

/** Region code of every element; elements in no set are code 0. */
export function elementCodes(es: ElementSets): Map<string, number> {
  const m = new Map<string, number>();
  es.sets.forEach((list, i) => {
    for (const e of list) m.set(String(e), (m.get(String(e)) ?? 0) | (1 << i));
  });
  for (const e of es.outside) if (!m.has(String(e))) m.set(String(e), 0);
  return m;
}

/** Elements of the set an expression describes, in the order they were first listed. */
export function elementsOf(src: string, es: ElementSets): { items?: string[]; error?: string } {
  const n = es.sets.length;
  const r = regionOf(src, n);
  if (r.error) return { error: r.error };
  const codes = elementCodes(es);
  return { items: [...codes.entries()].filter(([, c]) => (r.mask! >> c) & 1).map(([e]) => e) };
}

/** Inclusion-exclusion for two sets, with the numbers: n(A ∪ B) = n(A) + n(B) − n(A ∩ B). */
export function inclusion(es: ElementSets): { a: number; b: number; both: number; union: number } {
  const [A, B] = es.sets;
  const sb = new Set(B.map(String));
  const both = A.filter((x) => sb.has(String(x))).length;
  return { a: A.length, b: B.length, both, union: A.length + B.length - both };
}

/* ---------------- layout ---------------- */

export interface VennGeometry {
  rect: [number, number, number, number];
  circles: Array<[number, number, number]>;
  /** Where each set's letter sits (clear of overlaps). */
  labels: Array<[number, number]>;
}

export function vennGeometry(n: number): VennGeometry {
  if (n === 3) {
    const r = 78;
    return {
      rect: [100, 38, 520, 292],
      circles: [[318, 148, r], [402, 148, r], [360, 222, r]],
      labels: [[262, 118], [458, 118], [360, 280]],
    };
  }
  const r = 92;
  return {
    rect: [90, 50, 540, 270],
    circles: [[308, 185, r], [412, 185, r]],
    labels: [[248, 185], [472, 185]],
  };
}

/** Region code of a point (inside the universe), by circle membership. */
export function codeAt(g: VennGeometry, x: number, y: number): number {
  let c = 0;
  g.circles.forEach(([cx, cy, r], i) => {
    if (Math.hypot(x - cx, y - cy) < r) c |= 1 << i;
  });
  return c;
}

/**
 * Spreads `count` element positions inside region `code`: grid candidates at least `margin` from
 * every circle edge, the universe border and the set letters, picked far apart from each other.
 * Returns null when the region is too small for that many.
 */
export function placeInRegion(g: VennGeometry, code: number, count: number, margin = 15): Array<[number, number]> | null {
  if (!count) return [];
  // Prefer positions well inside the region; fall back to tighter margins only when it is small.
  for (const mg of [Math.max(margin, 26), Math.max(margin, 20), margin]) {
    const r = placeWithMargin(g, code, count, mg);
    if (r) return r;
  }
  return null;
}

function placeWithMargin(g: VennGeometry, code: number, count: number, margin: number): Array<[number, number]> | null {
  const [rx, ry, rw, rh] = g.rect;
  const cand: Array<[number, number]> = [];
  for (let y = ry + 20; y <= ry + rh - 20; y += 6) {
    for (let x = rx + 20; x <= rx + rw - 20; x += 6) {
      if (codeAt(g, x, y) !== code) continue;
      if (g.circles.some(([cx, cy, r]) => Math.abs(Math.hypot(x - cx, y - cy) - r) < margin)) continue;
      if (g.labels.some(([lx, ly]) => Math.hypot(x - lx, y - ly) < 30)) continue;
      cand.push([x, y]);
    }
  }
  if (cand.length < count) return null;
  const mx = cand.reduce((s, p) => s + p[0], 0) / cand.length;
  const my = cand.reduce((s, p) => s + p[1], 0) / cand.length;
  const first = cand.reduce((b, p) => (Math.hypot(p[0] - mx, p[1] - my) < Math.hypot(b[0] - mx, b[1] - my) ? p : b));
  const chosen: Array<[number, number]> = [first];
  while (chosen.length < count) {
    let best = cand[0];
    let bd = -1;
    for (const p of cand) {
      const d = Math.min(...chosen.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])));
      if (d > bd) {
        bd = d;
        best = p;
      }
    }
    if (bd < 26) return null; // elements would touch
    chosen.push(best);
  }
  return chosen;
}
