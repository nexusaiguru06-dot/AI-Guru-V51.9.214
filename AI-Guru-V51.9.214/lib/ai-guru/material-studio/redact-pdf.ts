/**
 * V51.9.93 (server only): a copy of the book's PDF in which every page of a locked part is replaced by a blank page of the
 * same size saying it is locked. Page numbers stay the same, so "#page=N" links still land on the right page. The locked
 * pages' content is not copied at all (covering it would leave the text inside the file). Cached per book and lock set.
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { buildStudyParts, partOfPage } from './parts';
import type { IndexedDocument } from './types';

const cache = new Map<string, Uint8Array>();

export async function redactedPdf(doc: IndexedDocument, pdf: Buffer | Uint8Array, lockedParts: number[], freeParts: number[] = []): Promise<Uint8Array> {
  const key = `${doc.id}|${doc.indexedAt}|${lockedParts.join(',')}|${JSON.stringify(doc.freeParts ?? null)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const src = await PDFDocument.load(pdf, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.HelveticaBold);
  const parts = buildStudyParts(doc);
  const n = src.getPageCount();
  const keep = Array.from({ length: n }, (_, i) => i).filter((i) => !lockedParts.includes(partOfPage(parts, i + 1)));
  const copied = new Map((await out.copyPages(src, keep)).map((p, k) => [keep[k], p]));
  for (let i = 0; i < n; i++) {
    const page = copied.get(i);
    if (page) { out.addPage(page); continue; }
    const { width, height } = src.getPage(i).getSize();
    const blank = out.addPage([width, height]);
    const part = partOfPage(parts, i + 1);
    const lines = [`Page ${i + 1} - Part ${part}`, 'This part opens when the fee is paid.', freeParts.length ? `Free to study: Part ${freeParts.join(', ')}` : ''];
    lines.forEach((t, k) => { const size = k === 0 ? 20 : 13; blank.drawText(t, { x: (width - font.widthOfTextAtSize(t, size)) / 2, y: height / 2 + 20 - k * 26, size, font, color: rgb(0.2, 0.25, 0.33) }); });
  }
  const bytes = await out.save();
  if (cache.size > 20) cache.delete(cache.keys().next().value!);
  cache.set(key, bytes);
  return bytes;
}
