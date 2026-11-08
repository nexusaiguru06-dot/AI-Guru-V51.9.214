import { beforeEach, describe, expect, it } from 'vitest';
import type { RawItem } from './layout';
import { layoutPage, repairGlyphs } from './layout';
import { segmentBook, teachingUnits, type BookBlock } from './segment';
import { blockFeatures, selectDna } from './dna/registry';
import { learnedDnas, removeLearned } from './dna/learned';
import { aiPlanBlock, type Llm } from './plan/ai';
import { offlinePlan } from './plan/offline';
import { validateBlockPlan } from './plan/validate';
import { compileClass, missingMalayalam, segmentReel } from './class';
import { SCERT9_CH1_S1, samplePlanFor } from './samples/scert9-ch1-s1';
import { buildDnaScenes } from './dna/builders';
import type { BlockPlan } from './dna/types';
import { buildClassTimeline } from './interactive-player';

/* ---------------- a synthetic textbook page (layout like SCERT IX) ---------------- */

function line(text: string, x: number, y: number, h = 13): RawItem[] {
  // One item per word, like pdf.js, 6.5 units per character.
  const out: RawItem[] = [];
  let cx = x;
  for (const w of text.split(' ')) {
    out.push({ str: w, x: cx, y, w: w.length * 6.5, h, family: 'serif' });
    cx += w.length * 6.5 + 3.2;
  }
  return out;
}

const PAGE1: RawItem[] = [
  ...line('PAIRS OF EQUATIONS', 59, 581, 29),
  ...line('Mental math and algebra', 57, 545, 16),
  ...line("Let's start with a problem:", 57, 521),
  ...line('There are 100 beads, black and white, in a box; 10 more black than white. How many', 65, 499),
  ...line('black and how many white ?', 65, 483),
  ...line('Taking the number of black beads as x, the number of white is x − 10. Since there are', 57, 455),
  ...line('100 altogether,', 57, 439),
  ...line('x + (x − 10) = 100', 136, 415),
  ...line('We can extract x from this:', 57, 390),
  ...line('2x − 10 = 100', 158, 368),
  ...line('2x = 110', 184, 350),
  ...line('x = 55', 191, 331),
  ...line('Thus we get the number of black beads as 55; and subtracting 10 from this, we can get', 57, 309),
  ...line('the number of white as 45.', 57, 293),
  ...line('Said you had a sieve', 284, 270, 12).map((i) => ({ ...i, family: 'sans-serif' })),
  ...line('We state this as a general result:', 57, 240),
  ...line('Parallel lines the same distance apart cut any other line into equal pieces.', 70, 218),
  ...line('Now try these:', 57, 190),
  ...line('(1) The sum of two numbers is 26 and their difference is 4. What are the numbers ?', 67, 168),
  ...line('(2) Priya bought a bag and a pair of slippers for 1100 rupees. The bag costs 300', 67, 146),
  ...line('rupees more than the slippers. What is the price of the slippers?', 89, 130),
  // Stacked fraction 1/2 inline at the end of a body line, and a folio.
  ...line('The fraction is another form of', 57, 100),
  { str: '1', x: 240, y: 105, w: 5.5, h: 11, family: 'serif' },
  { str: '2', x: 240, y: 95, w: 5.5, h: 11, family: 'serif' },
  ...line('7', 424, 39, 18),
  // Symbol-font minus (Private Use Area) inside an equation.
  { str: '5', x: 250, y: 70, w: 6.5, h: 13 },
  { str: 'x', x: 257, y: 70, w: 5.8, h: 13 },
  { str: '', x: 266, y: 70, w: 0, h: 13, family: 'sans-serif' },
  { str: 'x', x: 276, y: 70, w: 5.8, h: 13 },
  { str: '= 4x', x: 286, y: 70, w: 24, h: 13 },
];

describe('layout reader', () => {
  it('repairs Symbol-font glyphs', () => {
    expect(repairGlyphs('5x  x  2  3 A')).toBe('5x − x × 2 ÷ 3 ∠A');
  });
  it('stacks small numerator/denominator runs into {a/b} tokens and keeps symbol glyphs in the line', () => {
    const L = layoutPage(1, PAGE1);
    const texts = L.fragments.map((f) => f.text);
    expect(texts).toContain('The fraction is another form of {1/2}');
    expect(texts).toContain('5x − x = 4x');
    expect(L.fragments.find((f) => f.text === 'Said you had a sieve')?.role).toBe('bubble');
    expect(L.fragments.find((f) => f.text === '7')?.role).toBe('furniture');
  });
});

