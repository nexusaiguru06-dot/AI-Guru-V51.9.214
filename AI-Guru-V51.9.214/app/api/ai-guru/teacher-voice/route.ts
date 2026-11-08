import { NextResponse } from 'next/server';
import { askerFor, callWorker, STUDENTS_NO_WORKERS, VOICE_WORKER } from '@/lib/ai-guru/teacher/avatar-api';
import { readMeta, readVoice } from '@/lib/ai-guru/teacher/avatar-store';

export const dynamic = 'force-dynamic';

/**
 * V51.9.100 — one sentence in the teacher's own voice (IndicF5 on this PC: scripts/teacher-voice/indicf5_server.py).
 * POST { text, lang, code, key } → { ok, result: { audioBase64, provider: 'teacher-voice' } }, the same shape as /api/ai-guru/tts.
 * Teachers only (code + key). Students never reach this worker: their avatar voice is their own key, on their phone.
 * 503 when the voice worker is not running: the reel maker then uses the classroom voice for that step.
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const a = await askerFor(req, b);
  if ('error' in a) return a.error;
  if (a.role !== 'teacher') return NextResponse.json({ ok: false, error: STUDENTS_NO_WORKERS }, { status: 403 }); // no surprise cost from students
  const text = String(b.text ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return NextResponse.json({ ok: false, error: 'Nothing to say.' }, { status: 400 });
  if (text.length > 600) return NextResponse.json({ ok: false, error: 'Too long for one step.' }, { status: 400 });
  const meta = await readMeta(a.id);
  const ref = meta?.voice ? await readVoice(a.id) : null;
  if (!meta?.voice || !ref) return NextResponse.json({ ok: false, error: 'No voice sample saved for this avatar.' }, { status: 404 });
  const r = await callWorker(VOICE_WORKER(), '/tts', { text, lang: b.lang === 'en' ? 'en' : 'ml', ref_audio_b64: ref.toString('base64'), ref_text: meta.voice.refText }, 120_000);
  if (!r.ok) return NextResponse.json({ ok: false, error: `Teacher voice: ${r.error}` }, { status: r.status });
  const audio = String(r.json.audio_b64 ?? '');
  if (!audio) return NextResponse.json({ ok: false, error: 'Teacher voice: the worker sent no audio.' }, { status: 502 });
  return NextResponse.json({ ok: true, result: { audioBase64: audio, provider: 'teacher-voice' } }, { headers: { 'cache-control': 'private, no-store' } });
}
