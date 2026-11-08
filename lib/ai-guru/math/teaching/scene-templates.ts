/**
 * Parameterised scene templates (V51.9).
 *
 * The planner (LLM) does NOT draw these scenes. It names a template and supplies a few numbers; this module
 * validates the numbers, verifies the mathematics with mathjs, and builds the whole teaching segment
 * (nodes, colour bindings, tweens, counts, narration in both languages) in code. A bad parameter set returns
 * null (the template is dropped with a warning) instead of producing a wrong picture.
 *
 * Pure module: no DOM, no server-only imports - safe in tests and, if ever needed, on the client.
 */
import { evaluate, derivative as mathDerivative } from 'mathjs';
import type { AIGuruTeachingLesson, AnimationIntent, TeachingBeat, TeachingSegment } from './types';
import type { MathVisualNode } from '../universal/types';

export type TemplateLanguage = 'english' | 'malayalam';

export interface SceneTemplateContext { language: TemplateLanguage; key: string }
export interface SceneTemplateBuild {
  segment: TeachingSegment;
  colorBindings: Record<string, string>;
  params: Record<string, number>;
  /** Equations the lesson QA should verify. */
  expressions: string[];
}
export interface SceneTemplateSpec {
  id: string;
  title: string;
  /** Shown to the planner so it can choose and fill the template. */
  usage: string;
  build(params: Record<string, unknown>, ctx: SceneTemplateContext): SceneTemplateBuild | null;
}

const int = (v: unknown): number | null => { const n = Number(v); return Number.isInteger(n) ? n : null; };
const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const fmt = (n: number) => String(Math.round(n * 1e6) / 1e6);
const signed = (n: number) => (n < 0 ? `(${n})` : String(n));

function pick(language: TemplateLanguage, en: string, ml: string) { return language === 'malayalam' ? ml : en; }

function beat(id: string, en: string, ml: string, ctx: SceneTemplateContext, actions: AnimationIntent[], targets: string[], intent: TeachingBeat['visualIntent'], durationMs: number): TeachingBeat {
  const narration = pick(ctx.language, en, ml);
  return {
    id, narration, cueWords: narration.split(/\s+/).filter(Boolean).slice(0, 3), durationMs, visualIntent: intent, targetObjects: targets, actions,
    explain: { en, ml },
  };
}

const create = (node: MathVisualNode): AnimationIntent => ({ type: 'create', objectId: node.id, node });
const text = (id: string, x: number, y: number, w: number, h: number, content: string, extra: Partial<MathVisualNode> = {}, fontSize = 34): MathVisualNode =>
  ({ id, kind: 'text', x, y, width: w, height: h, content, style: { fontSize }, ...extra });
const latex = (id: string, x: number, y: number, w: number, h: number, tex: string, fontSize = 36): MathVisualNode =>
  ({ id, kind: 'latex', x, y, width: w, height: h, latex: tex, style: { fontSize } });

function segment(key: string, title: string, intuition: string, math: string, expressions: string[], beats: TeachingBeat[]): TeachingSegment {
  return {
    id: `tpl-${key}`, title, order: 0, intuition: { explanation: intuition }, mathematics: { explanation: math, expressions, verified: false },
    beats, estimatedDurationMs: beats.reduce((sum, b) => sum + (b.durationMs || 0), 0),
  };
}

