// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { buildReel, drawReelFrame, voiceScript } from '../motion/index';
import { setMeasurer } from '../motion/metrics';
import { FONT } from '../motion/grammar';
import { cleanShot, guessVisual, makeScript, parseMarkup, parseScript, plainText, SAMPLE_EXPLAINERS, scriptWithoutAi } from './script';

const DIR = path.join(process.cwd(), 'public', 'fonts', 'reel');
const mctx = createCanvas(10, 10).getContext('2d');
beforeAll(() => {
  for (const [f, fam] of [['NotoSerif_400Regular.ttf', 'AIGuruSerif'], ['NotoSansMalayalam_400Regular.ttf', 'AIGuruMalayalam'], ['playfair-display-latin-700-normal.woff2', 'AIGuruElegant'], ['playfair-display-latin-600-normal.woff2', 'AIGuruElegant'], ['noto-serif-malayalam-malayalam-400-normal.woff2', 'AIGuruElegantMl'], ['lexend-latin-700-normal.woff2', 'AIGuruModern'], ['anek-malayalam-malayalam-700-normal.woff2', 'AIGuruModernMl']]) {
    const p = path.join(DIR, f); if (fs.existsSync(p)) GlobalFonts.registerFromPath(p, fam);
  }
  setMeasurer((text, px, weight = '400') => { mctx.font = `${weight} ${px}px ${FONT.math}`; return mctx.measureText(text).width; });
});
afterAll(() => setMeasurer(null));
const sample = SAMPLE_EXPLAINERS[0].script;

describe('explainer reels (V51.9.124)', () => {
  it('markup: emphasis and highlight, plain text for the voice', () => {
    expect(parseMarkup('The *Sun* is [very far] away.')).toEqual([
      { text: 'The', em: false, hl: false }, { text: 'Sun', em: true, hl: false }, { text: 'is', em: false, hl: false },
      { text: 'very', em: false, hl: true }, { text: 'far', em: false, hl: true }, { text: 'away.', em: false, hl: false },
    ]);
    expect(plainText('The *Sun* is [very far] away.')).toBe('The Sun is very far away.');
  });
  it('one part per shot, the voice says the plain sentence', () => {
    for (const lang of ['en', 'ml'] as const) {
      const reel = buildReel({ kind: 'explainer', script: sample, lang });
      expect(reel.parts).toHaveLength(sample.shots.length);
      expect(reel.parts.every((p) => p.explainer && p.group === 'explainer')).toBe(true);
      const s = voiceScript(reel);
      expect(s.some((x) => /[*[\]]/.test(x))).toBe(false);
      expect(s.length).toBe(sample.shots.length);
    }
  });
  it('checks an AI script and works without AI', async () => {
    const s = parseScript('```json\n' + JSON.stringify({ title: 'Atoms', shots: [{ text: { en: 'Everything is made of *atoms*.' }, visual: 'atom', label: { en: 'tiny' } }, { text: 'A title', visual: 'title' }, { text: 'Look', visual: 'photo' }, { text: '' }, { text: 'Count', number: { value: 'x' } }] }) + '\n```');
    expect(s.shots.map((x) => x.visual)).toEqual(['atom', 'plain', 'night-sky', 'night-sky']);
    expect(s.shots[0].label?.en).toBe('TINY');
    expect(s.shots[3].number).toBeUndefined();
    expect(cleanShot({ text: { en: 'The Sun is hot.' } })).toMatchObject({ visual: 'planet', planet: 'sun' });
    expect(guessVisual('Electrons go round the nucleus')).toBe('atom');
    const plain = scriptWithoutAi('The Sun is 15 crore km away. Light takes 8 minutes to reach us.');
    expect(plain.shots[0]).toMatchObject({ visual: 'planet', number: { value: 15 } });
    const r = await makeScript('Rain falls from clouds.', async () => 'nope');
    expect(r.by).toBe('plain');
  });
  it('renders frames (for a look) and never a blank frame', () => {
    const out = path.join(process.cwd(), '..', '..', 'explainer-frames');
    fs.mkdirSync(out, { recursive: true });
    for (const lang of ['en', 'ml'] as const) {
      const reel = buildReel({ kind: 'explainer', script: sample, lang }, { voiceMs: (s) => Math.max(1800, s.length * 70) });
      let start = 0;
      reel.parts.forEach((p, i) => {
        const c = createCanvas(1080, 1920);
        const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
        drawReelFrame(ctx, reel, start + p.durationMs * 0.7, { format: 'vertical', handle: 'aiguru.app/j/ANU' });
        const d = c.getContext('2d').getImageData(0, 0, 1080, 1920).data;
        let lit = 0; for (let k = 0; k < d.length; k += 4 * 97) if (d[k] + d[k + 1] + d[k + 2] > 120) lit++;
        expect(lit).toBeGreaterThan(20);
        fs.writeFileSync(path.join(out, `${lang}-${i + 1}.png`), c.toBuffer('image/png'));
        start += p.durationMs;
      });
    }
  }, 60000);
});
