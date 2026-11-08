/**
 * Motion-class DNA: the teaching templates a textbook block can be taught with.
 *
 * A DNA = a fixed visual + teaching grammar (what is drawn, in what order, how it
 * moves) with SLOTS that a planner fills for one concrete block. The same filled
 * plan builds the English and the Malayalam teaching, so both languages share
 * exactly the same board graphics; only captions/voice (and word labels) change.
 */

import type { Role } from '../../reels/motion/grammar';
import type { Link } from '../../reels/motion/recipes/derivation';
import type { Vars } from '../../reels/motion/verify';
import type { BlockKind } from '../segment';

/** Bilingual text. Malayalam may be missing in offline plans (that pass is then skipped). */
export interface Bi {
  en: string;
  ml?: string;
}

export type DnaId =
  | 'bridge'
  | 'section-intro'
  | 'concept-board'
  | 'mental-math'
  | 'word-problem'
  | 'equation-chain'
  | 'equation-pair'
  | 'translate-table'
  | 'number-table'
  | 'key-result'
  | 'identity-formula'
  | 'area-model'
  | 'column-arithmetic'
  | 'geometry-construction'
  | 'number-line'
  | 'plane-transform'
  | 'function-graph'
  | 'fraction-bars'
  | 'histogram'
  | 'probability-tree'
  | 'matrix-grid'
  | 'shape-formula'
  | 'venn-sets'
  | 'unit-circle'
  | 'linear-system'
  | 'arithmetic-sequence'
  | 'quadratic-equation'
  | 'polynomial'
  | 'angle-geometry'
  | 'solid-figure'
  | 'ratio-percent'
  | 'pie-chart'
  | 'matrix-ops'
  | 'area-figure'
  | 'coordinate-geometry'
  | 'square-identity'
  | 'balance-scale'
  | 'balance-pair'
  /** V51.9.58: the chapter introduction (title card, a tour of the chapter's topics with small worked examples, recap). */
  | 'chapter-intro'
  | 'typeset-chain'
  | 'quadratic-derivation'
  | 'hcf-lcm'
  | 'fraction-line'
  | 'ai-custom'
  /** V51.9.50: a validated free sketch for blocks no template fits (see dna/sketch-math.ts). */
  | 'ai-sketch'
  | `learned:${string}`;

/* ---------------- plan shapes (one per DNA family) ---------------- */

export interface ChainLine {
  tokens: string[];
  caption: Bi;
  links?: Link[];
  note?: Bi;
  fresh?: boolean;
  cancel?: [number, number][];
  check?: boolean;
}

export interface ChainPlan {
  title?: string;
  lines: ChainLine[];
  /** Variable values that make every line true (for the maths check). */
  solutions?: Vars[];
  /** Token indices of the last line that form the answer. */
  answer?: number[];
}

export interface BoardPoint {
  /** For the "columns" layout: which column (0 = left, 1 = right) the idea belongs to. */
  col?: 0 | 1;
  /** Board text with *key terms*. */
  board?: Bi;
  /** V51.9.52: a small picture beside the idea (sun, drop, cloud, leaf, coin, book, flag…); when omitted the app picks one from the words. */
  icon?: string;
  /** "scale" layout: how heavy this idea is (1–9); the beam tips toward the heavier pan. Default 1. */
  weight?: number;
  /** "bars" layout: the number this bar shows (0 or more). */
  value?: number;
  /** "tree" layout: index of the earlier point this one branches from (leave out for a first-level branch). */
  parent?: number;
  /** Or a maths line (tokens). */
  math?: string[];
  say: Bi;
}

export type BoardLayout = 'cards' | 'pyramid' | 'columns' | 'flow' | 'cycle' | 'timeline' | 'scale' | 'bars' | 'tree';

export interface BoardPlan {
  heading: Bi;
  /** How the ideas are drawn (V51.9.46); default "cards". "pyramid": first point is the base. "columns": needs `heads` and a `col` on each point. V51.9.51: "flow" (steps with arrows), "cycle" (3–5 nodes in a ring), "timeline" (key = the date/year). */
  layout?: BoardLayout;
  /** Titles of the two columns of the "columns" layout, or of the two pans of the "scale" layout. */
  heads?: [Bi, Bi];
  /** "bars" layout: the unit of the numbers ("crore", "km", "%"). */
  unit?: Bi;
  points: BoardPoint[];
}

export interface WordProblemPlan {
  statement: Bi;
  /** Phrases of the English statement to colour/focus (numbers, conditions). */
  highlights?: string[];
  highlightsMl?: string[];
  unknowns: Array<{ symbol: string; meaning: Bi }>;
  equations: Array<{ phrase: Bi; tokens: string[] }>;
  /** Either explicit solution lines or a solver input ("x + y = 11000 and 4x + y = 14000"). */
  solution: { lines?: ChainLine[]; solver?: string };
  /** Answer in words (omit when solvedLater). */
  answer?: Bi;
  /** The textbook solves this problem in the next blocks: model it here, solve it there. */
  solvedLater?: boolean;
  solutions?: Vars[];
}

export interface KeyResultPlan {
  statement: Bi;
  keyTerms?: { en: string[]; ml?: string[] };
  formula?: string[];
  say: Bi;
}

export interface AreaModelPlan {
  /** Parts of the width and of the height, e.g. [20, 6] and [10, 5], or letters ["x","y"]. */
  widthParts: Array<number | string>;
  heightParts: Array<number | string>;
  unit?: string;
  say: { setup: Bi; split: Bi; parts: Bi; total: Bi };
}

export interface TablePlan {
  headers: Bi[];
  rows: Array<Array<number | string>>;
  ops: Array<
    | { op: 'scale'; row: number; by: number; say: Bi }
    | { op: 'subtract'; from: number; minus: number; say: Bi }
    | { op: 'add'; a: number; b: number; say: Bi }
    | { op: 'focus'; row: number; col?: number; say: Bi }
  >;
}

export type FigureStep =
  | { op: 'segment'; from: string; to: string; color?: Role; width?: number; dashed?: boolean; say?: Bi }
  | { op: 'line'; through: [string, string]; color?: Role; say?: Bi }
  | { op: 'polygon'; points: string[]; color?: Role; fill?: Role; say?: Bi }
  | { op: 'right-angle'; at: string; arms: [string, string]; say?: Bi }
  | { op: 'equal-ticks'; segments: Array<[string, string]>; count?: number; color?: Role; say?: Bi }
  | { op: 'label'; at: string; text: string; dx?: number; dy?: number; say?: Bi }
  | { op: 'text'; at: [number, number]; text: Bi; color?: Role; say?: Bi }
  | { op: 'highlight'; targets: string[]; color?: Role; say?: Bi }
  | { op: 'arc'; center: string; radius: number; fromDeg: number; toDeg: number; color?: Role; say?: Bi }
  | { op: 'point'; at: string; color?: Role; say?: Bi };

