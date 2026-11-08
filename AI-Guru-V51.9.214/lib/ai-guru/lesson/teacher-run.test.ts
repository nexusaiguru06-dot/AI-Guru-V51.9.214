import { describe, expect, it } from 'vitest';
import { buildTeacherReadingMaterial, type TeacherRunParagraph } from './teacher-run';

const para = (id: string, page: number, text = `text of ${id}`): TeacherRunParagraph => ({ id, source: { text, pageNumber: page } });
const book = [para('a', 1), para('b', 7), para('c', 7), para('d', 8), para('e', 9), para('f', 12)];
const base = { lessonId: 'L', lessonTitle: 'Lesson', paragraphs: book, language: 'english' as const };

describe('buildTeacherReadingMaterial', () => {
  it('teaches on through the chapter instead of stopping after one paragraph', () => {
    const m = buildTeacherReadingMaterial({ ...base, startIndex: 1, startPage: 7, endPage: 9 });
    expect(m.sections.map(s => s.sourceIds[0])).toEqual(['b', 'c', 'd', 'e']);
    expect(m.sections.length).toBeGreaterThan(1);
  });

  it('stops at the end of the chapter, not the end of the book', () => {
    const m = buildTeacherReadingMaterial({ ...base, startIndex: 1, startPage: 7, endPage: 8 });
    expect(m.sections.map(s => s.sourceIds[0])).toEqual(['b', 'c', 'd']);
  });

  it('runs to the end of the book when no chapter end is known', () => {
    expect(buildTeacherReadingMaterial({ ...base, startIndex: 3, startPage: 8 }).sections).toHaveLength(3);
  });

  it('every section has a matching source id, so the textbook pane can follow along', () => {
    const m = buildTeacherReadingMaterial({ ...base, startIndex: 0, startPage: 1, endPage: 12 });
    expect(m.sources.map(s => s.id)).toEqual(m.sections.map(s => s.sourceIds[0]));
  });

  it('keeps the page the student is looking at for the first section only', () => {
    const m = buildTeacherReadingMaterial({ ...base, startIndex: 3, startPage: 6, endPage: 12 });
    expect(m.sources[0].page).toBe(6);
    expect(m.sources[1].page).toBe(9);
  });

  it('skips empty passages after the start but never drops the start paragraph', () => {
    const gappy = [para('x', 3, ''), para('y', 3, '   '), para('z', 3)];
    const m = buildTeacherReadingMaterial({ ...base, paragraphs: gappy, startIndex: 0, startPage: 3 });
    expect(m.sections.map(s => s.sourceIds[0])).toEqual(['x', 'z']);
  });

  it('caps one run so a single Play cannot queue the whole book', () => {
    const many = Array.from({ length: 300 }, (_, i) => para(`p${i}`, 1 + Math.floor(i / 5)));
    expect(buildTeacherReadingMaterial({ ...base, paragraphs: many, startIndex: 0, startPage: 1, maxSections: 25 }).sections).toHaveLength(25);
  });

  it('clamps a bad start index', () => {
    expect(buildTeacherReadingMaterial({ ...base, startIndex: 99, startPage: 12 }).sections.map(s => s.sourceIds[0])).toEqual(['f']);
  });
});

import { paragraphIndexForSource } from './paragraph-flow';

describe('teacher run <-> textbook pane', () => {
  it('every queued section maps back to its own lesson paragraph, so the pane advances with the class', () => {
    const m = buildTeacherReadingMaterial({ ...base, startIndex: 1, startPage: 7, endPage: 9 });
    m.sections.forEach((section, i) => {
      const hit = m.sources.find(s => s.id === section.sourceIds[0])!;
      const idx = paragraphIndexForSource(hit as never, book as never, section.sourceText);
      expect(book[idx!].id).toBe(section.sourceIds[0]);
      expect(idx).toBe(1 + i);
    });
  });
});
