import type { VisualPattern, Params } from './types';
import { Builder, CANVAS, COLORS, CYCLE, clipSegment, fmt, isNumeric, list, niceStep, num, obj, str } from './geom';

/* ------------------------------------------------------------------------------------------------
 * AI Guru visual pattern catalog.
 * Every pattern is a pure function: parameters in -> VisualAction[] out (1000x700 board, labels are
 * SVG text placed at x,y). They are deterministic, inside the frame and covered by tests, so the
 * Visual Developer agent only has to choose a pattern and supply the real numbers of the step.
 * ---------------------------------------------------------------------------------------------- */

const pfx = (id: string, o?: { idPrefix?: string }) => o?.idPrefix || `vp-${id}`;
/** #rrggbb -> rgba(): 8-digit hex is not understood by every SVG renderer. */
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Shared number-line drawing, used by "number-line" and "number-line-jumps". */
function drawNumberLine(b: Builder, min: number, max: number, step: number, y: number) {
  const x0 = 80, x1 = 920;
  const px = (v: number) => x0 + ((v - min) / (max - min)) * (x1 - x0);
  b.arrow(x0 - 20, y, x1 + 20, y, { stroke: COLORS.muted, width: 4 });
  b.arrow(x1 + 20, y, x0 - 20, y, { stroke: COLORS.muted, width: 4 });
  const count = Math.floor((max - min) / step + 1e-9);
  for (let i = 0; i <= count; i++) {
    const v = Number((min + i * step).toFixed(6));
    b.line(px(v), y - 10, px(v), y + 10, { stroke: COLORS.muted, width: 3, ms: 80 });
    b.text(fmt(v), px(v), y + 42, { size: 22, color: COLORS.muted, ms: 80 });
  }
  return px;
}
function safeStep(min: number, max: number, want: unknown): number {
  let step = num(want, niceStep(min, max), 1e-6);
  if ((max - min) / step > 24) step = niceStep(min, max);
  return step;
}

const numberLine: VisualPattern = {
  id: 'number-line',
  name: 'Number line with marked points / ray',
  summary: 'A labelled number line with open/closed points and an optional shaded ray.',
  whenToUse: 'Inequalities, integers, ordering numbers, absolute value, solution sets, comparing decimals and fractions.',
  domains: ['algebra', 'arithmetic', 'number-system'],
  concepts: ['number line', 'inequality', 'solution set', 'integers', 'ordering', 'absolute value', 'ray', 'interval'],
  keywords: ['greater than', 'less than', 'at least', 'at most', 'open circle', 'closed circle', 'x > 3', 'x <= 2', 'mark', 'plot number'],
  signals: [/number line|inequalit|[<>\u2264\u2265]\s*-?\d|\bx\s*[<>]|solution set|interval|absolute value|ordering|decimals?/i],
  params: [
    { name: 'min', type: 'number', description: 'left end of the line', default: -5 },
    { name: 'max', type: 'number', description: 'right end of the line', default: 5 },
    { name: 'step', type: 'number', description: 'distance between ticks', default: 1 },
    { name: 'marks', type: 'object[]', description: 'points to mark: {value, label?, style: "closed"|"open"|"dot"}. Plain numbers are allowed.', default: [] },
    { name: 'ray', type: 'object', description: 'shaded ray: {from, direction: "left"|"right", closed: boolean}' },
  ],
  example: { min: -2, max: 8, marks: [{ value: 3, label: 'x = 3', style: 'open' }], ray: { from: 3, direction: 'right', closed: false } },
  build(p, o) {
    const b = new Builder(pfx('number-line', o));
    let min = num(p.min, -5), max = num(p.max, 5);
    if (max <= min) max = min + 10;
    const step = safeStep(min, max, p.step);
    const y = 350;
    const px = drawNumberLine(b, min, max, step, y);
    const ray = obj(p.ray);
    if (ray.from != null) {
      const from = Math.min(max, Math.max(min, num(ray.from, 0)));
      const right = str(ray.direction, 'right') !== 'left';
      b.arrow(px(from), y, right ? 940 : 60, y, { stroke: COLORS.amber, width: 9 });
    }
    const marks = list(p.marks).slice(0, 8);
    marks.forEach((m, i) => {
      const mo = typeof m === 'object' && m !== null ? obj(m) : { value: m };
      const v = num(mo.value, NaN);
      if (!Number.isFinite(v) || v < min || v > max) return;
      const style = str(mo.style, 'dot', 10);
      const color = CYCLE[i % CYCLE.length];
      b.circle(px(v), y, 13, { fill: style === 'open' ? COLORS.bg : color, stroke: color, width: 4, ms: 250 });
      b.text(str(mo.label, fmt(v)), px(v), y - 34, { size: 26, color });
    });
    if (ray.from != null) {
      const from = num(ray.from, 0);
      if (from >= min && from <= max) b.circle(px(from), y, 13, { fill: ray.closed ? COLORS.amber : COLORS.bg, stroke: COLORS.amber, width: 4, ms: 250 });
    }
    return b.actions;
  },
};

