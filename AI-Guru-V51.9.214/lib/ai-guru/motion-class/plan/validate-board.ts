/**
 * Validators for the fraction, histogram and probability-tree plans. The planner chooses
 * what to show; these checks make sure it can be drawn and that every number the app will
 * compute (shaded widths, mean, path products) comes from legal inputs.
 */

import { parseQ, qAdd, treeDepth, treeLeaves, type Q } from '../dna/board-builders';
import { SOLID_OPS, solidProblem } from '../dna/s-math';
import { RATIO_OPS, ratioProblem } from '../dna/rp-math';
import { PIE_OPS, pieProblem } from '../dna/pc-math';
import { FL_OPS, flProblem } from '../dna/fl-math';
import { MO_OPS, moProblem } from '../dna/mo-math';
import { AF_OPS, afProblem } from '../dna/af-math';
import { CG_OPS, cgProblem } from '../dna/cg-math';
import { SQ_OPS, sqProblem } from '../dna/sq-math';
import { BAL_OPS, balProblem, requiredOps } from '../dna/bal-math';
import { PAIR_OPS, pairProblem, requiredPairOps } from '../dna/pair-math';
import { tsProblem } from '../dna/ts-math';
import { qdProblem } from '../dna/qd-math';
import { hlProblem } from '../dna/hl-math';
import type { PairPlan, FractionPlan, HistogramPlan, MatrixPlan, ShapePlan, TreeNode, TreePlan, TrigPlan, VennPlan, LinPlan, SeqPlan, QuadPlan, PolyPlan, AnglePlan, SolidPlan, RatioPlan, PiePlan, FracLinePlan, MatrixOpsPlan, AreaFigPlan, CoordPlan, SqPlan, BalPlan, TsPlan, QdPlan, HlPlan } from '../dna/types';
import { eqProblem, solve } from '../dna/lin-math';
import { disc, problem as quadProblem, rationalRoots, roots as quadRoots } from '../dna/q-math';
import { circleProblem, parallelProblem, triangleProblem } from '../dna/a-math';
import { COEF_MAX_Q, DIV_DEG_MAX, R_MAX, fullyFactorable, identityOf, integerRoots, polyProblem, termsOf } from '../dna/p-math';
import { A_MAX, D_MAX, N_MAX, TERMS_MAX, TERMS_MIN, TEST_MAX } from '../dna/as-math';
import { ANGLE_MAX, ANGLE_MIN, RATIOS, fitRadius, isAngle } from '../dna/trig-math';
import { codeName, elementCodes, placeInRegion, regionOf, sameSet, vennGeometry } from '../dna/venn-math';
import { FORMULAS_OK, SHAPE_KINDS, isSpecial, needsB } from '../dna/shape-math';

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const int = (v: unknown, lo: number, hi: number): v is number => finite(v) && Number.isInteger(v) && v >= lo && v <= hi;

export function checkFractions(plan: FractionPlan, path: string, errors: string[]) {
  if (!Array.isArray(plan?.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with a "bar" or a "grid").`);
  const bars: Array<{ n: number; k: number }> = [];
  let grid = false;
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    const has = (b: unknown, what: string): b is number => {
      const ok = int(b, 0, bars.length - 1) && bars.length > 0;
      if (!ok) errors.push(`${at}.${what} must be the number of a bar already drawn (0 = the first bar${bars.length ? `, up to ${bars.length - 1} now` : '; draw a bar first'}).`);
      return ok;
    };
    switch (s.op) {
      case 'bar':
        if (grid) errors.push(`${at}: do not mix bars and a tile grid in one picture; use two separate DNAs.`);
        if (!int(s.n, 1, 24)) errors.push(`${at}.n must be a whole number of parts, 1–24.`);
        else if (!int(s.shade, 0, s.n)) errors.push(`${at}.shade must be a whole number 0–${s.n} (parts coloured).`);
        else bars.push({ n: s.n, k: s.shade });
        if (bars.length > 5) errors.push(`${at}: at most 5 bars on one board.`);
        break;
      case 'split':
        if (has(s.bar, 'bar')) {
          const b = bars[s.bar];
          if (!int(s.by, 2, 12)) errors.push(`${at}.by must be a whole number 2–12.`);
          else if (b.n * s.by > 24) errors.push(`${at}: ${b.n} parts × ${s.by} = ${b.n * s.by} parts is too many to draw (max 24).`);
          else {
            b.n *= s.by;
            b.k *= s.by;
          }
        }
        break;
      case 'shade':
        if (has(s.bar, 'bar')) {
          const b = bars[s.bar];
          if (!int(s.to, 0, b.n)) errors.push(`${at}.to must be a whole number 0–${b.n} (bar ${s.bar} has ${b.n} parts now).`);
          else b.k = s.to;
        }
        break;
      case 'join':
        if (has(s.a, 'a') && has(s.b, 'b')) {
          const A = bars[s.a];
          const B = bars[s.b];
          if (s.a === s.b) errors.push(`${at}: a and b must be two different bars.`);
          else if (A.n !== B.n) errors.push(`${at}: bars ${s.a} and ${s.b} have ${A.n} and ${B.n} parts. Cut them (split) until the parts are equal before joining.`);
          else if (A.k + B.k > A.n) errors.push(`${at}: ${A.k} + ${B.k} parts is more than the whole bar (${A.n}); an improper sum is not drawn. Use smaller fractions.`);
          else if (bars.length >= 5) errors.push(`${at}: at most 5 bars on one board.`);
          else bars.push({ n: A.n, k: A.k + B.k });
        }
        break;
      case 'grid':
        if (bars.length) errors.push(`${at}: do not mix bars and a tile grid in one picture.`);
        if (grid) errors.push(`${at}: only one grid per board.`);
        grid = true;
        if (!int(s.rows, 1, 10) || !int(s.cols, 1, 10) || s.rows * s.cols > 100) errors.push(`${at}.rows and .cols must be whole numbers 1–10 (at most 100 tiles).`);
        else if (!int(s.shade, 0, s.rows * s.cols)) errors.push(`${at}.shade must be a whole number 0–${s.rows * s.cols} (tiles coloured).`);
        break;
      default:
        errors.push(`${at}.op "${(s as { op?: string }).op}" is not one of bar, split, shade, join, grid.`);
    }
  });
}

export function checkHistogram(plan: HistogramPlan, path: string, errors: string[]) {
  const cats = plan?.categories;
  if (!Array.isArray(cats) || cats.length < 2 || cats.length > 12 || !cats.every((c) => typeof c === 'string' && c.length > 0 && c.length <= 8)) {
    return void errors.push(`${path}.categories must be 2–12 labels of at most 8 characters, like ["Mon","Tue","Wed"].`);
  }
  if (!finite(plan.yMax) || plan.yMax <= 0 || plan.yMax > 100000) return void errors.push(`${path}.yMax must be a positive number (top of the vertical axis).`);
  if (plan.yLabel !== undefined && (typeof plan.yLabel !== 'string' || plan.yLabel.length > 10)) errors.push(`${path}.yLabel must be at most 10 characters.`);
  if (!Array.isArray(plan.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (axes, bars, …).`);
  let values: number[] | null = null;
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    const needBars = () => {
      if (!values) errors.push(`${at}: "${s.op}" needs the bars drawn before it.`);
      return !!values;
    };
    switch (s.op) {
      case 'axes':
        break;
      case 'bars':
        if (values) errors.push(`${at}: bars can be drawn only once; use "change" to alter a bar.`);
        else if (!Array.isArray(s.values) || s.values.length !== cats.length || !s.values.every((v) => finite(v) && v >= 0 && v <= plan.yMax)) {
          errors.push(`${at}.values must be ${cats.length} numbers (one per category), each between 0 and yMax (${plan.yMax}).`);
        } else values = [...s.values];
        break;
      case 'highlight':
        if (needBars() && !int(s.index, 0, cats.length - 1)) errors.push(`${at}.index must be a bar number 0–${cats.length - 1}.`);
        break;
      case 'mean':
      case 'median':
        needBars();
        break;
      case 'line':
        if (!finite(s.y) || s.y < 0 || s.y > plan.yMax) errors.push(`${at}.y must be between 0 and yMax (${plan.yMax}).`);
        if (s.label !== undefined && (typeof s.label !== 'string' || s.label.length > 12)) errors.push(`${at}.label must be at most 12 characters.`);
        break;
      case 'change':
        if (needBars()) {
          if (!int(s.index, 0, cats.length - 1)) errors.push(`${at}.index must be a bar number 0–${cats.length - 1}.`);
          else if (!finite(s.to) || s.to < 0 || s.to > plan.yMax) errors.push(`${at}.to must be between 0 and yMax (${plan.yMax}).`);
          else values![s.index] = s.to;
        }
        break;
      default:
        errors.push(`${at}.op "${(s as { op?: string }).op}" is not one of axes, bars, highlight, mean, median, line, change.`);
    }
  });
}

