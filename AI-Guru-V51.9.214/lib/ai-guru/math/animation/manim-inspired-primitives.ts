/**
 * AI Guru browser primitives inspired by the visual vocabulary of ManimGL.
 *
 * This is intentionally NOT a Manim runtime. It is a small deterministic
 * scene vocabulary for SVG/browser playback: grids, number lines, vectors,
 * arcs, sectors, matrices, bars and sample spaces.
 */
import type { MathVisualNode } from '../universal/types';

export const THREE_B1B_COLORS = {
  ink: '#f8fafc',
  blue: '#60a5fa',
  cyan: '#67e8f9',
  gold: '#fbbf24',
  green: '#4ade80',
  red: '#f87171',
  purple: '#c084fc',
} as const;

export function gridNode(id: string, x: number, y: number, width: number, height: number, step = 40): MathVisualNode {
  return { id, kind: 'grid', x, y, width, height, grid: { step, majorEvery: 5 }, color: THREE_B1B_COLORS.blue };
}

export function numberLineNode(id: string, x: number, y: number, width: number, min: number, max: number, step = 1): MathVisualNode {
  return { id, kind: 'numberLine', x, y, width, height: 90, numberLine: { min, max, step }, color: THREE_B1B_COLORS.ink };
}

export function vectorNode(id: string, x: number, y: number, dx: number, dy: number, color = THREE_B1B_COLORS.blue): MathVisualNode {
  return { id, kind: 'vector', x, y, width: Math.abs(dx), height: Math.abs(dy), vector: { dx, dy }, color };
}

export function arcNode(id: string, x: number, y: number, radius: number, startAngle: number, endAngle: number, color = THREE_B1B_COLORS.gold): MathVisualNode {
  return { id, kind: 'arc', x, y, width: radius * 2, height: radius * 2, arc: { radius, startAngle, endAngle }, color };
}

export function sectorNode(id: string, x: number, y: number, radius: number, startAngle: number, endAngle: number, color = THREE_B1B_COLORS.blue): MathVisualNode {
  return { id, kind: 'sector', x, y, width: radius * 2, height: radius * 2, arc: { radius, startAngle, endAngle }, color };
}

export function matrixNode(id: string, x: number, y: number, values: string[][], color = THREE_B1B_COLORS.ink) : MathVisualNode {
  return { id, kind: 'matrix', x, y, width: 300, height: 160, matrix: { values }, color };
}

export function barChartNode(id: string, x: number, y: number, width: number, height: number, values: number[], labels?: string[]): MathVisualNode {
  return { id, kind: 'barChart', x, y, width, height, barChart: { values, labels }, color: THREE_B1B_COLORS.blue };
}

export function sampleSpaceNode(id: string, x: number, y: number, width: number, height: number, items: string[][]): MathVisualNode {
  return { id, kind: 'sampleSpace', x, y, width, height, sampleSpace: { items }, color: THREE_B1B_COLORS.ink };
}