const numberLineJumps: VisualPattern = {
  id: 'number-line-jumps',
  name: 'Number line with jumps (integer addition and subtraction)',
  summary: 'Start at a number and hop right for addition or left for subtraction; the result is marked.',
  whenToUse: 'Integer addition and subtraction with negative numbers, counting on or back, showing why 5 - 8 = -3.',
  domains: ['arithmetic', 'number-system'],
  concepts: ['integer addition', 'integer subtraction', 'integers', 'negative numbers', 'number line', 'counting on'],
  keywords: ['jump', 'hop', 'plus', 'minus', 'move right', 'move left', 'below zero', 'add integers', 'subtract integers'],
  signals: [/negative|integer|below zero|number line|counting (on|back)|(^|[\s(=,])[-\u2212]\d/i],
  params: [
    { name: 'start', type: 'number', description: 'where the hopping starts', default: 0 },
    { name: 'jumps', type: 'number[]', description: 'signed jumps, e.g. [3, -5]', default: [] },
  ],
  example: { start: 5, jumps: [-8] },
  build(p, o) {
    const b = new Builder(pfx('number-line-jumps', o));
    const start = num(p.start, 0);
    const jumps = list(p.jumps).map((j) => num(j, 0)).filter((j) => j !== 0).slice(0, 5);
    const stops = [start]; for (const j of jumps) stops.push(stops[stops.length - 1] + j);
    let min = Math.floor(Math.min(...stops)) - 1, max = Math.ceil(Math.max(...stops)) + 1;
    if (max - min < 8) { const c = (max + min) / 2; min = Math.floor(c - 4); max = min + 8; }
    const y = 400;
    const px = drawNumberLine(b, min, max, safeStep(min, max, 1), y);
    b.dot(px(start), y, COLORS.cyan, 11);
    jumps.forEach((j, i) => {
      const a = px(stops[i]), z = px(stops[i + 1]), col = CYCLE[i % CYCLE.length];
      const lift = 80 + (i % 2) * 22, dir = Math.sign(z - a);
      b.line(a, y - 10, a + dir * 14, y - lift, { stroke: col, width: 5 });
      b.line(a + dir * 14, y - lift, z - dir * 14, y - lift, { stroke: col, width: 5 });
      b.arrow(z - dir * 14, y - lift, z, y - 12, { stroke: col, width: 5 });
      b.text(`${j > 0 ? '+' : '\u2212'}${fmt(Math.abs(j))}`, (a + z) / 2, y - lift - 16, { size: 30, color: col });
    });
    const end = stops[stops.length - 1];
    b.dot(px(end), y, COLORS.green, 12);
    b.text(`${fmt(start)}${jumps.map((j) => ` ${j > 0 ? '+' : '\u2212'} ${fmt(Math.abs(j))}`).join('')} = ${fmt(end)}`, 500, 560, { size: 38, color: COLORS.green });
    return b.actions;
  },
};

const rightTriangle: VisualPattern = {
  id: 'right-triangle',
  name: 'Right triangle with labelled sides (Pythagoras)',
  summary: 'A right-angled triangle with the right-angle mark, side labels and the theorem written beside it with the working.',
  whenToUse: 'Pythagoras theorem, finding a missing side, trigonometric ratios (opposite/adjacent/hypotenuse), area of a right triangle.',
  domains: ['geometry', 'trigonometry'],
  concepts: ['pythagoras theorem', 'right triangle', 'hypotenuse', 'missing side', 'trigonometric ratio', 'sine', 'cosine', 'tangent'],
  keywords: ['right angle', 'legs', 'adjacent', 'opposite', 'square of hypotenuse', 'a squared', 'triangle sides', '3 4 5'],
  signals: [/pythagor|hypotenuse|right[- ]angled|right triangle|\b(sin|cos|tan)\b|sine|cosine|tangent|opposite|adjacent/i],
  params: [
    { name: 'a', type: 'string', description: 'vertical leg: number or letter', default: 'a' },
    { name: 'b', type: 'string', description: 'horizontal leg: number or letter', default: 'b' },
    { name: 'c', type: 'string', description: 'hypotenuse: number or letter', default: 'c' },
    { name: 'vertices', type: 'string[]', description: 'names of the corners [right angle, right end, top]', default: ['A', 'B', 'C'] },
    { name: 'formula', type: 'string', description: 'line written beside the triangle', default: 'a\u00b2 + b\u00b2 = c\u00b2' },
    { name: 'working', type: 'string[]', description: 'extra lines under the formula (each a step of the working)' },
  ],
  example: { a: 3, b: 4, c: 5, formula: 'a\u00b2 + b\u00b2 = c\u00b2', working: ['3\u00b2 + 4\u00b2 = c\u00b2', '9 + 16 = c\u00b2', 'c = 5'] },
  build(p, o) {
    const b = new Builder(pfx('right-triangle', o));
    const A = str(p.a, 'a', 12), B = str(p.b, 'b', 12), C = str(p.c, 'c', 12);
    const va = num(p.a, 3, 0.1), vb = num(p.b, 4, 0.1);
    const m = Math.max(va, vb);
    const la = Math.max(110, (360 * va) / m), lb = Math.max(110, (360 * vb) / m);
    const x0 = 120, y0 = 560;
    const [nA, nB, nC] = [0, 1, 2].map((i) => str(list(p.vertices)[i], ['A', 'B', 'C'][i], 3));
    b.line(x0, y0, x0 + lb, y0, { stroke: COLORS.cyan, width: 5 });
    b.line(x0, y0, x0, y0 - la, { stroke: COLORS.cyan, width: 5 });
    b.line(x0 + lb, y0, x0, y0 - la, { stroke: COLORS.amber, width: 5 });
    b.line(x0 + 30, y0, x0 + 30, y0 - 30, { stroke: COLORS.muted, width: 3, ms: 150 });
    b.line(x0, y0 - 30, x0 + 30, y0 - 30, { stroke: COLORS.muted, width: 3, ms: 150 });
    b.text(nA, x0 - 26, y0 + 30, { size: 26, color: COLORS.muted });
    b.text(nB, x0 + lb + 26, y0 + 30, { size: 26, color: COLORS.muted });
    b.text(nC, x0 - 26, y0 - la - 12, { size: 26, color: COLORS.muted });
    b.text(B, x0 + lb / 2, y0 + 44, { size: 30, color: COLORS.cyan });
    b.text(A, x0 - 30, y0 - la / 2 + 8, { size: 30, color: COLORS.cyan, anchor: 'end' });
    const len = Math.hypot(lb, la), nx = la / len, ny = lb / len;
    b.text(C, x0 + lb / 2 + nx * 40, y0 - la / 2 - ny * 34, { size: 30, color: COLORS.amber });
    b.text(str(p.formula, 'a\u00b2 + b\u00b2 = c\u00b2', 40), 560, 240, { size: 38, color: COLORS.amber, anchor: 'start' });
    list(p.working).slice(0, 6).forEach((w, i) => b.text(str(w, '', 40), 560, 300 + i * 56, { size: 34, color: i === list(p.working).length - 1 ? COLORS.green : COLORS.ink, anchor: 'start' }));
    return b.actions;
  },
};

const triangleAngles: VisualPattern = {
  id: 'triangle-angles',
  name: 'Triangle with its three angles (angle sum)',
  summary: 'A triangle drawn from two given angles, each angle written at its corner, with the 180\u00b0 sum below.',
  whenToUse: 'Angle sum property, finding a missing angle, exterior angle, isosceles/equilateral triangle angles.',
  domains: ['geometry'],
  concepts: ['angle sum property', 'triangle', 'missing angle', 'interior angles', 'exterior angle', 'isosceles triangle'],
  keywords: ['180 degrees', 'sum of angles', 'find x', 'angle a', 'triangle abc', 'equilateral', 'degrees'],
  signals: [/angle sum|sum of (the )?angles|interior angle|exterior angle|180\s*\u00b0|triangle.*angle|missing angle/i],
  params: [
    { name: 'A', type: 'string', description: 'angle at the left corner (number or letter), e.g. "40\u00b0" or "x"', default: '60\u00b0' },
    { name: 'B', type: 'string', description: 'angle at the right corner', default: '60\u00b0' },
    { name: 'C', type: 'string', description: 'angle at the top corner', default: '60\u00b0' },
    { name: 'names', type: 'string[]', description: 'corner names', default: ['A', 'B', 'C'] },
  ],
  example: { A: '40\u00b0', B: '65\u00b0', C: 'x' },
  build(p, o) {
    const b = new Builder(pfx('triangle-angles', o));
    let da = num(p.A, 60, 10, 150), db = num(p.B, 60, 10, 150);
    if (da + db > 165) { da = 60; db = 60; }
    const dc = 180 - da - db, rad = Math.PI / 180;
    let L = 520;
    const side = (deg: number) => Math.sin(deg * rad);
    const height = (L * side(da) * side(db)) / side(dc);
    if (height > 400) L *= 400 / height;
    const ax = 500 - L / 2, ay = 560, bx = ax + L, by = 560;
    const bLen = (L * side(db)) / side(dc);
    const cx = ax + bLen * Math.cos(da * rad), cy = ay - bLen * Math.sin(da * rad);
    const [nA, nB, nC] = [0, 1, 2].map((i) => str(list(p.names)[i], ['A', 'B', 'C'][i], 3));
    b.line(ax, ay, bx, by, { stroke: COLORS.cyan, width: 5 });
    b.line(ax, ay, cx, cy, { stroke: COLORS.cyan, width: 5 });
    b.line(bx, by, cx, cy, { stroke: COLORS.cyan, width: 5 });
    b.text(nA, ax - 28, ay + 30, { size: 26, color: COLORS.muted });
    b.text(nB, bx + 28, by + 30, { size: 26, color: COLORS.muted });
    b.text(nC, cx, cy - 20, { size: 26, color: COLORS.muted });
    b.text(str(p.A, `${fmt(da)}\u00b0`, 10), ax + 78, ay - 14, { size: 28, color: COLORS.amber });
    b.text(str(p.B, `${fmt(db)}\u00b0`, 10), bx - 78, by - 14, { size: 28, color: COLORS.pink });
    b.text(str(p.C, `${fmt(dc)}\u00b0`, 10), cx, cy + 66, { size: 28, color: COLORS.green });
    b.text(`\u2220${nA} + \u2220${nB} + \u2220${nC} = 180\u00b0`, 500, 650, { size: 34, color: COLORS.ink });
    return b.actions;
  },
};

const parallelTransversal: VisualPattern = {
  id: 'parallel-transversal',
  name: 'Parallel lines cut by a transversal',
  summary: 'Two parallel lines with arrow marks and a transversal; the eight angles can be labelled.',
  whenToUse: 'Corresponding, alternate interior/exterior and co-interior angles; proving lines parallel; finding angle x.',
  domains: ['geometry'],
  concepts: ['parallel lines', 'transversal', 'corresponding angles', 'alternate angles', 'co-interior angles', 'vertically opposite angles'],
  keywords: ['alternate interior', 'allied angles', 'straight line 180', 'l parallel m', 'find angle', 'angle pair'],
  signals: [/transversal|parallel lines|corresponding angle|alternate (interior|exterior)|co-?interior|allied angle/i],
  params: [
    { name: 'angle', type: 'number', description: 'angle of the transversal with the lines, degrees', default: 60 },
    { name: 'labels', type: 'object', description: 'angle labels: p1..p4 at the upper crossing (upper-left, upper-right, lower-left, lower-right) and q1..q4 at the lower crossing' },
  ],
  example: { angle: 62, labels: { p2: '62\u00b0', q2: 'x' } },
  build(p, o) {
    const b = new Builder(pfx('parallel-transversal', o));
    const yU = 240, yL = 470, th = num(p.angle, 60, 35, 145) * (Math.PI / 180);
    const dx = (yL - yU) / Math.tan(th);
    const xU = 500 + dx / 2, xL = xU - dx; // crossings centred on the board for every angle
    const xAt = (y: number) => xU - (y - yU) / Math.tan(th);
    for (const y of [yU, yL]) {
      b.line(110, y, 890, y, { stroke: COLORS.cyan, width: 5 });
      b.line(820, y - 10, 832, y, { stroke: COLORS.cyan, width: 3, ms: 100 });
      b.line(832, y, 820, y + 10, { stroke: COLORS.cyan, width: 3, ms: 100 });
    }
    b.line(xAt(yU - 110), yU - 110, xAt(yL + 110), yL + 110, { stroke: COLORS.amber, width: 5 });
    const lab = obj(p.labels);
    const place = (key: string, x: number, y: number, dx: number, dy: number, color: string) => {
      const v = lab[key]; if (v != null && str(v)) b.text(str(v, '', 8), x + dx, y + dy, { size: 28, color });
    };
    const spots: Array<[number, number, string]> = [[xU, yU, 'p'], [xL, yL, 'q']];
    for (const [x, y, k] of spots) {
      place(`${k}1`, x, y, -58, -16, COLORS.pink); place(`${k}2`, x, y, 58, -16, COLORS.green);
      place(`${k}3`, x, y, -58, 42, COLORS.violet); place(`${k}4`, x, y, 58, 42, COLORS.amber);
    }
    return b.actions;
  },
};

const auxiliaryLine: VisualPattern = {
  id: 'auxiliary-line',
  name: 'Auxiliary (construction) line',
  summary: 'A dashed line between two points with end dots and a label: "we draw this extra line".',
  whenToUse: 'Whenever a proof or solution adds a construction line, a perpendicular, a diagonal, a parallel through a point.',
  domains: ['geometry'],
  concepts: ['auxiliary line', 'construction', 'perpendicular', 'diagonal', 'parallel through a point', 'proof'],
  keywords: ['draw a line', 'join', 'extend', 'produce', 'draw perpendicular', 'construct', 'additional line'],
  signals: [/auxiliary|construct|perpendicular|draw a line|\bjoin\b|produce|diagonal/i],
  params: [
    { name: 'from', type: 'number[]', description: '[x, y] start on the board (0..1000, 0..700)', default: [300, 500] },
    { name: 'to', type: 'number[]', description: '[x, y] end', default: [700, 200] },
    { name: 'label', type: 'string', description: 'text next to the line, e.g. "AD \u22a5 BC"' },
    { name: 'color', type: 'string', description: 'line colour hex', default: COLORS.pink },
  ],
  example: { from: [250, 520], to: [650, 220], label: 'AD \u22a5 BC' },
  build(p, o) {
    const b = new Builder(pfx('auxiliary-line', o));
    const f = list(p.from), t = list(p.to);
    const x1 = num(f[0], 300, 60, 940), y1 = num(f[1], 500, 60, 640), x2 = num(t[0], 700, 60, 940), y2 = num(t[1], 200, 60, 640);
    const color = /^#[0-9a-f]{6}$/i.test(str(p.color)) ? str(p.color) : COLORS.pink;
    b.line(x1, y1, x2, y2, { stroke: color, width: 5, dashed: true, ms: 700 });
    b.dot(x1, y1, color); b.dot(x2, y2, color);
    const label = str(p.label, '', 30);
    if (label) {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, len = Math.hypot(x2 - x1, y2 - y1) || 1;
      b.text(label, mx + ((y2 - y1) / len) * 44, my - ((x2 - x1) / len) * 44, { size: 28, color });
    }
    return b.actions;
  },
};

const coordinatePlane: VisualPattern = {
  id: 'coordinate-plane',
  name: 'Coordinate plane with a graph and points',
  summary: 'Axes with ticks and a line, parabola or point-to-point curve; labelled points and optional intercepts.',
  whenToUse: 'Graphing linear equations and functions, slope and intercepts, quadratic graphs, plotting ordered pairs, solving by graph.',
  domains: ['algebra', 'graphs', 'coordinate-geometry'],
  concepts: ['coordinate plane', 'graph of a line', 'slope', 'y-intercept', 'quadratic graph', 'parabola', 'vertex', 'ordered pair', 'linear equation'],
  keywords: ['plot', 'y = mx + c', 'x-axis', 'y-axis', 'gradient', 'intercept', 'origin', 'points', 'graph of', 'curve', 'roots', 'zeros'],
  signals: [/\bgraph|\bplot|slope|gradient|intercept|coordinate|parabola|vertex|ordered pair/i],
  params: [
    { name: 'xMin', type: 'number', description: '', default: -5 }, { name: 'xMax', type: 'number', description: '', default: 5 },
    { name: 'yMin', type: 'number', description: '', default: -5 }, { name: 'yMax', type: 'number', description: '', default: 5 },
    { name: 'curve', type: 'object', description: '{type:"linear", m, c} | {type:"quadratic", a, h, k} (y=a(x-h)^2+k) | {type:"points", points:[[x,y],...]}; optional label' },
    { name: 'points', type: 'object[]', description: 'marked points: {x, y, label?}' },
    { name: 'showIntercepts', type: 'boolean', description: 'mark where a linear graph crosses the axes', default: false },
  ],
  example: { xMin: -4, xMax: 6, yMin: -3, yMax: 8, curve: { type: 'linear', m: 1, c: 2, label: 'y = x + 2' }, showIntercepts: true },
  build(p, o) {
    const b = new Builder(pfx('coordinate-plane', o));
    let xMin = num(p.xMin, -5), xMax = num(p.xMax, 5), yMin = num(p.yMin, -5), yMax = num(p.yMax, 5);
    if (xMax <= xMin) { xMin = -5; xMax = 5; } if (yMax <= yMin) { yMin = -5; yMax = 5; }
    const s = Math.min(800 / (xMax - xMin), 580 / (yMax - yMin));
    const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2;
    const px = (x: number) => 500 + (x - cx) * s, py = (y: number) => 350 - (y - cy) * s;
    const axisX = Math.min(Math.max(0, yMin), yMax), axisY = Math.min(Math.max(0, xMin), xMax);
    b.arrow(px(xMin) - 10, py(axisX), px(xMax) + 10, py(axisX), { stroke: COLORS.muted, width: 3 });
    b.arrow(px(axisY), py(yMin) + 10, px(axisY), py(yMax) - 10, { stroke: COLORS.muted, width: 3 });
    const stepX = niceStep(xMin, xMax, 10), stepY = niceStep(yMin, yMax, 10);
    for (let v = Math.ceil(xMin / stepX) * stepX; v <= xMax + 1e-9; v += stepX) {
      if (Math.abs(v) < 1e-9) continue;
      b.line(px(v), py(axisX) - 7, px(v), py(axisX) + 7, { stroke: COLORS.muted, width: 2, ms: 60 });
      b.text(fmt(Number(v.toFixed(6))), px(v), py(axisX) + 30, { size: 18, color: COLORS.muted, ms: 60 });
    }
    for (let v = Math.ceil(yMin / stepY) * stepY; v <= yMax + 1e-9; v += stepY) {
      if (Math.abs(v) < 1e-9) continue;
      b.line(px(axisY) - 7, py(v), px(axisY) + 7, py(v), { stroke: COLORS.muted, width: 2, ms: 60 });
      b.text(fmt(Number(v.toFixed(6))), px(axisY) - 14, py(v) + 6, { size: 18, color: COLORS.muted, anchor: 'end', ms: 60 });
    }
    b.text('x', px(xMax) + 6, py(axisX) - 14, { size: 22, color: COLORS.muted });
    b.text('y', px(axisY) + 20, py(yMax) - 4, { size: 22, color: COLORS.muted });
    const curve = obj(p.curve);
    const type = str(curve.type, '', 12);
    let endPt: [number, number] | null = null;
    const seg = (x1: number, y1: number, x2: number, y2: number) => {
      const c = clipSegment(x1, y1, x2, y2, xMin, xMax, yMin, yMax);
      if (c) { b.line(px(c[0]), py(c[1]), px(c[2]), py(c[3]), { stroke: COLORS.cyan, width: 5, ms: 90 }); endPt = [c[2], c[3]]; }
    };
    if (type === 'linear') {
      const m = num(curve.m, 1), c = num(curve.c, 0);
      seg(xMin, m * xMin + c, xMax, m * xMax + c);
      if (p.showIntercepts) {
        if (c >= yMin && c <= yMax && 0 >= xMin && 0 <= xMax) { b.dot(px(0), py(c), COLORS.amber); b.text(`(0, ${fmt(c)})`, px(0) + 12, py(c) - 14, { size: 22, color: COLORS.amber, anchor: 'start' }); }
        if (m !== 0) { const x0 = -c / m; if (x0 >= xMin && x0 <= xMax && 0 >= yMin && 0 <= yMax) { b.dot(px(x0), py(0), COLORS.pink); b.text(`(${fmt(Number(x0.toFixed(2)))}, 0)`, px(x0) + 12, py(0) + 62, { size: 22, color: COLORS.pink, anchor: 'start' }); } }
      }
    } else if (type === 'quadratic') {
      const a = num(curve.a, 1), h = num(curve.h, 0), k = num(curve.k, 0);
      const N = 28; let prev: [number, number] | null = null;
      for (let i = 0; i <= N; i++) { const x = xMin + ((xMax - xMin) * i) / N, y = a * (x - h) ** 2 + k; if (prev) seg(prev[0], prev[1], x, y); prev = [x, y]; }
      if (h >= xMin && h <= xMax && k >= yMin && k <= yMax) { b.dot(px(h), py(k), COLORS.amber); b.text(`(${fmt(h)}, ${fmt(k)})`, px(h) + 14, py(k) + (a > 0 ? 34 : -16), { size: 22, color: COLORS.amber, anchor: 'start' }); }
    } else if (type === 'points') {
      const pts = list(curve.points).map((q) => list(q)).filter((q) => q.length >= 2).slice(0, 40).map((q) => [num(q[0], 0), num(q[1], 0)] as [number, number]);
      for (let i = 1; i < pts.length; i++) seg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    }
    const label = str(curve.label, '', 24);
    if (label && endPt) b.text(label, Math.min(920, px((endPt as [number, number])[0]) - 20), Math.max(50, py((endPt as [number, number])[1]) - 14), { size: 26, color: COLORS.cyan, anchor: 'end' });
    list(p.points).slice(0, 10).forEach((q, i) => {
      const qo = obj(q); const x = num(qo.x, NaN), y = num(qo.y, NaN);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < xMin || x > xMax || y < yMin || y > yMax) return;
      const col = CYCLE[i % CYCLE.length];
      b.dot(px(x), py(y), col, 9);
      b.text(str(qo.label, `(${fmt(x)}, ${fmt(y)})`, 16), px(x) + 14, py(y) - 14, { size: 22, color: col, anchor: 'start' });
    });
    return b.actions;
  },
};