describe('segmenter', () => {
  const book = segmentBook([PAGE1]);
  const blocks = book.blocks;
  const kindOf = (start: string) => blocks.find((b) => b.text.startsWith(start))?.kind;
  it('finds the chapter and section', () => {
    expect(book.chapters[0].title).toBe('Pairs of Equations');
    expect(book.chapters[0].sections[0].title).toBe('Mental math and algebra');
  });
  it('types the blocks', () => {
    expect(kindOf('There are 100 beads')).toBe('problem');
    expect(kindOf('x + (x − 10) = 100')).toBe('math');
    expect(blocks.find((b) => b.text.startsWith('2x − 10 = 100'))?.lines.map((l) => l.text)).toEqual(['2x − 10 = 100', '2x = 110', 'x = 55']);
    expect(kindOf('Parallel lines the same distance apart')).toBe('result');
    expect(kindOf('(1) The sum of two numbers')).toBe('exercise');
    expect(blocks.find((b) => b.text.startsWith('(2) Priya'))?.text).toContain('What is the price of the slippers?');
  });
  it('groups a worked solution into one teaching unit', () => {
    const units = teachingUnits(book.chapters[0].sections[0].blocks);
    const worked = units.find((u) => u.text.startsWith('Taking the number of black beads'));
    expect(worked?.kind).toBe('math');
    expect(worked?.text).toContain('x = 55');
    expect(worked?.text).toContain('the number of white as 45');
  });
});

/* ---------------- DNA selection ---------------- */

const block = (kind: BookBlock['kind'], text: string, lines?: BookBlock['lines']): BookBlock => ({
  id: 't',
  kind,
  page: 1,
  chapterId: 'ch1',
  sectionId: 's1',
  text,
  lines: lines ?? text.split('\n').map((t) => ({ text: t, math: kind === 'math' })),
});

describe('DNA selection', () => {
  it.each([
    ['problem', 'The price of a table and chair is 11000 rupees. The price of the table and four chairs is 14000 rupees. What is the price of each ?', 'word-problem'],
    ['math', '2x − 10 = 100\n2x = 110\nx = 55', 'balance-scale'],
    ['math', 'x + y = 11000\n4x + y = 14000', 'balance-pair'],
    ['result', 'Parallel lines the same distance apart cut any other line into equal pieces.', 'key-result'],
    ['prose', "Let's start with a problem:", 'bridge'],
    ['prose', 'If we keep the extra 10 black beads apart for the time being, there are 90 in the box, which means 45 each.', 'mental-math'],
    ['prose', 'Draw a line 6 centimetre long and draw perpendiculars 2 centimetres apart on it. The parallel lines cut the slanted line into equal pieces, see this picture.', 'geometry-construction'],
    ['prose', 'What is the area of a rectangle of sides 26 centimetres and 5 centimetres? 26 × 5 = (20 + 6) × 5', 'area-model'],
  ] as const)('%s "%s" → %s', (kind, text, want) => {
    expect(selectDna(block(kind, text)).dna).toBe(want);
  });
  it('problems, equations and formulas are mandatory; a weak fit asks the AI for a new DNA', () => {
    const sel = selectDna(block('problem', 'Prove that the sum of the angles of a quadrilateral is 360 degrees.'));
    expect(sel.mandatory).toBe(true);
    expect(sel.needsAi).toBe(true);
    expect(sel.dna).toBe('ai-custom');
    expect(selectDna(block('prose', 'We also continue our study of geometry.')).mandatory).toBe(false);
  });
  it('labelled rows choose the words → equations table', () => {
    const b = block('math', '', [
      { text: '2x + 3y = 110', math: true, label: 'Price of 2 pens and 3 notebooks is 110 rupees' },
      { text: '2x + 5y = 170', math: true, label: 'Price of 2 pens and 5 notebooks is 170 rupees' },
    ]);
    b.text = b.lines.map((l) => `${l.label} → ${l.text}`).join('\n');
    expect(blockFeatures(b).labelled).toBe(true);
    expect(selectDna(b).dna).toBe('translate-table');
  });
});

/* ---------------- AI planner (mock model) ---------------- */

const CHAIN_BLOCK = block('math', '2x − 10 = 100\n2x = 110\nx = 55');
const goodChain = {
  dna: 'equation-chain',
  read: { en: '2x − 10 = 100\n2x = 110\nx = 55', ml: 'ഇതിൽ നിന്ന് x കണ്ടെത്താം: 2x − 10 = 100, 2x = 110, x = 55' },
  teach: {
    lines: [
      { tokens: ['2', 'x', '−', '10', '=', '100'], caption: { en: 'We start here.', ml: 'ഇവിടെ നിന്നു തുടങ്ങാം.' } },
      { tokens: ['2', 'x', '=', '110'], caption: { en: 'Add 10 to both sides.', ml: 'ഇരുവശത്തും 10 കൂട്ടുക.' } },
      { tokens: ['x', '=', '55'], caption: { en: 'Divide by 2.', ml: '2 കൊണ്ട് ഹരിക്കുക.' } },
    ],
    solutions: [{ x: 55 }],
  },
};

