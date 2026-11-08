import { describe, it, expect } from 'vitest';
import { figuresFromOps, type Ops } from './page-figures';
import { plainFigureShots } from '../motion-class/figures';

const OPS: Ops = { save: 1, restore: 2, transform: 3, constructPath: 4, paintImageXObject: 5, paintInlineImageXObject: 6, paintImageMaskXObject: 7, paintFormXObjectBegin: 8, paintFormXObjectEnd: 9 };
const path = (x0: number, y0: number, x1: number, y1: number) => [[], [], [x0, y0, x1, y1]];

describe('textbook pictures on a page', () => {
  it('finds a drawing (several strokes) and a photo, with its caption and corner labels, and skips a lone box', () => {
    // page 600 × 800 (PDF space: y up)
    const fn = [4, 4, 4, 4, 1, 3, 5, 2, 4];
    const args: unknown[][] = [
      path(100, 500, 300, 500), path(100, 500, 100, 650), path(100, 500, 300, 650), path(100, 500, 112, 512), // triangle
      [], [200, 0, 0, 140, 330, 120], [], [], // a 200×140 image at (330,120)
      path(50, 20, 250, 60), // one rectangle round some text
    ];
    const text = [
      { str: 'A', box: { x: 90, y: 140, w: 8, h: 10 } },
      { str: 'Figure 6.1 A right triangle', box: { x: 120, y: 312, w: 150, h: 10 } },
      { str: 'Picture 6.2 The sun', box: { x: 360, y: 685, w: 120, h: 10 } },
    ];
    const figs = figuresFromOps(fn, args, OPS, text, 600, 800);
    expect(figs).toHaveLength(2);
    expect(figs[0].kind).toBe('drawing');
    expect(figs[0].near).toContain('Figure 6.1');
    expect(figs[0].box.x).toBeLessThanOrEqual(90); // the label A is inside the crop
    expect(figs[1].kind).toBe('image');
    expect(figs[1].near).toContain('The sun');
  });

  it('explains a picture without AI from its caption, labels and the lesson', () => {
    const shots = plainFigureShots({ box: { x: 0, y: 0, w: 1, h: 1 }, kind: 'drawing', inside: '', near: 'A B C Figure 6.1 A right triangle', image: 'data:image/png;base64,x' }, 'In a right triangle the longest side is the hypotenuse. Plants need sunlight to grow well.');
    expect(shots[0].text.en).toContain('Figure 6.1 A right triangle');
    expect(shots[0].text.en).not.toContain('A B C Figure');
    expect(shots[1].text.en).toContain('A, B, C');
    expect(shots.map((s) => s.text.en).join(' ')).toContain('hypotenuse');
    expect(shots.map((s) => s.text.en).join(' ')).not.toContain('Plants');
    expect(shots.every((s) => s.visual === 'figure' && s.photo)).toBe(true);
  });
});
