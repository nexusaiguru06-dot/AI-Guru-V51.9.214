import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, Motion } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { becomeMath, layoutMath, mathBox, mathGlyphs, mathProblem, parseMath, placeMath, showMath, MathParseError, MATH_MAX_CHARS } from '../reels/motion/typeset';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { findTsFormulas, tsProblem, TS_MAX_STEPS } from './dna/ts-math';
import { SAMPLE_DETERMINANT, SAMPLE_MATRIX_PRODUCT, SAMPLE_QUADRATIC_FORMULA, SAMPLE_SQRT_EQUATION, TYPESET_SAMPLES } from './samples/typeset-chain';
import type { BlockPlan, TsPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlinePlan, offlineTypeset } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass } from './class';

const block = (text: string, kind: BookBlock['kind'] = 'math'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const RD = { en: 'x', ml: 'എ' };
const say = { en: 'Look.', ml: 'നോക്കൂ.' };
const FORMULAS = [
  'x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}',
  '\\frac{1}{2} + \\frac{3}{4} = \\frac{5}{4}',
  '\\begin{bmatrix} 1 & 0 \\\\ 1 & -1 \\end{bmatrix}\\begin{bmatrix} 1 \\\\ 2 \\end{bmatrix}',
  '\\det\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} = ad - bc',
  'x² + 3/4 = √16 + \\vec{v}',
  '\\sin(x) = x - \\frac{x^{3}}{3!} + \\frac{x^{5}}{5!}',
  'a_{1} + a_{2} = \\sqrt{\\frac{a}{b}}',
  '\\color{a}{x} + \\color{b}{y} = \\text{total}',
];

const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;

describe('parser', () => {
  it('reads every kind of formula', () => {
    for (const f of FORMULAS) expect(() => parseMath(f), f).not.toThrow();
  });
  it('reads fractions, roots, powers, subscripts and matrices into the right shapes', () => {
    expect(parseMath('\\frac{1}{2}')).toMatchObject({ k: 'frac' });
    expect(parseMath('\\sqrt{x}')).toMatchObject({ k: 'sqrt' });
    expect(parseMath('x^{2}')).toMatchObject({ k: 'script', sup: { s: '2' } });
    expect(parseMath('x²')).toMatchObject({ k: 'script', sup: { s: '2' } });
    expect(parseMath('x_{1}')).toMatchObject({ k: 'script', sub: { s: '1' } });
    expect(parseMath('3/4')).toMatchObject({ k: 'frac' });
    expect(parseMath('√16')).toMatchObject({ k: 'sqrt' });
    expect(parseMath('\\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}')).toMatchObject({ k: 'mat', br: '[' });
    expect(parseMath('\\begin{pmatrix}1 & 2\\end{pmatrix}')).toMatchObject({ k: 'mat', br: '(' });
  });
  it('√( … ) takes the whole bracket, nested brackets included', () => {
    const t = parseMath('√(a + (b − c)) + 1') as { k: string; c: Array<{ k: string }> };
    expect(t.k).toBe('row');
    expect(t.c[0].k).toBe('sqrt');
    expect(t.c.length).toBe(3);
  });
  it('a multi-digit exponent and a minus exponent are read whole', () => {
    expect(parseMath('x^10')).toMatchObject({ k: 'script', sup: { s: '10' } });
    expect(parseMath('x^{-1}')).toMatchObject({ k: 'script' });
  });
  it('a number keeps its digits together; function names are one symbol', () => {
    const n = parseMath('11000') as { k: string; s: string };
    expect(n.s).toBe('11000');
    expect(parseMath('sin x')).toMatchObject({ k: 'row' });
    const glyphs = layoutMath('\\sin(x)', 40).glyphs.map((g) => g.text);
    expect(glyphs).toContain('sin');
  });
  it('says what is wrong instead of drawing rubbish', () => {
    expect(mathProblem('\\frac{1}{')).toMatch(/not closed|ends too early/);
    expect(mathProblem('\\foo{x}')).toMatch(/unknown command/);
    expect(mathProblem('')).toMatch(/empty/);
    expect(mathProblem('x'.repeat(MATH_MAX_CHARS + 1))).toMatch(/at most/);
    expect(mathProblem('\\begin{bmatrix}1 & 2 \\\\ 3\\end{bmatrix}')).toMatch(/same number of entries/);
    expect(mathProblem('\\begin{array}{c}1\\end{array}')).toMatch(/not supported/);
    expect(mathProblem('\\color{purple}{x}')).toMatch(/colour/);
    expect(mathProblem('\\sqrt[3]{x}')).toMatch(/index/);
    expect(mathProblem('x}')).toMatch(/unexpected/);
    expect(mathProblem(42)).toMatch(/text/);
    expect(mathProblem('{'.repeat(9) + 'x' + '}'.repeat(9))).toMatch(/nested|too big/);
    expect(() => parseMath('\\frac{1}{')).toThrow(MathParseError);
  });
  it('a formula with too many parts is refused', () => {
    expect(mathProblem(Array.from({ length: 140 }, () => 'a+').join('') + 'b')).toMatch(/too big|characters/);
  });
  it('minus signs: a leading or unary minus has no space after it; a binary minus has', () => {
    const g = layoutMath('-b - c', 40).glyphs;
    const b = g.find((q) => q.text === 'b')!;
    const m1 = g[0];
    const gapUnary = b.x - tokenWidth('b', 40) / 2 - (m1.x + tokenWidth('−', 40) / 2);
    const m2 = g[2];
    const c = g[3];
    const gapBinary = c.x - tokenWidth('c', 40) / 2 - (m2.x + tokenWidth('−', 40) / 2);
    expect(gapBinary).toBeGreaterThan(gapUnary + 3);
  });
});

describe('layout', () => {
  it('every formula fits its width and has real boxes', () => {
    for (const f of FORMULAS) {
      const L = layoutMath(f, 44, 640);
      expect(L.w, f).toBeGreaterThan(0);
      expect(L.w, f).toBeLessThanOrEqual(640 + 1);
      expect(L.up, f).toBeGreaterThan(0);
      expect(L.down, f).toBeGreaterThan(0);
      for (const g of L.glyphs) {
        expect(g.x - tokenWidth(g.text, g.size) / 2, `${f} ${g.text}`).toBeGreaterThanOrEqual(-0.5);
        expect(g.x + tokenWidth(g.text, g.size) / 2, `${f} ${g.text}`).toBeLessThanOrEqual(L.w + 0.5);
      }
    }
  });
  it('glyphs of one formula never overlap', () => {
    for (const f of FORMULAS) {
      const L = layoutMath(f, 44, 640);
      const bs = L.glyphs.map((g) => ({ g, l: g.x - tokenWidth(g.text, g.size) / 2, r: g.x + tokenWidth(g.text, g.size) / 2, t: g.y - g.size * 0.4, b: g.y + g.size * 0.4 }));
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const ox = Math.min(bs[i].r, bs[j].r) - Math.max(bs[i].l, bs[j].l);
        const oy = Math.min(bs[i].b, bs[j].b) - Math.max(bs[i].t, bs[j].t);
        expect(ox > 0.5 && oy > 0.5, `${f}: "${bs[i].g.text}" overlaps "${bs[j].g.text}"`).toBe(false);
      }
    }
  });
  it('a fraction has a bar as wide as its widest part; numerator above and denominator below the axis', () => {
    const L = layoutMath('\\frac{a + b}{2}', 40);
    expect(L.strokes.length).toBe(1);
    const bar = L.strokes[0].pts;
    expect(bar[0][1]).toBe(0);
    const num = L.glyphs.filter((g) => ['a', 'b', '+'].includes(g.text));
    const den = L.glyphs.find((g) => g.text === '2')!;
    for (const g of num) expect(g.y).toBeLessThan(0);
    expect(den.y).toBeGreaterThan(0);
    const nw = Math.max(...num.map((g) => g.x + tokenWidth(g.text, g.size) / 2)) - Math.min(...num.map((g) => g.x - tokenWidth(g.text, g.size) / 2));
    expect(bar[1][0] - bar[0][0]).toBeGreaterThan(nw);
  });
  it('a power sits higher and smaller than its base; a subscript lower', () => {
    const L = layoutMath('x^{2}', 40);
    const [x, two] = L.glyphs;
    expect(two.size).toBeLessThan(x.size);
    expect(two.y).toBeLessThan(0);
    const S = layoutMath('x_{1}', 40);
    expect(S.glyphs[1].y).toBeGreaterThan(0);
  });
  it('a square root puts a bar over its whole radicand', () => {
    const L = layoutMath('\\sqrt{x + 3}', 40);
    const bar = L.strokes[0].pts;
    const right = Math.max(...L.glyphs.map((g) => g.x + tokenWidth(g.text, g.size) / 2));
    expect(bar[bar.length - 1][0]).toBeGreaterThanOrEqual(right);
    const top = bar[bar.length - 1][1];
    for (const g of L.glyphs) expect(g.y - g.size * 0.35).toBeGreaterThan(top);
  });
  it('a matrix is a grid: entries in columns and rows, with brackets around', () => {
    const L = layoutMath('\\begin{bmatrix}1 & 22 \\\\ 333 & 4\\end{bmatrix}', 40);
    const at = (t: string) => L.glyphs.find((g) => g.text === t)!;
    expect(at('1').y).toBe(at('22').y);
    expect(at('333').y).toBe(at('4').y);
    expect(at('333').y).toBeGreaterThan(at('1').y);
    // column centres line up
    expect(at('1').x).toBeCloseTo(at('333').x, 5);
    expect(at('22').x).toBeCloseTo(at('4').x, 5);
    expect(L.strokes.length).toBe(2);
    for (const s of L.strokes) for (const [x] of s.pts) { expect(x).toBeGreaterThanOrEqual(-0.5); expect(x).toBeLessThanOrEqual(L.w + 0.5); }
  });
  it('keys count repeated symbols in order', () => {
    const L = layoutMath('x + x = x', 40);
    expect(L.glyphs.filter((g) => g.text === 'x').map((g) => g.key)).toEqual(['x@40#1', 'x@40#2', 'x@40#3']);
  });
  it('colours: \\color wins, then the colour map, then the default', () => {
    const m = new Motion('t', 720, 444);
    const h = placeMath(m, 'p', '\\color{c}{x} + x + y', 360, 100, 0, { colors: { x: 'a' }, color: 'ink' });
    expect(h.glyphs.map((g) => g.color)).toEqual(['c', 'ink', 'a', 'ink', 'ink']);
  });
});