export interface FigurePlan {
  title?: Bi;
  /** Named points in a 0..100 × 0..100 box (y down). */
  points: Record<string, [number, number]>;
  steps: FigureStep[];
}

export interface NumberLinePlan {
  min: number;
  max: number;
  steps: Array<
    | { op: 'point'; at: number; label?: string; color?: Role; say: Bi }
    | { op: 'jump'; from: number; by: number; color?: Role; say: Bi }
    | { op: 'text'; text: string; say: Bi }
  >;
}

/* ---- plane / graph (3Blue1Brown-style coordinate board) ---- */

/** [a, b, c, d] = the matrix [[a, b], [c, d]]: (x, y) ↦ (a·x + b·y, c·x + d·y). Column 1 is where î lands, column 2 where ĵ lands. */
export type Mat4 = [number, number, number, number];

export type PlaneStep =
  /** Axes, numbers and the blue grid appear. */
  | { op: 'grid'; say: Bi }
  /** î (green, along x) and ĵ (red, along y). */
  | { op: 'basis'; say: Bi }
  /** A vector from the origin. */
  | { op: 'vector'; v: [number, number]; label?: string; color?: Role; say: Bi }
  /** Builds v = x·î + y·ĵ: a green piece along x, then a red piece up. */
  | { op: 'combine'; v: [number, number]; say: Bi }
  /** A polygon (vertices in maths coordinates) that follows every transformation. */
  | { op: 'shape'; points: Array<[number, number]>; label?: string; color?: Role; say: Bi }
  /** The unit square on î and ĵ (its area shows the determinant). */
  | { op: 'square'; say: Bi }
  /** Shows the matrix (its columns coloured like î and ĵ). */
  | { op: 'matrix'; say: Bi }
  /** Applies a matrix after what is already applied. `name` (≤ 14 chars) is written above the matrix. */
  | { op: 'transform'; matrix: Mat4; name?: Bi; say: Bi }
  /** Writes det = … (computed by the app) and pulses the unit square. */
  | { op: 'det'; say: Bi }
  /** Back to the untransformed plane. */
  | { op: 'reset'; say: Bi };

export interface PlanePlan {
  title?: Bi;
  /** Half-width / half-height of the visible plane in units (default 5 and 4). */
  xMax?: number;
  yMax?: number;
  /** Write numbers on the axes (off by default, like the linear-algebra videos). */
  numbers?: boolean;
  steps: PlaneStep[];
}

export type GraphStep =
  /** Axes, numbers and grid appear. */
  | { op: 'axes'; say: Bi }
  /** Draws y = fn(x) (fn uses x, + - * / ^, sin cos tan sqrt abs ln exp, pi). Optional `label` is written beside the curve. */
  | { op: 'curve'; fn: string; from?: number; to?: number; color?: Role; label?: string; say: Bi }
  /** A plotted point; `drop` adds dashed lines to both axes. */
  | { op: 'point'; at: [number, number]; label?: string; color?: Role; drop?: boolean; say: Bi }
  /** A dot rides the latest curve to each x in `stops` and reads its coordinates. */
  | { op: 'tracker'; stops: number[]; say: Bi }
  /** Shades the area between the latest curve and the x-axis from `from` to `to`. */
  | { op: 'shade'; from: number; to: number; color?: Role; say: Bi }
  /** Bends the latest curve into another function (a parameter changing). `label` replaces the curve label. */
  | { op: 'morph'; fn: string; label?: string; say: Bi }
  /** A straight segment between two points (slope triangle sides, distances…). */
  | { op: 'segment'; from: [number, number]; to: [number, number]; color?: Role; dashed?: boolean; label?: string; say: Bi };

export interface GraphPlan {
  title?: Bi;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  steps: GraphStep[];
}

/* ---- fractions: bars and tiles ---- */

export type FractionStep =
  /** A bar cut into `n` equal parts with the first `shade` parts coloured; its fraction is written beside it. */
  | { op: 'bar'; n: number; shade: number; say: Bi }
  /** Cuts every part of bar `bar` (0 = first bar drawn) into `by` smaller equal parts: the fraction changes its numbers, not its size. */
  | { op: 'split'; bar: number; by: number; say: Bi }
  /** Colours more (or fewer) parts of bar `bar`. */
  | { op: 'shade'; bar: number; to: number; say: Bi }
  /** Puts the shaded parts of two bars with the same number of parts end to end on a new bar (addition). */
  | { op: 'join'; a: number; b: number; say: Bi }
  /** A grid of tiles (rows × cols) with `shade` tiles coloured; writes the fraction, and decimal and percent when they exist. */
  | { op: 'grid'; rows: number; cols: number; shade: number; say: Bi };

export interface FractionPlan {
  title?: Bi;
  steps: FractionStep[];
}

/* ---- statistics: bar chart / histogram ---- */

export type HistogramStep =
  | { op: 'axes'; say: Bi }
  /** All bars grow from zero (one value per category); values are written on top. */
  | { op: 'bars'; values: number[]; say: Bi }
  | { op: 'highlight'; index: number; say: Bi }
  /** Dashed line at the MEAN, computed by the app. */
  | { op: 'mean'; say: Bi }
  /** Dashed line at the MEDIAN, computed by the app. */
  | { op: 'median'; say: Bi }
  /** Dashed line at any height (a target, a limit). `label` ≤ 12 characters. */
  | { op: 'line'; y: number; label?: string; say: Bi }
  /** One bar grows or shrinks; mean / median lines already drawn move to their new value. */
  | { op: 'change'; index: number; to: number; say: Bi };

export interface HistogramPlan {
  title?: Bi;
  /** One label per bar (≤ 8 characters): "Mon", "0–10". */
  categories: string[];
  /** Top of the vertical axis. */
  yMax: number;
  /** Short unit written above the axis (≤ 10 characters), e.g. "marks". */
  yLabel?: string;
  steps: HistogramStep[];
}

/* ---- probability tree ---- */

export interface TreeNode {
  /** Outcome name on the board (≤ 6 characters): "H", "Red". */
  label: string;
  /** Probability of this branch given its parent, as a fraction: "1/2", "3/5". Siblings must add up to 1. */
  p: string;
  children?: TreeNode[];
}

export type TreeStep =
  /** Reveals the tree down to `levels` (1 = first branches). */
  | { op: 'grow'; levels: number; say: Bi }
  /** Highlights one root-to-end path (indices of the branch taken at each level) and multiplies its probabilities. */
  | { op: 'path'; path: number[]; say: Bi }
  /** Highlights several paths and ADDS their probabilities. */
  | { op: 'event'; paths: number[][]; say: Bi }
  /** Writes the probability of every end of the tree and shows that they add up to 1. */
  | { op: 'total'; say: Bi };

