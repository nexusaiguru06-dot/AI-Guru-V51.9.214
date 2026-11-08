import { MISTAKES } from '../features';
import { describe, expect, it } from 'vitest';
import { evalItem } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { mathProblem } from '../reels/motion/typeset';
import { glyphTexts, labelRows, locateParts } from '../reels/motion/decompose';
import { arcProblems, arcFor, autoMistake } from './dna/arc-math';
import { arcScenes, buildFormal, buildMistake } from './dna/arc-builders';
import { hlSplit } from './dna/hl-math';
import { compileClass } from './class';
import { qaCaptions } from './plan/qa';
import { wordingProblems } from './plan/wording';
import { lintPlan } from './lint';
import { prepareSegment } from './player';
import { buildClassTimeline } from './interactive-player';
import { placeQuestions } from './interactive/questions';
import type { BalPlan, BlockPlan, HlPlan, LessonArc } from './dna/types';
import type { BookBlock } from './segment';
import { HL_SAMPLE_12_18, HL_SAMPLE_COPRIME } from './samples/hcf-lcm';
import { BAL_SAMPLES, BAL_TWO_STEP_SAMPLE, BAL_MINUS_SAMPLE } from './samples/balance-scale';

const block = (id: string, text: string): BookBlock => ({ id, kind: 'problem', page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const plan = (blockId: string, dna: string, teach: unknown, arc?: LessonArc): BlockPlan => ({ blockId, dna, teach, read: { en: 'Read.', ml: 'വായിക്കുക.' }, source: 'ai', ...(arc ? { arc } : {}) }) as unknown as BlockPlan;
const ML = /[ഀ-ൿ]/;
const nums = (tex: string) => (tex.match(/-?\d+/g) ?? []).map(Number);

/** Text items visible at time t: none overlaps another on the same line or leaves the 720-wide board. */
function layoutClean(sc: ReturnType<typeof buildMistake>, t: number): string[] {
  const st = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, t)).filter((s) => s.alpha > 0.5).map((q) => ({ q, l: q.x - tokenWidth(q.text, q.size) / 2, r: q.x + tokenWidth(q.text, q.size) / 2 }));
  const bad: string[] = [];
  for (const b of st) if (b.l < 2 || b.r > 718) bad.push(`off board: ${b.q.text}`);
  for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
    if (Math.abs(st[i].q.y - st[j].q.y) > 14) continue;
    if (Math.max(st[i].l, st[j].l) - Math.min(st[i].r, st[j].r) < -1.5) bad.push(`overlap: ${st[i].q.text} / ${st[j].q.text}`);
  }
  return bad;
}

describe('the app\'s own common mistakes are true where they must be', () => {
  it('HCF/LCM: wrong = a × b, right = a × b ÷ HCF = LCM, for every pair to 120 that shares a prime; none for co-prime', () => {
    let n = 0;
    for (let a = 2; a <= 120; a++) for (let b = a + 1; b <= 120; b++) {
      const s = hlSplit(a, b);
      const mk = autoMistake({ dna: 'hcf-lcm', teach: { ...HL_SAMPLE_12_18, a, b } as HlPlan });
      if (s.hcf === 1) {
        expect(mk).toBeUndefined();
        continue;
      }
      n++;
      expect(nums(mk!.wrong.tex)).toEqual([a, b, a * b]);
      const [ab, h, l] = nums(mk!.right.tex);
      expect([ab, h, l]).toEqual([a * b, s.hcf, s.lcm]);
      expect(ab / h).toBe(l); // the right line is TRUE
      expect(a * b).not.toBe(s.lcm); // the wrong line really is wrong
      expect(mathProblem(mk!.wrong.tex)).toBeNull();
      expect(mathProblem(mk!.right.tex)).toBeNull();
    }
    expect(n).toBeGreaterThan(2000);
  });
  it('balance scale: the right line moves the term with its sign changed (and gives a·x), the wrong one does not', () => {
    for (let a = 1; a <= 4; a++) for (let b = -12; b <= 12; b++) {
      if (b === 0) continue;
      for (let x = 1; x <= 20; x++) {
        const c = a * x + b;
        const mk = autoMistake({ dna: 'balance-scale', teach: { ...BAL_TWO_STEP_SAMPLE, title: undefined, a, b, c } as BalPlan })!;
        expect(mk.at).toBe('before');
        const right = mk.right.tex.split('\\Rightarrow')[1];
        const wrong = mk.wrong.tex.split('\\Rightarrow')[1];
        const val = (rhs: string) => {
          const m = rhs.match(/=\s*(-?\d+)\s*([+-])\s*(\d+)/)!;
          return Number(m[1]) + (m[2] === '+' ? 1 : -1) * Number(m[3]);
        };
        expect(val(right)).toBe(a * x);
        expect(val(wrong)).not.toBe(a * x);
        expect(mathProblem(mk.right.tex)).toBeNull();
      }
    }
    // no move step, or nothing to move: no mistake scene
    expect(autoMistake({ dna: 'balance-scale', teach: { ...BAL_TWO_STEP_SAMPLE, b: 0, c: 20 } })).toBeUndefined();
    expect(autoMistake({ dna: 'concept-board', teach: {} })).toBeUndefined();
  });
  it('every auto mistake is bilingual and passes the arc validator (with its own wording rules)', () => {
    const plans: Array<Pick<BlockPlan, 'dna' | 'teach'>> = [{ dna: 'hcf-lcm', teach: HL_SAMPLE_12_18 }, ...BAL_SAMPLES.map((p) => ({ dna: 'balance-scale' as const, teach: p }))];
    for (const p of plans) {
      const mk = autoMistake(p);
      if (!mk) continue;
      for (const s of [mk.wrong.say, mk.why, mk.right.say]) expect(s.ml).toMatch(ML);
      expect(arcProblems({ mistake: mk })).toEqual([]);
    }
  });
});