function checkNodes(nodes: unknown, path: string, depth: number, errors: string[]) {
  if (!Array.isArray(nodes) || nodes.length < 1 || nodes.length > 6) return void errors.push(`${path} must list 1–6 branches.`);
  let sum: Q = [0, 1];
  let ok = true;
  (nodes as TreeNode[]).forEach((n, i) => {
    const at = `${path}[${i}]`;
    if (!n || typeof n.label !== 'string' || !n.label.trim() || n.label.length > 6) {
      errors.push(`${at}.label must be 1–6 characters ("H", "Red").`);
      ok = false;
    }
    const q = typeof n?.p === 'string' ? parseQ(n.p) : null;
    if (!q || q[0] > q[1]) {
      errors.push(`${at}.p "${n?.p}" must be a fraction between 0 and 1, like "2/5".`);
      ok = false;
    } else sum = qAdd(sum, q);
    if (n?.children?.length) {
      if (depth >= 3) errors.push(`${at}: the tree may have at most 3 levels.`);
      else checkNodes(n.children, `${at}.children`, depth + 1, errors);
    }
  });
  if (ok && (sum[0] !== 1 || sum[1] !== 1)) errors.push(`${path}: the probabilities of sibling branches add up to ${sum[1] === 1 ? sum[0] : `${sum[0]}/${sum[1]}`}, but must add up to exactly 1.`);
}

export function checkTree(plan: TreePlan, path: string, errors: string[]) {
  const before = errors.length;
  checkNodes(plan?.branches, `${path}.branches`, 1, errors);
  if (plan?.start !== undefined && (typeof plan.start !== 'string' || plan.start.length > 6)) errors.push(`${path}.start must be at most 6 characters.`);
  if (errors.length > before) return;
  const D = treeDepth(plan.branches);
  if (treeLeaves(plan.branches) > 8) return void errors.push(`${path}: the tree has ${treeLeaves(plan.branches)} ends; at most 8 fit on the board.`);
  if (!Array.isArray(plan.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"grow","levels":1}).`);
  let grown = 0;
  const walk = (p: unknown, at: string): boolean => {
    if (!Array.isArray(p) || !p.length || !p.every((i) => int(i, 0, 5))) {
      errors.push(`${at} must be a list of branch numbers like [0,1] (one per level, counting from 0).`);
      return false;
    }
    let list: TreeNode[] | undefined = plan.branches;
    for (let k = 0; k < p.length; k++) {
      const node: TreeNode | undefined = list?.[p[k]];
      if (!node) {
        errors.push(`${at} = [${p.join(',')}]: there is no branch ${p[k]} at level ${k + 1}.`);
        return false;
      }
      list = node.children;
      if (k === p.length - 1 && list?.length) {
        errors.push(`${at} = [${p.join(',')}] stops before the end of the tree; continue to an end (${D} numbers on the longest path).`);
        return false;
      }
    }
    return true;
  };
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    switch (s.op) {
      case 'grow':
        if (!int(s.levels, 1, D)) errors.push(`${at}.levels must be 1–${D}.`);
        else grown = Math.max(grown, s.levels);
        break;
      case 'path':
        if (grown < D) errors.push(`${at}: grow the tree to all ${D} levels before using a path.`);
        else walk(s.path, `${at}.path`);
        break;
      case 'event':
        if (grown < D) errors.push(`${at}: grow the tree to all ${D} levels before using an event.`);
        else if (!Array.isArray(s.paths) || s.paths.length < 1 || s.paths.length > 6) errors.push(`${at}.paths must list 1–6 paths.`);
        else s.paths.forEach((p, k) => walk(p, `${at}.paths[${k}]`));
        break;
      case 'total':
        if (grown < D) errors.push(`${at}: grow the tree to all ${D} levels before the total.`);
        break;
      default:
        errors.push(`${at}.op "${(s as { op?: string }).op}" is not one of grow, path, event, total.`);
    }
  });
}

export function checkMatrix(plan: MatrixPlan, path: string, errors: string[]) {
  if (!int(plan?.rows, 1, 5) || !int(plan?.cols, 1, 5)) return void errors.push(`${path}.rows and ${path}.cols must be whole numbers 1–5.`);
  if (plan.name !== undefined && (typeof plan.name !== 'string' || !plan.name || plan.name.length > 2)) errors.push(`${path}.name must be 1–2 characters ("A").`);
  if (plan.entries !== undefined) {
    const e = plan.entries;
    if (!Array.isArray(e) || e.length !== plan.rows || !e.every((r) => Array.isArray(r) && r.length === plan.cols && r.every((v) => finite(v) && Math.abs(v) < 10000 && Number.isInteger(v * 100)))) {
      return void errors.push(`${path}.entries must be ${plan.rows} rows of ${plan.cols} numbers (at most 2 decimals, below 10000), or left out for a_{ij}.`);
    }
  }
  if (!Array.isArray(plan.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"show"}).`);
  let shown = false;
  let general: { rows: string; cols: string } | null = null;
  let generals = 0;
  let zoom: { i: number; j: number } | null = null;
  let symbolic = !plan.entries;
  const nr = () => (general ? 4 : plan.rows);
  const nc = () => (general ? 4 : plan.cols);
  const dotRow = () => (general ? 2 : -1);
  const needShow = (at: string, op: string) => {
    if (!shown) errors.push(`${at}: "${op}" needs {"op":"show"} before it.`);
    return shown;
  };
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    switch (s.op) {
      case 'show':
        if (shown) errors.push(`${at}: "show" only once; use "general" to draw a new grid.`);
        shown = true;
        break;
      case 'row':
        if (needShow(at, 'row') && (!int(s.index, 0, nr() - 1) || s.index === dotRow())) errors.push(`${at}.index must be a row of the grid (0–${nr() - 1}${general ? ', not the dots row 2' : ''}).`);
        break;
      case 'column':
        if (needShow(at, 'column') && (!int(s.index, 0, nc() - 1) || s.index === (general ? 2 : -1))) errors.push(`${at}.index must be a column of the grid (0–${nc() - 1}${general ? ', not the dots column 2' : ''}).`);
        break;
      case 'diagonal':
        needShow(at, 'diagonal');
        break;
      case 'entry':
        if (needShow(at, 'entry')) {
          if (!int(s.i, 0, nr() - 1) || !int(s.j, 0, nc() - 1) || s.i === dotRow() || s.j === (general ? 2 : -1)) errors.push(`${at}: i and j must name an entry of the grid (0-based${general ? ', not the dots' : ''}).`);
          else zoom = { i: s.i, j: s.j };
        }
        break;
      case 'indices':
        if (!zoom) errors.push(`${at}: "indices" needs an "entry" step before it (the camera must be zoomed in).`);
        else if (!symbolic) errors.push(`${at}: "indices" needs entries written as a_{ij}; leave out "entries".`);
        break;
      case 'zoomOut':
        if (!zoom) errors.push(`${at}: "zoomOut" needs an "entry" step before it.`);
        zoom = null;
        break;
      case 'size':
      case 'kind':
        needShow(at, s.op);
        break;
      case 'general':
        if (needShow(at, 'general')) {
          const ok = (v: unknown) => typeof v === 'string' && /^[a-z]$/.test(v);
          if (!ok(s.rows) || !ok(s.cols)) errors.push(`${at}.rows and .cols must be single lowercase letters like "m" and "n".`);
          else {
            if (++generals > 2) errors.push(`${at}: at most two "general" steps.`);
            general = { rows: s.rows, cols: s.cols };
            symbolic = true;
            zoom = null;
          }
        }
        break;
      default:
        errors.push(`${at}.op "${(s as { op?: string }).op}" is not one of show, row, column, diagonal, entry, indices, zoomOut, size, kind, general.`);
    }
  });
  if (!shown) errors.push(`${path}: the plan must contain {"op":"show"}.`);
}