/* ───────────────────────── 1. number-line jump ───────────────────────── */
const numberLineJump: SceneTemplateSpec = {
  id: 'number-line-jump',
  title: 'Adding integers on a number line',
  usage: 'params {a, b}: integers, -20..20, b != 0, |a+b| <= 25. Shows a start dot at a, a jump of b, and a live count to a+b.',
  build(params, ctx) {
    const a = int(params.a), b = int(params.b);
    if (a === null || b === null || b === 0 || Math.abs(a) > 20 || Math.abs(b) > 20) return null;
    const s = a + b;
    if (Math.abs(s) > 25 || Number(evaluate(`${a} + ${b}`)) !== s) return null;
    const p = `tpl:${ctx.key}`, U = `${ctx.key}_u`;
    const lo = Math.min(0, a, s) - 1, hi = Math.max(0, a, s) + 1;
    const X0 = 80, X1 = 920, scale = (X1 - X0) / (hi - lo), X = (v: number) => X0 + (v - lo) * scale, AY = 380;
    const tickStep = hi - lo > 20 ? 5 : 1;
    const ticks: MathVisualNode[] = [];
    for (let v = lo; v <= hi; v++) if (v % tickStep === 0 || v === a || v === s) ticks.push({ id: `${p}:tick${v}`, kind: 'line', x: X(v), y: AY - 12, startX: X(v), startY: AY - 12, endX: X(v), endY: AY + 12, style: { strokeWidth: 3 }, color: 'gray' });
    // Labels: 0, start and landing point. Drop/shift labels that would collide (they are 64px wide).
    const labels: Array<[number, number]> = [];
    const place = (v: number, row: number) => { if (!labels.some(([lv, lr]) => lr === row && Math.abs(X(lv) - X(v)) < 70)) labels.push([v, row]); };
    place(a, 0); place(s, Math.abs(X(s) - X(a)) < 70 ? 1 : 0); place(0, 0);
    const labelNodes = labels.map(([v, row]) => text(`${p}:lab${v}`, X(v) - 32, AY + 24 + row * 46, 64, 40, String(v), { colorRole: v === a ? 'a' : v === s ? 's' : undefined, color: v === 0 && v !== a && v !== s ? 'gray' : undefined }, 28));
    const direction = b > 0;
    const sumTex = `{\\color{gold}${a}}+{\\color{blue}${signed(b)}}={\\color{green}${s}}`;
    const beats: TeachingBeat[] = [
      beat(`${p}:b1`, `Start at ${a} on the number line.`, `Number line-ൽ ${a} ൽ നിന്ന് തുടങ്ങാം.`, ctx,
        [create({ id: `${p}:axis`, kind: 'line', x: X0, y: AY, startX: X0, startY: AY, endX: X1, endY: AY, style: { strokeWidth: 4 }, color: 'gray' }), ...ticks.map(create), ...labelNodes.map(create),
          create({ id: `${p}:dot`, kind: 'point', x: X(a), y: AY, bindX: `${X(a)} + ${U}*${X(s) - X(a)}`, color: 'gold', style: { radius: 13 } })],
        [`${p}:dot`], 'create', 3000),
      beat(`${p}:b2`, `Now jump ${Math.abs(b)} steps to the ${direction ? 'right' : 'left'}.`, `ഇനി ${Math.abs(b)} step ${direction ? 'വലത്തോട്ട്' : 'ഇടത്തോട്ട്'} ചാടാം.`, ctx,
        [create({ id: `${p}:jump`, kind: 'arrow', x: X(a), y: AY - 50, startX: X(a), startY: AY - 50, endX: X(s), endY: AY - 50, style: { strokeWidth: 6 }, color: 'blue' }),
          { type: 'tween', param: U, from: 0, to: 1, durationMs: 2600, together: true },
          create(text(`${p}:val`, 380, 520, 260, 50, `= ${a}`, { valueFormat: '= {v}', colorRole: 's', decimals: 0 }, 40)),
          { type: 'count', objectId: `${p}:val`, from: a, to: s, durationMs: 2600, decimals: 0, together: true }],
        [`${p}:jump`], 'move', 3600),
      beat(`${p}:b3`, `We land on ${s}. So ${a} + ${signed(b)} = ${s}.`, `നമ്മൾ ${s} ൽ എത്തി. അതായത് ${a} + ${signed(b)} = ${s}.`, ctx,
        [create(latex(`${p}:eq`, 200, 590, 600, 56, sumTex, 40)), { type: 'recolor', target: `${p}:val`, color: 'green', durationMs: 800, together: true }],
        [`${p}:eq`], 'derive', 3000),
      beat(`${p}:b4`, 'A positive number moves us right; a negative number moves us left.', 'positive number വലത്തോട്ടും negative number ഇടത്തോട്ടും നീങ്ങുന്നു.', ctx,
        [{ type: 'highlight', objectId: `${p}:eq` }, { type: 'pause', durationMs: 700 }], [`${p}:eq`], 'highlight', 2600),
    ];
    return {
      segment: segment(`${ctx.key}-numline`, 'Jumping on the number line', 'Adding is a move along the line: start, then jump.', 'The landing point is the sum.', [`${a} + ${signed(b)} = ${s}`], beats),
      colorBindings: { a: 'gold', b: 'blue', s: 'green' }, params: { [U]: 0 }, expressions: [`${a} + ${signed(b)} = ${s}`],
    };
  },
};

