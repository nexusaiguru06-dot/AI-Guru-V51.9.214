/** V51.9.106 — font styles: card fonts, board fonts, Auto, pins. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { BRANCH_EXAMPLES, buildReel, drawReelFrame } from './index';
import { setMeasurer } from './metrics';
import { FONT, MATH_FONT_DEFAULT } from './grammar';
import { BOARD_FONTS, CARD_FONTS, FONT_FAMILIES, LOOK_FONT, LOOK_FONTS, LOOKS, boardStack, withBoardFont } from './look';
import { cleanPins, planStyle } from './variety';

const DIR = path.join(process.cwd(), 'public', 'fonts', 'reel');
const FILES: Array<[string, string]> = [
  ['AIGuruSerif', 'NotoSerif_400Regular.ttf'], ['AIGuruMalayalam', 'NotoSansMalayalam_400Regular.ttf'],
  ['AIGuruRound', 'baloo-2-latin-400-normal.woff2'], ['AIGuruHand', 'kalam-latin-400-normal.woff2'],
  ['AIGuruModern', 'lexend-latin-400-normal.woff2'], ['AIGuruModernMl', 'anek-malayalam-malayalam-400-normal.woff2'],
  ['AIGuruBubbly', 'fredoka-latin-400-normal.woff2'], ['AIGuruBubblyMl', 'manjari-malayalam-400-normal.woff2'],
  ['AIGuruMarker', 'patrick-hand-latin-400-normal.woff2'], ['AIGuruMarkerMl', 'gayathri-malayalam-400-normal.woff2'],
  ['AIGuruElegant', 'playfair-display-latin-400-normal.woff2'], ['AIGuruElegantMl', 'noto-serif-malayalam-malayalam-400-normal.woff2'],
  ['AIGuruComic', 'comic-neue-latin-400-normal.woff2'],
];
const mctx = createCanvas(10, 10).getContext('2d');
beforeAll(() => {
  for (const [fam, f] of FILES) GlobalFonts.registerFromPath(path.join(DIR, f), fam);
  // measures with whatever the board font is at that moment, as the browser does
  setMeasurer((text, px, weight = '400') => { mctx.font = `${weight} ${px}px ${FONT.math}`; return mctx.measureText(text).width; });
});
afterAll(() => setMeasurer(null));

describe('V51.9.106 font styles', () => {
  it('every font style has its files, an English and a Malayalam family, and a stack ending in the serif', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    for (const [, f] of FILES) expect(fs.existsSync(path.join(DIR, f)), f).toBe(true);
    for (const k of CARD_FONTS) {
      expect(FONT_FAMILIES[k][0]).toMatch(/^AIGuru/);
      expect(LOOK_FONT[k]).toContain('AIGuruSerif');
    }
    for (const k of BOARD_FONTS) expect(boardStack(k).endsWith(MATH_FONT_DEFAULT)).toBe(true);
    expect(boardStack('serif')).toBe(MATH_FONT_DEFAULT);
    for (const l of LOOKS) expect(LOOK_FONTS[l.id], l.id).toBeDefined();
  });

  it('the board font is used while building and drawing, and always put back', () => {
    expect(FONT.math).toBe(MATH_FONT_DEFAULT);
    const w = (k: (typeof BOARD_FONTS)[number]) => withBoardFont(k, () => { mctx.font = `400 64px ${FONT.math}`; return mctx.measureText('2x + 3 = 11').width; });
    const widths = new Set(BOARD_FONTS.map(w));
    expect(widths.size).toBeGreaterThanOrEqual(5); // the fonts really differ
    expect(FONT.math).toBe(MATH_FONT_DEFAULT);
    expect(() => withBoardFont('modern', () => { throw new Error('x'); })).toThrow();
    expect(FONT.math).toBe(MATH_FONT_DEFAULT); // put back even after an error
  });

  it('every board font builds and draws a sum and an equation, and the pictures differ', () => {
    const ex = BRANCH_EXAMPLES.find((e) => e.id === 'linear-equation') ?? BRANCH_EXAMPLES[0];
    const shots = new Map<string, string>();
    for (const k of BOARD_FONTS) {
      for (const req of [{ kind: 'arithmetic' as const, text: '478 + 356' }, { kind: 'branch' as const, id: ex.id }]) {
        const reel = withBoardFont(k, () => buildReel(req));
        expect(reel.durationMs).toBeGreaterThan(1000);
        const c = createCanvas(720, 1280);
        const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
        drawReelFrame(ctx, reel, reel.durationMs * 0.6, { format: 'vertical', boardFont: k });
        if (req.kind === 'arithmetic') shots.set(k, c.toDataURL());
      }
      expect(FONT.math).toBe(MATH_FONT_DEFAULT);
    }
    expect(new Set(shots.values()).size).toBe(BOARD_FONTS.length);
  });

  it('Auto picks fonts that suit the look, keeps the serif board often, and never shifts the other choices', () => {
    const date = new Date('2026-10-22T06:00:00Z');
    const cards = new Set<string>(), boards = new Set<string>();
    let serifBoard = 0, suited = 0;
    for (let s = 1; s <= 500; s++) {
      const st = planStyle(s * 2654435761, { date });
      cards.add(st.font); boards.add(st.boardFont);
      if (st.boardFont === 'serif') serifBoard++;
      if (st.font === st.look.font || LOOK_FONTS[st.look.id].card.includes(st.font)) suited++;
      const fixed = planStyle(s * 2654435761, { date, choices: { font: 'comic', boardFont: 'marker' } });
      expect({ ...fixed, font: st.font, boardFont: st.boardFont }).toEqual(st);
      expect([fixed.font, fixed.boardFont]).toEqual(['comic', 'marker']);
    }
    expect(cards.size).toBe(CARD_FONTS.length);
    expect(boards.size).toBe(BOARD_FONTS.length);
    expect(serifBoard / 500).toBeGreaterThan(0.35);
    expect(serifBoard / 500).toBeLessThan(0.8);
    expect(suited / 500).toBeGreaterThan(0.6);
  });

  it('little ones get rounder fonts more often; a board font that is not allowed is ignored; fonts can be pinned', () => {
    const date = new Date('2026-10-22T06:00:00Z');
    const round = (level: 'young' | null) => Array.from({ length: 400 }, (_, i) => planStyle((i + 1) * 40503, { date, level })).filter((s) => ['bubbly', 'rounded', 'comic'].includes(s.font)).length;
    expect(round('young')).toBeGreaterThan(round(null) * 1.3);
    expect(planStyle(7, { choices: { boardFont: 'elegant' } }).boardFont).not.toBe('elegant'); // elegant is for cards only
    expect(cleanPins({ font: 'marker', boardFont: 'comic', look: 'neon' })).toEqual({ font: 'marker', look: 'neon' });
  });
});
