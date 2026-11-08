import type { VisualAction } from '../lesson/types';
import type { Params } from './types';

/** The board every VisualAction is drawn on. */
export const CANVAS = { width: 1000, height: 700, margin: 30 } as const;

export const COLORS = {
  ink: '#e6faff', cyan: '#67e8f9', amber: '#fbbf24', green: '#4ade80', pink: '#f472b6',
  violet: '#a78bfa', red: '#f87171', blue: '#60a5fa', muted: '#94a3b8', bg: '#0b1017',
} as const;
export const CYCLE = [COLORS.amber, COLORS.pink, COLORS.green, COLORS.violet, COLORS.blue] as const;

const round = (n: number) => Math.round(n * 10) / 10;

/** Forgiving number reader: models send "3", 3, "3.5" or junk. */
export function num(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof v === 'string' ? Number(v.trim().replace(/[°\u2212]/g, (c) => (c === '\u2212' ? '-' : ''))) : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
export function isNumeric(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string' && v.trim() !== '') return Number.isFinite(Number(v.trim().replace(/[°]/g, '').replace(/\u2212/g, '-')));
  return false;
}
export function str(v: unknown, fallback = '', max = 60): string {
  if (v == null) return fallback;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return (s || fallback).slice(0, max);
}
export function list(v: unknown): unknown[] { return Array.isArray(v) ? v : v == null ? [] : [v]; }
export function obj(v: unknown): Params { return v && typeof v === 'object' && !Array.isArray(v) ? (v as Params) : {}; }

/** 1, 2, 5, 10, ... step giving at most ~10 ticks. */
export function niceStep(min: number, max: number, target = 10): number {
  const raw = Math.max(1e-9, (max - min) / target);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}
export function fmt(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toFixed(2)));
}

/** Clip a segment to a rectangle (Liang-Barsky). Returns null when nothing is inside. */
export function clipSegment(x1: number, y1: number, x2: number, y2: number, xmin: number, xmax: number, ymin: number, ymax: number): [number, number, number, number] | null {
  let t0 = 0, t1 = 1; const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy], q = [x1 - xmin, xmax - x1, y1 - ymin, ymax - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; continue; }
    const r = q[i] / p[i];
    if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy];
}

interface LineOpts { stroke?: string; width?: number; dashed?: boolean; ms?: number }
interface TextOpts { size?: number; color?: string; anchor?: 'start' | 'middle' | 'end'; ms?: number }
interface ShapeOpts { fill?: string; stroke?: string; width?: number; ms?: number }

/** Collects VisualActions with unique, prefixed ids. */
export class Builder {
  readonly actions: VisualAction[] = [];
  private n = 0;
  constructor(private prefix: string) {}
  private id(kind: string) { return `${this.prefix}-${kind}-${++this.n}`; }

  line(x1: number, y1: number, x2: number, y2: number, o: LineOpts = {}): string {
    const id = this.id('line');
    this.actions.push({ type: 'line', id, startX: round(x1), startY: round(y1), endX: round(x2), endY: round(y2), style: o.dashed ? 'dashed' : 'solid', stroke: o.stroke ?? COLORS.cyan, strokeWidth: o.width ?? 4, durationMs: o.ms ?? 450 });
    return id;
  }
  /** Line with an arrow head at (x2,y2). */
  arrow(x1: number, y1: number, x2: number, y2: number, o: LineOpts = {}): string {
    const id = this.line(x1, y1, x2, y2, o);
    const a = Math.atan2(y2 - y1, x2 - x1), h = 16;
    for (const s of [-1, 1]) this.line(x2, y2, x2 - h * Math.cos(a + s * 0.45), y2 - h * Math.sin(a + s * 0.45), { ...o, dashed: false, ms: 120 });
    return id;
  }
  text(content: string, x: number, y: number, o: TextOpts = {}): string {
    const id = this.id('text');
    this.actions.push({ type: 'write', id, content, x: round(x), y: round(y), fontSize: o.size ?? 24, placement: 'absolute', color: o.color ?? COLORS.ink, anchor: o.anchor ?? 'middle', durationMs: o.ms ?? 300 });
    return id;
  }
  rect(x: number, y: number, w: number, h: number, o: ShapeOpts = {}): string {
    const id = this.id('rect');
    this.actions.push({ type: 'shape', id, shape: 'rectangle', x: round(x), y: round(y), width: round(w), height: round(h), fill: o.fill ?? 'none', stroke: o.stroke ?? COLORS.cyan, strokeWidth: o.width ?? 4, durationMs: o.ms ?? 450 });
    return id;
  }
  circle(cx: number, cy: number, r: number, o: ShapeOpts = {}): string {
    const id = this.id('circle');
    this.actions.push({ type: 'shape', id, shape: 'circle', x: round(cx - r), y: round(cy - r), width: round(2 * r), height: round(2 * r), fill: o.fill ?? 'none', stroke: o.stroke ?? COLORS.cyan, strokeWidth: o.width ?? 4, durationMs: o.ms ?? 450 });
    return id;
  }
  dot(cx: number, cy: number, color: string = COLORS.amber, r = 8): string { return this.circle(cx, cy, r, { fill: color, stroke: color, width: 2, ms: 250 }); }
  pause(ms: number): string {
    const id = this.id('pause');
    this.actions.push({ type: 'pause', id, durationMs: ms });
    return id;
  }
}
