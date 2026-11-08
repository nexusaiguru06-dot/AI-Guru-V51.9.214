'use client';

/**
 * AI Guru Scene IR -> native manim-web mobjects for graph / plot / matrix / barChart.
 *
 * Replaces the plain-`Text` fallback in renderer.ts `makeMobject` for these kinds.
 * No dependency on renderer.ts (avoids a circular import): the caller passes a
 * `PrimitiveBox` already converted to manim world units.
 *
 * Safety: function strings go through the existing sandboxed `evalExpr`
 * (no eval / Function), same as the SVG board.
 */

import {
  Axes,
  BarChart,
  Dot,
  FunctionGraph,
  Group,
  Line,
  Matrix,
  ParametricFunction,
  Text,
  type Mobject,
} from 'manim-web';
import type { MathVisualNode } from '../universal/types';
import { evalExpr, derivative } from '../animation/expr';
import { resolveColor } from '../animation/colors';

export interface PrimitiveBox {
  /** Centre of the node in manim world units. */
  center: [number, number, number];
  /** Width / height in manim world units. */
  width: number;
  height: number;
  /** Resolved stroke colour for the node. */
  color: string;
}

const AXIS_COLOR = '#94a3b8';
const CURVE_COLOR = '#67e8f9';
const MARKER_COLOR = '#facc15';
const BAR_PALETTE = ['#67e8f9', '#a78bfa', '#facc15', '#86efac', '#fb923c', '#f472b6'];

/** 1 / 2 / 5 × 10^n tick step giving roughly 4-8 ticks across `span`. */
export function niceStep(span: number): number {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const raw = span / 6;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const mult = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
  return mult * pow;
}

/**
 * Place a composite by its known local centre instead of `moveTo(group)`.
 * `Mobject.getBounds()` throws for groups containing not-yet-rendered Text,
 * so we never ask for bounds; the layout maths here is exact anyway.
 */
function placeAt(group: Group, localCenter: [number, number, number], box: PrimitiveBox): Group {
  group.position.set(box.center[0] - localCenter[0], box.center[1] - localCenter[1], 0);
  return group;
}

function axesLocalCenter(
  axes: Axes,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
): [number, number, number] {
  const a = axes.c2p(xMin, yMin);
  const b = axes.c2p(xMax, yMax);
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0];
}

/**
 * manim-web's Axes always draws the axis lines through graph-space (0,0), even
 * when 0 is outside the range (e.g. ln x on [1, 9]) — the lines then poke out of
 * the plot box. Slide each axis line to the nearest edge of the visible window.
 */
function fitAxesToWindow(axes: Axes, xMin: number, xMax: number, yMin: number, yMax: number): void {
  const cx = Math.min(Math.max(0, xMin), xMax);
  const cy = Math.min(Math.max(0, yMin), yMax);
  axes.getYAxis().position.x = axes.c2p(cx, 0)[0];
  axes.getXAxis().position.y = axes.c2p(0, cy)[1];
}

function fallbackText(node: MathVisualNode, box: PrimitiveBox): Mobject {
  return new Text({
    text: String(node.content ?? node.graph?.title ?? node.id ?? ''),
    color: box.color,
    fontSize: 26,
  }).moveTo(box.center);
}

/** Indices (as x values) where the sampled function is undefined or jumps wildly. */
function findDiscontinuities(
  f: (x: number) => number,
  xMin: number,
  xMax: number,
  ySpan: number,
): number[] {
  const out: number[] = [];
  const N = 400;
  let prevY = f(xMin);
  for (let i = 1; i <= N; i++) {
    const x = xMin + ((xMax - xMin) * i) / N;
    const y = f(x);
    const bad = !Number.isFinite(y) || !Number.isFinite(prevY);
    const jump = !bad && Math.abs(y - prevY) > ySpan * 4;
    if (jump) out.push(x - (xMax - xMin) / (2 * N));
    prevY = y;
  }
  return out;
}

