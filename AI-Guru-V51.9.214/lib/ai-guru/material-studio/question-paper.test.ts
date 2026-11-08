import { describe, expect, it } from 'vitest';
import pages from '../../../fixtures/ai-guru/question-paper-pages.json';
import { indexPdf } from './index-pdf';
import { splitQuestionPaper } from './question-paper';

describe('20-question test paper (real text extracted with the app\'s own layout code)', () => {
  const { sources, parser } = indexPdf(pages as any, 'AI-Guru-V45-20-Question-Test-Paper.pdf');
  const questions = sources.filter(s => /^\d{1,2}\. /.test(s.text));

  it('uses question-paper mode', () => expect(parser).toContain('question-paper'));

  it('creates exactly one unit per question, in printed order 1..20', () => {
    expect(questions.map(q => Number(q.text.match(/^(\d+)\./)![1]))).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('never merges two questions into one unit and never cuts a question in half', () => {
    for (const q of questions) {
      const n = Number(q.text.match(/^(\d+)\./)![1]);
      // a unit starts with its own number and never contains the NEXT question's number
      expect(new RegExp(`(?:^|\\s)${n + 1}\\.\\s+[A-Z(\\u2212-]`).test(q.text), q.text).toBe(false);
    }
    const q19 = questions.find(q => q.text.startsWith('19.'))!;
    expect(q19.text).toContain('60\u00b0');
    expect(q19.text).toContain('geometrically');
  });

  it('keeps instructions and the closing note as their own units', () => {
    expect(sources[0].text).toMatch(/^AI GURU V45/);
    expect(sources[0].text).not.toMatch(/^1\./);
    expect(sources.some(s => /^Student instruction:/.test(s.text))).toBe(true);
    const q20 = questions.find(q => q.text.startsWith('20.'))!;
    expect(q20.text).not.toContain('Student instruction');
  });

  it('ids are page-local and sequential, matching what the rest of the app expects', () => {
    const p1 = sources.filter(s => s.page === 1).map(s => s.id);
    expect(p1[0]).toBe('S1_1');
    expect(p1[p1.length - 1]).toBe(`S1_${p1.length}`);
    expect(sources.find(s => s.text.startsWith('14.'))!.page).toBe(2);
    expect(sources.find(s => s.text.startsWith('14.'))!.id).toBe('S2_1');
  });
});

describe('splitQuestionPaper guards', () => {
  it('does not trigger on ordinary prose or on fewer than 3 questions', () => {
    expect(splitQuestionPaper([{ page: 1, text: 'Dear children, this chapter has 2. things to learn.\n\nAnother paragraph.' }])).toBeNull();
    expect(splitQuestionPaper([{ page: 1, text: '1. First.\n2. Second.' }])).toBeNull();
  });
  it('splits questions glued together and keeps very short questions', () => {
    const u = splitQuestionPaper([{ page: 1, text: '1. Add 2+3.\n2. Solve x+1=2.3. Find 4*5.\n4. Divide 8/2.' }])!;
    expect(u.map(x => x.text)).toEqual(['1. Add 2+3.', '2. Solve x+1=2.', '3. Find 4*5.', '4. Divide 8/2.']);
  });
  it('numbering must start at 1 (a stray list inside a chapter is not a paper)', () => {
    expect(splitQuestionPaper([{ page: 1, text: 'Intro text here for the chapter.\n5. a\n6. b\n7. c' }])).toBeNull();
  });
});
