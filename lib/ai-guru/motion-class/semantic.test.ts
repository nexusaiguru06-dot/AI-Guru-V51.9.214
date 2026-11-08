import { describe, expect, it } from 'vitest';
import { DNA_CARDS } from './dna/cards';
import { buildDnaIndex, cosine, decide, hashEmbedder, hybridSelections, normalise, ollamaEmbedder, selectDnaHybrid, truncateTo, type TextEmbedder } from './dna/semantic';
import { selectDna } from './dna/registry';
import type { BookBlock } from './segment';
import { EVAL_SET } from './eval/dna-eval-set';
import { evalBlock, evalHybrid, evalRules } from './eval/run-eval';
import { aiPlanBlock, planSection } from './plan/ai';
import { offlinePlan } from './plan/offline';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b' + text.length, kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });

/** An embedder whose "meaning" is a fixed lookup: lets the tests control similarity exactly. */
function fake(map: (t: string) => number[], name = 'fake'): TextEmbedder {
  return { name, embed: async (texts) => texts.map((t) => normalise(map(t))) };
}
const axisOf = (id: string) => DNA_CARDS.findIndex((c) => c.id === id);

describe('vector helpers', () => {
  it('normalise, cosine, Matryoshka truncation', () => {
    expect(cosine(normalise([3, 4]), normalise([3, 4]))).toBeCloseTo(1);
    expect(cosine(normalise([1, 0]), normalise([0, 1]))).toBeCloseTo(0);
    const t = truncateTo([3, 4, 12, 0], 2);
    expect(t).toHaveLength(2);
    expect(Math.hypot(...t)).toBeCloseTo(1);
  });
});

describe('hash embedder', () => {
  it('is deterministic, unit length, and puts similar wording closer than different wording', async () => {
    const e = hashEmbedder(256);
    const [a, b, c] = await e.embed(['draw the graph of the line', 'draw the graph of the curve', 'the baker sold bread'], 'query');
    expect(a).toEqual((await e.embed(['draw the graph of the line'], 'query'))[0]);
    expect(Math.hypot(...a)).toBeCloseTo(1);
    expect(cosine(a, b)).toBeGreaterThan(cosine(a, c));
  });
  it('works on Malayalam letters', async () => {
    const [a, b, c] = await hashEmbedder(256).embed(['ഒരു നാണയം ടോസ് ചെയ്യുക', 'നാണയം ടോസ് ചെയ്താൽ', 'ത്രികോണം വരയ്ക്കുക'], 'query');
    expect(cosine(a, b)).toBeGreaterThan(cosine(a, c));
  });
});

describe('Ollama embedder (request shape only; the real model is not run here)', () => {
  it('adds the task prefixes, posts to /api/embed, truncates and renormalises', async () => {
    const calls: Array<{ url: string; body: { model: string; input: string[] } }> = [];
    const fetchImpl = (async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true, json: async () => ({ embeddings: JSON.parse(init.body).input.map(() => [3, 4, 0, 0]) }) };
    }) as unknown as typeof fetch;
    const e = ollamaEmbedder({ fetchImpl, dims: 2, model: 'embeddinggemma-2' });
    const q = await e.embed(['hello'], 'query');
    await e.embed(['hello'], 'document');
    expect(calls[0].url).toBe('http://localhost:11434/api/embed');
    expect(calls[0].body.input[0]).toBe('task: search result | query: hello');
    expect(calls[1].body.input[0]).toBe('title: none | text: hello');
    expect(q[0]).toHaveLength(2);
    expect(Math.hypot(...q[0])).toBeCloseTo(1);
  });
  it('a server error or a wrong count throws (the selector then keeps the rules)', async () => {
    const bad = ollamaEmbedder({ fetchImpl: (async () => ({ ok: false, status: 500 })) as unknown as typeof fetch });
    await expect(bad.embed(['x'], 'query')).rejects.toThrow(/500/);
    const short = ollamaEmbedder({ fetchImpl: (async () => ({ ok: true, json: async () => ({ embeddings: [] }) })) as unknown as typeof fetch });
    await expect(short.embed(['x'], 'query')).rejects.toThrow(/wrong number/);
  });
});