/** Shape plans: a figure first, then only steps that fit that figure; sizes are small whole numbers. */
export function checkShape(plan: ShapePlan, path: string, errors: string[]) {
  if (!Array.isArray(plan?.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"shape","kind":"circle"}).`);
  if (plan.steps.length > 24) errors.push(`${path}.steps has ${plan.steps.length} steps; use at most 24.`);
  let kind: (typeof SHAPE_KINDS)[number] | null = null;
  let shapes = 0;
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if (s.op === 'shape') {
      shapes++;
      if (shapes > 6) errors.push(`${at}: at most 6 shapes in one class; split the rest into another block.`);
      if (!SHAPE_KINDS.includes(s.kind)) return void errors.push(`${at}.kind must be one of ${SHAPE_KINDS.join(', ')}.`);
      kind = s.kind;
      if (s.a !== undefined && !int(s.a, 1, 50)) errors.push(`${at}.a must be a whole number 1–50 (or left out for letters).`);
      if (s.b !== undefined && !int(s.b, 1, 50)) errors.push(`${at}.b must be a whole number 1–50 (or left out).`);
      if (s.a === undefined && s.b !== undefined) errors.push(`${at}: b without a. Give a first.`);
      if (s.a !== undefined && needsB(s.kind) && s.b === undefined) errors.push(`${at}: ${s.kind} needs both a and b when sizes are given.`);
      if (s.b !== undefined && !needsB(s.kind)) errors.push(`${at}: ${s.kind} takes only a (b is for rectangle, triangle and right-triangle).`);
      return;
    }
    if (!kind) return void errors.push(`${at}: "${s.op}" needs a {"op":"shape"} step before it.`);
    switch (s.op) {
      case 'label':
        break;
      case 'height':
        if (kind !== 'triangle') errors.push(`${at}: "height" only fits a triangle (this is a ${kind}).`);
        break;
      case 'angles':
        if (!isSpecial(kind)) errors.push(`${at}: "angles" only fits special-30-60-90 and special-45-45-90 (this is a ${kind}).`);
        break;
      case 'formula':
        if (!FORMULAS_OK[kind].includes(s.what)) errors.push(`${at}: a ${kind} has the formulas ${FORMULAS_OK[kind].join(', ')}; "${String(s.what)}" is not one of them.`);
        break;
      case 'name':
        break;
      default:
        errors.push(`${at}.op "${(s as { op?: string }).op}" is not one of shape, label, height, angles, formula, name.`);
    }
  });
  if (!shapes) errors.push(`${path}: no shape step.`);
}

/** Venn plans: legal set expressions, true identities, elements that fit their regions. */
export function checkVenn(plan: VennPlan, path: string, errors: string[]) {
  if (plan?.sets !== 2 && plan?.sets !== 3) return void errors.push(`${path}.sets must be 2 or 3.`);
  const n = plan.sets;
  if (plan.labels !== undefined) {
    if (!Array.isArray(plan.labels) || plan.labels.length > n) errors.push(`${path}.labels must list at most ${n} words (one per set).`);
    else plan.labels.forEach((l, i) => l?.en && l.en.length > 12 && errors.push(`${path}.labels[${i}] is longer than 12 characters.`));
  }
  let hasEl = false;
  if (plan.elements !== undefined) {
    hasEl = true;
    const ok = Array.isArray(plan.elements) && plan.elements.length === n && plan.elements.every((l) => Array.isArray(l) && l.every((e) => (typeof e === 'string' && e.length > 0 && e.length <= 6) || (finite(e) && String(e).length <= 6)));
    if (!ok) {
      errors.push(`${path}.elements must be ${n} lists (one per set) of numbers or words of at most 6 characters.`);
      hasEl = false;
    } else {
      const dup = plan.elements.find((l) => new Set(l.map(String)).size !== l.length);
      if (dup) errors.push(`${path}.elements: an element is repeated inside one set.`);
      const outside = plan.outside ?? [];
      if (!Array.isArray(outside) || outside.length > 6) errors.push(`${path}.outside must list at most 6 elements.`);
      const codes = elementCodes({ sets: plan.elements, outside: Array.isArray(outside) ? outside : [] });
      if (Array.isArray(outside) && outside.some((e) => plan.elements!.some((l) => l.map(String).includes(String(e))))) errors.push(`${path}.outside: an element listed there is also in a set.`);
      const per = new Map<number, number>();
      for (const c of codes.values()) per.set(c, (per.get(c) ?? 0) + 1);
      const g = vennGeometry(n);
      for (const [c, k] of per) {
        if (k > 6) errors.push(`${path}: region "${codeName(c, n)}" would hold ${k} elements; at most 6.`);
        else if (!placeInRegion(g, c, k)) errors.push(`${path}: region "${codeName(c, n)}" is too small for ${k} elements; use fewer.`);
      }
    }
  } else if (plan.outside !== undefined) errors.push(`${path}.outside needs "elements".`);
  if (!Array.isArray(plan.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"show"}).`);
  if (plan.steps.length > 20) errors.push(`${path}.steps has ${plan.steps.length} steps; use at most 20.`);
  let shown = false;
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if (s.op === 'show') {
      if (shown) errors.push(`${at}: "show" only once.`);
      shown = true;
      return;
    }
    if (!shown) return void errors.push(`${at}: "${s.op}" needs {"op":"show"} before it.`);
    const expr = (src: unknown, field: string) => {
      if (typeof src !== 'string' || !src.trim()) return void errors.push(`${at}.${field} must be a set expression such as "A∩B".`);
      const r = regionOf(src, n);
      if (r.error) errors.push(`${at}.${field} "${src}": ${r.error}. Use A${n === 3 ? ', B, C' : ' and B'}, ∪ ∩ − and a trailing ' for the complement.`);
    };
    switch (s.op) {
      case 'shade':
        expr(s.expr, 'expr');
        break;
      case 'identity': {
        expr(s.left, 'left');
        expr(s.right, 'right');
        if (typeof s.left === 'string' && typeof s.right === 'string') {
          const c = sameSet(s.left, s.right, n);
          if (!c.error && !c.same) errors.push(`${at}: "${s.left}" and "${s.right}" are not the same set: they differ in the region(s) ${c.differ!.map((k) => codeName(k, n)).join(', ')}. Only true identities may be shown.`);
        }
        break;
      }
      case 'list':
        expr(s.expr, 'expr');
        if (!hasEl) errors.push(`${at}: "list" needs "elements".`);
        break;
      case 'inclusion':
        if (!hasEl) errors.push(`${at}: "inclusion" needs "elements".`);
        if (n !== 2) errors.push(`${at}: "inclusion" is for two sets.`);
        break;
      case 'clear':
        break;
      default:
        errors.push(`${at}.op "${(s as { op?: string }).op}" is not one of show, shade, identity, list, inclusion, clear.`);
    }
  });
  if (!shown) errors.push(`${path}: no "show" step.`);
}

