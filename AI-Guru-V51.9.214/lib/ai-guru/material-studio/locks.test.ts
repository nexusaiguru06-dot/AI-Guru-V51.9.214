/** V51.9.93: the five parts, and what a student who has not paid receives from a book. */
import { describe, expect, it } from 'vitest';
import { buildStudyParts, partOfMaterial, partOfPage } from './parts';
import { isPageLocked, serveDocument, serveMaterial } from './locks';
import { mat, sampleBook } from './locks.fixtures';

describe('five parts', () => {
  const parts = buildStudyParts(sampleBook());
  it('follow the chapters', () => {
    expect(parts.map((p) => [p.index, p.startPage, p.endPage])).toEqual([[1, 1, 10], [2, 11, 20], [3, 21, 30], [4, 31, 40], [5, 41, 50], [6, 51, 60], [7, 61, 70], [8, 71, 80], [9, 81, 90], [10, 91, 100]]);
    expect(partOfPage(parts, 1)).toBe(1); expect(partOfPage(parts, 25)).toBe(3); expect(partOfPage(parts, 50)).toBe(5);
  });
  it('a material belongs to the part it was made for, else to the last part its pages touch', () => {
    expect(partOfMaterial(mat('a', ['part-1'], [3]), parts)).toBe(1);
    expect(partOfMaterial(mat('b', ['part-3::ch3'], [22]), parts)).toBe(3);
    expect(partOfMaterial(mat('c', ['ch1', 'ch2'], [2, 15]), parts)).toBe(2);
    expect(partOfMaterial(mat('d', [], []), parts)).toBe(1);
  });
});

describe('what a student who has not paid receives', () => {
  it('free part in full; locked parts without text, summaries or content', () => {
    const d = serveDocument(sampleBook(), { full: false, signedIn: true, fee: 900, studentCode: 'ST-5-26', defaultFree: [1] });
    expect(d.access).toMatchObject({ full: false, freeParts: [1], lockedParts: [2, 3, 4, 5, 6, 7, 8, 9, 10], fee: 900 });
    expect(d.sources[0]).toMatchObject({ text: 'Text of page 1', part: 1 });
    expect(d.sources[10]).toMatchObject({ text: '', part: 2, locked: true, page: 11 });
    expect(d.sources.filter((s) => s.text).length).toBe(10);
    expect(JSON.stringify(d)).not.toContain('Text of page 11');
    expect(d.chapters[0].summary).toBe('About chapter 1');
    expect(d.chapters[1].summary).toBeUndefined();
    expect(d.chapters[1].title).toBe('Chapter 2');
    expect(d.parts.map((p) => p.locked)).toEqual([false, true, true, true, true, true, true, true, true, true]);
  });
  it('a book’s own free parts win; enrolled gets everything', () => {
    expect(serveDocument(sampleBook([1, 2]), { full: false, signedIn: false, defaultFree: [1] }).access.lockedParts).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    const all = serveDocument(sampleBook(), { full: true, signedIn: true, defaultFree: [1] });
    expect(all.access.lockedParts).toEqual([]);
    expect(all.sources.every((s) => s.text)).toBe(true);
  });
  it('materials of locked parts become stubs (title, type, part, pages only)', () => {
    const parts = buildStudyParts(sampleBook());
    const open = serveMaterial(mat('a', ['part-1'], [3], 'whiteboard-notes'), parts, [2, 3, 4, 5]);
    expect(open).toMatchObject({ part: 1, sections: [{ content: 'secret question' }] });
    expect(open.locked).toBeUndefined();
    const stub = serveMaterial(mat('b', ['part-3'], [22, 27], 'revision-notes'), parts, [2, 3, 4, 5]);
    expect(stub).toMatchObject({ part: 3, locked: true, sections: [], overview: '', title: 'revision-notes b', type: 'revision-notes' });
    expect(stub.sources.map((s) => s.page)).toEqual([22, 27]);
    expect(JSON.stringify(stub)).not.toMatch(/secret|Text of page/);
    expect(isPageLocked(sampleBook(), 11, [2, 3, 4, 5])).toBe(true);
    expect(isPageLocked(sampleBook(), 10, [2, 3, 4, 5])).toBe(false);
  });
});
