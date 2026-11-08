import { describe, expect, it } from 'vitest';
import pages from '../../../fixtures/ai-guru/question-paper-pages.json';
import { indexPdf } from '../material-studio/index-pdf';
import { nextParagraphToTeach, paragraphIndexForSource, toIndexedSource } from './paragraph-flow';

// Build the lesson exactly like the classroom does (createLessonDraft: id `paragraph:${index}`).
const { sources } = indexPdf(pages as any, 'paper.pdf');
const paragraphs = sources.map((s, i) => ({ id: `paragraph:${i}`, source: { pageNumber: s.page, text: s.text } }));

/** The OLD behaviour, kept only to prove the bug: `paragraph` = global 0-based index, read as page-local 1-based. */
function legacyMatch(i: number) {
  const p = paragraphs[i];
  const hit = { id: p.id, page: p.source.pageNumber!, paragraph: i || 1, text: p.source.text };
  const samePage = paragraphs.map((q, k) => ({ q, k })).filter(({ q }) => q.source.pageNumber === hit.page);
  const byNumber = samePage[hit.paragraph - 1];
  const exact = samePage.find(({ q }) => q.source.text === hit.text);
  return (byNumber || exact)!.k;
}

describe('the repeat bug (old behaviour)', () => {
  it('old mapping resolved most page-1 paragraphs to the paragraph BEFORE them, so "next" replayed the same one', () => {
    expect(legacyMatch(0)).toBe(0);
    expect(legacyMatch(2)).toBe(1);      // taught paragraph 2, thought it was 1 ...
    expect(legacyMatch(2) + 1).toBe(2);  // ... "next" = 2 again: the lesson never moves on
  });
});

describe('new flow', () => {
  it('maps every on-demand paragraph to itself', () => {
    paragraphs.forEach((p, i) => {
      expect(paragraphIndexForSource(toIndexedSource(p, paragraphs), paragraphs)).toBe(i);
    });
  });
  it('maps indexed ids (S2_3) and plain page-local numbers correctly too', () => {
    sources.forEach((s, i) => expect(paragraphIndexForSource(s as any, paragraphs)).toBe(i));
  });
  it('teaching from paragraph 0 walks 1, 2, 3 ... to the end with no repeats', () => {
    const taught = new Set<number>();
    let current = 0; const order: number[] = [0]; taught.add(0);
    for (let guard = 0; guard < 100; guard++) {
      const last = paragraphIndexForSource(toIndexedSource(paragraphs[current], paragraphs), paragraphs);
      const next = nextParagraphToTeach({ lastMatched: last, fallbackCurrent: current, taught, total: paragraphs.length });
      if (next === null) break;
      order.push(next); taught.add(next); current = next;
    }
    expect(order).toEqual(paragraphs.map((_, i) => i));
    expect(new Set(order).size).toBe(order.length);
  });
  it('even a wrong match can never send the lesson backwards or sideways', () => {
    expect(nextParagraphToTeach({ lastMatched: 1, fallbackCurrent: 5, taught: [0, 1, 2, 3, 4, 5], total: 22 })).toBe(6);
    expect(nextParagraphToTeach({ lastMatched: undefined, fallbackCurrent: 3, taught: [], total: 22 })).toBe(4);
    expect(nextParagraphToTeach({ lastMatched: 21, fallbackCurrent: 21, taught: [21], total: 22 })).toBeNull();
  });
});
