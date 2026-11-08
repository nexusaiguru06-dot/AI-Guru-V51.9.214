// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildReel } from './motion/index';
import { makeReel } from './motion/reel';
import { reelFileName, reelInLanguage, reelLanguages } from './share-reel';
import { cleanDesign } from './design/layer';

describe('Share reel (V51.9.121)', () => {
  it('keeps only the parts of one language', () => {
    const en = buildReel({ kind: 'arithmetic', text: '12 + 7', lang: 'en' }).parts.map((p) => ({ ...p, group: 'b1:teach:en' }));
    const ml = buildReel({ kind: 'arithmetic', text: '12 + 7', lang: 'ml' }).parts.map((p) => ({ ...p, group: 'b1:teach:ml' }));
    const both = makeReel('Class', [...en, ...ml]);
    const segs = [{ id: 'b1:teach:en', lang: 'en' as const }, { id: 'b1:teach:ml', lang: 'ml' as const }];
    expect(reelLanguages(segs)).toEqual(['en', 'ml']);
    const r = reelInLanguage(both, segs, 'ml');
    expect(r.parts.every((p) => p.group === 'b1:teach:ml')).toBe(true);
    expect(r.durationMs).toBeLessThan(both.durationMs);
    expect(reelInLanguage(both, [], 'ml')).toBe(both);
  });
  it('file names and card shapes', () => {
    expect(reelFileName('Mental math & algebra', 'ml', 'problem-1')).toBe('Mental-math-algebra-problem-1-ml.mp4');
    expect(cleanDesign({ parts: { title: { shape: 'ribbon' }, caption: { shape: 'zigzag' } } }).parts).toMatchObject({ title: { shape: 'ribbon' }, caption: {} });
    expect(cleanDesign({ parts: { caption: { shape: 'zigzag' } } }).parts.caption?.shape).toBeUndefined();
  });
});