/** Unit-circle plans: legal angles, an order that can be drawn, each ratio once. */
export function checkTrig(plan: TrigPlan, path: string, errors: string[]) {
  if (!isAngle(plan?.angle)) return void errors.push(`${path}.angle must be a whole number of degrees from ${ANGLE_MIN} to ${ANGLE_MAX}.`);
  if (!Array.isArray(plan.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"show"}).`);
  if (plan.steps.length > 24) errors.push(`${path}.steps has ${plan.steps.length} steps; use at most 24.`);
  let shown = false;
  let point = false;
  let legs = false;
  let theta = plan.angle;
  const done = new Set<string>();
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if (s.op === 'show') {
      if (shown) errors.push(`${at}: "show" only once.`);
      shown = true;
      return;
    }
    if (!shown) return void errors.push(`${at}: "${s.op}" needs {"op":"show"} before it.`);
    switch (s.op) {
      case 'point':
        if (point) errors.push(`${at}: "point" only once.`);
        point = true;
        break;
      case 'legs':
        if (!point) errors.push(`${at}: "legs" needs "point" before it.`);
        if (legs) errors.push(`${at}: "legs" only once.`);
        legs = true;
        break;
      case 'ratio':
        if (!RATIOS.includes(s.which)) errors.push(`${at}.which must be one of ${RATIOS.join(', ')}.`);
        else if (done.has(s.which)) errors.push(`${at}: ${s.which} was already drawn.`);
        else done.add(s.which);
        if (!legs) errors.push(`${at}: "ratio" needs "legs" before it.`);
        break;
      case 'sweep':
        if (!point) errors.push(`${at}: "sweep" needs "point" before it.`);
        if (!isAngle(s.to)) errors.push(`${at}.to must be a whole number of degrees from ${ANGLE_MIN} to ${ANGLE_MAX}.`);
        else if (s.to === theta) errors.push(`${at}.to is the angle the point is already at (${theta}°).`);
        else theta = s.to;
        break;
      case 'values':
        if (!done.size) errors.push(`${at}: "values" needs at least one "ratio" before it.`);
        break;
      case 'identity':
        if (!['pythagorean', 'tan-sec', 'cot-csc'].includes(s.which)) errors.push(`${at}.which must be pythagorean, tan-sec or cot-csc.`);
        if (!point) errors.push(`${at}: "identity" needs "point" before it.`);
        break;
      case 'box':
        if (!done.size) errors.push(`${at}: "box" needs at least one "ratio" before it.`);
        break;
      default:
        errors.push(`${at}.op "${(s as { op?: string }).op}" is not one of show, point, legs, ratio, sweep, values, identity, box.`);
    }
  });
  if (!shown) errors.push(`${path}: no "show" step.`);
}

/** Linear-system plans: usable numbers, one whole-number solution, an order that can be drawn. */
export function checkLinear(plan: LinPlan, path: string, errors: string[]) {
  const p1 = eqProblem(plan?.e1, `${path}.e1`);
  const p2 = eqProblem(plan?.e2, `${path}.e2`);
  if (p1) errors.push(p1);
  if (p2) errors.push(p2);
  if (!p1 && !p2) {
    const sol = solve(plan);
    if ('error' in sol) errors.push(`${path}: ${sol.error}.`);
  }
  if (!Array.isArray(plan?.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"show"}).`);
  if (plan.steps.length > 14) errors.push(`${path}.steps has ${plan.steps.length} steps; use at most 14.`);
  let shown = false;
  let graph = false;
  let matrix = false;
  const found = new Set<string>();
  const elim = new Set<string>();
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if (s.op === 'show') {
      if (shown) errors.push(`${at}: "show" only once.`);
      shown = true;
      return;
    }
    if (!shown) return void errors.push(`${at}: "${s.op}" needs {"op":"show"} before it.`);
    switch (s.op) {
      case 'graph':
        if (graph) errors.push(`${at}: "graph" only once.`);
        graph = true;
        break;
      case 'meet':
        if (!graph) errors.push(`${at}: "meet" needs "graph" before it.`);
        break;
      case 'eliminate': {
        if (s.var !== 'x' && s.var !== 'y') {
          errors.push(`${at}.var must be "x" or "y" (the unknown to eliminate).`);
          break;
        }
        const left = s.var === 'x' ? 'y' : 'x';
        if (elim.has(s.var)) errors.push(`${at}: ${s.var} was already eliminated.`);
        else if (found.has(left)) errors.push(`${at}: eliminating ${s.var} finds ${left}, which is already found.`);
        elim.add(s.var);
        found.add(left);
        break;
      }
      case 'substitute':
        if (s.into !== 1 && s.into !== 2) errors.push(`${at}.into must be 1 or 2 (the equation to put the value into).`);
        if (found.size !== 1) errors.push(`${at}: "substitute" needs exactly one unknown found by "eliminate" before it.`);
        else found.add([...found][0] === 'x' ? 'y' : 'x');
        break;
      case 'check':
        if (found.size < 2) errors.push(`${at}: "check" needs both unknowns found (use "eliminate" and "substitute", or two "eliminate").`);
        break;
      case 'matrix':
        if (matrix) errors.push(`${at}: "matrix" only once.`);
        matrix = true;
        break;
      default:
        errors.push(`${at}.op "${(s as { op?: string }).op}" is not one of show, graph, eliminate, substitute, meet, check, matrix.`);
    }
  });
  if (!shown) errors.push(`${path}: no "show" step.`);
}

