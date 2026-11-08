import { describe, expect, it } from 'vitest';
import pages from '../../../fixtures/ai-guru/question-paper-pages.json';
import { indexPdf } from '../material-studio/index-pdf';
import { extractExpressions, planTemplateSolution, pretty, stepsFromSolution } from './template-solver';

const { sources } = indexPdf(pages as any, 'paper.pdf');
const Q = (n: number) => sources.find(s => s.text.startsWith(`${n}. `))!.text;
const texts = (q: number) => planTemplateSolution(Q(q))!.rows.map(r => r.text);
const labels = (q: number) => planTemplateSolution(Q(q))!.rows.map(r => r.label).filter(Boolean);

describe('problem extraction (real questions from the 20-question paper)', () => {
  it('finds the mathematics inside the question sentence', () => {
    expect(extractExpressions(Q(1))).toEqual(['2x + 5 = 20']);
    expect(extractExpressions(Q(20))).toEqual(['5x + 2y = 20', '2x + 3y = 19']);
    expect(extractExpressions(Q(2))).toBeNull();      // a word problem is not "just maths"
    expect(extractExpressions(Q(11))).toBeNull();
  });
  it('pretty(): true minus, superscripts, attached unary minus', () => {
    expect(pretty('- 6 + 8 - ( - 5) - 9')).toBe('\u22126 + 8 \u2212 (\u22125) \u2212 9');
    expect(pretty('2x^2 - 7x + 3 = 0')).toBe('2x\u00b2 \u2212 7x + 3 = 0');
  });
});

describe('Q1  2x + 5 = 20  - the reference sequence, every step, then a check', () => {
  const plan = planTemplateSolution(Q(1))!;
  it('is verified and reaches 7.5', () => {
    expect(plan.family).toBe('linear'); expect(plan.verified).toBe(true);
    expect(plan.answerText).toContain('x = 7.5');
  });
  it('rows appear in teaching order', () => {
    expect(texts(1).slice(0, 6)).toEqual(['2x + 5 = 20', '2x + 5 \u2212 5 = 20 \u2212 5', '2x = 15', '2x / 2 = 15 / 2', 'x = 15/2', 'x = 7.5']);
    expect(labels(1).slice(0, 6)).toEqual(['Equation', 'Subtract 5 from both sides', 'Simplifies to', 'Divide both sides by 2', 'Therefore', 'Therefore']);
  });
  it('marks what changed (arc over the operation, circle around the isolated term, arc over the value)', () => {
    const [, sub, simp, div, therefore] = plan.rows;
    expect(sub.text.slice(sub.focus!.from, sub.focus!.to)).toBe('5 \u2212 5');   expect(sub.focus!.style).toBe('arc');
    expect(simp.text.slice(simp.focus!.from, simp.focus!.to)).toBe('2x');       expect(simp.focus!.style).toBe('circle');
    expect(div.text.slice(div.focus!.from, div.focus!.to)).toBe('/ 2');         expect(div.focus!.style).toBe('arc');
    expect(therefore.text.slice(therefore.focus!.from, therefore.focus!.to)).toBe('15/2');
  });
  it('boxes the answer, then checks by substitution and states the solution', () => {
    const rows = plan.rows;
    const boxed = rows.filter(r => r.boxed);
    expect(boxed).toHaveLength(1); expect(boxed[0].text).toBe('x = 7.5');
    expect(rows.map(r => r.kind).slice(-4)).toEqual(['check-title', 'check', 'check-ok', 'answer']);
    expect(rows[rows.length - 3].text).toBe('2(7.5) + 5 = 20');
    expect(rows[rows.length - 2].text).toContain('20 = 20');
    expect(rows[rows.length - 1].text).toBe('The solution is  x = 7.5');
  });
  it('every row has an English caption; the Malayalam caption exists for every row', () => {
    for (const r of plan.rows) { expect(r.captionEn.length).toBeGreaterThan(3); expect(r.captionMl?.length ?? 0).toBeGreaterThan(3); }
  });
});

