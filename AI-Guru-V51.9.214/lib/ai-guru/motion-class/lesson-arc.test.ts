import { describe, expect, it } from 'vitest';
import { drawMotionFrame, Motion } from '../reels/motion';
import { sceneStateAt, type MotionScene } from '../reels/motion/engine';
import { tokenWidth } from '../reels/motion/metrics';
import { drawMascot, POSES, setPose, speechBubble, thoughtBubble } from '../reels/motion/mascot';
import { arcScenes } from './dna/arc-builders';
import { arcFor, arcProblems, defaultArc } from './dna/arc-math';
import { buildDnaScenes } from './dna/builders';
import { buildConcept } from './dna/concept-builders';
import { boardProblems, BOARD_MAX_POINTS } from './dna/concept-math';
import { bracePoints, buildIdentityTry, buildPairBrace, identityTry, joinTokens } from './dna/visual-builders';
import { checkLines } from './dna/wp-check';
import { validatePlan } from './plan/validate';
import { textOnlyWarning } from './plan/visual-qa';
import { compileClass } from './class';
import type { BlockPlan, BoardPlan, ChainPlan, LessonArc } from './dna/types';
import type { BookBlock } from './segment';

const B = (en: string, ml = `മല ${en}`) => ({ en, ml });
const get = (sc: MotionScene, id: string) => sc.items.find((i) => i.id === id)!;
const keys = (sc: MotionScene) => sc.items.map((i) => i.id);
const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;

const ARC: LessonArc = {
  hook: B('If both sides stay equal, what can we do to one side?', 'ഇരുവശവും തുല്യമെങ്കിൽ ഒരു വശത്ത് എന്ത് ചെയ്യാം?'),
  why: { question: B('But why does the sign change?', 'ചിഹ്നം മാറുന്നത് എന്തുകൊണ്ട്?'), answer: B('We take 5 from both pans, so it stays level.', 'രണ്ട് തട്ടിൽനിന്നും 5 എടുക്കുന്നു.') },
  formal: { tex: 'x = \\frac{c - b}{a}', say: B('So x equals c minus b over a.', 'അതിനാൽ x = (c − b)/a.') },
  check: { tex: '2 \\times 10 + 5 = 25', say: B('Check: 2 times 10 plus 5 is 25.', 'പരിശോധന: 2 × 10 + 5 = 25.') },
  summary: B('Do the same to both sides.', 'ഇരുവശത്തും ഒരേ കാര്യം ചെയ്യുക.'),
};

/** Everything visible at the end of a scene stays inside the 720-wide board. */
function insideBoard(sc: MotionScene, label: string) {
  const states = sceneStateAt(sc, Math.max(0, sc.durationMs - 100));
  for (const s of states) {
    if (s.alpha < 0.5) continue;
    if (s.kind === 'text') {
      const half = tokenWidth(s.text, s.size) / 2;
      expect(s.x - half, `${label}: "${s.text}" left`).toBeGreaterThanOrEqual(-1);
      expect(s.x + half, `${label}: "${s.text}" right`).toBeLessThanOrEqual(721);
    } else if (s.kind === 'poly' && s.points) {
      for (const [x] of s.points) {
        expect(x, `${label}: ${s.id}`).toBeGreaterThanOrEqual(-2);
        expect(x, `${label}: ${s.id}`).toBeLessThanOrEqual(722);
      }
    }
  }
}

describe('mascot', () => {
  it('draws in every pose and changes pose with a morph', () => {
    for (const pose of POSES) {
      const m = new Motion('m', 720, 444);
      const { mascot, end } = drawMascot(m, 'mc', 118, 318, 1.15, 100, 'idle', 1);
      const t = setPose(m, mascot, pose, end + 100);
      m.hold(t + 400);
      const sc = m.build(300);
      expect(sceneStateAt(sc, sc.durationMs - 50).filter((s) => s.alpha > 0.5).length, pose).toBeGreaterThan(6);
    }
  });
  it('speech and thought bubbles hold their words and stay on the board', () => {
    const m = new Motion('b', 720, 444);
    const { mascot } = drawMascot(m, 'mc', 118, 318, 1.15, 100);
    const long = 'If both sides must stay equal, what can we do to one side of the scale?';
    const th = thoughtBubble(m, 'th', long, 800, { x: 410, y: 118, maxW: 500, toward: [136, 270] });
    const sp = speechBubble(m, 'sp', 'Because we take the same from both.', 800, { x: 410, y: 250, maxW: 500, toward: [136, 270] });
    m.write([...th.lines, ...sp.lines], 1000, 100);
    for (const b of [th, sp]) {
      expect(b.box.x1).toBeLessThanOrEqual(700);
      expect(b.box.x0).toBeGreaterThanOrEqual(10);
    }
    insideBoard(m.build(300), 'bubbles');
    void mascot;
  });
});