/** Arithmetic-sequence plans: legal a, d and counts, and an order that can be drawn. */
export function checkSeq(plan: SeqPlan, path: string, errors: string[]) {
  const int = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
  if (!int(plan?.a) || Math.abs(plan.a) > A_MAX) errors.push(`${path}.a (first term) must be a whole number from −${A_MAX} to ${A_MAX}.`);
  if (!int(plan?.d) || plan.d === 0 || Math.abs(plan.d) > D_MAX) errors.push(`${path}.d (common difference) must be a non-zero whole number from −${D_MAX} to ${D_MAX}.`);
  if (!int(plan?.terms) || plan.terms < TERMS_MIN || plan.terms > TERMS_MAX) errors.push(`${path}.terms (terms shown in the row) must be a whole number from ${TERMS_MIN} to ${TERMS_MAX}.`);
  if (!Array.isArray(plan?.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"show"}).`);
  if (plan.steps.length > 14) errors.push(`${path}.steps has ${plan.steps.length} steps; use at most 14.`);
  let shown = false;
  let formula = false;
  let graph = false;
  let pairs = false;
  let diff = false;
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if (s.op === 'show') {
      if (shown) errors.push(`${at}: "show" only once.`);
      shown = true;
      return;
    }
    if (!shown) return void errors.push(`${at}: "${s.op}" needs {"op":"show"} before it.`);
    switch (s.op) {
      case 'diff':
        if (diff) errors.push(`${at}: "diff" only once.`);
        diff = true;
        break;
      case 'formula':
        if (formula) errors.push(`${at}: "formula" only once.`);
        formula = true;
        break;
      case 'term':
        if (!formula) errors.push(`${at}: "term" needs "formula" before it.`);
        if (!int(s.n) || s.n <= (plan.terms ?? 0) || s.n > N_MAX) errors.push(`${at}.n must be a whole number from ${(plan.terms ?? 0) + 1} (a term not in the row) to ${N_MAX}.`);
        break;
      case 'pairs':
        if (pairs) errors.push(`${at}: "pairs" only once.`);
        if (plan.terms % 2) errors.push(`${at}: "pairs" needs an even number of terms in the row (terms is ${plan.terms}).`);
        if (formula || graph) errors.push(`${at}: "pairs" must come before "formula" and "graph" (it uses their space).`);
        pairs = true;
        break;
      case 'sum':
        if (!int(s.n) || s.n < 2 || s.n > N_MAX) errors.push(`${at}.n must be a whole number from 2 to ${N_MAX}.`);
        break;
      case 'test':
        if (!formula) errors.push(`${at}: "test" needs "formula" before it.`);
        if (!int(s.value) || Math.abs(s.value) > TEST_MAX) errors.push(`${at}.value must be a whole number from −${TEST_MAX} to ${TEST_MAX}.`);
        break;
      case 'graph':
        if (graph) errors.push(`${at}: "graph" only once.`);
        graph = true;
        break;
      default:
        errors.push(`${at}.op "${(s as { op?: string }).op}" is not one of show, diff, formula, term, pairs, sum, test, graph.`);
    }
  });
  if (!shown) errors.push(`${path}: no "show" step.`);
}

/** Quadratic plans: usable coefficients, steps that the discriminant allows, an order that can be drawn. */
export function checkQuad(plan: QuadPlan, path: string, errors: string[]) {
  const p = quadProblem(plan as { a: number; b: number; c: number }, path);
  if (p) errors.push(p);
  if (!Array.isArray(plan?.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"show"}).`);
  if (plan.steps.length > 12) errors.push(`${path}.steps has ${plan.steps.length} steps; use at most 12.`);
  const ok = !p;
  const D = ok ? disc(plan) : 0;
  const rational = ok && rationalRoots(plan);
  const wholeRoots = ok && rational && quadRoots(plan).every((r) => r.d === 1);
  let shown = false;
  let graph = false;
  const seen = new Set<string>();
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if (s.op === 'show') {
      if (shown) errors.push(`${at}: "show" only once.`);
      shown = true;
      return;
    }
    if (!shown) return void errors.push(`${at}: "${s.op}" needs {"op":"show"} before it.`);
    if (seen.has(s.op)) errors.push(`${at}: "${s.op}" only once.`);
    seen.add(s.op);
    switch (s.op) {
      case 'graph':
        graph = true;
        break;
      case 'discriminant':
        break;
      case 'factorise':
        if (ok && !rational) errors.push(`${at}: "factorise" needs a discriminant that is a perfect square (here D = ${D}); use "formula" instead.`);
        else if (ok && plan.b === 0 && plan.c === 0) errors.push(`${at}: "factorise" has nothing to split when b and c are both 0.`);
        break;
      case 'formula':
        break;
      case 'roots':
        if (!graph) errors.push(`${at}: "roots" needs "graph" before it.`);
        if (ok && !rational) errors.push(`${at}: "roots" needs a discriminant that is a perfect square to place the roots (here D = ${D}).`);
        break;
      case 'check':
        if (ok && !wholeRoots) errors.push(`${at}: "check" needs whole-number roots.`);
        break;
      default:
        errors.push(`${at}.op "${(s as { op?: string }).op}" is not one of show, graph, discriminant, factorise, formula, roots, check.`);
    }
  });
  if (!shown) errors.push(`${path}: no "show" step.`);
}


/** Polynomial plans: usable coefficients, steps whose numbers exist, an order that can be drawn. */
export function checkPoly(plan: PolyPlan, path: string, errors: string[]) {
  const pp = polyProblem(plan?.p, `${path}.p`);
  if (pp) errors.push(pp);
  const okP = !pp;
  const hasQ = plan?.q !== undefined;
  let okQ = false;
  if (hasQ) {
    const qp = polyProblem(plan.q, `${path}.q`, { min: 1, max: 3, coef: COEF_MAX_Q });
    if (qp) errors.push(qp);
    else okQ = true;
  }
  const hasR = plan?.r !== undefined;
  let okR = false;
  if (hasR) {
    if (!Number.isInteger(plan.r) || plan.r === 0 || Math.abs(plan.r as number) > R_MAX) errors.push(`${path}.r (the divisor is x − r) must be a non-zero whole number from −${R_MAX} to ${R_MAX}.`);
    else okR = true;
  }
  if (!Array.isArray(plan?.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"show"}).`);
  if (plan.steps.length > 12) errors.push(`${path}.steps has ${plan.steps.length} steps; use at most 12.`);
  let shown = false;
  let graph = false;
  const seen = new Set<string>();
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if (s.op === 'show') {
      if (shown) errors.push(`${at}: "show" only once.`);
      shown = true;
      return;
    }
    if (!shown) return void errors.push(`${at}: "${s.op}" needs {"op":"show"} before it.`);
    if (seen.has(s.op)) errors.push(`${at}: "${s.op}" only once.`);
    seen.add(s.op);
    switch (s.op) {
      case 'add':
      case 'subtract':
        if (!hasQ) errors.push(`${at}: "${s.op}" needs the second polynomial "q".`);
        break;
      case 'multiply':
        if (!hasQ) errors.push(`${at}: "multiply" needs the second polynomial "q".`);
        else if (okP && okQ) {
          if (termsOf(plan.p).length > 3 || termsOf(plan.q as number[]).length > 3) errors.push(`${at}: "multiply" needs at most 3 non-zero terms in p and in q so the table fits.`);
          if (plan.p.length - 1 + (plan.q as number[]).length - 1 > 5) errors.push(`${at}: "multiply" gives a product above degree 5; use smaller polynomials.`);
        }
        break;
      case 'divide':
        if (!hasR) errors.push(`${at}: "divide" needs "r" (the divisor is x − r).`);
        if (okP && plan.p.length - 1 > DIV_DEG_MAX) errors.push(`${at}: "divide" works on polynomials up to degree ${DIV_DEG_MAX}.`);
        break;
      case 'remainder':
        if (!hasR) errors.push(`${at}: "remainder" needs "r" (the divisor is x − r).`);
        break;
      case 'factor': {
        const roots = okP ? fullyFactorable(plan.p) : null;
        if (okP && !roots) errors.push(`${at}: "factor" needs P to start with 1 (monic) and factorise completely into (x − r) factors with whole-number r.`);
        else if (roots && !roots.includes((s as { at: number }).at)) errors.push(`${at}: P(${(s as { at: number }).at}) is not 0; the roots are ${[...new Set(roots)].join(', ')}.`);
        break;
      }
      case 'identity':
        if (okP && !identityOf(plan.p)) errors.push(`${at}: "identity" needs P to be x² − k², x² + 2kx + k² or x² − 2kx + k² (k a whole number).`);
        break;
      case 'graph':
        graph = true;
        break;
      case 'roots':
        if (!graph) errors.push(`${at}: "roots" needs "graph" before it.`);
        if (okP && !integerRoots(plan.p).roots.length) errors.push(`${at}: "roots" needs at least one whole-number root to mark.`);
        break;
      default:
        errors.push(`${at}.op "${(s as { op?: string }).op}" is not one of show, add, subtract, multiply, divide, remainder, factor, identity, graph, roots.`);
    }
  });
  void okR;
  if (!shown) errors.push(`${path}: no "show" step.`);
}


const ANGLE_OPS: Record<string, string[]> = {
  parallel: ['show', 'given', 'vertical', 'linear', 'corresponding', 'alternate', 'cointerior'],
  triangle: ['show', 'angles', 'find', 'sum', 'exterior'],
  circle: ['show', 'centre', 'circumference', 'double', 'same-arc', 'cyclic'],
};

/** Angle plans: a figure, angles that can be drawn, steps that belong to the figure in an order that works. */
export function checkAngle(plan: AnglePlan, path: string, errors: string[]) {
  const fig = plan?.figure;
  if (fig !== 'parallel' && fig !== 'triangle' && fig !== 'circle') return void errors.push(`${path}.figure must be "parallel", "triangle" or "circle".`);
  const p = fig === 'parallel' ? parallelProblem(plan.a, plan.at, path) : fig === 'triangle' ? triangleProblem(plan.A, plan.B, path) : circleProblem(plan.beta, path);
  if (p) errors.push(p);
  if (!Array.isArray(plan.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"show"}).`);
  if (plan.steps.length > 12) errors.push(`${path}.steps has ${plan.steps.length} steps; use at most 12.`);
  const seen = new Set<string>();
  const ops = plan.steps.map((s) => s?.op);
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if (!ANGLE_OPS[fig].includes(s.op)) return void errors.push(`${at}.op "${s.op}" is not one of ${ANGLE_OPS[fig].join(', ')} for a ${fig} figure.`);
    if (s.op === 'show') {
      if (seen.has('show')) errors.push(`${at}: "show" only once.`);
      seen.add('show');
      return;
    }
    if (!seen.has('show')) return void errors.push(`${at}: "${s.op}" needs {"op":"show"} before it.`);
    if (seen.has(s.op)) errors.push(`${at}: "${s.op}" only once.`);
    seen.add(s.op);
    const before = (op: string) => ops.slice(0, i).includes(op as never);
    switch (s.op) {
      case 'vertical':
      case 'linear':
      case 'corresponding':
      case 'alternate':
      case 'cointerior':
        if (!before('given')) errors.push(`${at}: "${s.op}" needs "given" before it (the angle it is worked out from).`);
        break;
      case 'find':
      case 'sum':
      case 'exterior':
        if (!before('angles')) errors.push(`${at}: "${s.op}" needs "angles" before it.`);
        if ((s.op === 'sum' || s.op === 'exterior') && ops.includes('find') && !before('find')) errors.push(`${at}: "${s.op}" must come after "find" (the third angle is found first).`);
        break;
      case 'double':
        if (!before('centre') || !before('circumference')) errors.push(`${at}: "double" needs "centre" and "circumference" before it.`);
        break;
      case 'same-arc':
      case 'cyclic':
        if (!before('circumference')) errors.push(`${at}: "${s.op}" needs "circumference" before it.`);
        break;
    }
  });
  if (!seen.has('show')) errors.push(`${path}: no "show" step.`);
}

