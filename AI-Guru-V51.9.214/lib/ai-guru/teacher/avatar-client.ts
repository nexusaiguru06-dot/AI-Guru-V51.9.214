'use client';

/**
 * V51.9.100 — browser side of the teacher's avatar: the picture ready for reels, the teacher's sign-in for the
 * avatar routes, recording the voice sample as WAV, and the AI lip-sync job.
 */

import { decodeImage } from '../student/photo-client';
import { prepareAvatar, type PreparedAvatar } from '../reels/motion/avatar-draw';
import { encodeWav, resample, type VoiceClips } from '../reels/motion/audio';
import { reelVoiceTrack, TRACK_RATE } from '../reels/motion/lipsync';
import type { MotionReel } from '../reels/motion/reel';
import type { AvatarForReel } from './avatar';

/* ---------------- the teacher's sign-in (this tab only) ---------------- */

const SIGNIN_KEY = 'aiguru_teacher_signin_v1';
export type TeacherAuth = { code: string; key: string };

export function loadTeacherAuth(): TeacherAuth | null {
  try {
    const o = JSON.parse(sessionStorage.getItem(SIGNIN_KEY) ?? 'null') as TeacherAuth | null;
    return o && typeof o.code === 'string' && typeof o.key === 'string' ? o : null;
  } catch {
    return null;
  }
}
export function saveTeacherAuth(a: TeacherAuth | null) {
  try { if (a) sessionStorage.setItem(SIGNIN_KEY, JSON.stringify(a)); else sessionStorage.removeItem(SIGNIN_KEY); } catch { /* private mode */ }
}

/* ---------------- the avatar for a reel ---------------- */

let cache: { key: string; p: PreparedAvatar } | null = null;

/** The decoded, prepared avatar (cached until the avatar changes). */
export async function preparedAvatar(a: AvatarForReel): Promise<PreparedAvatar> {
  const key = `${a.id}|${a.at}|${a.style}|${JSON.stringify(a.marks)}|${a.name}`;
  if (cache?.key === key) return cache.p;
  const img = await decodeImage(a.photo);
  const p = prepareAvatar(img, { marks: a.marks, name: a.name, style: a.style, id: a.id });
  cache = { key, p };
  return p;
}

/** A signed-in student's class teacher's avatar, when the teacher shares it (null otherwise). */
export async function fetchMyTeachersAvatar(): Promise<AvatarForReel | null> {
  try {
    const r = await fetch('/api/ai-guru/student-portal/teacher-avatar', { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.ok ? (j.avatar as AvatarForReel) : null;
  } catch {
    return null;
  }
}

export async function teacherAvatarCall(auth: TeacherAuth, body: Record<string, unknown>): Promise<Record<string, any>> {
  const r = await fetch('/api/ai-guru/teacher-avatar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...auth, ...body }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);
  return j;
}

/* ---------------- recording ---------------- */

export function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Any audio the browser can open (a recording, an MP3, a WAV) → mono 24 kHz WAV as base64, and its length. */
export async function audioToWav(blob: Blob, rate = 24_000): Promise<{ b64: string; seconds: number; url: string }> {
  const ctx = new OfflineAudioContext(1, 1, 48_000);
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  const mono = new Float32Array(buf.length);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) mono[i] += d[i] / buf.numberOfChannels;
  }
  // trim silence at both ends (the voice cloner copies pauses too)
  let a = 0, b = mono.length - 1;
  while (a < b && Math.abs(mono[a]) < 0.01) a++;
  while (b > a && Math.abs(mono[b]) < 0.01) b--;
  const pad = Math.round(0.15 * buf.sampleRate);
  const cut = mono.slice(Math.max(0, a - pad), Math.min(mono.length, b + pad));
  const out = resample(cut, buf.sampleRate, rate);
  const wav = new Uint8Array(encodeWav(out, rate));
  return { b64: bytesToB64(wav), seconds: out.length / rate, url: URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })) };
}

/** Starts recording from the microphone; call the returned stop() to get the recording. */
export async function startRecording(): Promise<{ stop: () => Promise<Blob>; cancel: () => void }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  const rec = new MediaRecorder(stream);
  const parts: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  rec.start();
  const end = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () => new Promise<Blob>((resolve) => { rec.onstop = () => { end(); resolve(new Blob(parts, { type: rec.mimeType || 'audio/webm' })); }; rec.stop(); }),
    cancel: () => { try { rec.stop(); } catch { /* stopped */ } end(); },
  };
}

/** Length of a video file in seconds (read by the browser). */
export function videoSeconds(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    const url = URL.createObjectURL(file);
    v.onloadedmetadata = () => { const d = v.duration; URL.revokeObjectURL(url); resolve(Number.isFinite(d) ? d : 0); };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not open that video.')); };
    v.src = url;
  });
}

/* ---------------- AI lip-sync ---------------- */

/** The reel's voice-over alone as a 16 kHz WAV (what LatentSync listens to). */
export function voiceTrackWav(reel: MotionReel, clips: VoiceClips): string {
  return bytesToB64(new Uint8Array(encodeWav(reelVoiceTrack(reel, clips, TRACK_RATE), TRACK_RATE)));
}

/**
 * Asks the AI lip-sync worker for the teacher's face speaking this reel's voice, and opens the result as a video the
 * MP4 export can step through frame by frame. Throws (with the reason) when the worker is not running or fails;
 * the caller then uses the built-in photo lip-sync.
 */
export async function aiLipsyncVideo(reel: MotionReel, clips: VoiceClips, auth: TeacherAuth | null, signal?: AbortSignal): Promise<{ video: HTMLVideoElement; url: string; syncConfidence: number | null }> {
  const r = await fetch('/api/ai-guru/teacher-avatar/lipsync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ audio: voiceTrackWav(reel, clips), ...(auth ?? {}) }), signal });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok || !j.video) throw new Error(j?.error || `AI lip-sync HTTP ${r.status}`);
  const bin = atob(String(j.video));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }));
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error('The AI lip-sync video could not be opened in this browser.'));
    video.src = url;
    video.load();
  });
  return { video, url, syncConfidence: typeof j.syncConfidence === 'number' ? j.syncConfidence : null };
}

/** LatentSync's own data rule: a sync confidence under 3 means the lips do not follow the voice well enough. */
export const SYNC_CONFIDENCE_MIN = 3;
