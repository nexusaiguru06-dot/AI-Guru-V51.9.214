/**
 * V51.9.93: what a student who has not paid receives from a book: the free parts in full, and for the other parts only
 * what is needed to show them as locked (page numbers, chapter titles, material titles) — never their text or content.
 * Pure.
 */
import { buildStudyParts, freePartsOf, partOfMaterial, partOfPage, PART_COUNT, type StudyPart } from './parts';
import type { IndexedDocument, IndexedSource, StudyMaterial } from './types';

export interface PartSummary { index: number; startPage: number; endPage: number; free: boolean; locked: boolean }
export interface BookAccess { full: boolean; freeParts: number[]; lockedParts: number[]; signedIn: boolean; /** V51.9.192: parts that cannot be used to make study materials until paid, and the price of one part. */ createLocked?: number[]; partPrice?: number; due?: number; fee?: number; studentCode?: string; /** V51.9.94 */ monthly?: number; yearly?: number; yearlyReductionPct?: number; why?: string }
export type LockedSource = IndexedSource & { part: number; locked?: true };
export type ServedDocument = Omit<IndexedDocument, 'sources'> & { sources: LockedSource[]; parts: PartSummary[]; access: BookAccess };
export type ServedMaterial = StudyMaterial & { part: number; locked?: true };

/** V51.9.191: `paidParts` = the parts this student opened by paying (the part plan), open in every book. */
export function lockedPartsOf(doc: Pick<IndexedDocument, 'freeParts'>, defaultFree: number[], full: boolean, paidParts: number[] = []): { freeParts: number[]; lockedParts: number[] } {
  const freeParts = [...new Set([...freePartsOf(doc, defaultFree), ...paidParts])].sort((x, y) => x - y);
  return { freeParts, lockedParts: full ? [] : Array.from({ length: PART_COUNT }, (_, i) => i + 1).filter((p) => !freeParts.includes(p)) };
}

export function summariseParts(parts: StudyPart[], freeParts: number[], lockedParts: number[]): PartSummary[] {
  return parts.map((p) => ({ index: p.index, startPage: p.startPage, endPage: p.endPage, free: freeParts.includes(p.index), locked: lockedParts.includes(p.index) }));
}

/** The book as this person may see it. */
export function serveDocument(doc: IndexedDocument, a: Omit<BookAccess, 'freeParts' | 'lockedParts'> & { defaultFree: number[]; paidParts?: number[] }): ServedDocument {
  const parts = buildStudyParts(doc);
  const { freeParts, lockedParts } = lockedPartsOf(doc, a.defaultFree, a.full, a.paidParts);
  const sources: LockedSource[] = doc.sources.map((s) => {
    const part = partOfPage(parts, s.page);
    return lockedParts.includes(part) ? { id: s.id, page: s.page, paragraph: s.paragraph, chapterId: s.chapterId, chapterTitle: s.chapterTitle, text: '', part, locked: true } : { ...s, part };
  });
  const chapters = doc.chapters.map((c) => (lockedParts.includes(partOfPage(parts, c.startPage)) ? { ...c, summary: undefined } : c));
  const { defaultFree: _d, paidParts: _p, ...rest } = a;
  return { ...doc, chapters, sources, parts: summariseParts(parts, freeParts, lockedParts), access: { ...rest, freeParts, lockedParts } };
}

/** A material of a locked part becomes a stub: title, type, part and page range only. */
export function serveMaterial(m: StudyMaterial, parts: StudyPart[], lockedParts: number[]): ServedMaterial {
  const part = partOfMaterial(m, parts);
  if (!lockedParts.includes(part)) return { ...m, part };
  const pages = m.sources.map((s) => s.page).filter((n) => Number.isFinite(n));
  const stubSources = pages.length ? [{ id: 'locked-start', page: Math.min(...pages), paragraph: 0, text: '' }, { id: 'locked-end', page: Math.max(...pages), paragraph: 0, text: '' }] : [];
  return { id: m.id, documentId: m.documentId, type: m.type, title: m.title, owner: m.owner, overview: '', teachingLanguage: m.teachingLanguage, materialLanguages: m.materialLanguages, chapterIds: m.chapterIds, sections: [], sources: stubSources, qa: m.qa, model: '', createdAt: m.createdAt, updatedAt: m.updatedAt, part, locked: true };
}

export const isPageLocked = (doc: IndexedDocument, page: number, lockedParts: number[]) => lockedParts.length > 0 && lockedParts.includes(partOfPage(buildStudyParts(doc), page));