const fractionBar: VisualPattern = {
  id: 'fraction-bar',
  name: 'Fraction bar (equal parts, some shaded)',
  summary: 'A bar split into equal parts with some shaded, the fraction written below; optionally a second bar to compare equivalent fractions.',
  whenToUse: 'Introducing fractions, equivalent fractions, comparing fractions, adding fractions with a common denominator, parts of a whole.',
  domains: ['fractions', 'arithmetic'],
  concepts: ['fraction', 'numerator', 'denominator', 'equivalent fractions', 'comparing fractions', 'parts of a whole'],
  keywords: ['shaded', 'equal parts', '3/4', 'half', 'quarter', 'common denominator', 'lcm', 'simplify fraction'],
  signals: [/fraction|numerator|denominator|equivalent|parts? of a whole|shaded/i],
  params: [
    { name: 'n', type: 'number', description: 'number of equal parts (2..12)', default: 4 },
    { name: 'k', type: 'number', description: 'number of shaded parts', default: 3 },
    { name: 'compare', type: 'object', description: 'second bar {n, k} to show an equivalent or compared fraction' },
  ],
  example: { n: 4, k: 2, compare: { n: 8, k: 4 } },
  build(p, o) {
    const b = new Builder(pfx('fraction-bar', o));
    const bar = (n: number, k: number, y0: number, color: string) => {
      const N = Math.round(num(n, 4, 1, 12)), K = Math.round(num(k, 1, 0, N)), w = 800 / N;
      for (let i = 0; i < N; i++) b.rect(100 + i * w, y0, w, 90, { fill: i < K ? 'rgba(103,232,249,0.45)' : 'none', stroke: color, width: 4, ms: 160 });
      b.text(`${K}/${N}`, 500, y0 + 160, { size: 56, color: COLORS.amber });
    };
    const cmp = obj(p.compare);
    if (cmp.n != null) { bar(num(p.n, 4), num(p.k, 1), 120, COLORS.cyan); bar(num(cmp.n, 8), num(cmp.k, 2), 400, COLORS.green); b.text('=', 500, 372, { size: 44, color: COLORS.muted }); }
    else bar(num(p.n, 4), num(p.k, 3), 250, COLORS.cyan);
    return b.actions;
  },
};