/* ───────── 2 & 3. area model / completing the square (shared tile scene) ───────── */
interface TileSpec { key: string; p: number; q: number; mode: 'expand' | 'square'; c?: number }

function tileScene(spec: TileSpec, ctx: SceneTemplateContext): SceneTemplateBuild {
  const { p, q, mode } = spec;
  const pre = `tpl:${ctx.key}`, L = `${ctx.key}_L`, u = 18, x0 = 60, y0 = 110, L0 = 150, L1 = 200;
  const tile = (id: string, x: number, y: number, w: number, h: number, color: string, bind: Partial<MathVisualNode>): MathVisualNode =>
    ({ id, kind: 'shape', shape: 'rectangle', x, y, width: w, height: h, color, style: { fill: color, strokeWidth: 3 }, ...bind });
  const sq = tile(`${pre}:sq`, x0, y0, L0, L0, 'gold', { bindWidth: L, bindHeight: L });
  const qx = tile(`${pre}:qx`, x0 + L0, y0, q * u, L0, mode === 'square' ? 'blue' : 'red', { bindX: `${x0} + ${L}`, bindHeight: L });
  const px = tile(`${pre}:px`, x0, y0 + L0, L0, p * u, 'blue', { bindY: `${y0} + ${L}`, bindWidth: L });
  const pq = tile(`${pre}:pq`, x0 + L0, y0 + L0, q * u, p * u, 'green', { bindX: `${x0} + ${L}`, bindY: `${y0} + ${L}` });
  const PX = 520, W = 440, prod = p * q;
  if (mode === 'expand') {
    const eq = `(x+{\\color{blue}${p}})(x+{\\color{red}${q}})=x^{2}+{\\color{purple}${p + q}}x+{\\color{green}${prod}}`;
    const beats = [
      beat(`${pre}:b1`, 'The big square has side x, so its area is x squared.', 'വലിയ square-ന്റെ side x ആണ്; അതിനാൽ area x squared.', ctx,
        [create(sq), create(latex(`${pre}:l1`, PX, 130, W, 50, 'x^{2}'))], [`${pre}:sq`], 'create', 3000),
      beat(`${pre}:b2`, `Add two strips: ${q} by x and ${p} by x.`, `രണ്ട് strips ചേർക്കാം: ${q} by x, ${p} by x.`, ctx,
        [create(qx), create(px), create(latex(`${pre}:l2`, PX, 200, W, 50, `{\\color{red}${q}}x+{\\color{blue}${p}}x`))], [`${pre}:qx`, `${pre}:px`], 'create', 3200),
      beat(`${pre}:b3`, `The corner is ${p} times ${q}, which is ${prod}.`, `മൂലയിലെ ഭാഗം ${p} × ${q} = ${prod}.`, ctx,
        [create(pq), create(text(`${pre}:l3`, PX, 270, W, 50, `${p} × ${q} = 0`, { valueFormat: `${p} × ${q} = {v}`, color: 'green', decimals: 0 }, 36)),
          { type: 'count', objectId: `${pre}:l3`, from: 0, to: prod, durationMs: 1800, decimals: 0, together: true }], [`${pre}:pq`], 'create', 3000),
      beat(`${pre}:b4`, `Together: (x+${p})(x+${q}) = x² + ${p + q}x + ${prod}, for any x.`, `എല്ലാം ചേർത്താൽ: (x+${p})(x+${q}) = x² + ${p + q}x + ${prod}, ഏത് x-നും.`, ctx,
        [create(latex(`${pre}:l4`, PX, 380, W, 56, eq, 32)), { type: 'tween', param: L, from: L0, to: L1, durationMs: 3200, together: true }, { type: 'recolor', target: 'var:x', color: 'red', durationMs: 1200, together: true }],
        [`${pre}:l4`], 'transform', 4200),
    ];
    return { segment: segment(`${ctx.key}-area`, 'Area model of a product', 'A product is an area: split the rectangle into tiles.', 'Add the tile areas.', [`(x+${p})*(x+${q}) = x^2 + ${p + q}*x + ${prod}`], beats), colorBindings: { x: 'gold' }, params: { [L]: L0 }, expressions: [`(x+${p})*(x+${q}) = x^2 + ${p + q}*x + ${prod}`] };
  }
  const h = p, b = 2 * h, c = spec.c ?? 0, total = c + h * h, root = Math.sqrt(total);
  const rootTex = Number.isInteger(root) ? `x=${-h}\\pm${root}` : `x=${-h}\\pm\\sqrt{${total}}`;
  const beats = [
    beat(`${pre}:b1`, `Start with x² + ${b}x = ${c}. Draw x² as a square of side x.`, `x² + ${b}x = ${c} ൽ തുടങ്ങാം. x² ഒരു square ആയി വരയ്ക്കാം.`, ctx,
      [create(sq), create(latex(`${pre}:l1`, PX, 130, W, 50, `x^{2}+{\\color{purple}${b}}x=${c}`))], [`${pre}:sq`], 'create', 3200),
    beat(`${pre}:b2`, `Split ${b}x into two strips, each ${h} by x.`, `${b}x രണ്ട് strips ആയി മുറിക്കാം; ഓരോന്നും ${h} by x.`, ctx,
      [create(qx), create(px), create(latex(`${pre}:l2`, PX, 200, W, 50, `{\\color{blue}${h}}x+{\\color{blue}${h}}x`))], [`${pre}:qx`, `${pre}:px`], 'create', 3200),
    beat(`${pre}:b3`, `The missing corner is ${h} by ${h}. We add ${h * h} to both sides.`, `കാണാത്ത മൂല ${h} by ${h} ആണ്. ഇരുവശത്തും ${h * h} കൂട്ടാം.`, ctx,
      [create(pq), create(text(`${pre}:l3`, PX, 270, W, 50, 'add 0', { valueFormat: 'add {v}', color: 'green', decimals: 0 }, 36)),
        { type: 'count', objectId: `${pre}:l3`, from: 0, to: h * h, durationMs: 1800, decimals: 0, together: true }], [`${pre}:pq`], 'create', 3000),
    beat(`${pre}:b4`, `Now (x+${h})² = ${total}, so x = ${-h} ± √${total}.`, `ഇപ്പോൾ (x+${h})² = ${total}; അതിനാൽ x = ${-h} ± √${total}.`, ctx,
      [create(latex(`${pre}:l4`, PX, 340, W, 56, `(x+{\\color{blue}${h}})^{2}={\\color{green}${total}}`, 36)), create(latex(`${pre}:l5`, PX, 440, W, 56, rootTex, 36)),
        { type: 'tween', param: L, from: L0, to: L1, durationMs: 3000, together: true }], [`${pre}:l4`, `${pre}:l5`], 'derive', 4200),
  ];
  const eqs = [`x^2 + ${b}*x = ${c}`];
  return { segment: segment(`${ctx.key}-square`, 'Completing the square', 'Make the missing corner so the shape becomes a perfect square.', 'Add (b/2)² to both sides.', eqs, beats), colorBindings: { x: 'gold' }, params: { [L]: L0 }, expressions: eqs };
}