describe('the mistake scene', () => {
  const mk = autoMistake({ dna: 'hcf-lcm', teach: HL_SAMPLE_12_18 })!;
  it('writes the wrong line in red, strikes it, then the right line in green with a tick — same picture in both languages', () => {
    const en = buildMistake(mk, 'en', 'T');
    const ml = buildMistake(mk, 'ml', 'T');
    expect(en.captions.length).toBe(3);
    const pos = (sc: typeof en) => sc.items.filter((it) => !it.id.startsWith('mk_')).map((it) => { const s = evalItem(it, sc.durationMs - 1); return `${it.id}@${s.x.toFixed(1)},${s.y.toFixed(1)}`; });
    expect(pos(ml)).toEqual(pos(en));
    const end = en.durationMs - 1;
    const wrongGlyph = evalItem(en.items.find((it) => it.id.startsWith('mw_g'))!, 50 + en.captions[0].t1 - 300);
    expect(wrongGlyph.color.toLowerCase()).toBe('#d22d2d'); // role a = red
    expect(evalItem(en.items.find((it) => it.id === 'mw_x')!, end).alpha).toBeGreaterThan(0.5);
    expect(evalItem(en.items.find((it) => it.id.startsWith('mr_g'))!, end).color.toLowerCase()).toBe('#13a018'); // role c = green
    for (const sc of [en, ml]) for (const c of sc.captions) expect(layoutClean(sc, c.t1 - 40)).toEqual([]);
  });
  it('V51.9.123: with mistakes switched off, no mistake scene is made at all (not even the plan\'s own)', () => {
    if (MISTAKES) return;
    const p = plan('h', 'hcf-lcm', HL_SAMPLE_12_18, { mistake: mk });
    expect(arcFor(p, 'en', { mistakes: true })?.mistake).toBeUndefined();
    const count = (mistakes: boolean) => compileClass([block('h', 'x')], new Map([['h', p]]), { title: 'T' }, { mistakes, read: false }).map((s) => s.build().length);
    expect(count(true)).toEqual(count(false));
  });
  it.skipIf(!MISTAKES)('goes before or after the picture as asked; off by default in a class, on with the option', () => {
    const hl = arcScenes({ mistake: mk }, 'en', 'T');
    expect([hl.before.length, hl.after.length]).toEqual([0, 1]);
    const bal = arcScenes({ mistake: autoMistake({ dna: 'balance-scale', teach: BAL_TWO_STEP_SAMPLE })! }, 'en', 'T');
    expect([bal.before.length, bal.after.length]).toEqual([1, 0]);
    const p = plan('h', 'hcf-lcm', HL_SAMPLE_12_18);
    expect(arcFor(p, 'en')).toBeUndefined();
    expect(arcFor(p, 'en', { mistakes: true })?.mistake).toBeTruthy();
    expect(arcFor(plan('h', 'hcf-lcm', HL_SAMPLE_COPRIME), 'en', { mistakes: true })).toBeUndefined();
    const count = (mistakes: boolean) => compileClass([block('h', 'x')], new Map([['h', p]]), { title: 'T' }, { mistakes, read: false }).map((s) => s.build().length);
    expect(count(true).map((n, i) => n - count(false)[i])).toEqual([1, 1]); // one extra scene per language
    // a plan's own mistake wins over the app's
    const own = plan('h', 'hcf-lcm', HL_SAMPLE_12_18, { mistake: { ...mk, why: { en: 'Own reason here.', ml: 'സ്വന്തം കാരണം.' } } });
    expect(arcFor(own, 'en', { mistakes: true })!.mistake!.why.en).toBe('Own reason here.');
  });
  it('questions inside the animation are still placed when the mistake scenes are on', async () => {
    const plans = new Map([['h', plan('h', 'hcf-lcm', HL_SAMPLE_12_18)], ['s', plan('s', 'balance-scale', BAL_MINUS_SAMPLE)]]);
    const segs = compileClass([block('h', 'x'), block('s', 'y')], plans, { title: 'T' }, { mistakes: true });
    const tl = buildClassTimeline('T', await Promise.all(segs.map((s) => prepareSegment(s, false))));
    const withM = placeQuestions(tl, plans).length;
    const segs0 = compileClass([block('h', 'x'), block('s', 'y')], plans, { title: 'T' });
    const tl0 = buildClassTimeline('T', await Promise.all(segs0.map((s) => prepareSegment(s, false))));
    expect(withM).toBe(placeQuestions(tl0, plans).length);
    expect(withM).toBeGreaterThan(0);
  });
  it('validator: rejects a mistake whose wrong and right lines are the same, bad formulas, a bad "at"', () => {
    expect(arcProblems({ mistake: { ...mk, right: { ...mk.right, tex: mk.wrong.tex } } }).join(' ')).toMatch(/are the same/);
    expect(arcProblems({ mistake: { ...mk, wrong: { ...mk.wrong, tex: '\\frac{1' } } }).join(' ')).toMatch(/mistake\.wrong\.tex/);
    expect(arcProblems({ mistake: { ...mk, at: 'middle' as never } }).join(' ')).toMatch(/"before" or "after"/);
    expect(arcProblems({ mistake: { ...mk, why: { en: 'Too short a reason.' } } }).join(' ')).toMatch(/Malayalam/);
  });
});

