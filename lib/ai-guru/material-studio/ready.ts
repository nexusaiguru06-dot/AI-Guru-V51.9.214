/**
 * V51.9.116 — which uploaded textbooks are ready to teach: an indexed book with at least one study material made
 * from it. Newest material first. Pure, so it is tested without the store.
 */

export interface ReadyBook {
  id: string;
  fileName: string;
  title: string;
  subject: string;
  grade: string;
  pageCount: number;
  materials: number;
  /** A General Class (whiteboard notes) material exists, so the class can start straight away. */
  teachable: boolean;
  updatedAt: string;
}

interface DocLike { id: string; fileName: string; title?: string; subject?: string; grade?: string; pageCount?: number; indexedAt?: string; sources?: unknown[] }
interface MatLike { documentId: string; type: string; createdAt?: string; locked?: boolean }

/** A readable name from the file name: "kerala_maths_std9_part1.pdf" → "kerala maths std9 part1". */
export const bookTitle = (fileName: string) => fileName.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Textbook';

/** V51.9.187: `keepBare` also lists an indexed book with no material yet (a student's downloaded book is still taught from its text). */
export function readyBooks(docs: DocLike[], mats: MatLike[], keepBare = false): ReadyBook[] {
  const by = new Map<string, MatLike[]>();
  for (const m of mats) { const l = by.get(m.documentId); if (l) l.push(m); else by.set(m.documentId, [m]); }
  const out: ReadyBook[] = [];
  for (const d of docs) {
    const list = by.get(d.id) ?? [];
    if (!list.length && !keepBare) continue;
    if (Array.isArray(d.sources) && d.sources.length === 0) continue; // not indexed: nothing to teach from
    const updatedAt = list.reduce((t, m) => (m.createdAt && m.createdAt > t ? m.createdAt : t), d.indexedAt ?? '');
    out.push({
      id: d.id, fileName: d.fileName, title: d.title?.trim() || bookTitle(d.fileName), subject: d.subject ?? '', grade: d.grade ?? '',
      pageCount: d.pageCount ?? 0, materials: list.length, teachable: list.some((m) => m.type === 'whiteboard-notes'), updatedAt,
    });
  }
  return out.sort((a, b) => Number(b.teachable) - Number(a.teachable) || b.updatedAt.localeCompare(a.updatedAt));
}
