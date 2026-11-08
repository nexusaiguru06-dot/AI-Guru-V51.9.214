import { describe, expect, it } from 'vitest';
import { actionSvg } from './action-svg';
import type { VisualAction } from '../lesson/types';

describe('actionSvg (shared by the board, the dry run and the gallery)', () => {
  it('draws positioned diagram labels with anchor and colour, without wrapping', () => {
    const svg = actionSvg({ type: 'write', id: 'l', content: 'a long label that must stay on one line', x: 500, y: 300, fontSize: 24, placement: 'absolute', anchor: 'middle', color: '#4ade80' } as VisualAction);
    expect(svg).toContain('text-anchor="middle"');
    expect(svg).toContain('fill="#4ade80"');
    expect((svg.match(/<tspan/g) ?? []).length).toBe(1);
  });
  it('still wraps ordinary flow text and keeps the default ink', () => {
    const long = 'word '.repeat(60);
    const svg = actionSvg({ type: 'write', id: 'p', content: long, x: 80, y: 100, fontSize: 22 } as VisualAction);
    expect((svg.match(/<tspan/g) ?? []).length).toBeGreaterThan(1);
    expect(svg).toContain('#e6faff');
    expect(svg).not.toContain('text-anchor');
  });
  it('escapes attribute values', () => {
    const svg = actionSvg({ type: 'write', id: 'x', content: 'a<b', x: 1, y: 1, placement: 'absolute', color: '"><script>' } as VisualAction);
    expect(svg).not.toContain('<script>');
  });
  it('renders lines, shapes and empty types', () => {
    expect(actionSvg({ type: 'line', id: 'a', startX: 1, startY: 2, endX: 3, endY: 4, style: 'dashed' })).toContain('stroke-dasharray');
    expect(actionSvg({ type: 'shape', id: 'b', shape: 'circle', x: 0, y: 0, width: 10, height: 10 })).toContain('<circle');
    expect(actionSvg({ type: 'pause', id: 'p', durationMs: 5 })).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"></svg>');
  });
});
