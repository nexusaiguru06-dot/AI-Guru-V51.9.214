import { describe, it, expect } from 'vitest';
import { LOOKS, pickLook, introKey, subjectClass, clipFor, loadIntroClips } from './intro-clips';
import { compileClass } from './class';
// @ts-expect-error plain JS module used by the render tool
import * as tool from '../../../tools/hyperframes-intros/pick-look.mjs';
import type { BookBlock } from './segment';
import type { BlockPlan } from './dna/types';

describe('HyperFrames intro clips', () => {
  it('the app and the render tool pick the same look and the same file name', () => {
    expect(tool.LOOKS.map((l: { id: string }) => l.id)).toEqual(LOOKS.map((l) => l.id));
    for (const subject of ['Maths', 'Physics', 'Geography', 'Social Science', undefined]) {
      let prev = -1;
      for (let n = 0; n < 12; n++) {
        const a = pickLook(subject, n, prev, 'Chapter 3');
        expect(a).toBe(tool.pickLook(subject, n, prev, 'Chapter 3'));
        expect(a).not.toBe(prev);
        prev = a;
      }
    }
    for (const look of [0, 3, 7]) expect(introKey({ heading: 'ബഹുപദങ്ങൾ', sub: 'x', lang: 'ml', look })).toBe(tool.introKey({ heading: 'ബഹുപദങ്ങൾ', sub: 'x', lang: 'ml', look }));
  });
  it('subjects get fitting looks', () => {
    expect(subjectClass('Geography')).toBe('earth');
    expect(subjectClass('Chemistry')).toBe('science');
    expect(subjectClass('History')).toBe('general');
    expect(subjectClass('Maths')).toBe('maths');
    for (let n = 0; n < 8; n++) expect(LOOKS[pickLook('Geography', n, -1)].subjects).toContain('earth');
  });
  it('clipFor finds rendered clips only', () => {
    const key = introKey({ heading: 'A', lang: 'en', look: 1 });
    const c = { base: '/x/', clips: { [key]: { file: `${key}.webm`, ms: 5000, look: 'chalk', heading: 'A', lang: 'en' } } };
    expect(clipFor(c, { heading: 'A', lang: 'en', look: 1 })).toEqual({ src: `/x/${key}.webm`, ms: 5000 });
    expect(clipFor(c, { heading: 'A', lang: 'en', look: 2 })).toBeUndefined();
    expect(clipFor(undefined, { heading: 'A', lang: 'en', look: 1 })).toBeUndefined();
  });
  it('a missing or empty manifest means no clips', async () => {
    expect(await loadIntroClips('/x/', (async () => ({ ok: false })) as unknown as typeof fetch)).toBeNull();
    expect(await loadIntroClips('/x/', (async () => ({ ok: true, json: async () => ({ clips: {} }) })) as unknown as typeof fetch)).toBeNull();
    expect(await loadIntroClips('/x/', (async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toBeNull();
  });
  it('compileClass reports every heading intro and attaches a clip when one exists', () => {
    const blocks = [{ id: 'h1', kind: 'heading', text: 'Polynomials' }, { id: 'h2', kind: 'heading', text: 'Zeros' }] as BookBlock[];
    const plans = new Map<string, BlockPlan>(blocks.map((b) => [b.id, { dna: 'concept', read: { en: b.text, ml: 'മലയാളം' } } as unknown as BlockPlan]));
    const seen: Array<{ heading: string; lang: string; look: number; sub?: string }> = [];
    compileClass(blocks, plans, { title: 'Polynomials' }, { headingIntro3d: true, subject: 'Maths', languages: ['en'], onIntro: (r) => seen.push(r) });
    expect(seen.map((s) => s.heading)).toEqual(['Polynomials', 'Zeros']);
    expect(seen[0].sub).toBeUndefined();
    expect(seen[1].sub).toBe('Polynomials');
    expect(seen[0].look).not.toBe(seen[1].look);
    const key = introKey({ heading: 'Zeros', sub: 'Polynomials', lang: 'en', look: seen[1].look });
    const clips = { base: '/c/', clips: { [key]: { file: `${key}.webm`, ms: 5000, look: 'x', heading: 'Zeros', lang: 'en' } } };
    const segs = compileClass(blocks, plans, { title: 'Polynomials' }, { headingIntro3d: true, subject: 'Maths', languages: ['en'], introClips: clips });
    const intro = segs.filter((s) => s.id.includes(':intro:'));
    expect(intro[0].build()[0].layer3d?.clip).toBeUndefined();
    expect(intro[1].build()[0].layer3d?.clip?.src).toBe(`/c/${key}.webm`);
  });
});