export interface TreePlan {
  title?: Bi;
  /** Name of the start node (≤ 6 characters), e.g. "Start". */
  start?: string;
  branches: TreeNode[];
  steps: TreeStep[];
}

/* ---- matrix as a grid of entries ---- */

export type MatrixStep =
  /** Brackets and entries appear (symbolic a_{ij}, or the numbers of the plan). */
  | { op: 'show'; say: Bi }
  /** Pen-drawn box round row `index` (0 = top), labelled. */
  | { op: 'row'; index: number; say: Bi }
  /** Pen-drawn box round column `index` (0 = left), labelled. */
  | { op: 'column'; index: number; say: Bi }
  /** Tilted box along the main diagonal, labelled. */
  | { op: 'diagonal'; say: Bi }
  /** The camera zooms into entry (row i, column j, both 0-based) and colours it. */
  | { op: 'entry'; i: number; j: number; say: Bi }
  /** After an `entry` zoom: arrows from "# of rows" / "# of columns" to the two subscript digits. */
  | { op: 'indices'; say: Bi }
  /** Camera back to the whole matrix. */
  | { op: 'zoomOut'; say: Bi }
  /** Writes A ∈ ℝ^{r×c} and "r × c matrix" above the matrix (numbers computed from the grid). */
  | { op: 'size'; say: Bi }
  /** Writes "Square Matrix" or "Rectangular Matrix", decided by the app from rows and columns. */
  | { op: 'kind'; say: Bi }
  /** Replaces the grid by the general one: a_{11} a_{12} … a_{1c} / ⋮ ⋱ ⋮ / a_{r1} a_{r2} … a_{rc} with letters r and c. */
  | { op: 'general'; rows: string; cols: string; say: Bi };

export interface MatrixPlan {
  title?: Bi;
  /** Name written before "=": "A". */
  name?: string;
  rows: number;
  cols: number;
  /** Optional numbers (rows × cols); symbolic a_{ij} when missing. */
  entries?: number[][];
  steps: MatrixStep[];
}

/* ---- a shape with its labels and formulas ---- */

export type ShapeKind = 'circle' | 'rectangle' | 'square' | 'triangle' | 'right-triangle' | 'special-30-60-90' | 'special-45-45-90';

export type ShapeStep =
  /** Starts a new figure (the previous one fades). a, b are optional whole-number sizes: circle r=a; rectangle l=a, w=b; square s=a; triangle base=a, height=b; right triangle legs a, b; special triangles short side a. Without them the labels are letters. */
  | { op: 'shape'; kind: ShapeKind; a?: number; b?: number; say: Bi }
  /** Side labels, computed by the app (r; l, w; a, b, c; a, a√3, 2a; …). */
  | { op: 'label'; say: Bi }
  /** Dotted height h with its right-angle mark (triangle only). */
  | { op: 'height'; say: Bi }
  /** Angle arcs with their degrees (special triangles only: 30°, 60°, 45°). */
  | { op: 'angles'; say: Bi }
  /** Writes a formula the app knows for this shape, with the numbers worked out when a (and b) are given. */
  | { op: 'formula'; what: 'area' | 'perimeter' | 'circumference' | 'pythagoras' | 'ratio'; say: Bi }
  /** Writes the shape's name under it (two-language dictionary). */
  | { op: 'name'; say: Bi };

export interface ShapePlan {
  title?: Bi;
  steps: ShapeStep[];
}

/* ---- sets and Venn diagrams ---- */

export type VennStep =
  /** The universe rectangle, the circles (A, B, optionally C) and, when given, the elements. Once, first. */
  | { op: 'show'; say: Bi }
  /** Shades the regions of a set expression ("A∩B", "A∪B", "A'", "A−B", "A'∪B'", "(A∩B)'") and writes it under the picture. */
  | { op: 'shade'; expr: string; say: Bi }
  /** Shades the left side, then writes left = right. The app checks both are the same set and rejects a false identity. */
  | { op: 'identity'; left: string; right: string; say: Bi }
  /** Needs elements: shades the expression and writes its elements, "A ∩ B = {3, 4}" (computed by the app). */
  | { op: 'list'; expr: string; say: Bi }
  /** Needs elements and 2 sets: n(A ∪ B) = n(A) + n(B) − n(A ∩ B) with the numbers counted by the app. */
  | { op: 'inclusion'; say: Bi }
  /** Removes the shading and any line written under the picture. */
  | { op: 'clear'; say: Bi };

export interface VennPlan {
  title?: Bi;
  sets: 2 | 3;
  /** Optional words beside the letters A, B, C (a two-language board word each, ≤ 12 characters). */
  labels?: Bi[];
  /** Optional elements of each set (numbers or short words, up to 6 per region); an element in two lists sits in the overlap. */
  elements?: Array<Array<string | number>>;
  /** Optional elements of the universe that belong to no set. */
  outside?: Array<string | number>;
  steps: VennStep[];
}

/* ---- trigonometric ratios on the unit circle ---- */

export type TrigRatio = 'cos' | 'sin' | 'tan' | 'cot' | 'sec' | 'csc';

export type TrigStep =
  /** Axes and the unit circle. Once, first. */
  | { op: 'show'; say: Bi }
  /** The point (x, y) at the plan's angle θ, the radius labelled 1 and the angle arc θ. */
  | { op: 'point'; say: Bi }
  /** The right triangle inside the circle: horizontal leg x and vertical leg y, with its right-angle mark. */
  | { op: 'legs'; say: Bi }
  /** Draws the segment whose LENGTH is this ratio (cos, sin, tan, cot, sec, csc), labelled along it, and writes its formula. Each once, after "legs". */
  | { op: 'ratio'; which: TrigRatio; say: Bi }
  /** The point slides to a new angle (integer degrees 20–70); every drawn segment follows and keeps its length. */
  | { op: 'sweep'; to: number; say: Bi }
  /** Replaces the formulas by the values of the drawn ratios at the current angle (exact for 30°, 45°, 60°, otherwise 2 decimals). */
  | { op: 'values'; say: Bi }
  /** Writes a Pythagorean identity under the picture; the app checks it holds at the current angle. */
  | { op: 'identity'; which: 'pythagorean' | 'tan-sec' | 'cot-csc'; say: Bi }
  /** A box round the formulas. */
  | { op: 'box'; say: Bi };

export interface TrigPlan {
  title?: Bi;
  /** Starting angle in whole degrees, 20–70. */
  angle: number;
  steps: TrigStep[];
}

/* ---- a pair of linear equations: lines, elimination, substitution ---- */