function scripted(answers: unknown[]): Llm & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (_s: string, user: string) => {
    calls.push(user);
    const a = answers[Math.min(calls.length - 1, answers.length - 1)];
    return typeof a === 'string' ? a : JSON.stringify(a);
  }) as Llm & { calls: string[] };
  fn.calls = calls;
  return fn;
}

describe('AI planner', () => {
  beforeEach(() => learnedDnas().forEach((d) => removeLearned(d.id)));
  const ctx = { chapterTitle: 'Pairs of Equations', sectionTitle: 'Mental math and algebra' };

  it('accepts a valid bilingual plan', async () => {
    const r = await aiPlanBlock(CHAIN_BLOCK, ctx, scripted([goodChain]));
    expect(r.plan.source).toBe('ai');
    expect(r.attempts).toBe(1);
  });

  it('rejects wrong maths, tells the model exactly why, and accepts the fix', async () => {
    const wrong = structuredClone(goodChain);
    wrong.teach.lines[1].tokens = ['2', 'x', '=', '90'];
    const llm = scripted([wrong, goodChain]);
    const r = await aiPlanBlock(CHAIN_BLOCK, ctx, llm);
    expect(r.attempts).toBe(2);
    expect(llm.calls[1]).toContain('"2 x = 90" is not true');
    expect(r.plan.source).toBe('ai');
  });

  it('rejects English copied into Malayalam fields', async () => {
    const lazy = structuredClone(goodChain);
    lazy.teach.lines[0].caption.ml = 'We start here.';
    const llm = scripted([lazy, goodChain]);
    const r = await aiPlanBlock(CHAIN_BLOCK, ctx, llm);
    expect(llm.calls[1]).toContain('must be written in Malayalam script');
    expect(r.plan.source).toBe('ai');
  });

  it('composes, saves and reuses a new DNA when no built-in DNA fits', async () => {
    const quad = block('problem', 'Prove that the sum of the angles of a quadrilateral is 360 degrees.');
    const composed = {
      dna: 'ai-custom',
      newDna: { name: 'Angle sum by triangles', description: 'Split a polygon into triangles, add their angle sums.', keywords: ['angles', 'quadrilateral', 'sum of the angles'] },
      read: { en: quad.text, ml: 'ഒരു ചതുർഭുജത്തിന്റെ കോണുകളുടെ തുക 360 ഡിഗ്രി എന്ന് തെളിയിക്കുക.' },
      teach: {
        segments: [
          {
            dna: 'geometry-construction',
            plan: {
              points: { A: [10, 80], B: [90, 80], C: [80, 15], D: [20, 25] },
              steps: [
                { op: 'polygon', points: ['A', 'B', 'C', 'D'], color: 'ink', say: { en: 'A quadrilateral ABCD.', ml: 'ABCD എന്ന ചതുർഭുജം.' } },
                { op: 'segment', from: 'A', to: 'C', color: 'b', say: { en: 'The diagonal AC makes two triangles.', ml: 'AC എന്ന വികർണം രണ്ടു ത്രികോണങ്ങൾ ഉണ്ടാക്കുന്നു.' } },
              ],
            },
          },
          {
            dna: 'equation-chain',
            plan: {
              lines: [
                { tokens: ['180', '+', '180'], caption: { en: 'Each triangle has 180 degrees.', ml: 'ഓരോ ത്രികോണത്തിനും 180 ഡിഗ്രി.' } },
                { tokens: ['360'], caption: { en: 'Together, 360 degrees.', ml: 'ആകെ 360 ഡിഗ്രി.' }, links: [[0, 0], [2, 0]] },
              ],
            },
          },
        ],
      },
    };
    const r = await aiPlanBlock(quad, ctx, scripted([composed]));
    expect(r.plan.dna).toBe('learned:angle-sum-by-triangles');
    expect(learnedDnas().map((d) => d.id)).toContain('angle-sum-by-triangles');
    // A later, similar block now selects the learned DNA.
    const later = selectDna(block('problem', 'Find the sum of the angles of a pentagon using the quadrilateral idea.'));
    expect(later.dna).toBe('learned:angle-sum-by-triangles');
    expect(buildDnaScenes(r.plan.dna, r.plan.teach, 'ml', 't').length).toBe(2);
  });

  it('falls back to the offline plan (with the reason) when the model keeps failing', async () => {
    const r = await aiPlanBlock(CHAIN_BLOCK, ctx, scripted(['not json at all']));
    expect(r.plan.source).toBe('offline');
    expect(r.plan.warnings?.join(' ')).toContain('AI plan rejected');
  });
});