describe('a formula read term by term', () => {
  const formal: NonNullable<LessonArc['formal']> = {
    tex: 'A = \\frac{1}{2}(a + b)h',
    say: { en: 'The area of a trapezium.', ml: 'ലംബകത്തിന്റെ പരപ്പളവ്.' },
    parts: [
      { match: '\\frac{1}{2}', label: { en: 'half', ml: 'പകുതി' } },
      { match: 'a + b', label: { en: 'the two parallel sides', ml: 'രണ്ട് സമാന്തര വശങ്ങൾ' } },
      { match: 'h', label: { en: 'the height', ml: 'ഉയരം' } },
    ],
  };
  it('finds each part in the formula, in order, without overlaps; refuses a part that is not there', () => {
    const loc = locateParts(formal.tex, formal.parts!);
    expect('ranges' in loc).toBe(true);
    const whole = glyphTexts(formal.tex);
    if ('ranges' in loc) {
      expect(whole.slice(...loc.ranges[1]).join('')).toBe('a+b');
      expect(whole.slice(...loc.ranges[2])).toEqual(['h']);
    }
    expect(arcProblems({ formal })).toEqual([]);
    expect(arcProblems({ formal: { ...formal, parts: [{ match: 'c + d', label: { en: 'x', ml: 'എ' } }] } }).join(' ')).toMatch(/not in the formula/);
    expect(arcProblems({ formal: { ...formal, parts: Array(6).fill(formal.parts![2]) } }).join(' ')).toMatch(/1–5 parts/);
    // the same symbol twice is found twice (the second "a" after the first)
    const twice = locateParts('a + a', [{ match: 'a' }, { match: 'a' }]);
    expect('ranges' in twice && twice.ranges).toEqual([[0, 1], [2, 3]]);
  });
  it('dims, lights each part with a brace and a label, then brings everything back; labels never overlap', () => {
    for (const lang of ['en', 'ml'] as const) {
      const sc = buildFormal(formal, lang, 'T');
      expect(sc.captions.length).toBe(1 + 3);
      const end = sc.durationMs - 1;
      for (let i = 0; i < 3; i++) {
        expect(evalItem(sc.items.find((it) => it.id === `fx_br${i}`)!, end).alpha).toBeGreaterThan(0.5);
        expect(evalItem(sc.items.find((it) => it.id === `fx_lb${i}`)!, end).alpha).toBeGreaterThan(0.5);
      }
      // at the end nothing is dimmed
      for (const it of sc.items.filter((x) => x.id.startsWith('fx_g'))) expect(it.dim.at(end)).toBeLessThan(0.05);
      // during part 2, the other glyphs are dimmed and part 2 is not
      const mid = sc.captions[2].t1 - 60;
      const loc = locateParts(formal.tex, formal.parts!) as { ranges: Array<[number, number]> };
      const glyphs = sc.items.filter((x) => /^fx_g\d+$/.test(x.id)).sort((a, b) => Number(a.id.slice(4)) - Number(b.id.slice(4)));
      glyphs.forEach((g, k) => {
        const inPart2 = k >= loc.ranges[1][0] && k < loc.ranges[1][1];
        const inLater = k >= loc.ranges[2][0];
        if (inPart2) expect(g.dim.at(mid)).toBeLessThan(0.05);
        if (inLater) expect(g.dim.at(mid)).toBeGreaterThan(0.5);
      });
      for (const c of sc.captions) expect(layoutClean(sc as never, c.t1 - 40)).toEqual([]);
    }
  });
  it('label rows: overlapping labels go to the next row', () => {
    expect(labelRows([{ cx: 100, w: 80 }, { cx: 150, w: 80 }, { cx: 400, w: 50 }])).toEqual([0, 1, 0]);
  });
  it('without parts the rule scene is exactly as before', () => {
    const plain = buildFormal({ tex: formal.tex, say: formal.say }, 'en', 'T');
    expect(plain.captions.length).toBe(1);
    expect(plain.items.some((it) => it.id.includes('_br'))).toBe(false);
    const g = plain.items.find((it) => it.id === 'fx_g0')!;
    expect(evalItem(g, plain.durationMs - 1).y).toBeGreaterThan(190); // still centred at y 215
  });
});