const barChart: VisualPattern = {
  id: 'bar-chart',
  name: 'Bar chart (drawn from shapes)',
  summary: 'Labelled bars scaled to the largest value with the value above each bar.',
  whenToUse: 'Comparing quantities, data handling, frequency tables, statistics (mean/median/mode from a table), word problems with amounts.',
  domains: ['statistics', 'data-handling', 'arithmetic'],
  concepts: ['bar graph', 'frequency', 'data', 'comparison', 'mean', 'mode', 'tally'],
  keywords: ['compare', 'how many', 'table', 'survey', 'scale', 'histogram', 'categories', 'chart'],
  signals: [/bar (graph|chart)|frequency|survey|histogram|tally|\bdata\b/i],
  params: [
    { name: 'labels', type: 'string[]', description: 'category names (max 8)', default: [] },
    { name: 'values', type: 'number[]', description: 'one number per category', default: [] },
    { name: 'title', type: 'string', description: 'chart title' },
  ],
  example: { labels: ['Mon', 'Tue', 'Wed', 'Thu'], values: [12, 18, 9, 15], title: 'Books read' },
  build(p, o) {
    const b = new Builder(pfx('bar-chart', o));
    const values = list(p.values).slice(0, 8).map((v) => Math.max(0, num(v, 0)));
    const labels = list(p.labels).slice(0, values.length).map((l, i) => str(l, `#${i + 1}`, 10));
    while (labels.length < values.length) labels.push(`#${labels.length + 1}`);
    const n = values.length || 1, max = Math.max(1, ...values), base = 560, slot = 800 / n, bw = Math.min(110, slot * 0.6);
    const title = str(p.title, '', 40); if (title) b.text(title, 500, 70, { size: 34, color: COLORS.amber });
    b.line(80, base, 920, base, { stroke: COLORS.muted, width: 3 });
    values.forEach((v, i) => {
      const h = Math.max(3, (v / max) * 380), x = 100 + i * slot + (slot - bw) / 2, col = CYCLE[i % CYCLE.length];
      b.rect(x, base - h, bw, h, { fill: rgba(col, 0.33), stroke: col, width: 4, ms: 380 });
      b.text(fmt(v), x + bw / 2, base - h - 14, { size: 26, color: col });
      b.text(labels[i], x + bw / 2, base + 38, { size: 24, color: COLORS.muted });
    });
    return b.actions;
  },
};