export type LinStep =
  /** Writes the two equations (1) and (2) on the right, in two colours. Once, first. */
  | { op: 'show'; say: Bi }
  /** Draws the plane and the two lines, each in its equation's colour. */
  | { op: 'graph'; say: Bi }
  /** Eliminates x or y: scales the equations to equal coefficients, adds or subtracts, writes the one-unknown equation and the value found. Each unknown at most once. */
  | { op: 'eliminate'; var: 'x' | 'y'; say: Bi }
  /** Puts the value found by `eliminate` into equation 1 or 2 and finds the other unknown. After exactly one `eliminate`. */
  | { op: 'substitute'; into: 1 | 2; say: Bi }
  /** Marks where the lines meet, labelled with the solution (x, y). Needs "graph". */
  | { op: 'meet'; say: Bi }
  /** Puts the solution into both equations and ticks them. Needs both unknowns found. */
  | { op: 'check'; say: Bi }
  /** Writes the system as A · x = b (matrix form) with the same numbers. Needs "show". */
  | { op: 'matrix'; say: Bi };

export interface LinPlan {
  title?: Bi;
  /** First equation a x + b y = c. */
  e1: { a: number; b: number; c: number };
  /** Second equation. */
  e2: { a: number; b: number; c: number };
  steps: LinStep[];
}

/* ---- arithmetic sequences: terms, common difference, n-th term, sum, graph ---- */

export type SeqStep =
  /** The first terms in boxes. Once, first. */
  | { op: 'show'; say: Bi }
  /** Arrows from each term to the next, each labelled with the common difference. */
  | { op: 'diff'; say: Bi }
  /** The n-th term formula: x_n = a + (n − 1)d, with the numbers, simplified. Once. */
  | { op: 'formula'; say: Bi }
  /** One far term worked out (n from terms+1 to 100). Needs "formula". */
  | { op: 'term'; n: number; say: Bi }
  /** Gauss pairing on the shown terms (an even number of them): every pair has the same sum. Before "formula" and "graph". */
  | { op: 'pairs'; say: Bi }
  /** The sum of the first n terms worked out (n from 2 to 100). */
  | { op: 'sum'; n: number; say: Bi }
  /** Is this whole number a term? Solves n − 1 = (v − a) ÷ d and ticks or crosses. Needs "formula". */
  | { op: 'test'; value: number; say: Bi }
  /** The points (n, x_n) on a plane: they lie on a straight line. */
  | { op: 'graph'; say: Bi };

export interface SeqPlan {
  title?: Bi;
  /** First term. */
  a: number;
  /** Common difference (not 0). */
  d: number;
  /** How many terms are shown in the row (4 to 7). */
  terms: number;
  steps: SeqStep[];
}

/* ---- quadratic equations: parabola, roots, discriminant, factorising, formula ---- */

export type QuadStep =
  /** Writes the equation a x² + b x + c = 0. Once, first. */
  | { op: 'show'; say: Bi }
  /** Draws the plane and the parabola y = a x² + b x + c. */
  | { op: 'graph'; say: Bi }
  /** D = b² − 4ac worked out, with D > 0, D = 0 or D < 0. */
  | { op: 'discriminant'; say: Bi }
  /** Splits the middle term, groups, writes the two factors and the roots. Needs a perfect-square D. */
  | { op: 'factorise'; say: Bi }
  /** The quadratic formula with the numbers; D < 0 stops at "D < 0" (no real roots). */
  | { op: 'formula'; say: Bi }
  /** Marks the roots on the x-axis where the curve meets it. Needs "graph" and a perfect-square D. */
  | { op: 'roots'; say: Bi }
  /** Puts each whole-number root into the equation and ticks it. Needs whole-number roots. */
  | { op: 'check'; say: Bi };

export interface QuadPlan {
  title?: Bi;
  a: number;
  b: number;
  c: number;
  steps: QuadStep[];
}

/* ---- polynomials: terms, add, multiply, divide, remainder and factor theorems, identities, graph ---- */

export type PolyStep =
  /** Writes P(x) with its degree and coefficients. Once, first. */
  | { op: 'show'; say: Bi }
  /** P + Q in aligned columns. Needs "q". */
  | { op: 'add'; say: Bi }
  /** P − Q (add the opposite) in aligned columns. Needs "q". */
  | { op: 'subtract'; say: Bi }
  /** P × Q in an area table, like terms in one colour, then collected. Needs "q". */
  | { op: 'multiply'; say: Bi }
  /** Long division of P by (x − r). Needs "r" and degree 2 or 3. */
  | { op: 'divide'; say: Bi }
  /** The remainder theorem: P(r) worked out. Needs "r". */
  | { op: 'remainder'; say: Bi }
  /** The factor theorem: P(at) = 0 so (x − at) is a factor; then every factor. P must be monic with whole-number roots. */
  | { op: 'factor'; at: number; say: Bi }
  /** P is x² − k², x² + 2kx + k² or x² − 2kx + k²: the identity, an area picture and the check. */
  | { op: 'identity'; say: Bi }
  /** The curve y = P(x). */
  | { op: 'graph'; say: Bi }
  /** Dots on the x-axis at the whole-number roots. Needs "graph". */
  | { op: 'roots'; say: Bi };

export interface PolyPlan {
  title?: Bi;
  /** Coefficients of P, highest power first: [3, −2, 0, 5, −7] is 3x⁴ − 2x³ + 5x − 7. Degree 2 to 4. */
  p: number[];
  /** Second polynomial for add / subtract / multiply: degree 1 to 3. */
  q?: number[];
  /** The divisor is x − r (r a non-zero whole number, −9..9) for divide and remainder. */
  r?: number;
  steps: PolyStep[];
}

/* ---- angles: parallel lines and a transversal, triangle angle sum, circle theorems ---- */

export type AngleStep =
  /** Draws the figure. Once, first. */
  | { op: 'show'; say: Bi }
  /** parallel: marks the given angle "a" at position "at" (default tr). */
  | { op: 'given'; say: Bi }
  /** parallel: the vertically opposite angle (equal). */
  | { op: 'vertical'; say: Bi }
  /** parallel: the angle next to it on a straight line (adds to 180°). */
  | { op: 'linear'; say: Bi }
  /** parallel: the corresponding angle at the other line (equal). */
  | { op: 'corresponding'; say: Bi }
  /** parallel: the alternate angle (equal). */
  | { op: 'alternate'; say: Bi }
  /** parallel: the co-interior angle (adds to 180°). */
  | { op: 'cointerior'; say: Bi }
  /** triangle: marks the angles at A and B (and C as "?" when "find" follows). */
  | { op: 'angles'; say: Bi }
  /** triangle: works out C = 180° − A − B. */
  | { op: 'find'; say: Bi }
  /** triangle: A + B + C = 180°. */
  | { op: 'sum'; say: Bi }
  /** triangle: the exterior angle at C equals A + B. */
  | { op: 'exterior'; say: Bi }
  /** circle: the angle at the centre on the arc AB. */
  | { op: 'centre'; say: Bi }
  /** circle: the angle at the circumference on the same arc. */
  | { op: 'circumference'; say: Bi }
  /** circle: the centre angle is twice the circumference angle. */
  | { op: 'double'; say: Bi }
  /** circle: a second point on the same arc sees AB at the same angle. */
  | { op: 'same-arc'; say: Bi }
  /** circle: a point on the other arc gives an angle that adds to 180° (cyclic quadrilateral). */
  | { op: 'cyclic'; say: Bi };

