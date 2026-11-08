import { describe, expect, it } from 'vitest';
import { makeBarChartMobject, makeGraphMobject, makeMatrixMobject, makePlotMobject, niceStep } from './primitives';

const box = { center: [2, 1, 0] as [number, number, number], width: 6, height: 3.5, color: '#67e8f9' };
const node = (kind: string, extra: object) => ({ id: 'n', kind, ...extra }) as any;

describe('manim-web primitives', () => {
  it('niceStep gives 1/2/5 x 10^n ticks', () => {
    expect(niceStep(6)).toBe(1);
    expect(niceStep(12)).toBe(2);
    expect(niceStep(100)).toBe(20);
  });

  it('plot: fits its box and is centred on the node', () => {
    const m: any = makePlotMobject(node('plot', { plot: { fn: 'x^2', xMin: -3, xMax: 3, yMin: -1, yMax: 9, marker: { x: '1', tangent: true } } }), box);
    expect(m.getWidth()).toBeCloseTo(6, 1);
    expect(m.getHeight()).toBeCloseTo(3.5, 1);
    const c = m.getCenter();
    expect(c[0]).toBeCloseTo(2, 1);
    expect(c[1]).toBeCloseTo(1, 1);
  });

  it('plot: asymptotes (1/x) stay near the box instead of exploding', () => {
    const m: any = makePlotMobject(node('plot', { plot: { fn: '1/x', xMin: -4, xMax: 4, yMin: -5, yMax: 5 } }), box);
    expect(m.getHeight()).toBeLessThan(3.5 * 1.3);
  });

  it('plot: axes slide to the visible window when 0 is outside the range', () => {
    const m: any = makePlotMobject(node('plot', { plot: { fn: 'ln(x)', xMin: 1, xMax: 9, yMin: 0, yMax: 3 } }), box);
    expect(m.getWidth()).toBeLessThan(6.5);
  });

  it('bad input falls back to text instead of throwing', () => {
    expect(() => makePlotMobject(node('plot', { plot: { fn: '((', xMin: -1, xMax: 1, yMin: -1, yMax: 1 } }), box)).not.toThrow();
    expect(() => makeGraphMobject(node('graph', { graph: { x: [1], y: [2] } }), box)).not.toThrow();
    expect(() => makeMatrixMobject(node('matrix', { matrix: { values: [] } }), box)).not.toThrow();
    expect(() => makeBarChartMobject(node('barChart', { barChart: { values: [NaN] } }), box)).not.toThrow();
  });

  it('graph / matrix / barChart construct without needing text bounds', () => {
    expect(() => makeGraphMobject(node('graph', { graph: { x: [1, 2, 3, 4], y: [2, 4, 3, 8], title: 'Sales' } }), box)).not.toThrow();
    expect(() => makeMatrixMobject(node('matrix', { matrix: { values: [['1', '2'], ['3', '\\frac{1}{2}']] } }), { ...box, width: 2, height: 1.5 })).not.toThrow();
    const bar: any = makeBarChartMobject(node('barChart', { barChart: { values: [3, 7, 5], labels: ['A', 'B', 'C'] } }), box);
    expect(bar.position.x).toBeCloseTo(2 - 3, 5); // bottom-left origin centred on the box
    expect(bar.position.y).toBeCloseTo(1 - 1.75, 5);
  });
});