describe('hybrid selection decisions', () => {
  // Cards embed on their own axis; the paragraph embeds on the axis the test chooses.
  const cardAxis = (text: string) => {
    const v = new Array(DNA_CARDS.length + 1).fill(0);
    const c = DNA_CARDS.findIndex((x) => x.en.includes(text) || x.ml.includes(text));
    v[c >= 0 ? c : DNA_CARDS.length] = 1;
    return v;
  };
  const paragraph = (id: string, strength = 1) => (t: string) => {
    const v = cardAxis(t);
    if (v.some((x, i) => x && i < DNA_CARDS.length)) return v;
    const w = new Array(DNA_CARDS.length + 1).fill(0);
    w[axisOf(id)] = strength;
    w[DNA_CARDS.length] = 0.2;
    return w;
  };
  const text = 'Rani ate one of the four equal pieces of a cake and Raju two pieces.';
  it('a paragraph that matches a card in meaning but not in keywords is redirected', async () => {
    const e = fake(paragraph('fraction-bars'));
    const index = await buildDnaIndex(e, { cache: false });
    const b = block(text);
    expect(selectDna(b).dna).toBe('concept-board');
    const s = await selectDnaHybrid(b, 'C', index, e);
    expect(s.dna).toBe('fraction-bars');
    expect(s.semantic?.used).toBe(true);
    expect(s.reason).toMatch(/meaning/);
  });
  it('weak similarity changes nothing', async () => {
    const e = fake(paragraph('fraction-bars', 0.05));
    const index = await buildDnaIndex(e, { cache: false });
    const s = await selectDnaHybrid(block(text), 'C', index, e);
    expect(s.dna).toBe('concept-board');
    expect(s.semantic?.used).toBe(false);
  });
  it('a sure rule is never overridden', async () => {
    const e = fake(paragraph('histogram'));
    const index = await buildDnaIndex(e, { cache: false });
    const b = block('The graph of the equation y = 2x + 1 is a straight line, and its slope is 2.');
    const s = await selectDnaHybrid(b, 'C', index, e);
    expect(s.dna).toBe('function-graph');
    expect(s.semantic?.used ?? false).toBe(false);
  });
  it('headings, bridges and equation runs are left to the rules', async () => {
    const e = fake(paragraph('histogram'));
    const index = await buildDnaIndex(e, { cache: false });
    for (const kind of ['heading', 'math'] as const) {
      const b = block('Pairs of equations', kind);
      expect((await selectDnaHybrid(b, 'C', index, e)).dna).toBe(selectDna(b).dna);
    }
  });
  it('an embedder that fails, or no embedder, gives exactly the rule-based selection', async () => {
    const index = await buildDnaIndex(fake(paragraph('fraction-bars')), { cache: false });
    const boom: TextEmbedder = { name: 'boom', embed: async () => { throw new Error('offline'); } };
    const b = block(text);
    expect(await selectDnaHybrid(b, 'C', index, boom)).toEqual(selectDna(b));
    expect(await selectDnaHybrid(b, 'C', null, null)).toEqual(selectDna(b));
  });
  it('one embedding call for a whole section, and only for blocks the rules are unsure about', async () => {
    let calls = 0;
    let seen = 0;
    const base = fake(paragraph('fraction-bars'));
    const e: TextEmbedder = { name: base.name, embed: async (t, k) => { if (k === 'query') { calls++; seen += t.length; } return base.embed(t, k); } };
    const index = await buildDnaIndex(e, { cache: false });
    calls = 0;
    seen = 0;
    const blocks = [block(text), block('The graph of the equation y = 2x + 1 is a straight line, and its slope is 2.'), block('Always check your answer by going back to the question.')];
    const m = await hybridSelections(blocks, 'C', index, e);
    expect(calls).toBe(1);
    expect(seen).toBe(2); // the sure graph block was not embedded
    expect(m.size).toBe(3);
  });
  it('decide() itself refuses to override a sure rule or a heading', async () => {
    const e = fake(paragraph('histogram'));
    const index = await buildDnaIndex(e, { cache: false });
    const [v] = await e.embed(['whatever'], 'query');
    const sure = block('The graph of the equation y = 2x + 1 is a straight line, and its slope is 2.');
    expect(decide(sure, selectDna(sure), v, index).dna).toBe('function-graph');
    const heading = block('Pairs of equations', 'heading');
    expect(decide(heading, selectDna(heading), v, index).dna).toBe(selectDna(heading).dna);
    const run = block('Pairs of equations', 'math'); // weak rules, but an equation run is never redirected
    expect(selectDna(run).score).toBeLessThan(0.8);
    expect(decide(run, selectDna(run), v, index).dna).toBe(selectDna(run).dna);
  });
  it('decide() is pure: same inputs, same answer', async () => {
    const e = fake(paragraph('fraction-bars'));
    const index = await buildDnaIndex(e, { cache: false });
    const b = block(text);
    const [v] = await e.embed([text], 'query');
    expect(decide(b, selectDna(b), v, index)).toEqual(decide(b, selectDna(b), v, index));
  });
});