describe('the other algebra questions on the paper', () => {
  it('Q3 quadratic formula: a,b,c -> formula -> substitute -> discriminant -> both roots -> check both', () => {
    const plan = planTemplateSolution(Q(3))!;
    expect(plan.family).toBe('quadratic'); expect(plan.answerText).toBe('x = 3   or   x = 1/2');
    expect(labels(3)).toEqual(expect.arrayContaining(['Identify a, b, c', 'Quadratic formula', 'Substitute a, b, c', 'Simplify inside the root', 'Take the square root']));
    expect(plan.rows.filter(r => r.kind === 'check-title')).toHaveLength(2);
    expect(texts(3)).toContain('x = (7 \u00b1 \u221a25) / 4');
  });
  it('Q4 (x+3)(x-3)+2x = x\u00b2 + 2x \u2212 9 using the identity', () => {
    const plan = planTemplateSolution(Q(4))!;
    expect(plan.answerText).toBe('x\u00b2 + 2x \u2212 9'); expect(texts(4)).toContain('(a + b)(a \u2212 b) = a\u00b2 \u2212 b\u00b2');
  });
  it('Q5 3(x-4)+2 = 5x-10  ->  x = 0, every move shown', () => {
    const plan = planTemplateSolution(Q(5))!;
    expect(plan.answerText).toContain('x = 0');
    expect(labels(5)).toEqual(expect.arrayContaining(['Expand the brackets', 'Combine like terms', 'Subtract 5x from both sides', 'Add 10 to both sides', 'Divide both sides by \u22122']));
  });
  it('Q15 (2x+5)\u00b2 = 4x\u00b2 + 20x + 25 with brackets kept around 2x', () => {
    const plan = planTemplateSolution(Q(15))!;
    expect(plan.answerText).toBe('4x\u00b2 + 20x + 25'); expect(texts(15)).toContain('(2x)\u00b2 + 2(2x)(5) + 5\u00b2');
  });
  it('Q16 surds = 9\u221a2', () => { expect(planTemplateSolution(Q(16))!.answerText).toBe('9\u221a2'); });
  it('Q17 integer arithmetic = \u22122, one addition at a time', () => {
    expect(planTemplateSolution(Q(17))!.answerText).toBe('\u22122');
    expect(texts(17).slice(0, 5)).toEqual(['\u22126 + 8 \u2212 (\u22125) \u2212 9', '\u22126 + 8 + 5 \u2212 9', '2 + 5 \u2212 9', '7 \u2212 9', '\u22122']);
  });
  it('Q20 pair of equations by elimination: x = 2, y = 5, both equations checked', () => {
    const plan = planTemplateSolution(Q(20))!;
    expect(plan.family).toBe('simultaneous'); expect(plan.answerText).toBe('x = 2,   y = 5');
    expect(labels(20)).toEqual(expect.arrayContaining(['Multiply (1) by 3  \u2192  (3)', 'Multiply (2) by 2  \u2192  (4)']));
    expect(plan.rows.filter(r => r.kind === 'check')).toHaveLength(2);
  });
});

describe('safety: never teach from the solver unless certain', () => {
  it('returns null for word problems, calculus and geometry (the lesson\u2019s own steps are used)', () => {
    for (const n of [2, 6, 7, 8, 9, 10, 11, 12, 13, 14, 18, 19]) expect(planTemplateSolution(Q(n)), `Q${n}`).toBeNull();
  });
  it('returns null for degenerate equations and unsupported quadratics', () => {
    expect(planTemplateSolution('Solve: 2x + 1 = 2x + 3')).toBeNull();          // no solution
    expect(planTemplateSolution('Solve: 2x + 1 = 2x + 1')).toBeNull();          // infinitely many
    expect(planTemplateSolution('Solve by factorisation: x^2 - 5x + 6 = 0')).toBeNull(); // not the formula method
  });
  it('handles no-real-root and irrational-root quadratics honestly', () => {
    expect(planTemplateSolution('Solve using the quadratic formula: x^2 + x + 1 = 0')!.answerText).toBe('No real solution');
    const irr = planTemplateSolution('Solve using the quadratic formula: x^2 - 2x - 1 = 0')!;
    expect(irr.answerText).toContain('\u221a8'.replace('\u221a8', '2\u221a2'));
  });
  it('fractional answers and negative answers are exact and checked', () => {
    expect(planTemplateSolution('Solve: 3x + 1 = 2')!.answerText).toContain('x = 1/3');
    expect(planTemplateSolution('Solve: 4x + 9 = 1')!.answerText).toContain('x = -2'.replace('-', '\u2212'));
    expect(planTemplateSolution('Solve: x + 3 = 5')!.answerText).toContain('x = 2');
  });
  it('stepsFromSolution: one step per row, ready for the teaching loop', () => {
    const plan = planTemplateSolution(Q(1))!;
    const steps = stepsFromSolution(plan);
    expect(steps).toHaveLength(plan.rows.length);
    expect(steps.every(s => s.verified && s.captionEnglish && s.visualIds.length === 0)).toBe(true);
    expect(steps[1].before).toBe('2x + 5 = 20'); expect(steps[1].after).toBe('2x + 5 \u2212 5 = 20 \u2212 5');
  });
});