describe('lesson arc', () => {
  it('a full arc is valid; wrong shapes explain themselves', () => {
    expect(arcProblems(ARC)).toEqual([]);
    expect(arcProblems(undefined)).toEqual([]);
    expect(arcProblems({})[0]).toMatch(/empty/);
    expect(arcProblems({ hook: { en: 'x' } }, 'arc', true).join(' ')).toMatch(/Malayalam/);
    expect(arcProblems({ formal: { tex: '\\frac{1', say: B('a') } }).join(' ')).toMatch(/formal\.tex/);
    expect(arcProblems({ nonsense: 1 }).join(' ')).toMatch(/not one of/);
    expect(arcProblems({ hook: B('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen') }).join(' ')).toMatch(/words/);
  });
  it('builds hook, why, formal, check and summary in both languages with the same pictures', () => {
    const en = arcScenes(ARC, 'en', 'T');
    const ml = arcScenes(ARC, 'ml', 'T');
    expect(en.before).toHaveLength(1);
    expect(en.after).toHaveLength(4);
    [...en.before, ...en.after].forEach((sc, i) => {
      insideBoard(sc, `arc ${i} en`);
      insideBoard(ml[i < 1 ? 'before' : 'after'][i < 1 ? 0 : i - 1], `arc ${i} ml`);
      const other = ml[i < 1 ? 'before' : 'after'][i < 1 ? 0 : i - 1];
      expect(keys(sc).filter((k) => !/_t\d*$/.test(k) && !/^(fx|cx)_g/.test(k)).sort()).toEqual(keys(other).filter((k) => !/_t\d*$/.test(k) && !/^(fx|cx)_g/.test(k)).sort());
    });
  });
  it('an empty arc adds no scenes; a partial arc adds only what it names', () => {
    expect(arcScenes(undefined, 'en', 'T')).toEqual({ before: [], after: [] });
    const p = arcScenes({ summary: B('Done.') }, 'en', 'T');
    expect(p.before).toHaveLength(0);
    expect(p.after).toHaveLength(1);
  });
  it('mental maths gets a hook by default, from its first line', () => {
    const teach: ChainPlan = { lines: [{ tokens: ['9', '×', '11', '=', '99'], caption: B('x') }] };
    const plan = { blockId: 'b', dna: 'mental-math', read: B('x'), teach, source: 'offline' } as BlockPlan;
    expect(defaultArc(plan)?.hook?.en).toMatch(/9 × 11/);
    expect(arcFor(plan, 'en')).toBeDefined();
    expect(arcFor({ ...plan, dna: 'equation-chain' }, 'en')).toBeUndefined();
  });
  it('Malayalam is skipped (never mixed English) when an arc field has no Malayalam', () => {
    const plan = { blockId: 'b', dna: 'equation-chain', read: B('x'), teach: { lines: [] }, arc: { summary: { en: 'Done.' } }, source: 'ai' } as unknown as BlockPlan;
    expect(arcFor(plan, 'en')).toBeDefined();
    expect(arcFor(plan, 'ml')).toBeUndefined();
  });
  it('the compiled class puts the hook before the unit and the rest after it', () => {
    const blk: BookBlock = { id: 'b', kind: 'math', page: 1, chapterId: 'c', sectionId: 's', lines: [{ text: 'x + 2 = 5', math: true } as BookBlock['lines'][number]], text: 'x + 2 = 5' };
    const teach: ChainPlan = { lines: [{ tokens: ['x', '+', '2', '=', '5'], caption: B('Start.') }, { tokens: ['x', '=', '3'], caption: B('Done.') }] };
    const base = { blockId: 'b', dna: 'equation-chain', read: B('x + 2 = 5'), teach, source: 'ai' } as BlockPlan;
    const without = compileClass([blk], new Map([['b', base]]), { title: 'T' }, { languages: ['en'] });
    const withArc = compileClass([blk], new Map([['b', { ...base, arc: ARC }]]), { title: 'T' }, { languages: ['en'] });
    const count = (s: typeof without) => s.reduce((a, x) => a + (x.phase === 'teach' ? x.build().length : 0), 0);
    expect(count(withArc) - count(without)).toBe(5);
  });
  it('draws in every format and theme', () => {
    const { before, after } = arcScenes(ARC, 'en', 'T');
    for (const sc of [...before, ...after]) for (const format of ['vertical', 'landscape', 'square'] as const) for (const theme of ['light', 'dark'] as const) {
      expect(() => drawMotionFrame(noop, sc, sc.durationMs / 2, { format, theme, stepLabel: 'STEP' } as never)).not.toThrow();
    }
  });
});

