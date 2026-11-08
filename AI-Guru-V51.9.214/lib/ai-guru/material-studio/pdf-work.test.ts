/** V51.9.179 — large textbooks (EGM review M7): limited PDF work, the PDF cache, and the file operations it relies on. */
import { mkdtempSync, promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  process.env.AI_GURU_DATA_ROOT = mkdtempSync(path.join(tmpdir(), 'pdfwork-'));
  delete process.env.AI_GURU_BUCKET; delete process.env.AI_GURU_BLOBS;
});

describe('withPdfSlot', () => {
  it('never runs more than AI_GURU_PDF_CONCURRENCY jobs at once, and every job finishes', async () => {
    process.env.AI_GURU_PDF_CONCURRENCY = '2';
    const { withPdfSlot } = await import('./pdf-work');
    let now = 0, peak = 0;
    const job = () => withPdfSlot(async () => { now++; peak = Math.max(peak, now); await new Promise((r) => setTimeout(r, 10)); now--; return 1; });
    const out = await Promise.all(Array.from({ length: 9 }, job));
    expect(out).toHaveLength(9);
    expect(peak).toBe(2);
  });
  it('a failing job frees its slot', async () => {
    process.env.AI_GURU_PDF_CONCURRENCY = '1';
    const { withPdfSlot } = await import('./pdf-work');
    await expect(withPdfSlot(async () => { throw new Error('bad pdf'); })).rejects.toThrow('bad pdf');
    expect(await withPdfSlot(async () => 'ok')).toBe('ok');
  });
});

describe('cachedPdf', () => {
  it('reads a book once, then from the cache; forgets it when asked; big books are not kept', async () => {
    process.env.AI_GURU_PDF_CACHE_MB = '1';
    const { blobs } = await import('../storage');
    await blobs.put('.data/ai-guru-material-studio/pdf/doc:small.pdf', new Uint8Array(100_000));
    await blobs.put('.data/ai-guru-material-studio/pdf/doc:big.pdf', new Uint8Array(400_000)); // more than a quarter of 1 MB
    const store = await import('./store');
    const spy = vi.spyOn(store, 'getDocumentPdf');
    const { cachedPdf, forgetPdf } = await import('./pdf-work');
    expect((await cachedPdf('doc:small'))?.length).toBe(100_000);
    await cachedPdf('doc:small');
    await cachedPdf('doc:big'); await cachedPdf('doc:big');
    forgetPdf('doc:small'); await cachedPdf('doc:small');
    const calls = spy.mock.calls.map((c) => c[0]);
    expect(calls.filter((c) => c === 'doc:small')).toHaveLength(2); // first read + after forgetting
    expect(calls.filter((c) => c === 'doc:big')).toHaveLength(2); // never cached
    expect(await cachedPdf('doc:none')).toBeNull();
  });
});

describe('file operations used for large uploads (local files)', () => {
  it('size, stream, toFile and move', async () => {
    const { blobs } = await import('../storage');
    const bytes = new Uint8Array(Array.from({ length: 5000 }, (_, i) => i % 251));
    await blobs.put('uploads/u_0123456789abcdef01234567.pdf', bytes);
    expect(await blobs.size('uploads/u_0123456789abcdef01234567.pdf')).toBe(5000);
    expect(await blobs.size('uploads/u_none.pdf')).toBeNull();
    const streamed = new Uint8Array(await new Response(await blobs.stream('uploads/u_0123456789abcdef01234567.pdf')).arrayBuffer());
    expect(streamed).toEqual(bytes);
    const dest = path.join(mkdtempSync(path.join(tmpdir(), 'tofile-')), 'b.pdf');
    expect(await blobs.toFile('uploads/u_0123456789abcdef01234567.pdf', dest)).toBe(true);
    expect((await fsp.readFile(dest)).length).toBe(5000);
    await blobs.move('uploads/u_0123456789abcdef01234567.pdf', '.data/ai-guru-material-studio/pdf/doc:moved.pdf');
    expect(await blobs.get('uploads/u_0123456789abcdef01234567.pdf')).toBeNull();
    expect((await blobs.get('.data/ai-guru-material-studio/pdf/doc:moved.pdf'))?.length).toBe(5000);
    expect(blobs.uploadUrl).toBeUndefined(); // direct upload only exists for Cloud Storage
  });
  it('saveDocumentFromUpload accepts only real upload names', async () => {
    const store = await import('./store');
    await expect(store.saveDocumentFromUpload({ id: 'doc:x' } as never, '../../etc/passwd')).rejects.toThrow('Invalid upload');
    await expect(store.saveDocumentFromUpload({ id: 'doc:x' } as never, 'uploads/u_short.pdf')).rejects.toThrow('Invalid upload');
  });
});
