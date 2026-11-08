import { describe, it, expect, afterEach } from 'vitest';
import { expressionFor, headingIntroScene, INTRO_MS, symbolsFor } from './heading-intro';
import { compileClass } from './class';
import { drawMotionFrame } from '../reels/motion/draw';
import { setLayer3dRenderer } from '../reels/motion/layer3d';

afterEach(() => setLayer3dRenderer(null));

describe('heading intro', () => {
  it('picks a key expression from the heading', () => {
    expect(expressionFor('Polynomials')).toContain('P(x)');
    expect(expressionFor('Quadratic Equations')).toContain('ax²');
    expect(expressionFor('Zebras')).toBeUndefined();
  });
  it('chooses symbols by subject', () => {
    expect(symbolsFor('Science Class 9')).toContain('H₂O');
    expect(symbolsFor('Mathematics')).toContain('π');
  });
  it('builds a scene with a 3D layer and a 2D fallback', () => {
    const sc = headingIntroScene({ heading: 'Polynomials', sub: 'Zeros and factors', lang: 'en', title: 'Polynomials' });
    expect(sc.layer3d?.expr).toContain('P(x)');
    expect(sc.durationMs).toBeGreaterThanOrEqual(INTRO_MS);
    expect(sc.items.length).toBeGreaterThan(0);
  });
  it('compileClass adds intro segments only for headings, only when enabled', () => {
    const blocks = [{ id: 'h1', kind: 'heading', text: 'Polynomials', page: 1 }, { id: 'p1', kind: 'paragraph', text: 'Hello', page: 1 }] as never[];
    const plans = new Map<string, never>([
      ['h1', { dna: 'section-intro', read: { en: 'Polynomials', ml: 'ബഹുപദങ്ങൾ' }, teach: null } as never],
      ['p1', { dna: 'bridge', read: { en: 'Hello' }, teach: null } as never],
    ]);
    const off = compileClass(blocks, plans, { title: 'Ch 2' });
    expect(off.some((s) => s.id.includes(':intro:'))).toBe(false);
    const on = compileClass(blocks, plans, { title: 'Ch 2' }, { headingIntro3d: true });
    const ids = on.filter((s) => s.id.includes(':intro:')).map((s) => s.id);
    expect(ids).toEqual(['h1:intro:en', 'h1:intro:ml']);
    expect(on[0].pill).toBe('INTRO');
    // two headings in a row get different looks; English and Malayalam of one heading share a look
    const b2 = [...blocks.slice(0, 1), { id: 'h2', kind: 'heading', text: 'Zeros', page: 1 }] as never[];
    const p2 = new Map(plans); p2.set('h2', { dna: 'section-intro', read: { en: 'Zeros', ml: 'പൂജ്യങ്ങൾ' }, teach: null } as never);
    const two = compileClass(b2, p2, { title: 'Ch 2' }, { headingIntro3d: true }).filter((s) => s.id.includes(':intro:'));
    const v = two.map((s) => s.build()[0].layer3d?.variant);
    expect(v[0]).toBe(v[1]); expect(v[2]).toBe(v[3]); expect(v[0]).not.toBe(v[2]);
  });
  it('draws the 3D picture and returns early, or falls back without a renderer', () => {
    const sc = headingIntroScene({ heading: 'Polynomials', lang: 'en', title: 'Polynomials' });
    const calls: string[] = [];
    const ctx = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? { width: 1280, height: 720 } : (..._a: unknown[]) => { calls.push(String(k)); return { width: 10, actualBoundingBoxAscent: 5, actualBoundingBoxDescent: 2 }; }), set: () => true }) as unknown as CanvasRenderingContext2D;
    drawMotionFrame(ctx, sc, 3000, { format: 'landscape' });
    expect(calls).not.toContain('drawImage');
    setLayer3dRenderer(() => ({}) as CanvasImageSource);
    calls.length = 0;
    drawMotionFrame(ctx, sc, 3000, { format: 'landscape' });
    expect(calls).toContain('drawImage');
  });
});