describe('concept board layouts', () => {
  const cards: BoardPlan = { heading: B('Kinds'), points: [{ board: B('*Natural* numbers count'), say: B('a') }, { math: ['x', '=', '3'], say: B('b') }, { board: B('Plain words only'), say: B('c') }] };
  const pyramid: BoardPlan = { layout: 'pyramid', heading: B('Systems'), points: ['*Real*', '*Rational*', '*Integers*', '*Whole*'].map((s) => ({ board: B(s), say: B(s) })) };
  const columns: BoardPlan = { layout: 'columns', heading: B('Mean vs median'), heads: [B('Mean'), B('Median')], points: [{ col: 0, board: B('*Add* all'), say: B('a') }, { col: 1, board: B('*Middle* value'), say: B('b') }, { col: 0, board: B('Pulled by extremes'), say: B('c') }] };
  it('each layout validates, builds and stays inside the board in both languages', () => {
    for (const [name, plan] of Object.entries({ cards, pyramid, columns })) {
      expect(boardProblems(plan, 'teach'), name).toEqual([]);
      expect(validatePlan('concept-board', plan, B('read'), true)).toEqual([]);
      for (const lang of ['en', 'ml'] as const) for (const sc of buildConcept(plan, lang, 'T')) insideBoard(sc, `${name} ${lang}`);
    }
  });
  it('one step per idea', () => {
    expect(buildConcept(cards, 'en', 'T')[0].captions).toHaveLength(3);
    expect(buildConcept(pyramid, 'en', 'T')[0].captions).toHaveLength(4);
  });
  it('a pyramid is built from its base: the first point is the widest, lowest band', () => {
    const sc = buildConcept(pyramid, 'en', 'T')[0];
    const ys = ['py0_p', 'py1_p', 'py2_p', 'py3_p'].map((id) => get(sc, id).points!.reduce((a, p) => a + p[1], 0) / 4);
    expect(ys[0]).toBeGreaterThan(ys[1]);
    expect(ys[1]).toBeGreaterThan(ys[3]);
    const width = (id: string) => { const p = get(sc, id).points!; return p[1][0] - p[0][0]; };
    expect(width('py0_p')).toBeGreaterThan(width('py3_p'));
  });
  it('columns put each idea in its own column', () => {
    const sc = buildConcept(columns, 'en', 'T')[0];
    const cx = (id: string) => { const p = get(sc, id).points!; return p.reduce((a, q) => a + q[0], 0) / p.length; };
    expect(cx('cl0_c')).toBeLessThan(360);
    expect(cx('cl1_c')).toBeGreaterThan(360);
    expect(cx('cl2_c')).toBeLessThan(360);
  });
  it('bad plans explain themselves', () => {
    expect(boardProblems({ ...pyramid, points: pyramid.points.slice(0, 2) }, 't').join(' ')).toMatch(/3–5/);
    expect(boardProblems({ ...columns, heads: undefined }, 't').join(' ')).toMatch(/heads/);
    expect(boardProblems({ ...columns, points: columns.points.map((p) => ({ ...p, col: 0 as const })) }, 't').join(' ')).toMatch(/column 1/);
    expect(boardProblems({ ...cards, points: Array.from({ length: BOARD_MAX_POINTS.cards + 1 }, () => cards.points[0]) }, 't').join(' ')).toMatch(/at most/);
    expect(boardProblems({ layout: 'pyramid', heading: B('x'), points: [1, 2, 3].map(() => ({ board: B('a very long line that cannot fit in a narrow band'), say: B('s') })) }, 't').join(' ')).toMatch(/too long/);
    expect(boardProblems({ ...cards, layout: 'spiral' as never }, 't').join(' ')).toMatch(/layout/);
  });
  it('idea cards stay flagged as text, a pyramid and columns do not', () => {
    expect(textOnlyWarning({ dna: 'concept-board', teach: cards })).toMatch(/Text-only/);
    expect(textOnlyWarning({ dna: 'concept-board', teach: pyramid })).toBeUndefined();
    expect(textOnlyWarning({ dna: 'concept-board', teach: columns })).toBeUndefined();
  });
});

