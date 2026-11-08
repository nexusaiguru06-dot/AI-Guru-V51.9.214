// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { buildReel, drawReelFrame, voiceScript } from '../motion/index';
import { setMeasurer } from '../motion/metrics';
import { FONT } from '../motion/grammar';
import { lookOf, SETTINGS, CAST_KINDS, buildStoryShot, type StoryBoard } from '../motion/recipes/story';
import { guessKind, guessSetting, makeStoryboard, parseShot, parseStoryboard, redoShot, SAMPLE_STORIES, sentences, storyboardWithoutAi, varyShot } from './storyboard';

const DIR = path.join(process.cwd(), 'public', 'fonts', 'reel');
const mctx = createCanvas(10, 10).getContext('2d');
beforeAll(() => {
  GlobalFonts.registerFromPath(path.join(DIR, 'NotoSerif_400Regular.ttf'), 'AIGuruSerif');
  GlobalFonts.registerFromPath(path.join(DIR, 'NotoSansMalayalam_400Regular.ttf'), 'AIGuruMalayalam');
  setMeasurer((text, px, weight = '400') => { mctx.font = `${weight} ${px}px ${FONT.math}`; return mctx.measureText(text).width; });
});
afterAll(() => setMeasurer(null));

const crow = SAMPLE_STORIES[0].board, ammu = SAMPLE_STORIES[1].board;

describe('story reels (V51.9.118)', () => {
  it('a story is one part per shot, with narration and the spoken lines in the voice script', () => {
    for (const lang of ['en', 'ml'] as const) {
      const reel = buildReel({ kind: 'story', board: ammu, lang });
      expect(reel.parts).toHaveLength(ammu.shots.length);
      expect(reel.parts.every((p) => p.group === 'story')).toBe(true);
      const script = voiceScript(reel);
      expect(script.length).toBeGreaterThanOrEqual(ammu.shots.length);
      expect(script.some((s) => s.includes(lang === 'ml' ? 'സത്യസന്ധത' : 'Honesty'))).toBe(true);
      expect(reel.durationMs).toBeGreaterThan(4 * 4000);
    }
  });
  it('a character looks the same in every shot', () => {
    const a = lookOf({ id: 'ammu', kind: 'girl' });
    expect(lookOf({ id: 'ammu', kind: 'girl' })).toEqual(a);
    const s1 = buildStoryShot(ammu, 0, 'en'), s3 = buildStoryShot(ammu, 3, 'en');
    const fills = (sc: typeof s1, k: number) => sc.items.filter((i) => i.id.startsWith(`c${k}_`)).map((i) => i.fill.at(1e9)).sort();
    // Ammu is the only one in shot 1 and the second in shot 4: same colours
    expect(fills(s3, 1)).toEqual(fills(s1, 0));
  });
  it('the name shows only the first time a character appears', () => {
    expect(buildStoryShot(ammu, 0, 'en').items.some((i) => i.text === 'Ammu')).toBe(true);
    expect(buildStoryShot(ammu, 1, 'en').items.some((i) => i.text === 'Ammu')).toBe(false);
    expect(buildStoryShot(ammu, 2, 'en').items.some((i) => i.text === 'Grandpa Raghavan')).toBe(true);
  });
  it('every setting and every character kind can be drawn', () => {
    const board: StoryBoard = { title: { en: 'All' }, cast: CAST_KINDS.map((k, i) => ({ id: `k${i}`, name: { en: k }, kind: k })), shots: [] };
    for (let i = 0; i < CAST_KINDS.length; i += 4) for (const s of SETTINGS) board.shots.push({ setting: s, who: board.cast.slice(i, i + 4).map((c) => c.id), action: 'enter', narration: { en: `${s} ${i}` }, line: { who: `k${i}`, text: { en: 'Hello there, friends of the class!' } } });
    for (let i = 0; i < board.shots.length; i++) expect(() => buildStoryShot(board, i, 'en')).not.toThrow();
  });
  it('renders frames (preview pictures for a look)', () => {
    const out = path.join(process.cwd(), '..', '..', 'story-frames');
    fs.mkdirSync(out, { recursive: true });
    for (const [name, board, lang] of [['crow', crow, 'en'], ['ammu', ammu, 'ml']] as const) {
      const reel = buildReel({ kind: 'story', board, lang });
      let start = 0;
      reel.parts.forEach((p, i) => {
        const c = createCanvas(1080, 1920);
        drawReelFrame(c.getContext('2d') as unknown as CanvasRenderingContext2D, reel, start + p.durationMs * 0.8, { format: 'vertical' });
        fs.writeFileSync(path.join(out, `${name}-${i + 1}.png`), c.toBuffer('image/png'));
        start += p.durationMs;
      });
    }
  }, 30000);
});