const areaModel: SceneTemplateSpec = {
  id: 'area-model',
  title: 'Area model for (x+p)(x+q)',
  usage: 'params {p, q}: integers 1..9. Tiles x², qx, px, pq in matching colours; x can grow and the identity still holds.',
  build(params, ctx) {
    const p = int(params.p), q = int(params.q);
    if (p === null || q === null || p < 1 || q < 1 || p > 9 || q > 9) return null;
    for (const x of [-3, 0, 2.5, 7]) if (!close(Number(evaluate(`((${x})+${p})*((${x})+${q})`)), Number(evaluate(`(${x})^2 + ${p + q}*(${x}) + ${p * q}`)))) return null;
    return tileScene({ key: ctx.key, p, q, mode: 'expand' }, ctx);
  },
};

const completingSquare: SceneTemplateSpec = {
  id: 'completing-square',
  title: 'Completing the square with tiles',
  usage: 'params {b, c}: b even integer 2..16, c integer with c + (b/2)² > 0. Solves x² + bx = c by adding the corner tile.',
  build(params, ctx) {
    const b = int(params.b), c = int(params.c);
    if (b === null || c === null || b < 2 || b > 16 || b % 2 !== 0 || Math.abs(c) > 200) return null;
    const h = b / 2, total = c + h * h;
    if (total <= 0) return null;
    // Verify the algebra and both roots with mathjs before drawing anything.
    for (const sign of [1, -1]) {
      const r = -h + sign * Math.sqrt(total);
      if (Math.abs(Number(evaluate(`(${r})^2 + ${b}*(${r}) - ${c}`))) > 1e-7) return null;
    }
    return tileScene({ key: ctx.key, p: h, q: h, mode: 'square', c }, ctx);
  },
};

