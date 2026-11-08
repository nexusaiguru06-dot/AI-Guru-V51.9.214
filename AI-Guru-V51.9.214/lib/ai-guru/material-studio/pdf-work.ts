/**
 * V51.9.179 — keeping heavy PDF work within one server copy's memory (EGM review M7).
 *
 * Rendering a page image, finding figures, repairing a page, OCR and redaction all load the whole PDF into memory.
 * On Cloud Run (2 GB, up to 40 requests at once) a few textbooks at the same time could run the server out of memory.
 *  - `withPdfSlot` lets at most AI_GURU_PDF_CONCURRENCY (default 2) of these run at once in this copy; others wait.
 *  - `cachedPdf` keeps recently used PDFs in a small cache (AI_GURU_PDF_CACHE_MB, default 150 MB), so the classroom
 *    showing page after page of the same book does not download it again for every page.
 */
import { getDocumentPdf } from './store';

const limit = () => Math.max(1, Number(process.env.AI_GURU_PDF_CONCURRENCY || 2));
let active = 0;
const waiting: Array<() => void> = [];

export async function withPdfSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= limit()) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

/** For tests and the health view. */
export const pdfSlotState = () => ({ active, waiting: waiting.length, limit: limit() });

const budget = () => Math.max(0, Number(process.env.AI_GURU_PDF_CACHE_MB ?? 150)) * 1024 * 1024;
const cache = new Map<string, Buffer>(); // insertion order = least recently used first
let cachedBytes = 0;

export function clearPdfCache() { cache.clear(); cachedBytes = 0; }

/** The book's PDF, from the cache when it was used recently. Books larger than a quarter of the cache are not kept. */
export async function cachedPdf(id: string): Promise<Buffer | null> {
  const hit = cache.get(id);
  if (hit) { cache.delete(id); cache.set(id, hit); return hit; }
  const pdf = await getDocumentPdf(id);
  if (!pdf) return null;
  if (pdf.length <= budget() / 4) {
    cache.set(id, pdf);
    cachedBytes += pdf.length;
    for (const [k, v] of cache) {
      if (cachedBytes <= budget()) break;
      cache.delete(k);
      cachedBytes -= v.length;
    }
  }
  return pdf;
}

/** Forget a book (after it is replaced or deleted). */
export function forgetPdf(id: string) { const v = cache.get(id); if (v) { cachedBytes -= v.length; cache.delete(id); } }