describe('on the board', () => {
  it('showMath makes every glyph visible and draws every stroke', () => {
    const m = new Motion('t', 720, 444);
    const { h, end } = showMath(m, 'a', '\\frac{1}{2}', 360, 200, 300);
    m.hold(end + 200);
    const sc = m.build();
    const t = end + 100;
    for (const g of h.glyphs) expect(evalItem(sc.items.find((i) => i.id === g.id)!, t).alpha).toBeGreaterThan(0.9);
    for (const s of h.strokes) expect(evalItem(sc.items.find((i) => i.id === s)!, t).alpha).toBeGreaterThan(0.9);
    expect(mathBox(h).x1 - mathBox(h).x0).toBeCloseTo(h.w, 5);
    expect(mathGlyphs(h, ['1'])).toHaveLength(1);
  });
  it('becomeMath keeps the shared symbols (they move), fades the rest, and brings new ones in', () => {
    const m = new Motion('t', 720, 444);
    const a = showMath(m, 'a', 'x + 3 = 25', 360, 200, 300);
    const t0 = a.end + 200;
    const b = becomeMath(m, a.h, 'b', 'x = 22', t0);
    m.hold(b.end + 200);
    const sc = m.build();
    expect(b.kept).toBe(2); // x and =
    const xOld = a.h.glyphs.find((g) => g.text === 'x')!;
    const xNew = b.h.glyphs.find((g) => g.text === 'x')!;
    expect(xNew.id).toBe(xOld.id);
    const end = b.end + 100;
    const sx = evalItem(sc.items.find((i) => i.id === xNew.id)!, end);
    expect(sx.x).toBeCloseTo(xNew.x, 1);
    expect(sx.alpha).toBeGreaterThan(0.9);
    // "+", "3" and "25" are gone, "22" is there
    for (const g of a.h.glyphs.filter((q) => ['+', '3', '25'].includes(q.text))) expect(evalItem(sc.items.find((i) => i.id === g.id)!, end).alpha).toBeLessThan(0.05);
    const twenty2 = b.h.glyphs.find((g) => g.text === '22')!;
    expect(evalItem(sc.items.find((i) => i.id === twenty2.id)!, end).alpha).toBeGreaterThan(0.9);
  });
  it('becomeMath redraws strokes: the old root fades, a new fraction bar is drawn', () => {
    const m = new Motion('t', 720, 444);
    const a = showMath(m, 'a', '\\sqrt{x}', 360, 200, 300);
    const b = becomeMath(m, a.h, 'b', '\\frac{x}{2}', a.end + 200);
    m.hold(b.end + 200);
    const sc = m.build();
    const t = b.end + 100;
    expect(evalItem(sc.items.find((i) => i.id === a.h.strokes[0])!, t).alpha).toBeLessThan(0.05);
    expect(evalItem(sc.items.find((i) => i.id === b.h.strokes[0])!, t).alpha).toBeGreaterThan(0.9);
  });
  it('the same symbol at another size is not matched (a power is a different glyph from a base)', () => {
    const m = new Motion('t', 720, 444);
    const a = showMath(m, 'a', 'x', 360, 200, 300);
    const b = becomeMath(m, a.h, 'b', 'x^{2}', a.end + 200);
    expect(b.kept).toBe(1);
  });
});

