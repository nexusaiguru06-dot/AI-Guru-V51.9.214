import { describe, expect, it } from 'vitest';
import { fitsWay, parseRaw, rawKindOf, wayLink } from './raw-reels';

describe('raw reels', () => {
  it('reads only well-formed ids, once each', () => {
    expect(parseRaw('?raw=vabc12345,pxyz98765,vabc12345,../x,v1')).toEqual(['vabc12345', 'pxyz98765']);
    expect(parseRaw('')).toEqual([]);
    expect(rawKindOf('pxyz98765')).toBe('part');
    expect(rawKindOf('vabc12345')).toBe('video');
  });
  it('an MP4 goes to Flow and Stock; a part goes to Design, Style and Stock', () => {
    expect(fitsWay('video', 'flow')).toBe(true);
    expect(fitsWay('video', 'stock')).toBe(true);
    expect(fitsWay('video', 'design')).toBe(false);
    expect(fitsWay('part', 'flow')).toBe(false);
    expect(fitsWay('part', 'style')).toBe(true);
  });
  it('links carry only the reels that fit', () => {
    const ids = ['vabc12345', 'pxyz98765'];
    expect(wayLink('/ai-guru/reels/flow', 'flow', ids)).toBe('/ai-guru/reels/flow?raw=vabc12345');
    expect(wayLink('/ai-guru/reels/design', 'design', ids, true)).toBe('/ai-guru/reels/design?raw=pxyz98765&from=class');
    expect(wayLink('/ai-guru/reels/stock', 'stock', ids)).toBe('/ai-guru/reels/stock?raw=vabc12345,pxyz98765');
    expect(wayLink('/ai-guru/reels/flow', 'flow', [])).toBe('/ai-guru/reels/flow');
  });
});

describe('V51.9.213 — the fifth way, Google Omni 1.2', () => {
  it('takes an MP4 like Google Flow does, never a whiteboard part, and has no ?from=class', () => {
    expect(fitsWay('video', 'omni')).toBe(true);
    expect(fitsWay('part', 'omni')).toBe(false);
    expect(wayLink('/ai-guru/reels/omni', 'omni', ['vabcdef1', 'pabcdef2'], true)).toBe('/ai-guru/reels/omni?raw=vabcdef1');
  });
});
