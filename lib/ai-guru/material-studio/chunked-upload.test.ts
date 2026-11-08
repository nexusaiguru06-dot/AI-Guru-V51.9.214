// @vitest-environment node
/** V51.9.204 — a large PDF sent in pieces (Netlify takes about 4.5 MB per request), and clear errors for non-JSON replies. */
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CHUNK_BYTES, checkPart, pieces, readJsonReply } from './chunked-upload';

describe('pieces and checks', () => {
  it('splits a size into 1 MB ranges', () => {
    expect(CHUNK_BYTES).toBe(1024 * 1024);
    expect(pieces(2.5 * 1024 * 1024)).toEqual([[0, CHUNK_BYTES], [CHUNK_BYTES, 2 * CHUNK_BYTES], [2 * CHUNK_BYTES, 2.5 * 1024 * 1024]]);
    expect(pieces(10)).toEqual([[0, 10]]);
  });
  it('refuses bad ids, numbers and sizes', () => {
    expect(checkPart('a'.repeat(24), 0, 3, 100)).toBeNull();
    expect(checkPart('../etc', 0, 3, 100)).toMatch(/id/);
    expect(checkPart('a'.repeat(24), 3, 3, 100)).toMatch(/piece number/);
    expect(checkPart('a'.repeat(24), 0, 101, 100)).toMatch(/pieces/);
    expect(checkPart('a'.repeat(24), 0, 3, CHUNK_BYTES + 1)).toMatch(/MB/);
  });
  it('explains an empty or non-JSON reply instead of "Unexpected end of JSON input"', async () => {
    expect(await readJsonReply(new Response('', { status: 413 }), 'Reading the textbook')).toMatchObject({ ok: false, error: expect.stringMatching(/too large/) });
    expect(await readJsonReply(new Response('<html>Gateway timeout</html>', { status: 504 }), 'Reading the textbook')).toMatchObject({ ok: false, error: expect.stringMatching(/took too long/) });
    expect(await readJsonReply(new Response('', { status: 502 }), 'Sending piece 1')).toMatchObject({ ok: false, error: expect.stringMatching(/stopped with an error \(502\)[\s\S]*Part 1/) });
    expect(await readJsonReply(new Response('{"ok":true,"x":1}', { status: 200 }), 'x')).toEqual({ ok: true, x: 1 });
  });
});

describe('the upload route', () => {
  let R: any;
  beforeAll(async () => {
    process.chdir(mkdtempSync(path.join(tmpdir(), 'chunk204-')));
    R = await import('@/app/api/ai-guru/material-studio/upload-chunk/route');
  });
  const send = (id: string, part: number, parts: number, body: Uint8Array) => R.POST(new Request(`http://x/a?id=${id}&part=${part}&parts=${parts}`, { method: 'POST', body }));
  it('joins the pieces into one PDF that the index route can read', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.7\n' + 'x'.repeat(5000) + '\n%%EOF');
    const id = 'b'.repeat(24);
    const a = pdf.slice(0, 2000), b = pdf.slice(2000, 4000), c = pdf.slice(4000);
    expect(await (await send(id, 0, 3, a)).json()).toMatchObject({ ok: true, done: false });
    expect(await (await send(id, 1, 3, b)).json()).toMatchObject({ ok: true, done: false });
    const last = await (await send(id, 2, 3, c)).json();
    expect(last).toMatchObject({ ok: true, done: true, key: `uploads/u_${id}.pdf`, size: pdf.length });
    const { blobs } = await import('@/lib/ai-guru/storage');
    expect(Buffer.compare((await blobs.get(last.key))!, Buffer.from(pdf))).toBe(0);
    const { UPLOAD_KEY } = await import('./store');
    expect(UPLOAD_KEY.test(last.key)).toBe(true);
  });
  it('a missing piece or a file that is not a PDF is refused', async () => {
    expect((await send('c'.repeat(24), 1, 2, new Uint8Array([1, 2, 3]))).status).toBe(409);
    expect((await send('d'.repeat(24), 0, 1, new TextEncoder().encode('hello'))).status).toBe(400);
  });
});
