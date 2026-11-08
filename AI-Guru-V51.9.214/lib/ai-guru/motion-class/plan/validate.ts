/**
 * Plan validation: structure, both languages, buildability, and maths.
 * Every error is a short sentence the AI can act on in its retry.
 */

import { SKETCH_DNA, sketchProblems, type SketchPlan } from '../dna/sketch-math';
import { sketchLayoutProblems } from '../dna/sketch-builders';
import { boardProblems } from '../dna/concept-math';
import { verifyDerivation } from '../../reels/motion/verify';
import { buildDnaScenes, chainToDerivation, solverChain, tokenize } from '../dna/builders';
import type { BlockPlan, BoardPlan, Bi, ChainPlan, CompositePlan, DnaId, WordProblemPlan } from '../dna/types';
import { DNA_BY_ID } from '../dna/registry';
import { introProblems } from '../dna/ci-math';
import { isValidExpr, evalExpr } from '../../math/animation/expr';
import { matApply, matMul, matDet, IDENT, type Mat } from '../../reels/motion/plane';
import { visualStats } from './visual-qa';
import type { FractionPlan, GraphPlan, HistogramPlan, MatrixPlan, PlanePlan, ShapePlan, TreePlan, TrigPlan, VennPlan, LinPlan, SeqPlan, QuadPlan, PolyPlan, AnglePlan, SolidPlan, RatioPlan, BalPlan, PairPlan, PiePlan, FracLinePlan, MatrixOpsPlan, AreaFigPlan, CoordPlan, SqPlan, TsPlan, QdPlan, HlPlan, ChapterIntroPlan } from '../dna/types';
import { checkFractions, checkHistogram, checkAngle, checkSolid, checkRatio, checkPie, checkFracLine, checkMatrixOps, checkAreaFig, checkCoord, checkSq, checkBal, checkPair, checkTs, checkQd, checkHl, checkLinear, checkPoly, checkQuad, checkSeq, checkMatrix, checkShape, checkTree, checkTrig, checkVenn } from './validate-board';

const ML = /[ഀ-ൿ]/;

function checkBi(b: unknown, path: string, errors: string[], needMl: boolean) {
  if (!b || typeof b !== 'object' || typeof (b as Bi).en !== 'string' || !(b as Bi).en.trim()) {
    errors.push(`${path}.en is missing.`);
    return;
  }
  if (!needMl) return;
  const ml = (b as Bi).ml;
  const en = (b as Bi).en;
  if (typeof ml !== 'string' || !ml.trim()) errors.push(`${path}.ml (Malayalam) is missing.`);
  else if (/[A-Za-z]{4,}/.test(en.replace(/\b(cm|sq|kg)\b/g, '')) && !ML.test(ml)) errors.push(`${path}.ml must be written in Malayalam script, not English.`);
}

/** Walks a plan and checks every bilingual field. */
function checkAllBi(x: unknown, path: string, errors: string[], needMl: boolean) {
  if (!x || typeof x !== 'object') return;
  if (Array.isArray(x)) return x.forEach((v, i) => checkAllBi(v, `${path}[${i}]`, errors, needMl));
  const o = x as Record<string, unknown>;
  if ('en' in o && typeof o.en === 'string') return checkBi(o, path, errors, needMl);
  for (const [k, v] of Object.entries(o)) checkAllBi(v, `${path}.${k}`, errors, needMl);
}

function checkTokens(tokens: unknown, path: string, errors: string[]) {
  if (!Array.isArray(tokens) || !tokens.length || !tokens.every((t) => typeof t === 'string' && t.length > 0)) {
    errors.push(`${path} must be a non-empty array of string tokens like ["2","x","+","5","=","25"].`);
    return;
  }
  const joined = (tokens as string[]).join(' ');
  if ((tokens as string[]).some((t) => t.length > 14 && !/^\{.*\}$/.test(t))) errors.push(`${path}: split long tokens into single numbers, letters and symbols (got "${joined}").`);
}