describe('typeset-chain: plan checks', () => {
  const ok = (p: unknown) => validatePlan('typeset-chain', p, RD);
  it('accepts every sample', () => {
    for (const p of Object.values(TYPESET_SAMPLES)) expect(ok(p), JSON.stringify(p)).toEqual([]);
  });
  const base = (steps: unknown[]) => ({ steps });
  it('rejects what cannot be drawn', () => {
    expect(ok(base([]))[0]).toMatch(/steps/);
    expect(ok(base([{ op: 'become', tex: 'x', say }]))[0]).toMatch(/needs a formula on the board|"show"/);
    expect(ok(base([{ op: 'show', tex: '\\frac{1}{', say }]))[0]).toMatch(/tex/);
    expect(ok(base([{ op: 'show', tex: 'x', say }, { op: 'jump', say }]))[0]).toMatch(/op/);
    expect(ok(base([{ op: 'show', tex: 'x', say: { en: '', ml: '' } }]))[0]).toMatch(/say/);
    expect(ok(base([{ op: 'box', say }]))[0]).toMatch(/needs a formula/);
    expect(ok(base([{ op: 'show', tex: 'x + 1 = 2', say }]))[0]).toMatch(/plain equation/);
    expect(ok(base([{ op: 'show', tex: 'x', say }, { op: 'focus', parts: [], say }]))[0]).toMatch(/parts/);
    expect(ok(base(Array.from({ length: TS_MAX_STEPS + 1 }, () => ({ op: 'show', tex: 'x', say }))))[0]).toMatch(/at most/);
    expect(ok({ colors: { x: 'purple' }, steps: [{ op: 'show', tex: 'x', say }] })[0]).toMatch(/colors/);
    expect(ok({ colors: { toolong: 'a' }, steps: [{ op: 'show', tex: 'x', say }] })[0]).toMatch(/colors/);
    expect(ok(base([{ op: 'show', tex: 'x', note: { en: 'n'.repeat(80), ml: '' }, say }]))[0]).toMatch(/note/);
  });
  it('tsProblem is null for a good plan', () => {
    expect(tsProblem(SAMPLE_SQRT_EQUATION, 'p')).toBeNull();
  });
});