/* ───────────────────── 4. moving point + live slope ───────────────────── */
const movingPointGraph: SceneTemplateSpec = {
  id: 'moving-point-graph',
  title: 'A point sliding along y = a·x² with a live slope',
  usage: 'params {a, x0, x1}: a integer -3..3 (non-zero); x0, x1 numbers in [-3,3], x0 != x1. The point slides from x0 to x1 while x, y and slope update live.',
  build(params, ctx) {
    const a = int(params.a), x0 = num(params.x0), x1 = num(params.x1);
    if (a === null || a === 0 || Math.abs(a) > 3 || x0 === null || x1 === null || Math.abs(x0) > 3 || Math.abs(x1) > 3 || close(x0, x1)) return null;
    // mathjs verifies the derivative that drives the live slope readout.
    const slopeExpr = String(mathDerivative(`${a}*x^2`, 'x').toString());
    for (const x of [x0, x1, 0.5]) if (!close(Number(evaluate(slopeExpr, { x })), 2 * a * x, 1e-9)) return null;
    const pre = `tpl:${ctx.key}`, T = `${ctx.key}_t`;
    const yMax = a > 0 ? 9 * a + 1 : 1, yMin = a > 0 ? -1 : 9 * a - 1;
    const PX = 620, W = 340;
    const beats = [
      beat(`${pre}:b1`, `Here is the curve y = ${a === 1 ? '' : a}x². A point sits on it.`, `ഇതാ curve y = ${a === 1 ? '' : a}x². അതിൽ ഒരു point ഉണ്ട്.`, ctx,
        [create({ id: `${pre}:plot`, kind: 'plot', x: 60, y: 110, width: 520, height: 440, plot: { fn: `${a}*x^2`, xMin: -3, xMax: 3, yMin, yMax, curveColor: '#60a5fa', marker: { x: T, color: '#f87171', tangent: true } } }),
          create(latex(`${pre}:eq`, PX, 110, W, 56, `y={\\color{gold}${a}}x^{2}`, 40))], [`${pre}:plot`], 'graph', 3200),
      beat(`${pre}:b2`, 'Watch x, y and the slope of the curve at the point.', 'x, y, point-ലെ curve-ന്റെ slope എന്നിവ ശ്രദ്ധിക്കൂ.', ctx,
        [create(text(`${pre}:rx`, PX, 200, W, 48, 'x = 0', { valueExpr: T, valueFormat: 'x = {v}', colorRole: 'x', decimals: 2 }, 34)),
          create(text(`${pre}:ry`, PX, 260, W, 48, 'y = 0', { valueExpr: `${a}*${T}^2`, valueFormat: 'y = {v}', color: 'white', decimals: 2 }, 34)),
          create(text(`${pre}:rs`, PX, 320, W, 48, 'slope = 0', { valueExpr: slopeExpr.replace(/\bx\b/g, T), valueFormat: 'slope = {v}', color: 'white', decimals: 2 }, 34))], [`${pre}:rs`], 'create', 3000),
      beat(`${pre}:b3`, 'Slide the point along the curve. See how the slope changes.', 'point curve-ലൂടെ നീക്കാം. slope എങ്ങനെ മാറുന്നു എന്ന് കാണൂ.', ctx,
        [{ type: 'tween', param: T, from: x0, to: x1, durationMs: 4500 }, { type: 'recolor', target: `${pre}:rs`, color: 'yellow', durationMs: 1000, together: true }], [`${pre}:plot`], 'move', 4800),
      beat(`${pre}:b4`, `The slope here is ${2 * a}x. It grows steadily as x grows.`, `ഇവിടെ slope ${2 * a}x ആണ്. x കൂടുമ്പോൾ slope ഒരേ നിരക്കിൽ കൂടുന്നു.`, ctx,
        [create(latex(`${pre}:law`, PX, 410, W, 56, `\\text{slope}=${2 * a}x`, 36)), { type: 'pause', durationMs: 700 }], [`${pre}:law`], 'derive', 3000),
    ];
    return { segment: segment(`${ctx.key}-slope`, 'Slope along a parabola', 'The steepness of the curve changes from point to point.', `For y = ${a}x² the slope is ${2 * a}x.`, [], beats), colorBindings: { a: 'gold', x: 'red' }, params: { [T]: x0 }, expressions: [] };
  },
};