const balanceScale: VisualPattern = {
  id: 'balance-scale',
  name: 'Balance scale (equation as two equal pans)',
  summary: 'Two pans on a balanced beam, one side of the equation on each pan, and the operation done to both sides underneath.',
  whenToUse: 'Explaining WHY we do the same thing to both sides of an equation; solving linear equations; equality as balance.',
  domains: ['algebra'],
  concepts: ['equation', 'balance', 'both sides', 'equality', 'linear equation', 'inverse operation'],
  keywords: ['subtract from both sides', 'add to both sides', 'divide both sides', 'multiply both sides', 'keep it balanced', 'solve for x', 'left hand side', 'right hand side'],
  signals: [/both sides|balance|same (thing|operation) (to|on)/i],
  params: [
    { name: 'left', type: 'string', description: 'left side of the equation', default: '2x + 5' },
    { name: 'right', type: 'string', description: 'right side of the equation', default: '20' },
    { name: 'operation', type: 'string', description: 'what is done to both sides, e.g. "\u2212 5 on both sides"' },
  ],
  example: { left: '2x + 5', right: '20', operation: '\u2212 5 on both sides' },
  build(p, o) {
    const b = new Builder(pfx('balance-scale', o));
    b.line(180, 250, 820, 250, { stroke: COLORS.amber, width: 8 });
    b.rect(470, 262, 60, 200, { fill: 'rgba(251,191,36,0.25)', stroke: COLORS.amber, width: 4 });
    b.rect(380, 462, 240, 30, { fill: 'rgba(251,191,36,0.25)', stroke: COLORS.amber, width: 4 });
    for (const [cx, col] of [[240, COLORS.cyan], [760, COLORS.green]] as const) {
      b.line(cx, 250, cx - 90, 340, { stroke: COLORS.muted, width: 3, ms: 150 });
      b.line(cx, 250, cx + 90, 340, { stroke: COLORS.muted, width: 3, ms: 150 });
      b.rect(cx - 130, 340, 260, 100, { fill: 'rgba(103,232,249,0.10)', stroke: col, width: 5 });
    }
    b.text(str(p.left, '2x + 5', 18), 240, 402, { size: 40, color: COLORS.cyan });
    b.text(str(p.right, '20', 18), 760, 402, { size: 40, color: COLORS.green });
    b.text('=', 500, 240, { size: 40, color: COLORS.amber });
    const op = str(p.operation, '', 36);
    if (op) b.text(op, 500, 590, { size: 38, color: COLORS.pink });
    return b.actions;
  },
};