export interface AnglePlan {
  title?: Bi;
  figure: 'parallel' | 'triangle' | 'circle';
  /** parallel: the given angle in degrees (30–150, not 90). */
  a?: number;
  /** parallel: where the given angle is: tl tr bl br tl2 tr2 bl2 br2 (top / bottom line, left / right, above / below). Default tr. */
  at?: string;
  /** triangle: angles at A and B in degrees (20–120, together 60–160). */
  A?: number;
  B?: number;
  /** circle: the angle at the circumference in degrees (20–90); the centre angle is twice as big. */
  beta?: number;
  steps: AngleStep[];
}

/* ---- solids: cuboid, triangular prism, cylinder, cone, sphere (volume, surface area, nets) ---- */

export type SolidKind = 'cuboid' | 'prism' | 'cylinder' | 'cone' | 'sphere';
export type SolidStep =
  /** Draws the solid with its sizes (dashed hidden edges) and lists them on the side. Once, first. */
  | { op: 'show'; say: Bi }
  /** Shades the base (cuboid: floor l × w; prism: the triangle; cylinder and cone: the circle) and works out its area. */
  | { op: 'base'; say: Bi }
  /** cone: slant height l from r and h (Pythagoras); prism: the third side c of the triangle. */
  | { op: 'slant'; say: Bi }
  /** The volume, formula then numbers (base × height when "base" came before; cone ⅓; sphere 4/3 π r³). */
  | { op: 'volume'; say: Bi }
  /** The surface opens out into a flat net with the area of every piece (not for the sphere). */
  | { op: 'net'; say: Bi }
  /** The total surface area, piece by piece (the sphere: four great circles). */
  | { op: 'surface'; say: Bi };

export interface SolidPlan {
  title?: Bi;
  solid: SolidKind;
  /** cuboid: length l; prism: leg a of the triangle (2–24). */
  a?: number;
  /** cuboid: width w; prism: leg b of the triangle. */
  b?: number;
  /** cuboid, prism, cylinder, cone: height (cuboid, cylinder, cone) or length of the prism. */
  h?: number;
  /** cylinder, cone, sphere: radius. */
  r?: number;
  /** cm (default), m or mm. */
  unit?: 'cm' | 'm' | 'mm';
  steps: SolidStep[];
}

/* ---- balance scale: one- and two-step linear equations a x + b = c ---- */

export type BalStep =
  /** Draws the scale with the tiles and writes the equation. Once, first. */
  | { op: 'show'; say: Bi }
  /** V51.9.55: takes d tiles of x off BOTH pans (x on both sides), one pair at a time, and writes the shorter equation. Needs d. */
  | { op: 'cancel'; say: Bi }
  /** Moves the b tile to the other pan (its sign changes) and writes c − b (or c + b). Needs b ≠ 0. */
  | { op: 'move'; say: Bi }
  /** Merges the right pan into one tile and writes a x = number. After "move". */
  | { op: 'simplify'; say: Bi }
  /** Divides both pans by a: the right tile splits into a equal tiles, one for every x. Needs a ≥ 2. */
  | { op: 'divide'; say: Bi }
  /** One x on one side and its value on the other; writes x = value. */
  | { op: 'answer'; say: Bi }
  /** Puts the value back into the equation (tick). After "answer". */
  | { op: 'check'; say: Bi };

export interface BalPlan {
  title?: Bi;
  /** The number of x tiles on the left pan, 1–4. */
  a: number;
  /** The constant on the left, −12 to 12 (0 for a x = c). Written a x + b = c (a x − 5 when b is −5). */
  b: number;
  /** The right side. (c − b) must be divisible by (a − d) and the answer a whole number from 1 to 100. */
  c: number;
  /** V51.9.55: x tiles on the right pan as well (a x + b = d x + c), 1 to a − 1. Needs a "cancel" step. Default 0. */
  d?: number;
  /** The unknown's letter, one of x y z n m p t (default x). */
  letter?: string;
  /** Write every value × 1, 10, 100 or 1000 (default 1): 3x = 3 tiles with 3000 written, for prices. */
  scale?: number;
  /** V51.9.65: 'beam' (default) = flat beam with tiles, ring on the working digits; 'pans' = the tipping pan scale. */
  look?: 'beam' | 'pans';
  steps: BalStep[];
}

/* ---- balance pair: two equations a x + b y = c as two scales, added or subtracted so one unknown cancels ---- */

export type PairStep =
  /** Draws the two scales, one for each equation, and writes both equations. Once, first. */
  | { op: 'show'; say: Bi }
  /** Puts the scales together (adds or subtracts them): the tiles of one unknown cancel and one scale is left. */
  | { op: 'combine'; say: Bi }
  /** Solves the one scale that is left: the first unknown. */
  | { op: 'solve'; say: Bi }
  /** Puts the first value into an equation (the number tile comes off both pans) and finds the other unknown. */
  | { op: 'back'; say: Bi }
  /** Puts both values into both scales: both pans balance (ticks). */
  | { op: 'check'; say: Bi };

export interface PairPlan {
  title?: Bi;
  /** a x + b y = c. a 1–4 (x tiles), b −3…3 but not 0 (y tiles; negative when y is taken away), c a whole number. */
  e1: { a: number; b: number; c: number };
  e2: { a: number; b: number; c: number };
  /** The two unknowns' letters (default x and y). */
  letters?: [string, string];
  /** Exactly: show, combine, solve, back, check. */
  steps: PairStep[];
}

/* ---- ratio and percent: bar models for sharing, percent of a quantity, percent change ---- */

export type RatioKind = 'share' | 'percent' | 'change';
export type RatioStep =
  /** Draws the bar and what is known. Once, first. */
  | { op: 'show'; say: Bi }
  /** share: one part = total ÷ (sum of the ratio). */
  | { op: 'unit'; say: Bi }
  /** share: each person's part = number of parts × one part. */
  | { op: 'parts'; say: Bi }
  /** share: the parts add up to the total again (tick). */
  | { op: 'check'; say: Bi }
  /** percent: the bar in ten equal blocks, each 10% of the whole. */
  | { op: 'tenth'; say: Bi }
  /** percent: shades p% of the bar and works out p% of the whole. */
  | { op: 'part'; say: Bi }
  /** percent: the answer, written beside the shaded part. */
  | { op: 'result'; say: Bi }
  /** change: the extra (or removed) p% of the original, worked out. */
  | { op: 'change'; say: Bi };

