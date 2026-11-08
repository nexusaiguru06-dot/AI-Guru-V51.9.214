import { describe, expect, it } from 'vitest';
import { drawMotionFrame, type MotionScene } from '../reels/motion';
import { checkLines } from './dna/wp-check';
import { buildDnaScenes } from './dna/builders';
import { offlinePlan, offlineWordProblem } from './plan/offline';
import { compileClass, problemFor, withProblem } from './class';
import type { BookBlock } from './segment';

const TABLE = "The price of a table and chair is 11000 rupees. The price of the table and four chairs is 14000 rupees. What's the price of each ?";
const blockOf = (text: string, kind = 'problem'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false }], text } as unknown as BookBlock);

/** A canvas stub that records every filled/stroked text. */
function noopCtx() {
  const texts: string[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(t, k: string) {
      if (k === 'measureText') return (s: string) => ({ width: s.length * 8 });
      if (k === 'fillText' || k === 'strokeText') return (s: string) => { texts.push(s); };
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (k in t) return t[k];
      return () => undefined;
    },
    set(t, k: string, v) { t[k] = v; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, texts };
}

describe('wp-check', () => {
  it('puts the answers into every equation and evaluates both sides', () => {
    const r = checkLines([{ tokens: ['x', '+', 'y', '=', '11000'] }, { tokens: ['4', 'x', '+', 'y', '=', '14000'] }], { x: 1000, y: 10000 });
    expect(r).not.toBeNull();
    expect(r![0].tokens.join(' ')).toBe('1000 + 10000 = 11000');
    expect(r![1].tokens.join(' ')).toBe('4 × 1000 + 10000 = 14000');
    expect(r!.every((l) => l.ok)).toBe(true);
  });
  it('never shows a false check', () => {
    expect(checkLines([{ tokens: ['x', '+', 'y', '=', '11000'] }], { x: 1000, y: 9000 })).toBeNull();
  });
  it('returns null for nothing to check or an unreadable equation', () => {
    expect(checkLines([], { x: 1 })).toBeNull();
    expect(checkLines([{ tokens: ['x', '+', 'y', '=', '5'] }], undefined)).toBeNull();
    expect(checkLines([{ tokens: ['x', '+', '=', '5'] }], { x: 1, y: 4 })).toBeNull();
    expect(checkLines([{ tokens: ['x', '=', '2', '÷', '0'] }], { x: 1 })).toBeNull();
  });
  it('handles brackets, minus and division', () => {
    const r = checkLines([{ tokens: ['2', '(', 'x', '−', '1', ')', '=', '8'] }, { tokens: ['y', '÷', '2', '=', '3'] }], { x: 5, y: 6 });
    expect(r?.length).toBe(2);
  });
});

describe('offlineWordProblem', () => {
  it('reads the table and chair problem', () => {
    const p = offlineWordProblem(TABLE)!;
    expect(p).not.toBeNull();
    expect(p.unknowns.length).toBe(2);
    expect(p.equations.map((e) => e.tokens.join(' '))).toEqual(['x + y = 11000', '4 x + y = 14000']);
    expect(p.unknowns.every((u) => u.meaning.en && u.meaning.ml)).toBe(true);
    expect(p.equations.every((e) => e.phrase.en && e.phrase.ml)).toBe(true);
  });
  it('reads a sum and difference problem', () => {
    const p = offlineWordProblem('The sum of two numbers is 50 and their difference is 14. Find the numbers.');
    expect(p).not.toBeNull();
    expect(p!.equations.length).toBe(2);
  });
  it('returns null for text it cannot read', () => {
    expect(offlineWordProblem('Discuss the history of numbers.')).toBeNull();
  });
  it('offlinePlan gives a drawable word-problem plan (no text-only warning)', () => {
    const plan = offlinePlan(blockOf(TABLE), 'Pairs of equations', 'Sec');
    expect(plan.dna).toBe('word-problem');
    expect((plan.teach as { unknowns?: unknown[] }).unknowns?.length).toBe(2);
    expect((plan.warnings ?? []).join(' ')).not.toMatch(/AI planner needed/);
  });
});

describe('word-problem scenes', () => {
  const plan = offlinePlan(blockOf(TABLE), 'Pairs of equations', 'Sec');
  const en = buildDnaScenes(plan.dna, plan.teach, 'en', 'T');
  const ml = buildDnaScenes(plan.dna, plan.teach, 'ml', 'T');
  const textsOf = (s: MotionScene) => s.items.filter((i) => i.kind === 'text').map((i) => i.text);
  it('has unknowns/equations, solving, check and answer', () => {
    expect(en.length).toBeGreaterThanOrEqual(4);
    const all = en.flatMap(textsOf);
    expect(all).toContain('11000');
    expect(all).toContain('1000');
    expect(all).toContain('10000');
    expect(en.some((s) => s.items.some((i) => i.kind === 'text' && i.text === '×'))).toBe(true);
  });
  it('pins the problem on every scene', () => {
    expect(en.every((s) => s.problem === TABLE)).toBe(true);
    expect(en.every((s) => s.problemLabel === 'PROBLEM')).toBe(true);
    expect(ml.every((s) => s.problemLabel === 'പ്രശ്നം')).toBe(true);
  });
  it('English and Malayalam pictures are the same (same item count per scene; the answer card is words, so it differs)', () => {
    expect(ml.length).toBe(en.length);
    expect(ml.slice(2, -1).map((s) => s.items.length)).toEqual(en.slice(2, -1).map((s) => s.items.length));
  });
  it('captions are present and the check scene ends with a tick for each equation', () => {
    expect(en.every((s) => s.captions.length > 0)).toBe(true);
    const check = en[en.length - 2];
    expect(check.items.filter((i) => i.id.startsWith('cktick')).length).toBe(2);
  });
});

describe('problem card layout', () => {
  const plan = offlinePlan(blockOf(TABLE), 'Pairs of equations', 'Sec');
  const scenes = buildDnaScenes(plan.dna, plan.teach, 'en', 'T');
  for (const format of ['vertical', 'landscape', 'square'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      it(`draws the card and the board in ${format} ${theme} at every caption`, () => {
        for (const sc of scenes) for (const cap of sc.captions) {
          const { ctx, texts } = noopCtx();
          expect(() => drawMotionFrame(ctx, sc, cap.t1 - 40, { format, theme, stepLabel: 'STEP' } as never)).not.toThrow();
          expect(texts.join(' ')).toContain('PROBLEM');
          expect(texts.join(' ')).toContain('11000');
        }
      });
    }
  }
  it('a scene without a problem keeps the old title', () => {
    const { ctx, texts } = noopCtx();
    const sc = { ...scenes[0], problem: undefined, title: 'My Title' } as MotionScene;
    drawMotionFrame(ctx, sc, 500, { format: 'vertical', theme: 'light', stepLabel: 'STEP' } as never);
    expect(texts.join(' ')).not.toContain('PROBLEM');
  });
});

describe('problemFor / withProblem', () => {
  it('uses the exercise text for a problem block', () => {
    const b = blockOf('Solve x² − 5x + 6 = 0.');
    expect(problemFor(b, { dna: 'quadratic-solve', teach: {} } as never, 'en')).toBe('Solve x² − 5x + 6 = 0.');
  });
  it('skips ordinary text and over-long blocks', () => {
    expect(problemFor(blockOf('Some theory.', 'paragraph'), { dna: 'concept-board', teach: {} } as never, 'en')).toBeUndefined();
    expect(problemFor(blockOf('x'.repeat(400)), { dna: 'linear-system', teach: {} } as never, 'en')).toBeUndefined();
  });
  it('does not overwrite a scene that already has a problem', () => {
    const a = { problem: 'keep' } as MotionScene;
    const b = {} as MotionScene;
    withProblem([a, b], 'new', 'en');
    expect(a.problem).toBe('keep');
    expect(b.problem).toBe('new');
  });
});

describe('compileClass', () => {
  it('the teach segment carries the problem card in both languages', () => {
    const b = blockOf(TABLE);
    const plan = offlinePlan(b, 'Pairs', 'Sec');
    const segs = compileClass([b], new Map([['b', plan]]), { title: 'T' }, { read: false });
    for (const seg of segs) {
      const scenes = seg.build();
      expect(scenes.length).toBeGreaterThan(0);
      expect(scenes.every((s) => !!s.problem)).toBe(true);
    }
  });
});