const areaModel: VisualPattern = {
  id: 'area-model',
  name: 'Area model (expanding brackets / multiplying)',
  summary: 'A rectangle split into a grid whose sides are the terms of the two factors; each cell holds a partial product.',
  whenToUse: 'Expanding (a + b)(c + d), FOIL, multiplying multi-digit numbers, algebraic identities like (a+b)\u00b2, factorising by area.',
  domains: ['algebra', 'arithmetic'],
  concepts: ['expansion', 'distributive property', 'area model', 'algebraic identity', 'multiplication', 'binomial product', 'factorisation'],
  keywords: ['expand brackets', 'foil', '(x+3)(x+2)', 'partial products', 'grid method', 'box method', '(a+b)^2', 'multiply'],
  signals: [/expand|bracket|distributive|\bfoil\b|area model|identity|factori[sz]|\)\s*\(/i],
  params: [
    { name: 'top', type: 'string[]', description: 'terms of the first factor (1-3 terms)', default: ['x', '3'] },
    { name: 'side', type: 'string[]', description: 'terms of the second factor (1-3 terms)', default: ['x', '2'] },
    { name: 'cells', type: 'string[][]', description: 'products, row by row, e.g. [["x\u00b2","3x"],["2x","6"]]' },
    { name: 'expansion', type: 'string', description: 'the collected result written under the grid' },
  ],
  example: { top: ['x', '3'], side: ['x', '2'], cells: [['x\u00b2', '3x'], ['2x', '6']], expansion: 'x\u00b2 + 5x + 6' },
  build(p, o) {
    const b = new Builder(pfx('area-model', o));
    const top = list(p.top).slice(0, 3).map((t) => str(t, '?', 6)), side = list(p.side).slice(0, 3).map((t) => str(t, '?', 6));
    if (!top.length) top.push('x', '3'); if (!side.length) side.push('x', '2');
    const size = (t: string, big: number) => (isNumeric(t) ? Math.min(big, 70 + Math.abs(Number(t)) * 25) : big);
    const widths = top.map((t) => size(t, 230)), heights = side.map((t) => size(t, 150));
    const totalW = widths.reduce((a, c) => a + c, 0), totalH = heights.reduce((a, c) => a + c, 0);
    const x0 = 500 - totalW / 2 + 40, y0 = 130;
    let cy = y0;
    heights.forEach((h, r) => {
      let cx = x0;
      widths.forEach((w, c) => {
        const own = list(list(p.cells)[r])[c];
        const txt = str(own, `${top[c]}\u00b7${side[r]}`, 10);
        b.rect(cx, cy, w, h, { fill: (r + c) % 2 ? 'rgba(103,232,249,0.10)' : 'rgba(251,191,36,0.10)', stroke: COLORS.cyan, width: 4, ms: 200 });
        b.text(txt, cx + w / 2, cy + h / 2 + 10, { size: 34, color: COLORS.ink });
        cx += w;
      });
      cy += h;
    });
    let cx = x0; top.forEach((t, c) => { b.text(t, cx + widths[c] / 2, y0 - 16, { size: 34, color: COLORS.amber }); cx += widths[c]; });
    cy = y0; side.forEach((t, r) => { b.text(t, x0 - 20, cy + heights[r] / 2 + 10, { size: 34, color: COLORS.pink, anchor: 'end' }); cy += heights[r]; });
    const exp = str(p.expansion, '', 40);
    if (exp) b.text(exp, 500, Math.min(660, y0 + totalH + 70), { size: 40, color: COLORS.green });
    return b.actions;
  },
};