describe('typeset-chain: choosing and planning', () => {
  it('a block with a root and an equation chooses it; look-alikes do not', () => {
    expect(selectDna(block('The roots are given by x = (−b ± √(b² − 4ac)) / 2a.')).dna).toBe('typeset-chain');
    expect(selectDna(block('Solve √(x + 3) = 5.')).dna).toBe('typeset-chain');
    expect(selectDna(block('The diagonal of the square is √2 times its side, so d = √2 a.', 'result')).dna).toBe('typeset-chain');
    expect(selectDna(block('1/2 + 3/4 = 5/4')).dna).not.toBe('typeset-chain'); // numeric fractions have their own DNA
    expect(selectDna(block('Solve 2x + 5 = 25')).dna).toBe('balance-scale');
    expect(selectDna(block('Dividing the sum by two gives the mean.', 'prose')).dna).not.toBe('typeset-chain');
    expect(selectDna(block('x² − 5x + 6 = 0')).dna).not.toBe('typeset-chain');
  });
  it('findTsFormulas pulls the formula out of a sentence', () => {
    expect(findTsFormulas('The distance is given by d = √(x² + y²) for every point.')).toEqual(['d = √(x² + y²)']);
    expect(findTsFormulas('No formula here.')).toEqual([]);
    expect(findTsFormulas('√ is a symbol.')).toEqual([]);
  });
  it('the offline planner builds a drawable plan', () => {
    const tp = offlineTypeset('Solve √(x + 3) = 5. Then check x = √(25)');
    expect(tp).not.toBeNull();
    expect(tp!.steps[0].op).toBe('show');
    expect(tp!.steps[tp!.steps.length - 1].op).toBe('box');
    const plan = offlinePlan(block('The roots are given by x = (−b ± √(b² − 4ac)) / 2a.'), 'Quadratic', 'Sec');
    expect(plan.dna).toBe('typeset-chain');
    expect(validatePlan('typeset-chain', plan.teach, RD)).toEqual([]);
    expect(offlineTypeset('Nothing with a root.')).toBeNull();
  });
});

