// @vitest-environment node
import { describe, expect, it } from 'vitest';
import raw from '../../../../data/ai-guru/opus-style-library.json';
import { clipPassage, OpusLibrarySchema, recipeChoices, recipeDirection, searchRecipes, styledLlm, toCard } from './library';
import { planStyle } from '../motion/variety';
import { parseScript, XPLAIN_SYSTEM } from '../explainer/script';

const lib = OpusLibrarySchema.parse(raw);

describe('Opus style library (V51.9.135)', () => {
  it('the file is valid, ids are unique and every upstream record is accounted for', () => {
    const ids = new Set(lib.recipes.map((r) => r.id));
    expect(ids.size).toBe(lib.recipes.length);
    expect(lib.counts.upstream).toBe(703);
    expect(lib.counts.kept + lib.counts.dropped).toBe(lib.counts.upstream);
    expect(lib.counts.kept).toBe(lib.recipes.length);
    expect(lib.recipes.filter((r) => r.recommended).length).toBe(lib.counts.recommended);
    expect(lib.counts.recommended).toBeGreaterThanOrEqual(30);
  });

  it('keeps nothing unsafe for a school reel', () => {
    const bad = /star ?wars|x-?wing|pok[eé]mon|marvel|disney|minecraft|\b(gun|kill|blood|weapon|bomb|zombie|casino|betting|bitcoin|cocktail|beer|wine|vodka|nsfw|horror|fuck)\b/i;
    expect(lib.recipes.filter((r) => bad.test(r.inspiration)).map((r) => r.id)).toEqual([]);
  });

  it('every recipe gives a real engine style (look, camera, fonts the engine has)', () => {
    for (const r of lib.recipes) {
      const s = planStyle(7, { choices: recipeChoices(r) });
      expect(s.look.id).toBe(r.choices.look);
      expect(s.camera).toBe(r.choices.camera);
      expect(s.music).toBe(r.choices.music);
      expect(s.font).toBe(r.choices.font);
      expect(s.boardFont).toBe(r.choices.boardFont);
      expect(s.pace).toBe(r.choices.pace);
    }
  });

  it('search: recommended first, category, mode and words', () => {
    const rec = searchRecipes(lib.recipes);
    expect(rec.total).toBe(lib.counts.recommended);
    expect(rec.items.length).toBeLessThanOrEqual(24);
    const all = searchRecipes(lib.recipes, { view: 'all', limit: 60 });
    expect(all.total).toBe(lib.recipes.length);
    const sci = searchRecipes(lib.recipes, { category: 'science' });
    expect(sci.items.every((r) => r.category === 'science')).toBe(true);
    const forSum = searchRecipes(lib.recipes, { mode: 'sum', view: 'all' });
    expect(forSum.items.every((r) => r.bestFor.includes('sum'))).toBe(true);
    const photon = searchRecipes(lib.recipes, { q: 'photon' });
    expect(photon.items[0]?.name).toMatch(/photon/i);
    const page2 = searchRecipes(lib.recipes, { view: 'all', offset: 24, limit: 24 });
    expect(page2.items[0]?.id).toBe(all.items[24]?.id);
  });

  it('cards are small (no long text for the phone)', () => {
    const c = toCard(lib.recipes[0]) as Record<string, unknown>;
    expect(c.inspiration).toBeUndefined();
    expect(c.tech).toBeUndefined();
    expect(JSON.stringify(c).length).toBeLessThan(1200);
  });

  it('the explainer writer gets the style, and its answer still goes through the same checks', async () => {
    const r = lib.recipes.find((x) => x.visuals.length) ?? lib.recipes[0];
    let seen = '';
    const fake = styledLlm(async (system) => {
      seen = system;
      return JSON.stringify({ title: { en: 'Light' }, shots: [{ text: { en: 'Light is *fast*.' }, visual: 'beam' }, { text: { en: 'It still takes time.' }, visual: 'not-a-visual' }] });
    }, r);
    const script = parseScript(await fake(XPLAIN_SYSTEM, 'x'));
    expect(seen.startsWith(XPLAIN_SYSTEM)).toBe(true);
    expect(seen).toContain(recipeDirection(r).trim().slice(0, 40));
    expect(script.shots.length).toBe(2);
    expect(script.shots.every((s) => s.visual !== ('not-a-visual' as never))).toBe(true);
    expect(styledLlm(async () => 'x', null)).toBeTypeOf('function');
  });

  it('a class part becomes the explainer passage (title first, text of every block)', () => {
    expect(clipPassage({ title: 'Light', blocks: [{ text: 'Light travels.' }, { text: '' }, { text: 'v = 3 × 10^8 m/s' }] })).toBe('Light\nLight travels.\nv = 3 × 10^8 m/s');
  });
});