export interface RatioPlan {
  title?: Bi;
  kind: RatioKind;
  /** share: the ratio, 2–3 parts of 1–9 (sum at most 20). */
  parts?: number[];
  /** share: the total to share (a multiple of the sum of the parts). */
  total?: number;
  /** percent, change: the whole / original amount. */
  whole?: number;
  /** percent, change: the percentage, a whole number; p × whole must be a multiple of 100. */
  pct?: number;
  /** change: increase or decrease. */
  dir?: 'up' | 'down';
  /** Rs (written before the number), kg, m, cm, km or l (after it). Default none. */
  unit?: 'Rs' | 'kg' | 'm' | 'cm' | 'km' | 'l';
  steps: RatioStep[];
}

/* ---- statistics: pie chart from data (total, central angles, percentages) ---- */

export type PieStep =
  /** The circle and the data listed on the side. Once, first. */
  | { op: 'show'; say: Bi }
  /** Adds the values: the total. */
  | { op: 'total'; say: Bi }
  /** Each angle = value / total × 360°, the sectors drawn one by one with their angles. */
  | { op: 'angle'; say: Bi }
  /** Each share as a percentage, written on its sector (after "angle"). */
  | { op: 'percent'; say: Bi }
  /** The angles add up to 360° (after "angle"), with a tick. */
  | { op: 'check'; say: Bi };

export interface PiePlan {
  title?: Bi;
  /** Category names, 1–10 characters each, the same in both languages (default A, B, C …). */
  labels?: string[];
  /** 2–6 whole numbers; every angle 360 × value ÷ total must be a whole number of at least 15°. */
  values: number[];
  steps: PieStep[];
}

/* ---- fractions on a number line: marking, equivalent fractions, comparing, adding and subtracting ---- */

export type FracLineKind = 'mark' | 'equivalent' | 'compare' | 'add';
export type FracLineStep =
  /** The number line with its whole numbers (and the first fraction, for equivalent and add). Once, first. */
  | { op: 'show'; say: Bi }
  /** mark: every whole is cut into D equal parts (D = the common denominator). */
  | { op: 'divide'; say: Bi }
  /** mark: a dot and label at each fraction. */
  | { op: 'mark'; say: Bi }
  /** mark: improper fractions written as mixed numbers (after "mark"). */
  | { op: 'mixed'; say: Bi }
  /** equivalent: the same point on a line cut k times finer. */
  | { op: 'scale'; say: Bi }
  /** compare, add: the fractions rewritten over the common denominator. */
  | { op: 'common'; say: Bi }
  /** add: the jump of the second fraction from the first. */
  | { op: 'jump'; say: Bi }
  /** equivalent, compare, add: the outcome. */
  | { op: 'result'; say: Bi };

export interface FracLinePlan {
  title?: Bi;
  kind: FracLineKind;
  /** mark: 1–4 fractions [numerator, denominator] in lowest terms; compare and add: exactly 2. */
  fracs?: Array<[number, number]>;
  /** equivalent: one proper fraction in lowest terms. */
  frac?: [number, number];
  /** equivalent: the multiplier, 2–6. */
  k?: number;
  /** add: "add" (default) or "sub" (the first minus the second). */
  op?: 'add' | 'sub';
  steps: FracLineStep[];
}

/* ---- matrices: multiplication and transpose ---- */

export type MatrixOpsKind = 'multiply' | 'transpose';
export type MatrixOpsStep =
  /** The matrices (A × B, or A and the empty A^T). Once, first. */
  | { op: 'show'; say: Bi }
  /** multiply: the orders m × n and n × p, the inner numbers equal, the order m × p of the product; the empty product brackets appear. */
  | { op: 'check'; say: Bi }
  /** multiply: one entry of the product, row i of A times column j of B (0-based). transpose: the entry (i, j) of A moves to (j, i). */
  | { op: 'entry'; i: number; j: number; say: Bi }
  /** multiply: every entry of the product not yet written. */
  | { op: 'all'; say: Bi }
  /** transpose: each row of A becomes a column of A^T, one row at a time. */
  | { op: 'rows'; say: Bi }
  /** transpose: the orders r × c and c × r. */
  | { op: 'size'; say: Bi };

export interface MatrixOpsPlan {
  title?: Bi;
  kind: MatrixOpsKind;
  /** The first matrix: whole numbers −9..9, rows of equal length. */
  a: number[][];
  /** multiply: the second matrix (its rows equal the columns of a). */
  b?: number[][];
  steps: MatrixOpsStep[];
}

/* ---- area of a parallelogram and of a trapezium ---- */

export type AreaFigKind = 'parallelogram' | 'trapezium';
export type AreaFigStep =
  /** The figure with its sizes written. Once, first. */
  | { op: 'show'; say: Bi }
  /** The perpendicular height, dashed, with its right-angle mark. */
  | { op: 'height'; say: Bi }
  /** parallelogram: a right triangle is cut off one end. */
  | { op: 'cut'; say: Bi }
  /** parallelogram: the triangle slides to the other end and the figure becomes a rectangle. */
  | { op: 'move'; say: Bi }
  /** trapezium: a second, turned copy completes a parallelogram of base a + b (area = half of it). */
  | { op: 'copy'; say: Bi }
  /** trapezium: a diagonal cuts it into two triangles on the two parallel sides (needs b × h and a × h even). */
  | { op: 'triangles'; say: Bi }
  /** The formula with the numbers worked out. */
  | { op: 'formula'; say: Bi };

export interface AreaFigPlan {
  title?: Bi;
  kind: AreaFigKind;
  /** parallelogram: the base; trapezium: the longer parallel side (bottom). 2–20. */
  b: number;
  /** trapezium: the shorter parallel side (top), 1 to b − 1. */
  a?: number;
  /** The perpendicular height, 2–20. */
  h: number;
  /** parallelogram: which way it leans (default right); trapezium: left (a right angle at the left), right or centre (default). */
  lean?: 'left' | 'right' | 'centre';
  unit?: 'cm' | 'm' | 'mm';
  steps: AreaFigStep[];
}

/* ---- coordinate geometry: points and quadrants, distance, midpoint ---- */

export type CoordKind = 'points' | 'distance' | 'midpoint';
export type CoordStep =
  /** The axes with their numbers and grid. Once, first. */
  | { op: 'axes'; say: Bi }
  /** points: plots point `i` (0-based) with dashed lines to both axes; distance, midpoint: plots both points (no `i`). */
  | { op: 'plot'; i?: number; say: Bi }
  /** points: the quadrant of every plotted point, with I, II, III, IV written on the plane. */
  | { op: 'quadrant'; say: Bi }
  /** distance, midpoint: the segment joining the two points. */
  | { op: 'segment'; say: Bi }
  /** distance: the horizontal and vertical legs of the right triangle on the grid with dx and dy worked out. */
  | { op: 'legs'; say: Bi }
  /** distance: d² = dx² + dy² and the distance. */
  | { op: 'formula'; say: Bi }
  /** midpoint: the middle point with each coordinate the average of the two. */
  | { op: 'midpoint'; say: Bi };