/** Solid plans: a solid with sizes that can be drawn, steps that belong to it in an order that works. */
export function checkSolid(plan: SolidPlan, path: string, errors: string[]) {
  const p = solidProblem(plan, path);
  if (p) return void errors.push(p);
  const kind = plan.solid;
  if (!Array.isArray(plan.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"show"}).`);
  if (plan.steps.length > 8) errors.push(`${path}.steps has ${plan.steps.length} steps; use at most 8.`);
  const seen = new Set<string>();
  const ops = plan.steps.map((s) => s?.op as string);
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if (!SOLID_OPS[kind].includes(s.op)) return void errors.push(`${at}.op "${s.op}" is not one of ${SOLID_OPS[kind].join(', ')} for a ${kind}.`);
    if (s.op === 'show') {
      if (seen.has('show')) errors.push(`${at}: "show" only once.`);
      seen.add('show');
      return;
    }
    if (!seen.has('show')) return void errors.push(`${at}: "${s.op}" needs {"op":"show"} before it.`);
    if (seen.has(s.op)) errors.push(`${at}: "${s.op}" only once.`);
    seen.add(s.op);
    const before = (op: string) => ops.slice(0, i).includes(op);
    const after = (op: string) => ops.slice(i + 1).includes(op);
    if (s.op === 'net' || s.op === 'surface') {
      if ((kind === 'cone' || kind === 'prism') && !before('slant')) errors.push(`${at}: "${s.op}" for a ${kind} needs "slant" before it (the slant length is used).`);
    }
    if (s.op === 'net') {
      for (const late of ['base', 'slant', 'volume']) if (after(late)) errors.push(`${at}: "net" replaces the solid, so "${late}" must come before it.`);
    }
    if (s.op === 'surface' && after('net')) errors.push(`${at}: "net" must come before "surface".`);
    if (s.op === 'volume' && after('base')) errors.push(`${at}: "base" must come before "volume".`);
  });
  if (!seen.has('show')) errors.push(`${path}: no "show" step.`);
}

/** Ratio and percent plans: numbers that give whole answers, steps that belong to the kind in an order that works. */
export function checkRatio(plan: RatioPlan, path: string, errors: string[]) {
  const p = ratioProblem(plan, path);
  if (p) return void errors.push(p);
  const kind = plan.kind;
  if (!Array.isArray(plan.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"show"}).`);
  if (plan.steps.length > 6) errors.push(`${path}.steps has ${plan.steps.length} steps; use at most 6.`);
  const seen = new Set<string>();
  const ops = plan.steps.map((s) => s?.op as string);
  const need: Record<string, string> = { parts: 'unit', check: 'parts', part: 'tenth', result: kind === 'percent' ? 'part' : 'change' };
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if (!RATIO_OPS[kind].includes(s.op)) return void errors.push(`${at}.op "${s.op}" is not one of ${RATIO_OPS[kind].join(', ')} for kind "${kind}".`);
    if (s.op === 'show') {
      if (seen.has('show')) errors.push(`${at}: "show" only once.`);
      seen.add('show');
      return;
    }
    if (!seen.has('show')) return void errors.push(`${at}: "${s.op}" needs {"op":"show"} before it.`);
    if (seen.has(s.op)) errors.push(`${at}: "${s.op}" only once.`);
    seen.add(s.op);
    // "part" may follow "show" directly; "tenth" is optional there
    const must = s.op === 'part' ? undefined : need[s.op];
    if (must && !ops.slice(0, i).includes(must)) errors.push(`${at}: "${s.op}" needs "${must}" before it.`);
    if (s.op === 'part' && ops.includes('tenth') && !ops.slice(0, i).includes('tenth')) errors.push(`${at}: "tenth" must come before "part".`);
  });
  if (!seen.has('show')) errors.push(`${path}: no "show" step.`);
}

