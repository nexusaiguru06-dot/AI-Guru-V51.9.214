import { describe, expect, it } from 'vitest';
import { arcNode, barChartNode, gridNode, matrixNode, numberLineNode, sampleSpaceNode, sectorNode, vectorNode } from './manim-inspired-primitives';

describe('Manim-inspired browser primitives', () => {
  it('creates deterministic primitive nodes', () => {
    expect(gridNode('g', 0, 0, 800, 400).kind).toBe('grid');
    expect(numberLineNode('n', 0, 0, 800, -5, 5).numberLine?.min).toBe(-5);
    expect(vectorNode('v', 0, 0, 100, -50).vector).toEqual({ dx: 100, dy: -50 });
    expect(arcNode('a', 0, 0, 80, 0, Math.PI / 2).arc?.radius).toBe(80);
    expect(sectorNode('s', 0, 0, 80, 0, Math.PI / 2).kind).toBe('sector');
    expect(matrixNode('m', 0, 0, [['1', '2'], ['3', '4']]).matrix?.values.length).toBe(2);
    expect(barChartNode('b', 0, 0, 400, 200, [2, 4]).barChart?.values).toEqual([2, 4]);
    expect(sampleSpaceNode('sp', 0, 0, 400, 200, [['H', 'T']]).sampleSpace?.items[0]).toEqual(['H', 'T']);
  });
});