export interface CoordPlan {
  title?: Bi;
  kind: CoordKind;
  /** Whole-number points (x, y), each coordinate −6..6; points: 1–4; distance, midpoint: exactly 2. */
  points: Array<[number, number]>;
  /** Optional one-letter names (A–Z, distinct; "M" is kept for the midpoint). Default A, B, C, D. */
  names?: string[];
  steps: CoordStep[];
}

/* ---- visual proofs of (a + b)², (a − b)² and (a + b)(a − b) ---- */

export type SqKind = 'sum' | 'difference' | 'product';
export type SqStep =
  /** The big square (side a + b for sum, a otherwise) with its sides braced. Once, first. */
  | { op: 'square'; say: Bi }
  /** sum: the a × a tile in a corner. */
  | { op: 'tileA'; say: Bi }
  /** sum: the two a × b strips. difference: the two strips of width b along the right and the bottom. */
  | { op: 'strips'; say: Bi }
  /** sum: the b × b tile. */
  | { op: 'tileB'; say: Bi }
  /** difference: the corner b × b that the two strips share (it was taken away twice). */
  | { op: 'corner'; say: Bi }
  /** product: the b × b square taken from a corner, leaving an L. */
  | { op: 'remove'; say: Bi }
  /** product: the L is cut into two rectangles. */
  | { op: 'cut'; say: Bi }
  /** product: the lower piece is turned and slid beside the upper one to make a rectangle (a + b) × (a − b). */
  | { op: 'move'; say: Bi }
  /** The pieces are named (sum, difference: labels in the tiles; product: braces a + b and a − b). */
  | { op: 'name'; say: Bi }
  /** The identity is written term by term, each term lighting its piece. */
  | { op: 'build'; say: Bi }
  /** The identity checked with the numbers a and b. */
  | { op: 'check'; say: Bi };

export interface SqPlan {
  title?: Bi;
  kind: SqKind;
  /** The longer side (and the first term). */
  a: number;
  /** The shorter side. */
  b: number;
  steps: SqStep[];
}

export interface ColumnPlan {
  /** "478 + 356", "347 × 26", "1260 ÷ 12". */
  sum: string;
}

/** A plan for a DNA made of several segments (also what the AI writes for a brand-new DNA). */
export interface CompositePlan {
  segments: Array<{ dna: Exclude<DnaId, 'ai-custom' | `learned:${string}` | 'bridge'>; plan: unknown }>;
}

export interface BlockPlan {
  blockId: string;
  dna: DnaId;
  /** The textbook text read aloud (English as printed) and its Malayalam translation. */
  read: Bi;
  /** Teaching plan for the DNA (shape depends on the DNA). */
  teach: unknown;
  source: 'offline' | 'ai' | 'fixture';
  /** The lesson arc around the picture (hook, why, formal, check, summary); optional. */
  arc?: LessonArc;
  /** Problems found while planning (shown in the UI; never silently dropped). */
  warnings?: string[];
  /** Quality gate (V51.9.41): how many asks it took and whether the last plan came out clean. */
  qa?: { attempts: number; passed: boolean; notes: string[] };
}

/* ---------------- DNA definition ---------------- */

export interface BlockFeatures {
  /** V51.9.55: two equations a x ± b y = c that one add or subtract solves (balance-pair). */
  pairBal: boolean;
  pairBalHits: number;
  kind: BlockKind;
  text: string;
  chars: number;
  numbers: number;
  equations: number;
  variables: string[];
  question: boolean;
  wordProblem: boolean;
  geometry: number;
  picture: boolean;
  area: boolean;
  identity: boolean;
  numberLine: boolean;
  /** Graph of a function / line / curve, coordinate plane, plotting. */
  graph: boolean;
  graphHits: number;
  /** Linear transformation of the plane: matrix, vector, reflection, rotation, stretch, shear. */
  plane: boolean;
  planeHits: number;
  /** A sequence / pattern of terms (not a mental-arithmetic chain). */
  sequence: boolean;
  /** Matrix words: matrix, rows, columns, diagonal, entry, a_ij. */
  matrix: boolean;
  matrixHits: number;
  /** Named shape with its formula: area of a circle, Pythagoras, special right triangles. */
  shape: boolean;
  shapeHits: number;
  /** Sets: union, intersection, complement, Venn diagram, universal set. */
  sets: boolean;
  setHits: number;
  /** Trigonometric ratios: sine, cosine, tangent, unit circle. */
  trig: boolean;
  trigHits: number;
  /** A pair of linear equations / simultaneous equations / graphical or elimination method. */
  linear: boolean;
  linearHits: number;
  /** Arithmetic sequence: common difference, n-th term, sum of terms, or a list of numbers with a constant difference. */
  seq: boolean;
  seqHits: number;
  /** Quadratic / second degree equation, roots, discriminant, parabola. */
  quad: boolean;
  quadHits: number;
  /** Polynomial, remainder / factor theorem, degree and coefficients. */
  poly: boolean;
  polyHits: number;
  /** Angles between lines, in triangles and in circles. */
  angle: boolean;
  angleHits: number;
  /** Solids: volume and surface area of a prism, cylinder, cone or sphere. */
  solid: boolean;
  solidHits: number;
  /** Ratios and percentages. */
  ratio: boolean;
  ratioHits: number;
  /** Pie charts. */
  pie: boolean;
  pieHits: number;
  /** Coordinate geometry: points, distance, midpoint. */
  coord: boolean;
  coordHits: number;
  /** Visual proofs of (a + b)², (a − b)², (a + b)(a − b). */
  sqid: boolean;
  sqidHits: number;
  /** Linear equations a x + b = c that a balance scale can show. */
  bal: boolean;
  balHits: number;
  /** Formulas with a root, \frac or a matrix that the typesetter can show line by line. */
  ts: boolean;
  tsHits: number;
  /** The text asks where the quadratic formula comes from (V51.9.48). */
  qdv: boolean;
  qdvHits: number;
  /** The text is about HCF / LCM of whole numbers (V51.9.49). */
  hl: boolean;
  hlHits: number;
  /** Area of a parallelogram or trapezium. */
  afig: boolean;
  afigHits: number;
  /** Matrix multiplication and transpose. */
  mops: boolean;
  mopsHits: number;
  /** Fractions placed on a number line. */
  fline: boolean;
  flineHits: number;
  /** Fractions, parts of a whole, percent, decimals as parts. */
  fractions: boolean;
  fractionHits: number;
  /** Data, bar graph, histogram, mean / median. */
  stats: boolean;
  statsHits: number;
  /** Chance, outcomes, coin / dice / bag draws. */
  prob: boolean;
  probHits: number;
  arithmeticOnly: boolean;
  table: boolean;
  labelled: boolean;
  formulaLike: boolean;
  reasoning: boolean;
  connective: boolean;
  chapterTitle: string;
}

