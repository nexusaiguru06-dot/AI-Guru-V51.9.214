import { NextResponse } from 'next/server';
import { blobs } from '@/lib/ai-guru/storage';
import { checkPart, partKeyOf, partsFolderOf, uploadKeyOf } from '@/lib/ai-guru/material-studio/chunked-upload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * V51.9.204 — one piece of a large PDF: POST ?id=<24 hex>&part=<n>&parts=<total>, the body = the piece's bytes.
 * The last piece joins all of them into uploads/u_<id>.pdf and answers { ok, done: true, key }.
 * Pieces that are never joined, like unindexed uploads, are left for storage clean-up.
 */
export async function POST(request: Request) {
  try { return await handle(request); } catch (e) {
    console.error('[upload-chunk]', e);
    return NextResponse.json({ ok: false, error: `Could not store the PDF piece: ${e instanceof Error ? e.message.slice(0, 200) : 'storage error'}` }, { status: 500 });
  }
}

async function handle(request: Request) {
  const q = new URL(request.url).searchParams;
  const id = String(q.get('id') ?? ''), part = Number(q.get('part')), parts = Number(q.get('parts'));
  const bytes = new Uint8Array(await request.arrayBuffer());
  const bad = checkPart(id, part, parts, bytes.byteLength);
  if (bad) return NextResponse.json({ ok: false, error: bad }, { status: 400 });
  await blobs.put(partKeyOf(id, part), bytes, 'application/octet-stream');
  if (part < parts - 1) return NextResponse.json({ ok: true, done: false });
  // the last piece: join them in order (a missing piece means the browser must send it again)
  const all: Buffer[] = [];
  for (let i = 0; i < parts; i++) {
    const b = await blobs.get(partKeyOf(id, i));
    if (!b) return NextResponse.json({ ok: false, missing: i, error: `Piece ${i + 1} of ${parts} did not arrive. Please upload again.` }, { status: 409 });
    all.push(b);
  }
  const whole = Buffer.concat(all);
  if (whole.subarray(0, 5).toString('latin1') !== '%PDF-') { await blobs.delPrefix(partsFolderOf(id)).catch(() => undefined); return NextResponse.json({ ok: false, error: 'That file is not a PDF.' }, { status: 400 }); }
  await blobs.put(uploadKeyOf(id), new Uint8Array(whole), 'application/pdf');
  await blobs.delPrefix(partsFolderOf(id)).catch(() => undefined);
  return NextResponse.json({ ok: true, done: true, key: uploadKeyOf(id), size: whole.length }, { headers: { 'cache-control': 'no-store' } });
}