export const SCENE_TEMPLATES: SceneTemplateSpec[] = [numberLineJump, areaModel, completingSquare, movingPointGraph];

export function sceneTemplateCatalog(): string {
  return SCENE_TEMPLATES.map(t => `- ${t.id}: ${t.title}. ${t.usage}`).join('\n');
}

export interface ExpandedTemplates { segments: TeachingSegment[]; colorBindings: Record<string, string>; params: Record<string, number>; expressions: string[]; warnings: string[] }

/**
 * Turn the planner's `sceneTemplates` requests into verified segments. At most one template per lesson is used,
 * because every template owns the whole board. Invalid requests are dropped with a warning.
 */
export function expandSceneTemplates(requests: unknown, opts: { language: TemplateLanguage; startOrder: number; segmentRoom: number }): ExpandedTemplates {
  const out: ExpandedTemplates = { segments: [], colorBindings: {}, params: {}, expressions: [], warnings: [] };
  if (!Array.isArray(requests) || !requests.length) return out;
  if (opts.segmentRoom < 1) { out.warnings.push('Scene template skipped: the lesson already has the maximum number of segments for this grade.'); return out; }
  const req = requests[0] as { id?: unknown; params?: unknown };
  const spec = SCENE_TEMPLATES.find(t => t.id === String(req?.id ?? ''));
  if (!spec) { out.warnings.push(`Unknown scene template "${String(req?.id ?? '')}" ignored.`); return out; }
  const params = req.params && typeof req.params === 'object' ? req.params as Record<string, unknown> : {};
  let built: SceneTemplateBuild | null = null;
  try { built = spec.build(params, { language: opts.language, key: 'm1' }); } catch { built = null; }
  if (!built) { out.warnings.push(`Scene template "${spec.id}" rejected: parameters failed validation or mathjs verification.`); return out; }
  built.segment.order = opts.startOrder;
  out.segments.push(built.segment); out.colorBindings = built.colorBindings; out.params = built.params; out.expressions = built.expressions;
  return out;
}

/** Apply expanded template segments to a normalised lesson (adds segments, bindings, params and QA expressions). */
export function applySceneTemplates(lesson: AIGuruTeachingLesson, requests: unknown, language: TemplateLanguage): string[] {
  const maxSegments = lesson.difficulty?.maxSegments ?? 7;
  const startOrder = lesson.segments.reduce((m, s) => Math.max(m, s.order), -1) + 1;
  const expanded = expandSceneTemplates(requests, { language, startOrder, segmentRoom: maxSegments - lesson.segments.length });
  if (expanded.segments.length) {
    lesson.segments.push(...expanded.segments);
    lesson.colorBindings = { ...(lesson.colorBindings ?? {}), ...expanded.colorBindings };
    lesson.params = { ...(lesson.params ?? {}), ...expanded.params };
  }
  return expanded.warnings;
}