describe('plumbing: a chosen selection reaches the planner', () => {
  const b = block('Rani ate one of the four equal pieces of a cake and Raju ate two pieces. How much did they eat together?');
  const sel = { ...selectDna(b), dna: 'fraction-bars' as const, score: 0.9, needsAi: false };
  it('offlinePlan honours it (and flags what the offline planner cannot draw)', () => {
    const plan = offlinePlan(b, 'C', 'S', sel);
    expect(plan.dna).toBe('concept-board'); // no fraction written in the text: AI needed, flagged
    expect(plan.warnings?.join(' ')).toMatch(/AI planner needed/);
  });
  it('aiPlanBlock sends the chosen DNA to the model', async () => {
    let user = '';
    const llm = async (_s: string, u: string) => ((user = u), '{"dna":"fraction-bars","read":{"en":"x","ml":"എ"},"teach":{"steps":[{"op":"bar","n":4,"shade":3,"say":{"en":"a","ml":"എ"}}]}}');
    const r = await aiPlanBlock(b, { chapterTitle: 'C', sectionTitle: 'S', before: [], after: [] } as never, llm as never, { selection: sel, maxAttempts: 1 });
    expect(user).toMatch(/SELECTED DNA: fraction-bars/);
    expect(r.selection.dna).toBe('fraction-bars');
  });
  it('planSection takes a selection map', async () => {
    const m = new Map([[b.id, sel]]);
    const progress: string[] = [];
    await planSection([b], { chapterTitle: 'C', sectionTitle: 'S' } as never, null, { selections: m, useCache: false, onProgress: (p) => p.message && progress.push(p.message) });
    expect(progress.join(' ')).toMatch(/fraction-bars/);
  });
});

describe('evaluation harness', () => {
  it('the set is balanced and keeps clear of the card sentences', () => {
    expect(EVAL_SET.filter((i) => i.lang === 'en')).toHaveLength(24);
    expect(EVAL_SET.filter((i) => i.lang === 'ml')).toHaveLength(24);
    const cards = new Set(DNA_CARDS.flatMap((c) => [...c.en, ...c.ml]));
    expect(EVAL_SET.filter((i) => cards.has(i.text))).toEqual([]);
    for (const id of ['plane-transform', 'function-graph', 'fraction-bars', 'histogram', 'probability-tree', 'geometry-construction', 'number-line', 'concept-board']) {
      expect(EVAL_SET.filter((i) => i.expect === id && i.lang === 'ml').length).toBe(3);
    }
  });
  it('rules read Malayalam almost not at all (the gap this module exists for)', () => {
    const r = evalRules();
    expect(r.accuracy.ml).toBeLessThan(0.3);
    expect(r.accuracy.en).toBeGreaterThan(0.5);
  });
  it('rules + hashed n-grams never do worse than rules alone, and read some Malayalam', async () => {
    const rules = evalRules();
    const h = await evalHybrid(hashEmbedder(512), { minCos: 0.4 }); // chosen from the threshold sweep (0.2–0.3 sends 3 plain paragraphs to a picture)
    expect(h.accuracy.all).toBeGreaterThanOrEqual(rules.accuracy.all);
    expect(h.accuracy.en).toBeGreaterThanOrEqual(rules.accuracy.en);
    expect(h.accuracy.ml).toBeGreaterThan(rules.accuracy.ml);
    expect(h.falsePictures).toBeLessThanOrEqual(1);
  });
  it('a short Malayalam instruction is not mistaken for a bridge sentence', () => {
    const it = EVAL_SET.find((i) => i.text.startsWith('AB എന്ന'))!;
    expect(selectDna(evalBlock(it, 0)).dna).not.toBe('bridge');
  });
});
