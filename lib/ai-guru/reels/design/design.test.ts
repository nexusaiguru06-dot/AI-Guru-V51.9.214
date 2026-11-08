// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { createCanvas, GlobalFonts, type Canvas } from '@napi-rs/canvas';
import { buildReel, drawReelFrame } from '../motion/index';
import { designPartRects } from '../motion/draw';
import { setMeasurer } from '../motion/metrics';
import { FONT } from '../motion/grammar';
import { SAMPLE_STORIES } from '../story/storyboard';
import { cleanDesign, entranceAt, fitToParts, isEmptyDesign, newItem, visibleIn, type DesignLayer } from './layer';
import { itemSize } from './draw-design';

const DIR = path.join(process.cwd(), 'public', 'fonts', 'reel');
const mctx = createCanvas(10, 10).getContext('2d');
beforeAll(() => {
  GlobalFonts.registerFromPath(path.join(DIR, 'NotoSerif_400Regular.ttf'), 'AIGuruSerif');
  GlobalFonts.registerFromPath(path.join(DIR, 'baloo-2-latin-700-normal.woff2'), 'AIGuruRound');
  setMeasurer((text, px, weight = '400') => { mctx.font = `${weight} ${px}px ${FONT.math}`; return mctx.measureText(text).width; });
});
afterAll(() => setMeasurer(null));

const px = (c: Canvas, x: number, y: number) => Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data.slice(0, 3));

describe('Reel designer layer (V51.9.119)', () => {
  it('items: defaults, visibility by part, entrance, fitting a shorter reel', () => {
    const t = newItem('text', { cx: 0.3, part: 2 });
    expect(t).toMatchObject({ kind: 'text', text: 'Your text', cx: 0.3, part: 2 });
    expect(visibleIn(t, 2)).toBe(true);
    expect(visibleIn(t, 1)).toBe(false);
    expect(visibleIn(newItem('sticker'), 5)).toBe(true);
    expect(entranceAt('pop', 0).a).toBe(0);
    expect(entranceAt('pop', 1000)).toEqual({ a: 1, s: 1, dx: 0, dy: 0 });
    expect(entranceAt('slide', 100).dx).toBeLessThan(0);
    const d = fitToParts({ parts: {}, items: [t] }, 2);
    expect(d.items[0].part).toBe(1);
    expect(isEmptyDesign({ parts: { title: { scale: 1 } }, items: [] })).toBe(true);
    expect(isEmptyDesign({ parts: { title: { fill: '#ff0000' } }, items: [] })).toBe(false);
  });
  it('cleans a stored design (bad colours, numbers and kinds dropped)', () => {
    const d = cleanDesign({ parts: { title: { dx: 9, scale: 0, fill: 'red', text: '#00ff00' }, nope: {} }, items: [{ id: 'a', kind: 'sticker', cx: 'x', size: 0.2, color: '#ABCDEF', part: -3, entrance: 'zzz' }, { kind: 'virus' }, { id: 'p', kind: 'photo', src: 'http://evil' }] });
    expect(d.parts.title).toMatchObject({ dx: 1, scale: 0.3, fill: undefined, text: '#00ff00' });
    expect(d.items).toHaveLength(2);
    expect(d.items[0]).toMatchObject({ cx: 0.5, color: '#ABCDEF', part: null, entrance: 'pop' });
    expect(d.items[1].src).toBeUndefined();
  });
  it('part rectangles for the handles', () => {
    const r = designPartRects('vertical', true);
    expect(r.dw).toBe(720);
    expect(r.rects.caption!.y).toBeGreaterThan(r.rects.board!.y);
    expect(r.rects.footer).toBeTruthy();
    expect(designPartRects('square', false).rects.footer).toBeUndefined();
  });
  it('sizes: characters keep their shape, text grows with its words', () => {
    const ch = itemSize(newItem('character', { cast: 'elephant' }), 720, null);
    expect(ch.w).toBeCloseTo(144);
    expect(ch.h).toBeGreaterThan(50);
    const a = itemSize(newItem('text', { text: 'Hi' }), 720, mctx as unknown as CanvasRenderingContext2D);
    const b = itemSize(newItem('text', { text: 'Hello everyone' }), 720, mctx as unknown as CanvasRenderingContext2D);
    expect(b.w).toBeGreaterThan(a.w);
  });
  it('draws: a red background, a moved and recoloured caption, a hidden title, items on their part only', () => {
    const reel = buildReel({ kind: 'story', board: SAMPLE_STORIES[0].board, lang: 'en' });
    const design: DesignLayer = {
      parts: { background: { fill: '#ff0000' }, title: { hidden: true }, caption: { dy: -0.05, fill: '#0000ff', text: '#ffffff' } },
      items: [newItem('shape', { id: 's1', shape: 'rect', color: '#00ff00', cx: 0.5, cy: 0.06, size: 0.3, part: 1, entrance: 'none' }), newItem('character', { cast: 'tiger', cx: 0.8, cy: 0.5, size: 0.25 })],
    };
    const out = path.join(process.cwd(), '..', '..', 'design-frames');
    fs.mkdirSync(out, { recursive: true });
    const frame = (t: number) => { const c = createCanvas(1080, 1920); drawReelFrame(c.getContext('2d') as unknown as CanvasRenderingContext2D, reel, t, { format: 'vertical', footer: true, design }); return c; };
    const p0 = reel.parts[0].durationMs;
    const c0 = frame(p0 * 0.8), c1 = frame(p0 + reel.parts[1].durationMs * 0.6);
    fs.writeFileSync(path.join(out, 'part1.png'), c0.toBuffer('image/png'));
    fs.writeFileSync(path.join(out, 'part2.png'), c1.toBuffer('image/png'));
    expect(px(c0, 20, 20)).toEqual([255, 0, 0]); // background (title hidden)
    expect(px(c1, 540, 115)).toEqual([0, 255, 0]); // the green box only in part 2 …
    expect(px(c0, 540, 115)).toEqual([255, 0, 0]); // … not in part 1
  });
});
