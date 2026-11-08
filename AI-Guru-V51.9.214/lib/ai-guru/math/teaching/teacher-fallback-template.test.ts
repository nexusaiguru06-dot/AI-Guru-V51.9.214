import { describe, it, expect } from 'vitest';
import { buildLocalTeacherLesson, buildTemplateTeacherLesson, recoverMissingVisualTeaching, repairTeacherVisualLayout } from './lesson-planner';
import { evaluateTeachingLesson, nodeBox } from './quality';
import { compileAIGuruTeachingLesson } from '../animation';
import type { AIGuruTeachingLesson } from './types';

const BEADS = [
  'Let\u2019s start with a problem:',
  'There are 100 beads, black and white, in a box; 10 more black than white. How many black and how many white?',
  'This can be thought out in different ways.',
  'If we keep the extra 10 black beads apart for the time being, there are 90 in the box, with black and white equal; which means 45 each.',
  'Now putting back the 10 black removed, there are 55 black and 45 white.',
  'We can use a little bit of algebra. Taking the number of black beads as x, the number of white is x - 10.',
];
const pageOf = (texts: string[]) => ({ pageNumber: 7, paragraphs: texts.map((text, i) => ({ id: `p${i}`, sentences: [{ id: `p7-para${i + 1}-s1`, text, readable: true, type: 'body' }] })) });
const inputOf = (texts: string[], over: Record<string, unknown> = {}): any => ({
  question: 'Textbook passage: ' + texts.join(' '), grade: 8, domain: 'algebra', language: 'english', chapterTitle: 'Pairs of Equations',
  textbookPageJson: JSON.stringify(pageOf(texts)), teacherReadingMode: true, ...over,
});
const allNodes = (l: AIGuruTeachingLesson) => l.segments.flatMap(s => s.beats.flatMap(b => b.actions.flatMap(a => (a.type === 'create' && a.node ? [a.node] : []))));
const run = async (l: AIGuruTeachingLesson, lang: 'english' | 'malayalam' = 'english') => {
  const fixed = repairTeacherVisualLayout(recoverMissingVisualTeaching(l, inputOf(BEADS)));
  return { lesson: fixed, quality: await evaluateTeachingLesson(fixed), compiled: compileAIGuruTeachingLesson(fixed, { teachingLanguage: lang }) };
};

describe('V51.9.7 Teacher-Reading fallback (Page 7 beads screenshot)', () => {
  it('passes visual QA on the first pass and teaches from the worked-solution video template', async () => {
    const { lesson, quality, compiled } = await run(buildTemplateTeacherLesson(inputOf(BEADS)));
    expect(quality.issues).toEqual([]);
    expect(quality.passed).toBe(true);
    expect(compiled.warnings).toEqual([]);
    const ids = allNodes(lesson).map(n => n.id);
    expect(ids.some(id => id.startsWith('row-'))).toBe(true);        // solver template rows are on the board
    expect(ids.some(id => id.startsWith('fallback-'))).toBe(false);   // no filler label clutter
    const latex = allNodes(lesson).filter(n => n.kind === 'latex').map(n => n.latex).join(' ');
    expect(latex).toMatch(/55/); expect(latex).toMatch(/45/);
  });
  it('still reads every textbook sentence verbatim with bilingual fields', async () => {
    const { lesson } = await run(buildTemplateTeacherLesson(inputOf(BEADS)));
    const beats = lesson.segments.flatMap(s => s.beats).filter(b => b.sourceCueId);
    expect(beats.map(b => b.read?.en)).toEqual(BEADS);
    expect(beats.every(b => b.read?.ml && b.explain?.en && b.explain?.ml)).toBe(true);
  });
  it('keeps every created node inside the 24px safe frame', async () => {
    const { lesson } = await run(buildTemplateTeacherLesson(inputOf(BEADS)));
    for (const n of allNodes(lesson)) { const b = nodeBox(n); expect(b.x).toBeGreaterThanOrEqual(24); expect(b.y).toBeGreaterThanOrEqual(24); expect(b.x + b.w).toBeLessThanOrEqual(976); expect(b.y + b.h).toBeLessThanOrEqual(676); }
  });
  it('works in Malayalam and for a primary grade profile (fewer segments)', async () => {
    for (const [grade, lang] of [[8, 'malayalam'], [5, 'english'], [11, 'english']] as const) {
      const { quality, compiled } = await run(buildTemplateTeacherLesson(inputOf(BEADS, { grade, language: lang })), lang);
      expect(quality.issues).toEqual([]); expect(compiled.warnings).toEqual([]);
    }
  });
  it('the table-and-chairs page also teaches from the template', async () => {
    const texts = ['The price of a table and a chair is 11000 rupees.', 'The price of a table and four chairs is 14000 rupees. What is the price of each?'];
    const { quality } = await run(buildTemplateTeacherLesson(inputOf(texts)));
    expect(quality.issues).toEqual([]);
  });
});

describe('board paging', () => {
  it('a page with no solvable problem (plain labels, many beats) is paged instead of overflowing', async () => {
    const texts = Array.from({ length: 6 }, (_, i) => `Concept sentence number ${i + 1} about the idea = ${i + 1}.`);
    const lesson = buildLocalTeacherLesson(inputOf(texts, { grade: 11 }));
    // simulate the old failure: many more rows than the board can hold
    const first = lesson.segments[0].beats[0];
    const mk = (i: number) => ({ type: 'create' as const, objectId: `x${i}`, node: { id: `x${i}`, kind: 'text' as const, x: 60, y: 38 + i * 58, width: 540, height: 50, content: `row ${i}`, style: { fontSize: 28 } } });
    first.actions = Array.from({ length: 16 }, (_, i) => mk(i));
    const fixed = repairTeacherVisualLayout(lesson);
    const q = await evaluateTeachingLesson(fixed);
    expect(q.checks['safe-frame']).toBe(true);
    expect(q.checks['text-overlap']).toBe(true);
    expect(fixed.segments.flatMap(s => s.beats.flatMap(b => b.actions)).some(a => a.type === 'erase')).toBe(true);
  });
  it('QA still catches genuinely overlapping text that is on the board at the same time', async () => {
    const l = buildTemplateTeacherLesson(inputOf(BEADS));
    const beat = l.segments.at(-1)!.beats[0];
    beat.actions.push({ type: 'create', objectId: 'clash', node: { id: 'clash', kind: 'text', x: 60, y: 110, width: 600, height: 40, content: 'clash', style: { fontSize: 28 } } });
    const q = await evaluateTeachingLesson(l);   // NOT repaired
    expect(q.checks['text-overlap']).toBe(false);
  });
});