function checkChain(plan: ChainPlan, path: string, errors: string[]) {
  if (!Array.isArray(plan?.lines) || !plan.lines.length) {
    errors.push(`${path}.lines must have at least one line.`);
    return;
  }
  plan.lines.forEach((l, i) => checkTokens(l.tokens, `${path}.lines[${i}].tokens`, errors));
  if (errors.length) return;
  const hasLetters = plan.lines.some((l) => l.check !== false && l.tokens.some((t) => /^[a-z]$/i.test(t)));
  if (hasLetters && !plan.solutions?.length) {
    errors.push(`${path}.solutions is required (values of the letters that make every line true), e.g. [{"x":55}].`);
    return;
  }
  const bad = verifyDerivation(chainToDerivation(plan, 'en', ''), plan.solutions ?? [{}]).filter((r) => !r.ok);
  for (const b of bad) {
    const line = plan.lines[b.line].tokens.join(' ');
    errors.push(`${path}.lines[${b.line}] "${line}" is not true for ${JSON.stringify(plan.solutions ?? {})}${b.error ? ` (${b.error})` : ''}. Fix the maths or set "check": false only for non-equation text lines.`);
  }
}

function checkWordProblem(plan: WordProblemPlan, path: string, errors: string[]) {
  if (!Array.isArray(plan.unknowns) || !plan.unknowns.length) errors.push(`${path}.unknowns must name at least one letter.`);
  if (!Array.isArray(plan.equations) || !plan.equations.length) errors.push(`${path}.equations must translate the conditions into equations.`);
  plan.equations?.forEach((e, i) => checkTokens(e.tokens, `${path}.equations[${i}].tokens`, errors));
  if (plan.solvedLater && !plan.solution?.solver && !plan.solution?.lines?.length) {
    // Modelled here, solved by the following textbook blocks.
  } else if (plan.solution?.solver) {
    const c = solverChain(plan.solution.solver);
    if (!c) errors.push(`${path}.solution.solver "${plan.solution.solver}" could not be solved; give explicit solution.lines instead.`);
  } else if (plan.solution?.lines?.length) {
    checkChain({ lines: plan.solution.lines, solutions: plan.solutions }, `${path}.solution`, errors);
  } else errors.push(`${path}.solution needs "solver" or "lines".`);
  // The equations themselves must hold for the answer.
  if (plan.solutions?.length && plan.equations?.length) {
    const asChain: ChainPlan = { lines: plan.equations.map((e) => ({ tokens: e.tokens, caption: e.phrase, fresh: true })), solutions: plan.solutions };
    const errs: string[] = [];
    checkChain(asChain, `${path}.equations`, errs);
    errors.push(...errs.map((e) => e.replace('.lines[', '[')));
  }
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function fnOk(src: unknown, from: number, to: number, yMin: number, yMax: number, path: string, errors: string[]) {
  if (typeof src !== 'string' || !src.trim()) return void errors.push(`${path} must be a formula in x, like "2x+1" or "x^2".`);
  const clean = src.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/^\s*y\s*=\s*/i, '');
  if (!isValidExpr(clean)) return void errors.push(`${path} "${src}" is not a valid formula (use x, numbers, + - * / ^ ( ) and sin cos tan sqrt abs ln exp pi).`);
  const tol = (yMax - yMin) * 0.002;
  for (let i = 0; i <= 60; i++) {
    const x = from + ((to - from) * i) / 60;
    const y = evalExpr(clean, { x });
    if (!Number.isFinite(y)) return void errors.push(`${path} "${src}" has no value at x = ${+x.toFixed(3)}; choose from/to where it is defined.`);
    if (y < yMin - tol || y > yMax + tol) return void errors.push(`${path} "${src}" leaves the picture at x = ${+x.toFixed(3)} (y = ${+y.toFixed(3)}, picture is ${yMin} … ${yMax}); change from/to or yMin/yMax.`);
  }
}

