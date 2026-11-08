// @vitest-environment node
/** V51.9.156 — Pro templates (after HyperFrames): valid, readable, first in the library, and every one draws. */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import raw from '../../../../data/ai-guru/opus-style-library.json';
import { PRO_TEMPLATES } from './pro-templates';
import { OpusLibrarySchema, OpusRecipeSchema, recipeChoices, searchRecipes } from './library';
import { ALL_LOOKS, LOOKS, LOOK_FONTS, PRO_LOOKS, lookById, readability } from '../motion/look';
import { buildReel, drawReelFrame } from '../motion/index';
import { setMeasurer } from '../motion/metrics';
import { FONT } from '../motion/grammar';
import { cleanPins, decorateReel, planStyle } from '../motion/variety';
import { TRANSITION_MS } from '../motion/look-draw';

const DIR = path.join(process.cwd(), 'public', 'fonts', 'reel');
const FILES: Array<[string, string]> = [
  ['AIGuruSerif', 'NotoSerif_400Regular.ttf'], ['AIGuruMalayalam', 'NotoSansMalayalam_400Regular.ttf'],
  ['AIGuruRound', 'baloo-2-latin-400-normal.woff2'], ['AIGuruModern', 'lexend-latin-400-normal.woff2'],
  ['AIGuruBubbly', 'fredoka-latin-400-normal.woff2'], ['AIGuruElegant', 'playfair-display-latin-400-normal.woff2'],
];
const mctx = createCanvas(10, 10).getContext('2d');
beforeAll(() => {
  for (const [fam, f] of FILES) GlobalFonts.registerFromPath(path.join(DIR, f), fam);
  setMeasurer((text, px, weight = '400') => { mctx.font = `${weight} ${px}px ${FONT.math}`; return mctx.measureText(text).width; });
});
afterAll(() => setMeasurer(null));

describe('V51.9.156 Pro templates', () => {
  it('ten templates, each valid, with its own Pro look that passes the readability check', () => {
    expect(PRO_TEMPLATES).toHaveLength(10);
    expect(new Set(PRO_TEMPLATES.map((t) => t.choices.look)).size).toBe(10);
    for (const t of PRO_TEMPLATES) {
      expect(OpusRecipeSchema.safeParse(t).success, t.id).toBe(true);
      const look = lookById(t.choices.look);
      expect(look.id, t.id).toBe(t.choices.look);
      expect(look.pro).toBe(true);
      expect(readability(look), look.id).toEqual([]);
      expect(LOOK_FONTS[look.id], look.id).toBeDefined();
    }
  });
  it('the automatic rotation never picks a Pro look; a template or a pin does', () => {
    expect(LOOKS.some((l) => l.pro)).toBe(false);
    expect(ALL_LOOKS).toHaveLength(LOOKS.length + PRO_LOOKS.length);
    for (let i = 0; i < 200; i++) expect(planStyle(i * 7919 + 3).look.pro).toBeFalsy();
    const t = PRO_TEMPLATES[2];
    expect(planStyle(5, { choices: recipeChoices(t) }).look.id).toBe(t.choices.look);
    expect(cleanPins({ look: 'pro-stage' }).look).toBe('pro-stage');
  });
  it('they come first in the style library', () => {
    const lib = OpusLibrarySchema.parse(raw);
    const all = [...PRO_TEMPLATES, ...lib.recipes];
    const first = searchRecipes(all, {}).items.slice(0, 10).map((r) => r.id);
    expect(first).toEqual(PRO_TEMPLATES.map((t) => t.id));
    expect(searchRecipes(all, { category: 'pro' }).total).toBe(10);
    expect(searchRecipes(all, { q: 'poster' }).items[0].id).toBe('opus-pro-exam-tip');
  });
  it('every template draws its title entrance, a part, a transition and a caption (frames differ while animating)', () => {
    const out = process.env.PRO_FRAMES;
    if (out) fs.mkdirSync(out, { recursive: true });
    const base = buildReel({ kind: 'arithmetic', text: '478 + 356', lang: 'en' });
    for (const t of PRO_TEMPLATES) {
      const style = planStyle(11, { choices: { ...recipeChoices(t), opener: t.choices.opener === 'none' ? 'fact' : t.choices.opener } as never });
      const reel = decorateReel(base, { style, kind: 'normal', lang: 'en', sum: '478 + 356', name: 'Anju' });
      expect(reel.parts.length, t.id).toBeGreaterThan(1);
      const p2 = reel.parts[0].durationMs;
      const look = style.look;
      const shot = (ms: number, w = 1080, h = 1920) => {
        const c = createCanvas(w, h);
        drawReelFrame(c.getContext('2d') as unknown as CanvasRenderingContext2D, reel, ms, { format: 'vertical', look, footer: true, download: true, handle: 'ai-guru.app/j/ANJU86PH' });
        return c;
      };
      const frames: Array<[string, number]> = [['title-in', 260], ['title-done', 2000], ['transition', p2 + TRANSITION_MS * 0.45], ['part2', p2 + 2500]];
      const pics = frames.map(([name, ms]) => { const c = shot(ms); if (out) fs.writeFileSync(path.join(out, `${look.id}-${name}.png`), c.toBuffer('image/png')); return c.toDataURL(); });
      expect(pics[0], `${look.id} title entrance`).not.toBe(pics[1]);
      expect(pics[2], `${look.id} transition`).not.toBe(pics[3]);
    }
  });
});