const circleParts: VisualPattern = {
  id: 'circle-parts',
  name: 'Circle with radius, diameter and chord',
  summary: 'A circle with its centre, a radius, a diameter and optionally a chord, each labelled; a formula can sit beside it.',
  whenToUse: 'Circumference and area of a circle, radius vs diameter, chord and tangent facts, arcs, parts of a circle.',
  domains: ['geometry', 'mensuration'],
  concepts: ['circle', 'radius', 'diameter', 'chord', 'circumference', 'area of circle', 'pi'],
  keywords: ['2 pi r', 'pi r squared', 'centre', 'parts of a circle', 'perimeter of circle'],
  signals: [/circle|radius|diameter|chord|circumference/i],
  params: [
    { name: 'show', type: 'string[]', description: 'which parts to draw: "radius", "diameter", "chord"', default: ['radius'] },
    { name: 'labels', type: 'object', description: '{radius, diameter, chord, centre} label text' },
    { name: 'formula', type: 'string', description: 'formula written beside the circle' },
  ],
  example: { show: ['radius', 'diameter'], labels: { radius: 'r = 7', diameter: 'd = 14' }, formula: 'C = 2\u03c0r' },
  build(p, o) {
    const b = new Builder(pfx('circle-parts', o));
    const cx = 340, cy = 360, r = 200, show = list(p.show).map((s) => str(s, '', 10).toLowerCase()), lab = obj(p.labels);
    b.circle(cx, cy, r, { stroke: COLORS.cyan, width: 5, ms: 700 });
    if (show.includes('diameter')) { b.line(cx - r, cy, cx + r, cy, { stroke: COLORS.pink, width: 5 }); b.text(str(lab.diameter, 'd', 14), cx, cy + 44, { size: 30, color: COLORS.pink }); }
    if (show.includes('radius') || !show.length) { b.line(cx, cy, cx + r * Math.cos(-0.6), cy + r * Math.sin(-0.6), { stroke: COLORS.amber, width: 5 }); b.text(str(lab.radius, 'r', 14), cx + r * 0.5 * Math.cos(-0.6) - 14, cy + r * 0.5 * Math.sin(-0.6) - 30, { size: 30, color: COLORS.amber, anchor: 'end' }); }
    if (show.includes('chord')) { const a1 = 2.3, a2 = 3.9; b.line(cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a2), cy + r * Math.sin(a2), { stroke: COLORS.green, width: 5 }); b.text(str(lab.chord, 'chord', 14), cx - r * 0.9, cy + r * 0.62, { size: 26, color: COLORS.green }); }
    b.dot(cx, cy, COLORS.ink, 6); b.text(str(lab.centre, 'O', 6), cx - 20, cy - 14, { size: 26, color: COLORS.ink });
    const f = str(p.formula, '', 30); if (f) b.text(f, 640, 350, { size: 46, color: COLORS.green, anchor: 'start' });
    return b.actions;
  },
};