function checkGraph(plan: GraphPlan, path: string, errors: string[]) {
  const { xMin, xMax, yMin, yMax } = plan ?? ({} as GraphPlan);
  if (![xMin, xMax, yMin, yMax].every(finite) || xMin >= xMax || yMin >= yMax || xMax - xMin > 1000 || yMax - yMin > 1000) {
    errors.push(`${path}: xMin < xMax and yMin < yMax must be numbers (picture box).`);
    return;
  }
  if (!Array.isArray(plan.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"axes"}).`);
  let curve: { fn: string; from: number; to: number } | null = null;
  let drawn = 0;
  const inBox = (p: unknown, at: string) => {
    if (!Array.isArray(p) || p.length !== 2 || !p.every(finite)) return void errors.push(`${at} must be [x, y] numbers.`);
    if (p[0] < xMin || p[0] > xMax || p[1] < yMin || p[1] > yMax) errors.push(`${at} = [${p[0]}, ${p[1]}] is outside the picture (${xMin}…${xMax}, ${yMin}…${yMax}).`);
  };
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    if ('label' in s && typeof s.label === 'string' && s.label.length > 18) errors.push(`${at}.label "${s.label}" is too long (max 18 characters).`);
    switch (s.op) {
      case 'axes':
        break;
      case 'curve': {
        const from = s.from ?? xMin;
        const to = s.to ?? xMax;
        if (!finite(from) || !finite(to) || from >= to || from < xMin || to > xMax) errors.push(`${at}: from < to, both inside xMin…xMax.`);
        else fnOk(s.fn, from, to, yMin, yMax, `${at}.fn`, errors);
        curve = { fn: s.fn, from, to };
        drawn++;
        break;
      }
      case 'point':
        inBox(s.at, `${at}.at`);
        drawn++;
        break;
      case 'tracker':
        if (!curve) errors.push(`${at}: a tracker needs a curve before it.`);
        else if (!Array.isArray(s.stops) || s.stops.length < 2 || s.stops.length > 6 || !s.stops.every((x) => finite(x) && x >= curve!.from && x <= curve!.to)) errors.push(`${at}.stops must be 2–6 numbers inside the curve's x range (${curve.from}…${curve.to}).`);
        break;
      case 'shade':
        if (!curve) errors.push(`${at}: shading needs a curve before it.`);
        else if (!finite(s.from) || !finite(s.to) || s.from >= s.to || s.from < curve.from || s.to > curve.to) errors.push(`${at}: from < to, inside the curve's x range (${curve.from}…${curve.to}).`);
        break;
      case 'morph':
        if (!curve) errors.push(`${at}: morph needs a curve before it.`);
        else {
          fnOk(s.fn, curve.from, curve.to, yMin, yMax, `${at}.fn`, errors);
          curve = { ...curve, fn: s.fn };
        }
        break;
      case 'segment':
        inBox(s.from, `${at}.from`);
        inBox(s.to, `${at}.to`);
        drawn++;
        break;
      default:
        errors.push(`${at}.op "${(s as { op?: string }).op}" is not one of axes, curve, point, tracker, shade, morph, segment.`);
    }
  });
  if (!drawn) errors.push(`${path}: draw at least one curve, point or segment.`);
}