/* ---------------- class compiler ---------------- */

describe('bilingual class', () => {
  const units = SCERT9_CH1_S1.map((f, i) => ({ ...block('prose', f.startsWith), id: `u${i}`, kind: (f.plan.dna === 'section-intro' ? 'heading' : 'prose') as BookBlock['kind'] }));
  const plans = new Map<string, BlockPlan>(SCERT9_CH1_S1.map((f, i) => [`u${i}`, { ...f.plan, blockId: `u${i}`, source: 'fixture' }]));

  it('every sample plan is valid (structure, Malayalam, maths)', () => {
    for (const [, p] of plans) expect(validateBlockPlan(p), p.dna).toEqual([]);
  });

  it('per block: Read EN → Teach EN → Read ML → Teach ML; bridges are read with the next block', () => {
    const segs = compileClass(units, plans, { title: 'Mental math and algebra' });
    const forBeads = segs.filter((s) => s.blockId === 'u2').map((s) => `${s.phase}:${s.lang}`);
    expect(forBeads).toEqual(['read:en', 'teach:en', 'read:ml', 'teach:ml']);
    expect(segs.some((s) => s.blockId === 'u1')).toBe(false); // the bridge itself has no segment
    const read = segmentReel(segs.find((s) => s.id === 'u2:read:en')!);
    expect(read.parts[0].captions[0].text).toContain("Let's start with a problem");
  });

  it('interactive timeline: segment and step marks line up with the joined class', () => {
    const segs = compileClass(units, plans, { title: 'S' }).filter((s) => s.blockId === 'u2');
    const prepared = segs.map((segment) => ({ segment, reel: segmentReel(segment), clips: null }));
    const tl = buildClassTimeline('S', prepared);
    expect(tl.segments.map((s) => s.label)).toEqual(['Read · English', 'Teach · English', 'Read · മലയാളം', 'Teach · മലയാളം']);
    expect(tl.segments[0].t0).toBe(0);
    for (let i = 1; i < tl.segments.length; i++) expect(tl.segments[i].t0).toBe(tl.segments[i - 1].t1);
    expect(tl.segments.at(-1)!.t1).toBe(tl.reel.durationMs);
    expect(tl.steps.length).toBe(prepared.reduce((n, p) => n + p.reel.parts.reduce((m, q) => m + q.captions.length, 0), 0));
    for (const st of tl.steps) {
      const seg = tl.segments[st.segment];
      expect(st.t0).toBeGreaterThanOrEqual(seg.t0);
      expect(st.t1).toBeLessThanOrEqual(seg.t1 + 1);
      expect(st.t1).toBeGreaterThan(st.t0);
    }
    expect(tl.audio.type).toBe('audio/wav');
    expect(tl.audio.size).toBeGreaterThan(44);
  });

  it('reads-first order and Malayalam skipped when a plan has no Malayalam', () => {
    const p = new Map(plans);
    const off = offlinePlan(block('math', '2x − 10 = 100\n2x = 110\nx = 55'), 'Pairs of Equations', 'S');
    p.set('u6', { ...off, blockId: 'u6' });
    const segs = compileClass(units, p, { title: 'S' }, { order: 'reads-first' });
    expect(segs.filter((s) => s.blockId === 'u2').map((s) => `${s.phase}:${s.lang}`)).toEqual(['read:en', 'read:ml', 'teach:en', 'teach:ml']);
    // The offline chain has Malayalam captions from the solver, but no Malayalam reading text.
    expect(segs.filter((s) => s.blockId === 'u6').map((s) => `${s.phase}:${s.lang}`)).toEqual(['read:en', 'teach:en', 'teach:ml']);
    expect(missingMalayalam({ a: { en: 'x' } })).toBe(true);
  });

  it('English and Malayalam teachings share exactly the same board graphics (maths items)', () => {
    const chain = plans.get('u6')!;
    const en = buildDnaScenes(chain.dna, chain.teach, 'en', 'T')[0];
    const ml = buildDnaScenes(chain.dna, chain.teach, 'ml', 'T')[0];
    const pos = (s: typeof en) =>
      s.items.filter((i) => i.kind === 'text' && !i.id.startsWith('note')).map((i) => `${i.id}:${i.text}@${Math.round(i.x.at(0))},${Math.round(i.y.at(0))}`);
    expect(pos(ml)).toEqual(pos(en));
    expect(ml.captions.map((c) => c.text)).not.toEqual(en.captions.map((c) => c.text));
  });

  it('sample lookup matches by the start of the unit text', () => {
    expect(samplePlanFor('x', 'There are 100 beads, black and white…')?.dna).toBe('word-problem');
  });
});