/** Pie chart plans: data that gives whole-degree sectors, steps in an order that works. */
export function checkPie(plan: PiePlan, path: string, errors: string[]) {
  const p = pieProblem(plan, path);
  if (p) return void errors.push(p);
  if (!Array.isArray(plan.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"show"}).`);
  if (plan.steps.length > 5) errors.push(`${path}.steps has ${plan.steps.length} steps; use at most 5.`);
  const seen = new Set<string>();
  const ops = plan.steps.map((s) => s?.op as string);
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if (!PIE_OPS.includes(s.op)) return void errors.push(`${at}.op "${s.op}" is not one of ${PIE_OPS.join(', ')}.`);
    if (s.op === 'show') {
      if (seen.has('show')) errors.push(`${at}: "show" only once.`);
      seen.add('show');
      return;
    }
    if (!seen.has('show')) return void errors.push(`${at}: "${s.op}" needs {"op":"show"} before it.`);
    if (seen.has(s.op)) errors.push(`${at}: "${s.op}" only once.`);
    seen.add(s.op);
    if ((s.op === 'percent' || s.op === 'check') && !ops.slice(0, i).includes('angle')) errors.push(`${at}: "${s.op}" needs "angle" before it.`);
  });
  if (!seen.has('show')) errors.push(`${path}: no "show" step.`);
}

/** Number-line fraction plans: fractions that fit the line, steps in an order that works. */
export function checkFracLine(plan: FracLinePlan, path: string, errors: string[]) {
  const p = flProblem(plan, path);
  if (p) return void errors.push(p);
  if (!Array.isArray(plan.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"show"}).`);
  const allowed = FL_OPS[plan.kind];
  if (plan.steps.length > allowed.length) errors.push(`${path}.steps has ${plan.steps.length} steps; use at most ${allowed.length}.`);
  const seen = new Set<string>();
  const ops = plan.steps.map((s) => s?.op as string);
  const dens = plan.kind === 'equivalent' ? [] : plan.fracs!.map((f) => f[1]);
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if (!allowed.includes(s.op)) return void errors.push(`${at}.op "${s.op}" is not one of ${allowed.join(', ')} for kind "${plan.kind}".`);
    if (s.op === 'show') {
      if (seen.has('show')) errors.push(`${at}: "show" only once.`);
      seen.add('show');
      return;
    }
    if (!seen.has('show')) return void errors.push(`${at}: "${s.op}" needs {"op":"show"} before it.`);
    if (seen.has(s.op)) errors.push(`${at}: "${s.op}" only once.`);
    seen.add(s.op);
    if (s.op === 'mark' && ops.includes('divide') && !ops.slice(0, i).includes('divide')) errors.push(`${at}: "divide" must come before "mark".`);
    if (s.op === 'mixed') {
      if (!ops.slice(0, i).includes('mark')) errors.push(`${at}: "mixed" needs "mark" before it.`);
      if (!plan.fracs!.some((f) => f[0] > f[1])) errors.push(`${at}: "mixed" needs an improper fraction in "fracs".`);
    }
    if (s.op === 'common' && dens[0] === dens[1]) errors.push(`${at}: "common" is not needed, the denominators are already the same.`);
    if (s.op === 'result' && i !== plan.steps.length - 1) errors.push(`${at}: "result" must be the last step.`);
    if (plan.kind === 'add' && s.op === 'common' && ops.includes('jump') && ops.indexOf('jump') > i) errors.push(`${at}: "jump" must come before "common".`);
  });
  if (!seen.has('show')) errors.push(`${path}: no "show" step.`);
}

/** Matrix multiplication and transpose plans: matrices that fit, steps in an order that works. */
export function checkMatrixOps(plan: MatrixOpsPlan, path: string, errors: string[]) {
  const p = moProblem(plan, path);
  if (p) return void errors.push(p);
  if (!Array.isArray(plan.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"show"}).`);
  const allowed = MO_OPS[plan.kind];
  if (plan.steps.length > 8) errors.push(`${path}.steps has ${plan.steps.length} steps; use at most 8.`);
  const seen = new Set<string>();
  const cells = new Set<string>();
  const ops = plan.steps.map((s) => s?.op as string);
  const rows = plan.a.length;
  const cols = plan.kind === 'multiply' ? plan.b![0].length : plan.a[0].length;
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if (!allowed.includes(s.op)) return void errors.push(`${at}.op "${s.op}" is not one of ${allowed.join(', ')} for kind "${plan.kind}".`);
    if (s.op === 'show') {
      if (seen.has('show')) errors.push(`${at}: "show" only once.`);
      seen.add('show');
      return;
    }
    if (!seen.has('show')) return void errors.push(`${at}: "${s.op}" needs {"op":"show"} before it.`);
    if (s.op !== 'entry' && seen.has(s.op)) errors.push(`${at}: "${s.op}" only once.`);
    seen.add(s.op);
    const before = ops.slice(0, i);
    if (s.op === 'entry') {
      const e = s as { i: number; j: number };
      const inRange = Number.isInteger(e.i) && Number.isInteger(e.j) && e.i >= 0 && e.j >= 0 && e.i < (plan.kind === 'multiply' ? rows : rows) && e.j < cols;
      if (!inRange) errors.push(`${at}: entry (${e.i}, ${e.j}) is outside the ${rows} × ${cols} ${plan.kind === 'multiply' ? 'product' : 'matrix'} (0-based row i, column j).`);
      else if (cells.has(`${e.i},${e.j}`)) errors.push(`${at}: entry (${e.i}, ${e.j}) was already used.`);
      cells.add(`${e.i},${e.j}`);
      if (plan.kind === 'multiply' && !before.includes('check')) errors.push(`${at}: "entry" needs "check" before it.`);
      if (plan.kind === 'transpose' && !before.includes('rows')) errors.push(`${at}: "entry" needs "rows" before it.`);
      if (cells.size > 4) errors.push(`${at}: use at most 4 "entry" steps.`);
    }
    if (s.op === 'all' && !before.includes('check')) errors.push(`${at}: "all" needs "check" before it.`);
    if (s.op === 'all' && i !== plan.steps.length - 1) errors.push(`${at}: "all" must be the last step.`);
  });
  if (!seen.has('show')) errors.push(`${path}: no "show" step.`);
}

/** Parallelogram and trapezium area plans: sizes that give whole areas, steps in an order that works. */
export function checkAreaFig(plan: AreaFigPlan, path: string, errors: string[]) {
  const p = afProblem(plan, path);
  if (p) return void errors.push(p);
  if (!Array.isArray(plan.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"show"}).`);
  const allowed = AF_OPS[plan.kind];
  const seen = new Set<string>();
  const ops = plan.steps.map((s) => s?.op as string);
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if (!allowed.includes(s.op)) return void errors.push(`${at}.op "${s.op}" is not one of ${allowed.join(', ')} for kind "${plan.kind}".`);
    if (s.op === 'show') {
      if (seen.has('show')) errors.push(`${at}: "show" only once.`);
      seen.add('show');
      return;
    }
    if (!seen.has('show')) return void errors.push(`${at}: "${s.op}" needs {"op":"show"} before it.`);
    if (seen.has(s.op)) errors.push(`${at}: "${s.op}" only once.`);
    seen.add(s.op);
    const before = ops.slice(0, i);
    if (s.op === 'cut' && !before.includes('height')) errors.push(`${at}: "cut" needs "height" before it.`);
    if (s.op === 'move' && !before.includes('cut')) errors.push(`${at}: "move" needs "cut" before it.`);
    if ((s.op === 'copy' || s.op === 'triangles') && !before.includes('height')) errors.push(`${at}: "${s.op}" needs "height" before it.`);
  });
  if (!seen.has('show')) errors.push(`${path}: no "show" step.`);
}

