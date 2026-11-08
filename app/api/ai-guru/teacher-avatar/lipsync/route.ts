import { NextResponse } from 'next/server';
import { askerFor, callWorker, STUDENTS_NO_WORKERS, LIPSYNC_WORKER } from '@/lib/ai-guru/teacher/avatar-api';
import { readMeta, readVideo } from '@/lib/ai-guru/teacher/avatar-store';
import { wavSeconds } from '@/lib/ai-guru/teacher/avatar';

export const dynamic = 'force-dynamic';
export const maxDuration = 900;

/** Longest voice track the AI lip-sync takes in one job (a reel is usually 30–90 s). */
const MAX_SECONDS = 240;

/**
 * V51.9.100 — the AI lip-sync (LatentSync on a GPU PC: scripts/avatar-lipsync/latentsync_worker.py).
 * POST { audio: base64 WAV of the reel's voice track, code, key } — teachers only (students: photo lip-sync on the phone) → { ok, video: base64 MP4, syncConfidence? }
 * The worker loops the teacher's face video forward-and-back to the voice's length and re-draws the lips.
 * 503 when the worker is not running: the reel then uses the built-in photo lip-sync.
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const a = await askerFor(req, b);
  if ('error' in a) return a.error;
  if (a.role !== 'teacher') return NextResponse.json({ ok: false, error: STUDENTS_NO_WORKERS }, { status: 403 }); // no surprise cost from students
  const meta = await readMeta(a.id);
  const video = meta?.video ? await readVideo(a.id) : null;
  if (!meta || meta.style !== 'ai' || !video) return NextResponse.json({ ok: false, error: 'This avatar is not set to AI lip-sync.' }, { status: 404 });
  const audio = String(b.audio ?? '').replace(/^data:audio\/[a-z0-9.+-]+;base64,/i, '');
  const sec = audio ? wavSeconds(new Uint8Array(Buffer.from(audio, 'base64'))) : null;
  if (sec === null) return NextResponse.json({ ok: false, error: 'Send the voice track as a WAV.' }, { status: 400 });
  if (sec > MAX_SECONDS) return NextResponse.json({ ok: false, error: `The voice track is longer than ${MAX_SECONDS / 60} minutes.` }, { status: 400 });
  const r = await callWorker(LIPSYNC_WORKER(), '/lipsync', { video_b64: video.bytes.toString('base64'), video_type: video.type, audio_b64: audio, steps: b.quality === 'draft' ? 12 : 20 }, 850_000);
  if (!r.ok) return NextResponse.json({ ok: false, error: `AI lip-sync: ${r.error}` }, { status: r.status });
  const out = String(r.json.video_b64 ?? '');
  if (!out) return NextResponse.json({ ok: false, error: 'AI lip-sync: the worker sent no video.' }, { status: 502 });
  return NextResponse.json({ ok: true, video: out, syncConfidence: typeof r.json.sync_confidence === 'number' ? r.json.sync_confidence : null }, { headers: { 'cache-control': 'private, no-store' } });
}