/** kind: 'plot' — y = fn(x) on its own axes, optional marker + tangent. */
export function makePlotMobject(node: MathVisualNode, box: PrimitiveBox): Mobject {
  const spec = node.plot;
  if (!spec) return fallbackText(node, box);
  const { fn, xMin, xMax, yMin, yMax } = spec;
  if (![xMin, xMax, yMin, yMax].every(Number.isFinite) || xMax <= xMin || yMax <= yMin) {
    return fallbackText(node, box);
  }

  const ySpan = yMax - yMin;
  const axes = new Axes({
    xRange: [xMin, xMax, niceStep(xMax - xMin)],
    yRange: [yMin, yMax, niceStep(ySpan)],
    xLength: box.width,
    yLength: box.height,
    color: AXIS_COLOR,
    tips: false,
  });
  fitAxesToWindow(axes, xMin, xMax, yMin, yMax);

  // Invalid or off-chart points become NaN: manim-web's FunctionGraph skips
  // non-finite samples, so asymptotes (1/x, tan x) never leave the plot box.
  const raw = (x: number) => evalExpr(fn, { x });
  const f = (x: number) => {
    const y = raw(x);
    return y >= yMin && y <= yMax ? y : NaN;
  };
  const curveColor = resolveColor(spec.curveColor) ?? CURVE_COLOR;
  const graph = new FunctionGraph({
    func: f,
    xRange: [xMin, xMax],
    color: curveColor,
    strokeWidth: 4,
    numSamples: 400,
    discontinuities: findDiscontinuities(f, xMin, xMax, ySpan),
    axes,
  });

  const parts: Mobject[] = [axes as unknown as Mobject, graph as unknown as Mobject];

  if (spec.marker) {
    const mx = evalExpr(spec.marker.x);
    const my = raw(mx);
    if (Number.isFinite(mx) && Number.isFinite(my) && my >= yMin && my <= yMax) {
      const mColor = resolveColor(spec.marker.color) ?? MARKER_COLOR;
      if (spec.marker.tangent) {
        const slope = derivative(fn, 'x', mx);
        if (Number.isFinite(slope)) {
          // Keep both ends of the tangent inside the visible window (x and y).
          const room = Math.min(my - yMin, yMax - my);
          const dx = Math.min(
            (xMax - xMin) * 0.2,
            mx - xMin,
            xMax - mx,
            Math.abs(slope) > 1e-9 ? room / Math.abs(slope) : Infinity,
          );
          if (dx > (xMax - xMin) * 0.01) parts.push(
            new Line({
              start: axes.c2p(mx - dx, my - slope * dx),
              end: axes.c2p(mx + dx, my + slope * dx),
              color: mColor,
              strokeWidth: 3,
            }) as unknown as Mobject,
          );
        }
      }
      parts.push(new Dot({ point: axes.c2p(mx, my), color: mColor, radius: 0.09 }) as unknown as Mobject);
    }
  }

  return placeAt(new Group(...parts), axesLocalCenter(axes, xMin, xMax, yMin, yMax), box);
}