/** Coordinate geometry plans: points that fit the plane, steps in an order that works. */
export function checkCoord(plan: CoordPlan, path: string, errors: string[]) {
  const p = cgProblem(plan, path);
  if (p) return void errors.push(p);
  if (!Array.isArray(plan.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"axes"}).`);
  const allowed = CG_OPS[plan.kind];
  const seen = new Set<string>();
  const plotted = new Set<number>();
  const ops = plan.steps.map((s) => s?.op as string);
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if (!allowed.includes(s.op)) return void errors.push(`${at}.op "${s.op}" is not one of ${allowed.join(', ')} for kind "${plan.kind}".`);
    if (s.op === 'axes') {
      if (seen.has('axes')) errors.push(`${at}: "axes" only once.`);
      seen.add('axes');
      return;
    }
    if (!seen.has('axes')) return void errors.push(`${at}: "${s.op}" needs {"op":"axes"} before it.`);
    const before = ops.slice(0, i);
    if (s.op === 'plot') {
      if (plan.kind === 'points') {
        const k = (s as { i?: number }).i;
        if (!Number.isInteger(k) || (k as number) < 0 || (k as number) >= plan.points.length) errors.push(`${at}: "plot" needs "i", the 0-based number of a point (0 to ${plan.points.length - 1}).`);
        else if (plotted.has(k as number)) errors.push(`${at}: point ${k} was already plotted.`);
        else plotted.add(k as number);
      } else {
        if ((s as { i?: number }).i !== undefined) errors.push(`${at}: "plot" plots both points at once; leave out "i".`);
        if (seen.has('plot')) errors.push(`${at}: "plot" only once.`);
      }
      seen.add('plot');
      return;
    }
    if (seen.has(s.op)) errors.push(`${at}: "${s.op}" only once.`);
    seen.add(s.op);
    if (!before.includes('plot')) errors.push(`${at}: "${s.op}" needs "plot" before it.`);
    if (s.op === 'quadrant' && plotted.size < 1) errors.push(`${at}: "quadrant" needs a point plotted first.`);
    if (s.op === 'legs' && !before.includes('segment')) errors.push(`${at}: "legs" needs "segment" before it.`);
    if (s.op === 'formula' && !before.includes('legs')) errors.push(`${at}: "formula" needs "legs" before it.`);
    if (s.op === 'midpoint' && !before.includes('segment')) errors.push(`${at}: "midpoint" needs "segment" before it.`);
  });
  if (!seen.has('axes')) errors.push(`${path}: no "axes" step.`);
}

/** Plans for the visual proofs of (a + b)², (a − b)² and (a + b)(a − b): sides that fit, steps in an order that works. */
export function checkSq(plan: SqPlan, path: string, errors: string[]) {
  const p = sqProblem(plan, path);
  if (p) return void errors.push(p);
  if (!Array.isArray(plan.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"square"}).`);
  const allowed = SQ_OPS[plan.kind];
  const needs: Record<string, string[]> = plan.kind === 'sum'
    ? { tileA: ['square'], strips: ['square'], tileB: ['square'], name: ['tileA', 'strips', 'tileB'], build: ['name'], check: ['build'] }
    : plan.kind === 'difference'
      ? { strips: ['square'], corner: ['strips'], name: ['corner'], build: ['name'], check: ['build'] }
      : { remove: ['square'], cut: ['remove'], move: ['cut'], name: ['move'], build: ['name'], check: ['build'] };
  const seen = new Set<string>();
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if (!allowed.includes(s.op)) return void errors.push(`${at}.op "${s.op}" is not one of ${allowed.join(', ')} for kind "${plan.kind}".`);
    if (s.op === 'square') {
      if (seen.has('square')) errors.push(`${at}: "square" only once.`);
      seen.add('square');
      return;
    }
    if (!seen.has('square')) return void errors.push(`${at}: "${s.op}" needs {"op":"square"} before it.`);
    if (seen.has(s.op)) errors.push(`${at}: "${s.op}" only once.`);
    for (const need of needs[s.op] ?? []) if (!seen.has(need)) errors.push(`${at}: "${s.op}" needs "${need}" before it.`);
    seen.add(s.op);
  });
}

/** Balance-scale plans: an equation a x + b = c with a whole answer, steps that can be drawn in an order that works and that reach the answer. */
export function checkBal(plan: BalPlan, path: string, errors: string[]) {
  const p = balProblem(plan, path);
  if (p) return void errors.push(p);
  if (!Array.isArray(plan.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"show"}).`);
  if (plan.steps.length > 7) errors.push(`${path}.steps has ${plan.steps.length} steps; use at most 7.`);
  const d = plan.d ?? 0;
  const a2 = plan.a - d >= 2;
  const lastBeforeCheck = a2 ? 'answer' : plan.b !== 0 ? 'simplify' : 'cancel';
  const first = d > 0 ? ['cancel'] : [];
  const needs: Record<string, string[]> = {
    cancel: [],
    move: first,
    simplify: ['move'],
    divide: plan.b !== 0 ? ['simplify'] : first,
    answer: ['divide'],
    check: [lastBeforeCheck],
  };
  const seen = new Set<string>();
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if (!BAL_OPS.includes(s.op)) return void errors.push(`${at}.op "${s.op}" is not one of ${BAL_OPS.join(', ')}.`);
    if (s.op === 'show') {
      if (seen.has('show')) errors.push(`${at}: "show" only once.`);
      seen.add('show');
      return;
    }
    if (!seen.has('show')) return void errors.push(`${at}: "${s.op}" needs {"op":"show"} before it.`);
    if (seen.has(s.op)) errors.push(`${at}: "${s.op}" only once.`);
    if (s.op === 'cancel' && d === 0) errors.push(`${at}: "cancel" needs d (x tiles on the right pan); there is nothing to take off both pans.`);
    if ((s.op === 'move' || s.op === 'simplify') && plan.b === 0) errors.push(`${at}: "${s.op}" needs b ≠ 0 (there is nothing to move).`);
    if (s.op === 'divide' && !a2) errors.push(`${at}: "divide" needs a − d ≥ 2 (a single x needs no dividing).`);
    if (s.op === 'answer' && !a2) errors.push(`${at}: "answer" needs a − d ≥ 2; with one x left the earlier step already gives the answer.`);
    for (const need of needs[s.op] ?? []) if (!seen.has(need)) errors.push(`${at}: "${s.op}" needs "${need}" before it.`);
    seen.add(s.op);
  });
  for (const op of [...requiredOps(plan), ...(a2 ? ['answer'] : [])]) if (!seen.has(op)) errors.push(`${path}: the steps must reach the answer; "${op}" is missing.`);
}

/** Balance-pair plans: two equations a x + b y = c that one add or subtract can solve with whole answers, and the five steps in order. */
export function checkPair(plan: PairPlan, path: string, errors: string[]) {
  const p = pairProblem(plan, path);
  if (p) return void errors.push(p);
  if (!Array.isArray(plan.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (show, combine, solve, back, check).`);
  const want = requiredPairOps();
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if (!PAIR_OPS.includes(s.op)) return void errors.push(`${at}.op "${s.op}" is not one of ${PAIR_OPS.join(', ')}.`);
    if (s.op !== want[i]) errors.push(`${at}: step ${i + 1} must be "${want[i] ?? 'none'}" (the steps are exactly ${want.join(', ')}); got "${s.op}".`);
  });
  if (plan.steps.length < want.length) errors.push(`${path}: the steps must reach the answer; "${want[plan.steps.length]}" is missing.`);
}

/** Typeset-chain plans: every formula must parse, steps need a line on the board, and each step needs a spoken caption. */
export function checkTs(plan: TsPlan, path: string, errors: string[]) {
  const p = tsProblem(plan, path);
  if (p) return void errors.push(p);
  plan.steps.forEach((s, i) => {
    if (!s.say?.en) errors.push(`${path}.steps[${i}].say is required (the spoken caption).`);
  });
}

/** Quadratic-derivation plans: b and c make a quadratic with two whole roots, the steps come in order, and each needs a spoken caption. */
export function checkQd(plan: QdPlan, path: string, errors: string[]) {
  const p = qdProblem(plan, path);
  if (p) return void errors.push(p);
  plan.steps.forEach((s, i) => {
    if (!s.say?.en) errors.push(`${path}.steps[${i}].say is required (the spoken caption).`);
  });
}

/** HCF/LCM plans: two different whole numbers (a < b), the steps in order, and a spoken caption for each. */
export function checkHl(plan: HlPlan, path: string, errors: string[]) {
  const p = hlProblem(plan, path);
  if (p) return void errors.push(p);
  plan.steps.forEach((s, i) => {
    if (!s.say?.en) errors.push(`${path}.steps[${i}].say is required (the spoken caption).`);
  });
}