export interface DnaDefinition {
  id: DnaId;
  name: string;
  /** Shown in the UI and given to the AI planner. */
  description: string;
  /** Block kinds this DNA can teach. */
  kinds: BlockKind[];
  /** 0..1 fit for a block. */
  score: (f: BlockFeatures) => number;
  /** JSON shape the planner must fill (for the AI prompt). */
  planShape: string;
  /** Example of a filled plan (for the AI prompt). */
  example?: string;
}

export interface DnaSelection {
  dna: DnaId;
  score: number;
  mandatory: boolean;
  /** Mandatory block whose best built-in DNA was weak: the AI must create/compose one. */
  needsAi: boolean;
  ranked: Array<{ id: DnaId; score: number }>;
  reason: string;
  /** Set by the semantic selector: what the closest card was and whether it overrode the rules. */
  semantic?: { dna: DnaId; cos: number; z: number; used: boolean };
}

/* ---- typeset formula lines (V51.9.45) ---- */

export type TsStep =
  /** Writes a formula (the lines before fade). The first step is always this. */
  | { op: 'show'; tex: string; note?: Bi; say: Bi }
  /** The line on the board turns into this one: symbols they share glide to their new places. */
  | { op: 'become'; tex: string; note?: Bi; say: Bi }
  /** Writes this formula underneath; the earlier lines are dimmed. */
  | { op: 'add'; tex: string; note?: Bi; say: Bi }
  /** Lights every symbol of the current line whose text is one of `parts` (e.g. ["x", "2"]). */
  | { op: 'focus'; parts: string[]; say: Bi }
  /** Boxes the current line. */
  | { op: 'box'; say: Bi };

export interface TsPlan {
  title?: Bi;
  /** Colour of symbols by their text, e.g. { "x": "a", "y": "b" }. */
  colors?: Record<string, Role>;
  steps: TsStep[];
}

/* ---- the lesson arc and the mascot (V51.9.46) ---- */

/**
 * Optional moments around a unit's picture: a hook question the mascot thinks before the picture,
 * a "why?" the mascot asks and answers after it, the rule as a typeset formula, a check with numbers,
 * and a one-sentence summary. The planner chooses which of them a unit needs.
 */
export interface LessonArc {
  /** A question for the viewer, asked by the mascot in a thought bubble before the picture (at most 16 words). */
  hook?: Bi;
  /** The moment a student asks "why?": the mascot asks (thought bubble) and answers (speech bubble), after the picture. */
  why?: { question: Bi; answer: Bi };
  /**
   * The rule as a typeset formula (LaTeX-like text), after the picture. V51.9.51: optional `parts` read the
   * formula term by term — it dims, then each part lights up in its own colour with a brace and a label.
   * `match` is the part exactly as written in `tex` (e.g. "a + b"); at most 5 parts, in reading order.
   */
  formal?: { tex: string; say: Bi; parts?: Array<{ match: string; label: Bi; say?: Bi }> };
  /** Numbers put into the rule, as a typeset line with a tick. */
  check?: { tex: string; say: Bi };
  /** One sentence the mascot cheers at the end (at most 28 words). */
  summary?: Bi;
  /**
   * V51.9.51: the common mistake. The wrong line is written in red ("You might think…"), struck out with the
   * reason, then the right line is written with a tick. `at`: before the picture or after it (default after).
   */
  mistake?: { wrong: { tex: string; say: Bi }; why: Bi; right: { tex: string; say: Bi }; at?: 'before' | 'after' };
}

/* ---- the quadratic formula, derived (V51.9.48) ---- */

export type QdStep =
  /** Draws the square of side x and the strip of area b·x; writes the equation. */
  | { op: 'show'; say: Bi }
  /** Cuts the strip in half (each half b/2 wide). */
  | { op: 'split'; say: Bi }
  /** Turns one half round the corner so the halves wrap two sides of the square. */
  | { op: 'bend'; say: Bi }
  /** The missing corner square, (b/2)², and what it adds to both sides. */
  | { op: 'corner'; say: Bi }
  /** The big square: (x + b/2)² = (b/2)² − c. */
  | { op: 'square'; say: Bi }
  /** Takes the square root of both sides: x + b/2 = ±√… */
  | { op: 'root'; say: Bi }
  /** Moves b/2 across: x = −b/2 ± √…; with the numbers, the two roots. */
  | { op: 'answer'; say: Bi }
  /** Writes it as the quadratic formula (first with a = 1, then the general a). Optional, last. */
  | { op: 'formula'; say: Bi };

export interface QdPlan {
  title?: Bi;
  /** x² + b x + c = 0 with whole roots: b even from 2 to 16, (b/2)² − c a perfect square from 1 to 144. */
  b: number;
  c: number;
  steps: QdStep[];
}

/* ---- HCF and LCM by prime tiles (V51.9.49) ---- */

export type HlStep =
  /** The two numbers. */
  | { op: 'show'; say: Bi }
  /** Each number splits into prime tiles. */
  | { op: 'factorise'; say: Bi }
  /** The tiles slide so shared primes sit in the same columns, joined by lines. */
  | { op: 'common'; say: Bi }
  /** The shared tiles are boxed; their product is the HCF. */
  | { op: 'hcf'; say: Bi }
  /** Every column is boxed; the product of all of them is the LCM. */
  | { op: 'lcm'; say: Bi }
  /** HCF × LCM = a × b. Optional, last. */
  | { op: 'check'; say: Bi };

export interface HlPlan {
  title?: Bi;
  /** The two numbers, a < b, each 2–120. */
  a: number;
  b: number;
  steps: HlStep[];
}

/* ---------------- V51.9.58: chapter introduction ---------------- */

/** A small worked example the app computes for a topic of the tour (the planner gives numbers only). */
export type IntroExample =
  /** a x + b = c with a whole answer: the line, the line after moving b, the answer, the check. */
  | { kind: 'solve'; a: number; b: number; c: number; letter?: string }
  /** a1 x + b1 y = c1 and a2 x + b2 y = c2 with a whole-number solution. */
  | { kind: 'pair'; e1: { a: number; b: number; c: number }; e2: { a: number; b: number; c: number } };

export interface IntroTopic {
  /** The topic's name on the board (a section heading). */
  name: Bi;
  /** What the teacher says about it. */
  say: Bi;
  example?: IntroExample;
}

export interface ChapterIntroPlan {
  title: Bi;
  /** Floating background formulas (maths symbols only, at most 8). */
  formulas?: string[];
  /** 2 to 6 topics, in the order of the chapter. */
  topics: IntroTopic[];
  /** Said over the title card. */
  welcome: Bi;
  /** Said over the closing recap. */
  closing: Bi;
}