function checkPlane(plan: PlanePlan, path: string, errors: string[]) {
  const xMax = plan?.xMax ?? 5;
  const yMax = plan?.yMax ?? 4;
  if (!finite(xMax) || !finite(yMax) || xMax < 2 || xMax > 12 || yMax < 2 || yMax > 8) return void errors.push(`${path}: xMax must be 2–12 and yMax 2–8.`);
  if (!Array.isArray(plan.steps) || !plan.steps.length) return void errors.push(`${path}.steps must list the steps (start with {"op":"grid"}).`);
  // Track where every point the plan places ends up, so nothing flies off the board.
  let cur: Mat = IDENT;
  const placed: Array<{ p: [number, number]; what: string }> = [{ p: [1, 0], what: 'î' }, { p: [0, 1], what: 'ĵ' }];
  const check = (stepNo: number) => {
    for (const q of placed) {
      const [x, y] = matApply(cur, q.p);
      if (Math.abs(x) > xMax + 1e-9 || Math.abs(y) > yMax + 1e-9) {
        errors.push(`${path}.steps[${stepNo}]: ${q.what} (${q.p.join(', ')}) lands at (${+x.toFixed(2)}, ${+y.toFixed(2)}), outside the plane (±${xMax}, ±${yMax}). Use a smaller matrix, smaller shapes, or a larger xMax/yMax.`);
        return;
      }
    }
  };
  const pt = (p: unknown, at: string): p is [number, number] => {
    const ok = Array.isArray(p) && p.length === 2 && p.every(finite);
    if (!ok) errors.push(`${at} must be [x, y] numbers.`);
    return ok;
  };
  plan.steps.forEach((s, i) => {
    const at = `${path}.steps[${i}]`;
    if (!s || typeof s !== 'object') return void errors.push(`${at} is not an object.`);
    if (!s.say?.en) errors.push(`${at}.say is required (the spoken caption).`);
    switch (s.op) {
      case 'grid':
      case 'basis':
      case 'matrix':
      case 'square':
      case 'det':
        if (s.op === 'square') placed.push({ p: [1, 1], what: 'the unit square' });
        break;
      case 'vector':
        if (pt(s.v, `${at}.v`)) placed.push({ p: s.v, what: 'the vector' });
        if (s.label && s.label.length > 6) errors.push(`${at}.label "${s.label}" is too long (max 6 characters).`);
        break;
      case 'combine':
        if (pt(s.v, `${at}.v`)) placed.push({ p: s.v, what: 'the vector' }, { p: [s.v[0], 0], what: 'the î part' });
        break;
      case 'shape':
        if (!Array.isArray(s.points) || s.points.length < 3 || s.points.length > 8) errors.push(`${at}.points must be 3–8 vertices [x, y].`);
        else s.points.forEach((p, k) => pt(p, `${at}.points[${k}]`) && placed.push({ p, what: 'a shape corner' }));
        break;
      case 'transform': {
        const M = s.matrix;
        if (!Array.isArray(M) || M.length !== 4 || !M.every((v) => finite(v) && Math.abs(v) <= 4)) {
          errors.push(`${at}.matrix must be [a, b, c, d] numbers with |entries| ≤ 4.`);
          break;
        }
        cur = matMul(M as Mat, cur);
        if (s.name?.en && s.name.en.length > 14) errors.push(`${at}.name.en "${s.name.en}" is too long (max 14 characters).`);
        break;
      }
      case 'reset':
        cur = IDENT;
        break;
      default:
        errors.push(`${at}.op "${(s as { op?: string }).op}" is not one of grid, basis, vector, combine, shape, square, matrix, transform, det, reset.`);
    }
    if (!errors.length) check(i);
  });
  void matDet;
}