describe('storyboards', () => {
  it('tidies an AI answer: unknown values fixed, speaker added to the shot, limits kept', () => {
    const b = parseStoryboard('```json\n' + JSON.stringify({
      title: { en: 'Kunjali', ml: 'കുഞ്ഞാലി' },
      cast: [{ id: 'k', name: { en: 'Kunjali' }, kind: 'admiral' }, { id: 'c', name: { en: 'Crow' }, kind: 'crow' }],
      shots: [
        { setting: 'Sea', who: [], action: 'fly', props: ['pot', 'sword'], narration: { en: 'Ships came.', ml: 'കപ്പലുകൾ വന്നു.' }, line: { who: 'k', text: { en: 'Stand firm!' } } },
        { setting: 'mars', who: ['c', 'zzz'], action: 'fly', narration: 'The crow watched.' },
        { setting: 'river', who: ['k'], narration: '' },
      ],
    }) + '\n```');
    expect(b.cast.map((c) => c.kind)).toEqual(['man', 'bird']);
    expect(b.shots).toHaveLength(2);
    expect(b.shots[0]).toMatchObject({ setting: 'sea', who: ['k'], action: 'enter', props: ['pot'] });
    expect(b.shots[1]).toMatchObject({ setting: 'village', who: ['c'], action: 'fly' });
    expect(() => parseStoryboard('{"shots":[]}')).toThrow();
  });
  it('without AI: sentences become shots, setting and characters guessed', () => {
    const b = storyboardWithoutAi('Once a crow was very thirsty. It flew over the field. Then it found a pot near a house. "I need water," said the crow.');
    expect(b.cast.some((c) => c.kind === 'bird')).toBe(true);
    expect(b.shots.length).toBeGreaterThanOrEqual(2);
    expect(b.shots.some((s) => s.line?.text.en === 'I need water,')).toBe(true);
    const ml = storyboardWithoutAi('ഒരു ദിവസം രാത്രി ആന കാട്ടിലൂടെ നടന്നു. പുഴയുടെ അടുത്ത് എത്തി.');
    expect(ml.shots[0].setting).toBe('night');
    expect(ml.shots[0].narration.ml).toContain('ആന');
    expect(guessSetting('The king sat on his throne')).toBe('palace');
    expect(guessKind('grandmother')).toBe('grandmother');
    expect(sentences('One. Two! Three?')).toEqual(['One.', 'Two!', 'Three?']);
  });
  it('AI failure falls back; redo a shot with and without AI', async () => {
    const r = await makeStoryboard('Ravi went to school. Ravi met his teacher.', async () => 'not json');
    expect(r.by).toBe('plain');
    expect(r.note).toMatch(/AI could not/);
    const shot = { ...ammu.shots[2] };
    expect(varyShot(shot, ammu)).toMatchObject({ action: 'walk', who: ['raghavan', 'ammu'] });
    const ai = await redoShot(ammu, 0, async () => JSON.stringify({ setting: 'home', who: ['ammu'], action: 'stand', narration: { en: 'Ammu at home.' } }));
    expect(ai).toMatchObject({ by: 'ai', shot: { setting: 'home' } });
    expect(parseShot({ shots: [{ narration: 'x', who: ['nobody'] }] }, ammu).who).toEqual([]);
  });
});