describe('typeset-chain: the class', () => {
  it('is a picture, not text', () => {
    for (const teach of Object.values(TYPESET_SAMPLES)) {
      expect(textOnlyWarning({ dna: 'typeset-chain', teach })).toBeUndefined();
      expect(visualStats(buildDnaScenes('typeset-chain', teach, 'en', 'T')).graphics).toBeGreaterThanOrEqual(1);
    }
  });
  it('compiles into a class and draws every frame in every format, light and dark', { timeout: 120000 }, () => {
    const plan: BlockPlan = { blockId: 'b', dna: 'typeset-chain', teach: SAMPLE_QUADRATIC_FORMULA, read: { en: 'x' }, warnings: [] } as unknown as BlockPlan;
    const segs = compileClass([block('The quadratic formula x = (−b ± √(b² − 4ac)) / 2a')], new Map([['b', plan]]), { title: 'T' });
    expect(segs.length).toBeGreaterThan(0);
    for (const teach of Object.values(TYPESET_SAMPLES)) {
      const sc = buildDnaScenes('typeset-chain', teach, 'en', 'T')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('nothing overlaps or leaves the board at any step', () => {
    for (const teach of Object.values(TYPESET_SAMPLES)) {
      const sc = buildDnaScenes('typeset-chain', teach, 'en', 'T')[0];
      for (let k = 0; k < sc.captions.length; k++) {
        const time = sc.captions[k].t1 - 40;
        const st = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((s) => s.alpha > 0.5).map((q) => {
          const w = tokenWidth(q.text, q.size);
          return { q, l: q.x - w / 2, r: q.x + w / 2, t: q.y - q.size * 0.4, b: q.y + q.size * 0.4 };
        });
        for (const s of st) {
          expect(s.l).toBeGreaterThan(2);
          expect(s.r).toBeLessThan(718);
          expect(s.t).toBeGreaterThan(0);
          expect(s.b).toBeLessThan(444);
        }
        for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
          const ox = Math.min(st[i].r, st[j].r) - Math.max(st[i].l, st[j].l);
          const oy = Math.min(st[i].b, st[j].b) - Math.max(st[i].t, st[j].t);
          expect(ox > 0.5 && oy > 0.5, `${st[i].q.text} / ${st[j].q.text} at step ${k}`).toBe(false);
        }
      }
    }
  });
  it('lines stack and the page restarts when it is full', () => {
    const steps: TsPlan['steps'] = [{ op: 'show', tex: '\\frac{a}{b} = \\frac{c}{d}', say }];
    for (let i = 0; i < 6; i++) steps.push({ op: 'add', tex: `\\frac{x_{${i + 1}}}{y} = \\sqrt{${i + 2}}`, note: { en: 'a note', ml: 'കുറിപ്പ്' }, say });
    const sc = buildDnaScenes('typeset-chain', { steps }, 'en', 'T')[0];
    for (let k = 0; k < sc.captions.length; k++) {
      const time = sc.captions[k].t1 - 40;
      const st = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((s) => s.alpha > 0.5);
      for (const s of st) expect(s.y + s.size * 0.4).toBeLessThan(444);
    }
  });
  it('English and Malayalam pictures are identical; only captions and notes differ', () => {
    for (const teach of [SAMPLE_QUADRATIC_FORMULA, SAMPLE_MATRIX_PRODUCT, SAMPLE_DETERMINANT]) {
      const en = buildDnaScenes('typeset-chain', teach, 'en', 'T')[0];
      const ml = buildDnaScenes('typeset-chain', teach, 'ml', 'T')[0];
      const pic = (s: typeof en) => s.items.filter((it) => !it.id.startsWith('nt')).map((it) => `${it.id}:${it.kind}:${it.text}`);
      expect(pic(ml)).toEqual(pic(en));
      expect(ml.captions.map((x) => x.text)).not.toEqual(en.captions.map((x) => x.text));
    }
  });
  it('the box surrounds the whole last line', () => {
    const sc = buildDnaScenes('typeset-chain', SAMPLE_SQRT_EQUATION, 'en', 'T')[0];
    const box = sc.items.find((i) => i.kind === 'rect')!;
    const t = sc.durationMs - 100;
    const b = evalItem(box, t);
    const texts = sc.items.filter((i) => i.kind === 'text').map((i) => evalItem(i, t)).filter((s) => s.alpha > 0.5 && !s.text.includes('3 from'));
    for (const s of texts.filter((q) => ['x', '=', '22'].includes(q.text))) {
      expect(s.x - tokenWidth(s.text, s.size) / 2).toBeGreaterThan(b.x - b.x2 / 2);
      expect(s.x + tokenWidth(s.text, s.size) / 2).toBeLessThan(b.x + b.x2 / 2);
    }
  });
});
