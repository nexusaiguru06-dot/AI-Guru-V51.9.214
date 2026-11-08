import { describe, expect, it } from 'vitest';
import { ensureCaption, groupHistory, isMathLike, newDerivation, pinProblem, playDerivationStep, playStepBar, playTemplateRow } from './derivation-beat';

const instant = { pause: async () => {} };
const recorder = () => { const log: any[] = []; return { log, reveal: async (a: any) => { log.push(a); } }; };

describe('isMathLike', () => {
  it('accepts real mathematics and rejects narrative labels', () => {
    for (const t of ['2x + 5 = 20', '(W + 10) + W = 100', 'x = 4', '100 - 10', '\u221a2', 'B = 55']) expect(isMathLike(t)).toBe(true);
    for (const t of ['Dynamic GeoGebra Model', 'Static Diagram', 'Introduction', '']) expect(isMathLike(t)).toBe(false);
  });
});

describe('playDerivationStep (the lesson\u2019s own steps, drawn in the worked-solution template)', () => {
  it('writes the original line first, then the new line with its label on the right and an arc over what changed', async () => {
    const b = recorder(); const st = newDerivation('m1-1');
    await playDerivationStep(b, st, { before: '2x + 5 = 20', operation: 'subtract 5 from both sides', after: '2x + 5 \u2212 5 = 20 \u2212 5' }, instant);
    expect(b.log.map(a => a.tpl.text)).toEqual(['2x + 5 = 20', '2x + 5 \u2212 5 = 20 \u2212 5']);
    const [first, second] = b.log;
    expect(first.role).toBe('tpl'); expect(first.tpl.label).toBe('Given'); // captions are mandatory: even the starting line has one
    expect(second.tpl.label).toBe('Subtract 5 from both sides');
    expect(second.tpl.text.slice(second.tpl.focus.from, second.tpl.focus.to)).toBe('5 \u2212 5');
    expect(second.tpl.focus.style).toBe('arc');
    expect(first.tpl.color).not.toBe(second.tpl.color);   // every line has its own colour
  });

  it('chains a whole solution top-to-bottom: distinct colours per step, only the answer boxed, no repeats', async () => {
    const b = recorder(); const st = newDerivation('m1-2');
    const steps = [
      { before: '2x + 5 = 20', operation: 'subtract 5 from both sides', after: '2x + 5 \u2212 5 = 20 \u2212 5' },
      { before: '2x + 5 \u2212 5 = 20 \u2212 5', operation: 'simplify', after: '2x = 15' },
      { before: '2x = 15', operation: 'divide both sides by 2', after: '2x / 2 = 15 / 2' },
      { before: '2x / 2 = 15 / 2', operation: 'therefore', after: 'x = 7.5' },
    ];
    for (let i = 0; i < steps.length; i++) await playDerivationStep(b, st, { ...steps[i], isLast: i === steps.length - 1 }, instant);
    const specs = b.log.map(a => a.tpl);
    expect(specs.map(s => s.text)).toEqual(['2x + 5 = 20', '2x + 5 \u2212 5 = 20 \u2212 5', '2x = 15', '2x / 2 = 15 / 2', 'x = 7.5']);
    expect(specs.filter(s => s.boxed)).toHaveLength(1);
    expect(specs[specs.length - 1].boxed).toBe(true);
    expect(new Set(specs.slice(0, 4).map(s => s.color)).size).toBe(4);
  });

  it('re-anchors when the model\u2019s steps do not chain, so no jump is ever hidden from the student', async () => {
    const b = recorder(); const st = newDerivation('m1-3');
    await playDerivationStep(b, st, { before: 'B + W = 100', operation: 'substitute', after: '2W + 10 = 100' }, instant);
    await playDerivationStep(b, st, { before: '100 - 10', operation: 'subtract the extra 10', after: 'Remaining = 90' }, instant);
    const lines = b.log.map(a => a.tpl.text);
    expect(lines.indexOf('100 - 10')).toBeGreaterThan(lines.indexOf('2W + 10 = 100'));
  });

  it('draws a template row exactly as given and survives a failing board', async () => {
    const b = recorder();
    await playTemplateRow(b, 'k', { id: 'r3', kind: 'result', text: 'x = 7.5', label: 'Therefore', ordinal: 4, boxed: true, captionEn: '' }, instant);
    expect(b.log[0].id).toBe('k-r3'); expect(b.log[0].tpl.boxed).toBe(true); expect(b.log[0].tpl.color).toBe('#4ade80');
    const broken = { reveal: async () => { throw new Error('boom'); } };
    await expect(playDerivationStep(broken, newDerivation('x'), { before: 'x + 1 = 2', operation: 'subtract 1', after: 'x = 1' }, instant)).resolves.toBe(2);
  });

  it('pins a short problem line and never writes prose on the board', async () => {
    const b = recorder();
    await pinProblem(b, 'k', '3. Solve using the quadratic formula: 2x\u00b2 \u2212 7x + 3 = 0.\nsecond line');
    expect(b.log).toHaveLength(1); expect(b.log[0].role).toBe('problem'); expect(b.log[0].content).not.toContain('second line');
  });
});