/** kind: 'graph' — sampled points (x[], y[]) drawn as a polyline on fitted axes. */
export function makeGraphMobject(node: MathVisualNode, box: PrimitiveBox): Mobject {
  const g = node.graph;
  const n = g ? Math.min(g.x.length, g.y.length) : 0;
  if (!g || n < 2) return fallbackText(node, box);

  const xs = g.x.slice(0, n);
  const ys = g.y.slice(0, n);
  if (![...xs, ...ys].every(Number.isFinite)) return fallbackText(node, box);

  const pad = (lo: number, hi: number) => {
    const span = hi - lo || 1;
    return [lo - span * 0.1, hi + span * 0.1] as [number, number];
  };
  const [xMin, xMax] = pad(Math.min(...xs), Math.max(...xs));
  const [yMin, yMax] = pad(Math.min(...ys), Math.max(...ys));

  const axes = new Axes({
    xRange: [xMin, xMax, niceStep(xMax - xMin)],
    yRange: [yMin, yMax, niceStep(yMax - yMin)],
    xLength: box.width,
    yLength: box.height,
    color: AXIS_COLOR,
    tips: false,
  });
  fitAxesToWindow(axes, xMin, xMax, yMin, yMax);

  // Piecewise-linear interpolation over the sample index -> straight segments.
  const curve = new ParametricFunction({
    func: (t: number) => {
      const s = Math.max(0, Math.min(n - 1, t));
      const i = Math.min(n - 2, Math.floor(s));
      const k = s - i;
      return axes.c2p(xs[i] + (xs[i + 1] - xs[i]) * k, ys[i] + (ys[i + 1] - ys[i]) * k);
    },
    tRange: [0, n - 1],
    color: box.color,
    strokeWidth: 4,
    numSamples: Math.max(60, n * 6),
  });

  const parts: Mobject[] = [axes as unknown as Mobject, curve as unknown as Mobject];

  // Point markers for short series (keeps the "data point" feel of the SVG board).
  if (n <= 24) {
    for (let i = 0; i < n; i++) {
      parts.push(new Dot({ point: axes.c2p(xs[i], ys[i]), color: box.color, radius: 0.06 }) as unknown as Mobject);
    }
  }

  if (g.title) {
    const lc = axesLocalCenter(axes, xMin, xMax, yMin, yMax);
    const title = new Text({ text: g.title, color: '#e2e8f0', fontSize: 24 });
    title.position.set(lc[0], lc[1] + box.height / 2 + 0.45, 0);
    parts.push(title as unknown as Mobject);
  }

  return placeAt(new Group(...parts), axesLocalCenter(axes, xMin, xMax, yMin, yMax), box);
}

/** kind: 'matrix' — values is a grid of LaTeX/number strings. */
export function makeMatrixMobject(node: MathVisualNode, box: PrimitiveBox): Mobject {
  const rows = node.matrix?.values;
  if (!rows?.length || !rows.every((r) => Array.isArray(r) && r.length > 0)) {
    return fallbackText(node, box);
  }
  const m = new Matrix(rows.map((r) => r.map(String)), {
    bracketType: '[]',
    elementColor: box.color,
    bracketColor: AXIS_COLOR,
    fontSize: Number(node.style?.fontSize ?? 44),
  });
  // Fit inside the node box, never scale up past 1.
  const w = m.getWidth();
  const h = m.getHeight();
  const k = Math.min(1, box.width / Math.max(w, 1e-6), box.height / Math.max(h, 1e-6));
  if (k < 1) m.scale(k);
  return m.moveTo(box.center) as unknown as Mobject;
}

/** kind: 'barChart' — one series of values with optional x labels. */
export function makeBarChartMobject(node: MathVisualNode, box: PrimitiveBox): Mobject {
  const bc = node.barChart;
  if (!bc?.values?.length || !bc.values.every(Number.isFinite)) return fallbackText(node, box);

  const top = Math.max(...bc.values, 0);
  const bottom = Math.min(...bc.values, 0);
  const step = niceStep(top - bottom || 1);
  const n = bc.values.length;
  const slot = box.width / n;
  const chart = new BarChart({
    values: bc.values,
    barWidth: Math.min(0.6, slot * 0.7),
    barGap: 0.05,
    xLabels: bc.labels,
    width: box.width,
    height: box.height,
    yRange: [Math.floor(bottom / step) * step, Math.ceil((top || 1) / step) * step, step],
    barColors: node.color ? box.color : BAR_PALETTE,
    axisColor: AXIS_COLOR,
  });
  // BarChart's local frame spans x:[0,width], y:[0,height] (origin bottom-left).
  chart.position.set(box.center[0] - box.width / 2, box.center[1] - box.height / 2, 0);
  return chart as unknown as Mobject;
}