const vennTwoSets: VisualPattern = {
  id: 'venn-two-sets',
  name: 'Venn diagram, two sets',
  summary: 'Two overlapping circles inside a universal rectangle with the elements of A only, both and B only.',
  whenToUse: 'Sets: union, intersection, difference, complement; counting problems with overlap; n(A\u222aB) = n(A) + n(B) \u2212 n(A\u2229B).',
  domains: ['sets', 'probability', 'statistics'],
  concepts: ['set', 'union', 'intersection', 'venn diagram', 'complement', 'universal set', 'subset'],
  keywords: ['a union b', 'a intersection b', 'overlap', 'both', 'only', 'neither', 'inclusion exclusion'],
  signals: [/venn|union|intersection|\bsets?\b|complement|subset/i],
  params: [
    { name: 'names', type: 'string[]', description: 'set names', default: ['A', 'B'] },
    { name: 'onlyA', type: 'string', description: 'elements only in A' }, { name: 'both', type: 'string', description: 'elements in both' },
    { name: 'onlyB', type: 'string', description: 'elements only in B' }, { name: 'outside', type: 'string', description: 'elements in neither' },
  ],
  example: { names: ['A', 'B'], onlyA: '1, 2', both: '3, 4', onlyB: '5, 6', outside: '7' },
  build(p, o) {
    const b = new Builder(pfx('venn-two-sets', o));
    const [nA, nB] = [0, 1].map((i) => str(list(p.names)[i], ['A', 'B'][i], 8));
    b.rect(80, 80, 840, 540, { stroke: COLORS.muted, width: 3 });
    b.text('U', 112, 122, { size: 28, color: COLORS.muted });
    b.circle(390, 350, 200, { stroke: COLORS.cyan, width: 5, ms: 600 });
    b.circle(610, 350, 200, { stroke: COLORS.pink, width: 5, ms: 600 });
    b.text(nA, 300, 130, { size: 34, color: COLORS.cyan }); b.text(nB, 700, 130, { size: 34, color: COLORS.pink });
    const put = (v: unknown, x: number, y: number, col: string) => { const s = str(v, '', 22); if (s) b.text(s, x, y, { size: 30, color: col }); };
    put(p.onlyA, 300, 360, COLORS.cyan); put(p.both, 500, 360, COLORS.amber); put(p.onlyB, 700, 360, COLORS.pink); put(p.outside, 150, 570, COLORS.muted);
    return b.actions;
  },
};

const highlightCallout: VisualPattern = {
  id: 'highlight-callout',
  name: 'Highlight a region with an arrow and a note',
  summary: 'A box around part of the figure, an arrow, and a short note ("this side is the hypotenuse").',
  whenToUse: 'Drawing attention to one part of a diagram or graph while a step is explained: a side, an angle, a point, a term.',
  domains: ['geometry', 'graphs', 'algebra'],
  concepts: ['highlight', 'emphasis', 'callout', 'annotation', 'point out'],
  keywords: ['look at', 'notice', 'this part', 'focus', 'mark', 'circle the', 'important'],
  signals: [/highlight|notice|point out|emphasi[sz]e/i],
  params: [
    { name: 'target', type: 'object', description: '{x, y, w, h} of the region to box on the board', default: { x: 400, y: 300, w: 200, h: 120 } },
    { name: 'text', type: 'string', description: 'the note' },
    { name: 'at', type: 'number[]', description: '[x, y] where the note is written', default: [160, 120] },
  ],
  example: { target: { x: 420, y: 320, w: 220, h: 140 }, text: 'longest side', at: [200, 150] },
  build(p, o) {
    const b = new Builder(pfx('highlight-callout', o));
    const t = obj(p.target), x = num(t.x, 400, 40, 900), y = num(t.y, 300, 40, 620), w = num(t.w, 200, 30, 900 - x + 60), h = num(t.h, 120, 30, 640 - y + 40);
    const at = list(p.at), tx = num(at[0], 160, 60, 900), ty = num(at[1], 120, 60, 640);
    b.rect(x, y, Math.min(w, 940 - x), Math.min(h, 660 - y), { stroke: COLORS.amber, width: 5, ms: 500 });
    const note = str(p.text, '', 40);
    if (note) {
      b.text(note, tx, ty, { size: 32, color: COLORS.amber, anchor: 'start' });
      b.arrow(tx + 30, ty + 14, x + Math.min(w, 940 - x) / 2, y, { stroke: COLORS.amber, width: 4 });
    }
    return b.actions;
  },
};

/** Ordered by how often a school syllabus needs them. */
export const PATTERNS: VisualPattern[] = [
  numberLine, numberLineJumps, rightTriangle, triangleAngles, parallelTransversal, auxiliaryLine,
  coordinatePlane, fractionBar, barChart, balanceScale, areaModel, circleParts, vennTwoSets, highlightCallout,
];

export function getPattern(id: string): VisualPattern | undefined {
  return PATTERNS.find((p) => p.id === id);
}

/** Build by id with forgiving params. Never throws: a bad recipe returns []. */
export function buildPattern(id: string, params: Params, idPrefix?: string) {
  const p = getPattern(id);
  if (!p) return [];
  try { return p.build(params ?? {}, { idPrefix }); } catch { return []; }
}

export { CANVAS };

/** True when the text contains one of the pattern's strong signals. */
export function matchesSignals(p: VisualPattern, text: string): boolean {
  return p.signals.some((r) => r.test(text));
}
