import { describe, it, expect } from 'vitest';
import { headingOf, heuristicChapters } from './book-understanding';

describe('V51.9.107 chapters found without AI', () => {
  it('reads a chapter heading even when it runs into the text', () => {
    expect(headingOf('Chapter 1 Fractions A fraction is a part of a whole.')).toEqual({ key: 'chapter 1', title: 'Chapter 1 Fractions' });
    expect(headingOf('UNIT 3: Ratio and Proportion. In this unit we…')).toEqual({ key: 'unit 3', title: 'Unit 3 Ratio and Proportion' });
    expect(headingOf('Lesson IV - Simple Equations The balance…')).toEqual({ key: 'lesson iv', title: 'Lesson IV Simple Equations' });
    expect(headingOf('അധ്യായം 2 ഭിന്നസംഖ്യകൾ')).toMatchObject({ key: 'അധ്യായം 2' });
    expect(headingOf('A fraction is a part of a whole.')).toBeNull();
    expect(headingOf('Chapters of this book are short.')).toBeNull();
  });
  it('splits a book at each new chapter, and a heading repeated on the next page stays in the same chapter', () => {
    const src = (id: string, page: number, text: string) => ({ id, page, text }) as Parameters<typeof heuristicChapters>[0][number];
    const ch = heuristicChapters([
      src('a', 1, 'Chapter 1 Fractions A fraction is a part of a whole.'), src('b', 1, 'Half of a pizza.'),
      src('c', 2, 'Chapter 1 Fractions Line 1 of page 2.'),
      src('d', 3, 'Chapter 2 Decimals Tenths and hundredths.'), src('e', 4, 'More decimals.'),
      src('f', 5, 'Chapter 3 Ratio A ratio compares two quantities.'),
    ]);
    expect(ch.map((c) => [c.title, c.startPage, c.endPage, c.sourceIds.length])).toEqual([['Chapter 1 Fractions', 1, 2, 3], ['Chapter 2 Decimals', 3, 4, 2], ['Chapter 3 Ratio', 5, 5, 1]]);
  });
});
