import { beforeEach, describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem } from '../reels/motion';
import { buildDnaScenes } from './dna/builders';
import { sketchProblems, type SketchPlan } from './dna/sketch-math';
import { sketchLayoutProblems } from './dna/sketch-builders';
import { _resetSketchCandidates, exportSketchCandidates, importSketchCandidates, promoteSketch, rejectSketch, saveSketchCandidate, sketchCandidates } from './dna/sketch-library';
import { getLearned, learnedDnas, removeLearned } from './dna/learned';
import { selectDna } from './dna/registry';
import { validatePlan } from './plan/validate';
import { aiPlanBlock, type Llm } from './plan/ai';
import { compileClass } from './class';
import type { BlockPlan } from './dna/types';
import type { BookBlock } from './segment';
import { SKETCH_TRIANGLE_180 } from './samples/ai-sketch';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const block = (text: string, kind: BookBlock['kind'] = 'result'): BookBlock => ({ id: 'b1', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;

describe('ai-sketch: a free board the app checks before drawing', () => {
  it('the sample validates, builds in both languages and draws every frame', () => {
    expect(sketchProblems(SKETCH_TRIANGLE_180)).toEqual([]);
    expect(validatePlan('ai-sketch', SKETCH_TRIANGLE_180, { en: 'x', ml: 'എ' })).toEqual([]);
    for (const lang of ['en', 'ml'] as const) {
      const sc = buildDnaScenes('ai-sketch', SKETCH_TRIANGLE_180, lang, 'T');
      expect(sc.length).toBe(1);
      expect(sc[0].captions.length).toBe(5); // title + 4 steps
      for (const f of [0.05, 0.3, 0.6, 0.99]) for (const format of ['landscape', 'vertical', 'square'] as const) drawMotionFrame(noop, sc[0], sc[0].durationMs * f, { format });
    }
  });
  it('English and Malayalam boards are the same picture (positions and shapes)', () => {
    const [en] = buildDnaScenes('ai-sketch', SKETCH_TRIANGLE_180, 'en', 'T');
    const [ml] = buildDnaScenes('ai-sketch', SKETCH_TRIANGLE_180, 'ml', 'T');
    const pos = (sc: typeof en) => sc.items.map((it) => { const s = evalItem(it, sc.durationMs - 1); return `${it.id}@${s.x.toFixed(1)},${s.y.toFixed(1)}:${JSON.stringify(s.points ?? null)}`; });
    expect(pos(ml)).toEqual(pos(en));
    expect(en.captions.map((c) => c.text)).not.toEqual(ml.captions.map((c) => c.text));
  });
  it('rejects broken names, out-of-board positions, unknown kinds and actions before show', () => {
    const cases: Array<[string, (p: SketchPlan) => void, RegExp]> = [
      ['unknown object', (p) => p.steps[1].do.push({ focus: ['nope'] }), /no object "nope"/],
      ['used before shown', (p) => p.steps[0].do.unshift({ focus: ['par'] }), /not on the board yet/],
      ['shown twice', (p) => p.steps[3].do.push({ show: ['tri'] }), /already shown/],
      ['off the board', (p) => { (p.objects[1] as { x: number }).x = 900; }, /inside the board/],
      ['duplicate id', (p) => { p.objects[2].id = 'la'; }, /used twice/],
      ['bad colour', (p) => { (p.objects[1] as { color: string }).color = 'pink'; }, /color must be one of/],
      ['bad kind', (p) => { (p.objects[1] as { kind: string }).kind = 'star'; }, /is not one of text/],
      ['move a shape', (p) => p.steps[3].do.push({ move: 'tri', to: [10, 10] }), /only a text or a dot can move/],
      ['morph wrong count', (p) => p.steps[3].do.push({ morph: 'tri', points: [[1, 1], [2, 2]] }), /same number of corners/],
      ['never shown', (p) => p.objects.push({ id: 'ghost', kind: 'dot', x: 5, y: 5 }), /never shown/],
      ['too many actions', (p) => p.steps[0].do.push({ dim: ['tri'] }, { dim: ['tri'] }, { dim: ['tri'] }, { dim: ['tri'] }, { dim: ['tri'] }), /at most 6/],
      ['bad action', (p) => p.steps[0].do.push({ explode: ['tri'] } as never), /is not one of show/],
      ['height', (p) => { p.height = 2000; }, /height must be/],
    ];
    for (const [name, mut, re] of cases) {
      const p = clone(SKETCH_TRIANGLE_180);
      mut(p);
      const errs = sketchProblems(p);
      expect(errs.join(' | '), name).toMatch(re);
      expect(validatePlan('ai-sketch', p, { en: 'x', ml: 'എ' }).length, name).toBeGreaterThan(0);
    }
  });
  it('catches text that overlaps, in Malayalam too', () => {
    const p = clone(SKETCH_TRIANGLE_180);
    p.objects.push({ id: 'clash', kind: 'text', x: 205, y: 312, text: { en: 'angle', ml: 'കോൺ' }, size: 30 });
    p.steps[0].do.push({ show: ['clash'] });
    expect(sketchLayoutProblems(p).join(' ')).toMatch(/overlap/);
    expect(validatePlan('ai-sketch', p, { en: 'x', ml: 'എ' }).join(' ')).toMatch(/overlap/);
    expect(sketchLayoutProblems(SKETCH_TRIANGLE_180)).toEqual([]);
  });
  it('a missing Malayalam caption is caught like any DNA (no English in the Malayalam pass)', () => {
    const p = clone(SKETCH_TRIANGLE_180);
    delete (p.steps[1].say as { ml?: string }).ml;
    expect(validatePlan('ai-sketch', p, { en: 'x', ml: 'എ' }).join(' ')).toMatch(/ml/);
  });
  it('can be a segment of a composite, and compiles into a class', () => {
    const composite = { segments: [{ dna: 'ai-sketch', plan: SKETCH_TRIANGLE_180 }] };
    expect(validatePlan('ai-custom', composite, { en: 'x', ml: 'എ' })).toEqual([]);
    const plan = { blockId: 'b1', dna: 'ai-sketch', teach: SKETCH_TRIANGLE_180, read: { en: 'Angles.', ml: 'കോണുകൾ.' }, source: 'ai' } as unknown as BlockPlan;
    const segs = compileClass([block('Angles of a triangle')], new Map([['b1', plan]]), { title: 'T' });
    expect(segs.filter((s) => s.phase === 'teach').map((s) => s.lang)).toEqual(['en', 'ml']);
    for (const s of segs) expect(s.build().length).toBeGreaterThan(0);
  });
  it('is never chosen by the selector on its own (selection of existing blocks is unchanged)', () => {
    for (const t of ['The angles of a triangle add up to 180 degrees.', 'Find the HCF of 12 and 18.', 'Solve 2x + 5 = 25', 'Some prose about numbers.']) {
      const sel = selectDna(block(t, 'prose'));
      expect(sel.dna).not.toBe('ai-sketch');
      expect(sel.ranked.some((r) => r.id === 'ai-sketch')).toBe(false);
    }
  });
});

describe('sketch candidates are reused only after a teacher promotes them', () => {
  beforeEach(() => {
    _resetSketchCandidates();
    for (const d of learnedDnas()) removeLearned(d.id);
  });
  it('save → promote → becomes a learned DNA that similar blocks select', () => {
    const c = saveSketchCandidate({ name: 'Triangle angle sum by parallel line', description: 'Parallel line carries the base angles up', keywords: ['angles', 'triangle', 'sum', '180'], kinds: ['result'], plan: SKETCH_TRIANGLE_180, blockText: 'The sum of the angles of a triangle is 180°.', blockId: 'b1' });
    expect(c.status).toBe('candidate');
    expect(learnedDnas().length).toBe(0); // not reused yet
    expect(selectDna(block('The sum of the angles of a triangle is 180°.')).dna.startsWith('learned:')).toBe(false);
    // the same block drawn again replaces its candidate
    const again = saveSketchCandidate({ ...c, name: 'Another name' });
    expect(again.id).toBe(c.id);
    expect(sketchCandidates().length).toBe(1);
    const l = promoteSketch(c.id)!;
    expect(l.segments).toEqual(['ai-sketch']);
    expect(getLearned(l.id)).toBeTruthy();
    expect(sketchCandidates('promoted').length).toBe(1);
    expect(validatePlan('ai-custom', l.example, { en: 'x', ml: 'എ' })).toEqual([]);
    expect(selectDna(block('The sum of the angles of a triangle is 180°.')).ranked.some((r) => r.id === `learned:${l.id}`)).toBe(true);
    // export / import round trip
    const json = exportSketchCandidates();
    _resetSketchCandidates();
    expect(importSketchCandidates(json)).toBe(1);
    rejectSketch(c.id);
    expect(sketchCandidates('rejected').length).toBe(1);
  });
});

describe('the planner draws a sketch only when nothing else fits', () => {
  beforeEach(() => {
    _resetSketchCandidates();
    for (const d of learnedDnas()) removeLearned(d.id);
  });
  const answer = (dna: string) =>
    JSON.stringify({ dna, newDna: { name: 'Triangle angle sum', description: 'parallel line', keywords: ['triangle', 'angles'] }, read: { en: 'The angles of a triangle add up to 180°.', ml: 'ത്രികോണത്തിന്റെ കോണുകളുടെ തുക 180° ആണ്.' }, teach: SKETCH_TRIANGLE_180 });
  it('needs-AI block: the sketch is accepted, kept as a candidate and flagged for review', async () => {
    let prompt = '';
    const llm: Llm = async (_s, u) => ((prompt = u), answer('ai-sketch'));
    const b = block('Prove that the exterior angle equals the sum of the interior opposite angles, with a figure.', 'result');
    const sel = { ...selectDna(b), needsAi: true, dna: 'ai-custom' as const, reason: 'test' };
    const r = await aiPlanBlock(b, { chapterTitle: 'Angles', sectionTitle: 'Triangles' }, llm, { selection: sel });
    expect(prompt).toMatch(/ai-sketch/);
    expect(r.plan.source).toBe('ai');
    expect(r.plan.dna).toBe('ai-sketch');
    expect(r.sketch?.status).toBe('candidate');
    expect(r.plan.warnings?.join(' ')).toMatch(/not its maths/);
    expect(sketchCandidates().length).toBe(1);
    expect(learnedDnas().length).toBe(0);
  });
  it('a block that has a template: a sketch answer is not taken (the selected DNA is kept)', async () => {
    const llm: Llm = async () => answer('ai-sketch');
    const b = block('Find the HCF and LCM of 12 and 18.', 'problem');
    const r = await aiPlanBlock(b, { chapterTitle: 'Numbers', sectionTitle: 'HCF' }, llm, { maxAttempts: 1 });
    expect(r.plan.dna).not.toBe('ai-sketch');
    expect(sketchCandidates().length).toBe(0);
  });
});