describe('visual replacements for text-only DNAs', () => {
  const line = (tokens: string[]) => ({ tokens, caption: B('c') });
  const identity: ChainPlan = { lines: [line(['(', 'x', '+', 'y', ')', '²', '=', 'x', '²', '+', '2', 'x', 'y', '+', 'y', '²'])], solutions: [{ x: 3, y: 4 }] };
  const pair: ChainPlan = { lines: [line(['x', '+', 'y', '=', '11000', '(1)']), line(['4', 'x', '+', 'y', '=', '14000', '(2)'])], solutions: [{ x: 1000, y: 10000 }] };
  it('the evaluator understands powers and refuses a false identity', () => {
    expect(checkLines([{ tokens: identity.lines[0].tokens }], { x: 3, y: 4 })?.[0].left).toBe(49);
    expect(checkLines([{ tokens: identity.lines[0].tokens }], { x: 3, y: 5 })).not.toBeNull(); // (3+5)² = 3²+2·3·5+5² also holds
    expect(checkLines([{ tokens: ['(', 'x', '+', 'y', ')', '²', '=', 'x', '²', '+', 'y', '²'] }], { x: 3, y: 4 })).toBeNull();
  });
  it('identity-formula adds the two-column try after the derivation, only when it can be computed', () => {
    const it = identityTry(identity)!;
    expect(it.value).toBe(49);
    expect(joinTokens(it.left)).toBe('(3 + 4)²');
    expect(buildDnaScenes('identity-formula', identity, 'en', 'T').length).toBe(2);
    expect(buildDnaScenes('identity-formula', { ...identity, solutions: undefined }, 'en', 'T').length).toBe(1);
    expect(buildIdentityTry({ ...identity, solutions: [{ x: 1 }] } as ChainPlan, 'en', 'T')).toBeNull();
    for (const lang of ['en', 'ml'] as const) insideBoard(buildIdentityTry(identity, lang, 'T')!, `try ${lang}`);
  });
  it('equation-pair opens with a brace over the two equations (labels dropped)', () => {
    const sc = buildPairBrace(pair, 'en', 'T')!;
    expect(get(sc, 'q0').text).toBe('x + y = 11000');
    expect(get(sc, 'q1').text).toBe('4 x + y = 14000');
    expect(buildDnaScenes('equation-pair', pair, 'en', 'T').length).toBe(2);
    expect(buildPairBrace({ lines: [pair.lines[0]] }, 'en', 'T')).toBeNull();
    for (const lang of ['en', 'ml'] as const) insideBoard(buildPairBrace(pair, lang, 'T')!, `pair ${lang}`);
    const b = bracePoints(100, 50, 150);
    expect(Math.min(...b.map((p) => p[0]))).toBeLessThan(100);
  });
  it('key result shows a typeset formula in a box when the formula parses, plain tokens otherwise', () => {
    const base = { statement: B('Area is pi r squared.'), say: B('Remember.') };
    const typeset = buildDnaScenes('key-result', { ...base, formula: ['A', '=', 'πr²'] }, 'en', 'T')[0];
    expect(keys(typeset).some((k) => k.startsWith('krf_g'))).toBe(true);
    expect(keys(typeset).includes('krfbox')).toBe(true);
    const plain = buildDnaScenes('key-result', { ...base, formula: ['A', '=', '\\frac{'] }, 'en', 'T')[0];
    expect(keys(plain).includes('kf0')).toBe(true);
    insideBoard(typeset, 'key');
  });
});