describe('narration wording', () => {
  it('flags "obviously / clearly / it follows that" and the Malayalam equivalents, and run-on sentences', () => {
    expect(wordingProblems('Obviously x is 3.', 'x = 3', 'p').join(' ')).toMatch(/"Obviously"/);
    expect(wordingProblems('It follows that x is 3.', '', 'p').join(' ')).toMatch(/it follows that/i);
    expect(wordingProblems('x is 3.', 'വ്യക്തമായും x = 3.', 'p').join(' ')).toMatch(/വ്യക്തമായും/);
    const long = Array(30).fill('word').join(' ') + '.';
    expect(wordingProblems(long, '', 'p').join(' ')).toMatch(/30-word sentence/);
    expect(wordingProblems('Two short sentences. Each one is fine.', 'രണ്ട് ചെറിയ വാക്യങ്ങൾ.', 'p')).toEqual([]);
    // words that only contain the pattern are not flagged
    expect(wordingProblems('The clearing is wide.', '', 'p')).toEqual([]);
  });
  it('the quality gate and the arc validator ask for a rewrite; the lint warns', () => {
    const teach = { ...HL_SAMPLE_12_18, steps: HL_SAMPLE_12_18.steps.map((s, i) => (i === 1 ? { ...s, say: { en: 'Clearly we split each number into primes.', ml: s.say.ml } } : s)) };
    expect(qaCaptions(teach).join(' ')).toMatch(/"Clearly"/);
    expect(arcProblems({ hook: { en: 'Obviously, what is the LCM?', ml: 'ലസാഗു എത്ര?' } }).join(' ')).toMatch(/"Obviously"/);
    expect(lintPlan('h', plan('h', 'hcf-lcm', teach)).some((i) => i.code === 'wording')).toBe(true);
  });
  it('every golden sample is clean under the new wording rules', async () => {
    const mods = await Promise.all(
      ['hcf-lcm', 'balance-scale', 'angle-geometry', 'area-figure', 'arithmetic-sequence', 'coordinate-geometry', 'fraction-line', 'fractions-stats', 'linear-system', 'matrix-grid', 'matrix-ops', 'pie-chart', 'plane-graph', 'polynomial', 'quadratic-derivation', 'quadratic-equation', 'ratio-percent', 'scert9-ch1-s1', 'shape-formula', 'solid-figure', 'square-identity', 'typeset-chain', 'unit-circle', 'venn-sets', 'ai-sketch'].map((f) => import(`./samples/${f}.ts`)),
    );
    const bad: string[] = [];
    for (const mod of mods) for (const v of Object.values(mod)) {
      // spoken lines only: a fixture's teach and arc (its "read" is textbook text read aloud, not checked)
      const teachLike = Array.isArray(v) ? v.map((x) => (x && typeof x === 'object' && 'plan' in x ? [(x as { plan: { teach: unknown; arc?: unknown } }).plan.teach, (x as { plan: { arc?: unknown } }).plan.arc] : x)) : v;
      bad.push(...qaCaptions(teachLike).filter((p) => /says "|word sentence/.test(p)));
    }
    expect(bad).toEqual([]);
  });
});
