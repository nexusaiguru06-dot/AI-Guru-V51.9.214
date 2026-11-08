import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { blobs, storageMode } from '@/lib/ai-guru/storage';
import { CHUNK_BYTES } from '@/lib/ai-guru/material-studio/chunked-upload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * V51.9.179 — POST { size, fileName } → { ok, direct, url?, key?, headers? }
 *
 * Cloud Run accepts at most 32 MB in one request, and textbooks are often larger. When files are kept in Cloud Storage,
 * this gives the browser a link, valid for 15 minutes, to put ONE PDF straight into the private bucket under a random
 * name (`uploads/u_….pdf`). The browser then calls /material-studio/index with that `uploadKey` instead of the file.
 * Anywhere else (laptop, Netlify) the answer is { direct: false, chunked: true, chunkBytes } (V51.9.204): the browser
 * sends the PDF in pieces to /material-studio/upload-chunk (Netlify takes at most about 4.5 MB in one request).
 * Uploads that are never indexed are removed by the bucket's 1-day rule (scripts/cloud/setup-google-cloud.sh).
 */
export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { size?: unknown; fileName?: unknown };
  const size = Number(b.size);
  const max = Number(process.env.AI_GURU_MAX_PDF_MB || 200) * 1024 * 1024;
  if (!(size > 0)) return NextResponse.json({ ok: false, error: 'Tell the size of the PDF.' }, { status: 400 });
  if (size > max) return NextResponse.json({ ok: false, error: `The PDF is larger than ${Math.round(max / 1048576)} MB.` }, { status: 413 });
  if (storageMode().blobs !== 'cloud-storage' || !blobs.uploadUrl) return NextResponse.json({ ok: true, direct: false, chunked: true, chunkBytes: CHUNK_BYTES });
  const key = `uploads/u_${randomBytes(12).toString('hex')}.pdf`;
  try {
    const { url, headers } = await blobs.uploadUrl(key, 'application/pdf', 900);
    return NextResponse.json({ ok: true, direct: true, url, key, headers }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    console.error('[upload-url] could not sign an upload link', e);
    return NextResponse.json({ ok: true, direct: false, chunked: true, chunkBytes: CHUNK_BYTES, note: 'Direct upload is not set up; sending the file in pieces.' });
  }
}
