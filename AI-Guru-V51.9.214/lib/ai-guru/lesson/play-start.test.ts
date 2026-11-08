import { describe, expect, it } from 'vitest';
import { resolvePlayStart } from './play-start';

const para = (pageNumber: number) => ({ source: { pageNumber } });

describe('resolvePlayStart', () => {
  // Front matter on page 1, chapter text begins on page 8; page 7 has no extracted text.
  const book = [para(1), para(1), para(2), para(8), para(8), para(9)];

  it('starts at the first paragraph on the requested page when it has text', () => {
    expect(resolvePlayStart(book, 0, 8)).toMatchObject({ index: 3, page: 8 });
  });

  it('starts from the next readable passage when the requested page has no text', () => {
    const r = resolvePlayStart(book, 1, 7)!;
    expect(r.index).toBe(3);
    expect(r.page).toBe(7);
    expect(r.requestedPage).toBe(7);
    expect(r.note).toMatch(/next readable passage on page 8/);
  });

  it('uses the cursor paragraph when no page was requested', () => {
    expect(resolvePlayStart(book, 4, null)).toMatchObject({ index: 4, page: 8 });
  });

  it('falls back to the last readable page past the end of the book', () => {
    const r = resolvePlayStart(book, 0, 40)!;
    expect(r.index).toBe(5);
    expect(r.page).toBe(9);
    expect(r.note).toBeTruthy();
  });

  it('copes with unsorted pages', () => {
    const odd = [para(9), para(1), para(8)];
    expect(resolvePlayStart(odd, 0, 7)).toMatchObject({ index: 2, page: 7 });
  });

  it('returns null for an empty lesson and clamps a bad cursor', () => {
    expect(resolvePlayStart([], 0, 7)).toBeNull();
    expect(resolvePlayStart(book, 99, null)).toMatchObject({ index: 5 });
  });
});