export function validatePlan(dna: DnaId, teach: unknown, read: Bi | undefined, needMl = true, path = 'teach'): string[] {
  const errors: string[] = [];
  if (read !== undefined) {
    if (!read?.en?.trim()) errors.push('read.en (the textbook text) is missing.');
    if (needMl && (!read?.ml?.trim() || !ML.test(read.ml))) errors.push('read.ml must be the Malayalam translation of the text, in Malayalam script.');
  }
  if (dna === 'bridge') return errors;
  if (!teach || typeof teach !== 'object') return [...errors, `${path} is missing.`];
  const known = DNA_BY_ID.has(dna) || dna === 'ai-custom' || dna === SKETCH_DNA || dna.startsWith('learned:');
  if (!known) return [...errors, `Unknown DNA "${dna}".`];

  checkAllBi(teach, path, errors, needMl);
  switch (dna) {
    case 'equation-chain':
    case 'equation-pair':
    case 'identity-formula':
    case 'mental-math':
      checkChain(teach as ChainPlan, path, errors);
      break;
    case 'section-intro':
    case 'concept-board':
      errors.push(...boardProblems(teach as BoardPlan, path));
      break;
    case 'word-problem':
      checkWordProblem(teach as WordProblemPlan, path, errors);
      break;
    case 'function-graph':
      checkGraph(teach as GraphPlan, path, errors);
      break;
    case 'plane-transform':
      checkPlane(teach as PlanePlan, path, errors);
      break;
    case 'fraction-bars':
      checkFractions(teach as FractionPlan, path, errors);
      break;
    case 'histogram':
      checkHistogram(teach as HistogramPlan, path, errors);
      break;
    case 'probability-tree':
      checkTree(teach as TreePlan, path, errors);
      break;
    case 'matrix-grid':
      checkMatrix(teach as MatrixPlan, path, errors);
      break;
    case 'shape-formula':
      checkShape(teach as ShapePlan, path, errors);
      break;
    case 'venn-sets':
      checkVenn(teach as VennPlan, path, errors);
      break;
    case 'unit-circle':
      checkTrig(teach as TrigPlan, path, errors);
      break;
    case 'linear-system':
      checkLinear(teach as LinPlan, path, errors);
      break;
    case 'arithmetic-sequence':
      checkSeq(teach as SeqPlan, path, errors);
      break;
    case 'quadratic-equation':
      checkQuad(teach as QuadPlan, path, errors);
      break;
    case 'polynomial':
      checkPoly(teach as PolyPlan, path, errors);
      break;
    case 'angle-geometry':
      checkAngle(teach as AnglePlan, path, errors);
      break;
    case 'solid-figure':
      checkSolid(teach as SolidPlan, path, errors);
      break;
    case 'ratio-percent':
      checkRatio(teach as RatioPlan, path, errors);
      break;
    case 'pie-chart':
      checkPie(teach as PiePlan, path, errors);
      break;
    case 'coordinate-geometry':
      checkCoord(teach as CoordPlan, path, errors);
      break;
    case 'square-identity':
      checkSq(teach as SqPlan, path, errors);
      break;
    case 'balance-scale':
      checkBal(teach as BalPlan, path, errors);
      break;
    case 'balance-pair':
      checkPair(teach as PairPlan, path, errors);
      break;
    case 'typeset-chain':
      checkTs(teach as TsPlan, path, errors);
      break;
    case 'hcf-lcm':
      checkHl(teach as HlPlan, path, errors);
      break;
    case 'quadratic-derivation':
      checkQd(teach as QdPlan, path, errors);
      break;
    case 'area-figure':
      checkAreaFig(teach as AreaFigPlan, path, errors);
      break;
    case 'matrix-ops':
      checkMatrixOps(teach as MatrixOpsPlan, path, errors);
      break;
    case 'fraction-line':
      checkFracLine(teach as FracLinePlan, path, errors);
      break;
    case 'chapter-intro':
      errors.push(...introProblems(teach as ChapterIntroPlan, path));
      break;
    case SKETCH_DNA: {
      // V51.9.50: a free sketch — structure first, then text that overlaps or leaves the board (both languages).
      const p = sketchProblems(teach as SketchPlan, path);
      errors.push(...p);
      if (!p.length) errors.push(...sketchLayoutProblems(teach as SketchPlan).map((m) => `${path}: ${m}`));
      break;
    }
    case 'ai-custom':
    default:
      if (dna === 'ai-custom' || dna.startsWith('learned:')) {
        const c = teach as CompositePlan;
        if (!Array.isArray(c.segments) || !c.segments.length) errors.push(`${path}.segments must list the DNA segments of the new template.`);
        c.segments?.forEach((s, i) => {
          if (!(DNA_BY_ID.has(s.dna) || s.dna === SKETCH_DNA) || (s.dna as string) === 'bridge') errors.push(`${path}.segments[${i}].dna "${s.dna}" is not a built-in DNA.`);
          else errors.push(...validatePlan(s.dna, s.plan, undefined, needMl, `${path}.segments[${i}].plan`));
        });
      }
  }
  if (errors.length) return errors;
  // Finally: it must actually build, in both languages.
  for (const lang of needMl ? (['en', 'ml'] as const) : (['en'] as const)) {
    try {
      const scenes = buildDnaScenes(dna, teach, lang, 'check');
      if (!scenes.length) errors.push(`${path} produced no scenes.`);
      else if (dna === 'function-graph' || dna === 'plane-transform' || dna === 'fraction-bars' || dna === 'histogram' || dna === 'probability-tree') {
        const v = visualStats(scenes);
        if (v.graphics < (dna === 'function-graph' || dna === 'plane-transform' ? 8 : 6)) errors.push(`${path} draws almost nothing (${v.graphics} drawings); add more steps.`);
      }
    } catch (e) {
      errors.push(`${path} does not build (${lang}): ${(e as Error).message}`);
    }
  }
  return errors;
}

export function validateBlockPlan(p: BlockPlan, needMl = true): string[] {
  return validatePlan(p.dna, p.teach, p.read, needMl);
}

/** Small helper for planners: textbook maths line → tokens. */
export const toTokens = tokenize;