describe('mandatory captions in every template', () => {
  it('gives every row kind a caption, in the teaching language', () => {
    const base = { id: 'r', text: 'x', ordinal: 0, captionEn: '' } as const;
    for (const kind of ['original', 'step', 'result', 'check-title', 'check', 'check-ok', 'answer', 'note'] as const) {
      expect(ensureCaption({ ...base, kind }).label?.trim()).toBeTruthy();
      expect(/[\u0D00-\u0D7F]/.test(ensureCaption({ ...base, kind }, 'malayalam').label || '')).toBe(true);
    }
    expect(ensureCaption({ ...base, kind: 'step', label: 'Divide both sides by 2' }).label).toBe('Divide both sides by 2');
  });
  it('playStepBar puts a captioned row on the board for steps that have no derivation line (geometry / graph / narrative)', async () => {
    const b = recorder();
    await playStepBar(b, 'g1', { id: 's2', n: 2, caption: 'Draw the auxiliary line' }, 1, 'english', instant);
    expect(b.log).toHaveLength(1);
    expect(b.log[0].id).toBe('g1-bar-s2');
    expect(b.log[0].tpl.text).toBe('Step 2');
    expect(b.log[0].tpl.label).toBe('Step 2');
    expect(b.log[0].tpl.label).not.toContain('auxiliary');
    await playStepBar(b, 'g1', { id: 's3', n: 3, caption: '' }, 2, 'english', instant);
    expect(b.log[1].tpl.label).toBe('Step 3');
  });
});

describe('groupHistory (side panels)', () => {
  const H = (paragraph: number, heading: string, before: string, after: string, key: string) => ({ key, paragraph, heading, step: { before, after } });
  it('numbers steps per paragraph and marks non-math entries as concepts', () => {
    const items = [
      H(1, 'Enhancing Geometric Efficiency', 'Static Diagram', 'Dynamic GeoGebra Model', 'a'),
      H(2, 'Conceptualizing the Bead Problem', 'B + W = 100', '(W + 10) + W = 100', 'b'),
      H(2, 'Conceptualizing the Bead Problem', '(W + 10) + W = 100', '2W + 10 = 100', 'c'),
      H(3, 'Analyzing Bead Distribution', '2W + 10 = 100', '2W = 90', 'd'),
    ];
    const isMath = (i: typeof items[number]) => isMathLike(i.step.before) || isMathLike(i.step.after);
    const g = groupHistory(items, isMath);
    expect(g.map(x => [x.paragraph, x.items.map(y => y.n)])).toEqual([[1, [0]], [2, [1, 2]], [3, [1]]]);
    expect(groupHistory(items.filter(isMath)).map(x => x.paragraph)).toEqual([2, 3]);
  });
});
