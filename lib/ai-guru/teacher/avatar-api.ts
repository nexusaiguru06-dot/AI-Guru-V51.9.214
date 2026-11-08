/**
 * V51.9.100 — server side of the teacher's avatar: who is asking, the avatar for a reel, saving, and the two
 * optional local workers (the teacher's voice with IndicF5, the AI lip-sync with LatentSync).
 *
 * Who may use an avatar:
 *   - the teacher (class code + 6-digit key, the same as "My class"): their own avatar, always;
 *   - a signed-in student: only their own class teacher's avatar, and only when that teacher ticked consent AND
 *     "my students may use it on their reels".
 */
import { NextResponse } from 'next/server';
import { studentFromRequest } from '../admin/auth';
import { readData } from '../admin/store';
import { openClass } from '../admin/teacher-auth';
import { photoBytes } from '../student/photo';
import {
  avatarIdFor,
  cleanMarks,
  cleanRefText,
  cleanStyle,
  CONSENT_VERSION,
  effectiveStyle,
  hasConsent,
  studentsMayUse,
  videoBytes,
  voiceBytes,
  type AvatarForReel,
  type AvatarMeta,
} from './avatar';
import * as store from './avatar-store';
import { characterById, CHARACTER_MARKS } from '../avatar/characters';

export type Asker = { role: 'teacher'; id: string; name: string } | { role: 'student'; id: string; name: string };

const fail = (status: number, error: string) => ({ error: NextResponse.json({ ok: false, error }, { status }) });

/** The teacher (code + key in the body), or a signed-in student whose teacher shares their avatar. */
export async function askerFor(req: Request, body: Record<string, unknown>): Promise<Asker | { error: Response }> {
  if (body.code !== undefined || body.key !== undefined) {
    const r = await openClass(req, body);
    if ('error' in r) return r;
    return { role: 'teacher', id: avatarIdFor(r.g), name: r.g.teacherName };
  }
  const sid = await studentFromRequest(req);
  if (!sid) return fail(401, 'Sign in first.');
  const data = await readData();
  const st = data.students.find((s) => s.id === sid);
  const g = st?.classId ? data.classes.find((c) => c.id === st.classId && c.active !== false) : undefined;
  if (!g) return fail(404, 'You have not joined a class with a teacher yet.');
  const meta = await store.readMeta(avatarIdFor(g));
  if (!studentsMayUse(meta)) return fail(404, 'Your teacher has not shared an avatar.');
  return { role: 'student', id: avatarIdFor(g), name: g.teacherName };
}

const dataUrl = (p: { bytes: Buffer; type: string }) => `data:${p.type};base64,${p.bytes.toString('base64')}`;

/**
 * Everything a reel needs, or null when there is no usable avatar.
 * For a student (`shared`): the face only, with the lip-sync drawn on the phone. The teacher's cloned voice and the
 * AI lip-sync run on the AI Guru PC, and students never use those (no surprise cost for the company).
 */
export async function avatarForReel(id: string, shared = false): Promise<AvatarForReel | null> {
  const meta = await store.readMeta(id);
  if (!meta || !hasConsent(meta)) return null;
  const photo = await store.readPhoto(id);
  if (!photo) return null;
  const style = effectiveStyle(meta.style, !!meta.video);
  const ch = characterById(meta.character);
  const extra = ch ? { character: ch.id, edge: ch.edge } : {};
  if (shared) return { id, name: meta.name, style: style === 'ai' ? 'lipsync' : style, marks: meta.marks, photo: dataUrl(photo), hasVoice: false, hasVideo: false, at: meta.at, shared: true, ...extra };
  return { id, name: meta.name, style, marks: meta.marks, photo: dataUrl(photo), hasVoice: !!meta.voice, hasVideo: !!meta.video, at: meta.at, ...extra };
}

/** The AI Guru PC's workers (teacher voice, AI lip-sync) are for the teacher only, never for a student. */
export const STUDENTS_NO_WORKERS = 'On students’ phones the avatar uses the free lip-sync, and the voice comes from the student’s own key. The AI Guru PC’s voice and AI lip-sync are for teachers only.';

/**
 * Saves the teacher's avatar. Body: { photo?, marks, style, consent: true, shareWithStudents,
 *   voice?: { wav, refText, lang }, removeVoice?, video?: { data, seconds }, removeVideo? }.
 * The consent tick is needed on every save (it is part of the form, not a one-time question).
 */
export async function saveAvatar(a: Extract<Asker, { role: 'teacher' }>, b: Record<string, unknown>): Promise<Response> {
  if (b.consent !== true) return NextResponse.json({ ok: false, error: 'Tick the box to confirm this is your own face and voice.' }, { status: 400 });
  // V51.9.103: a ready-made character (its picture is drawn by the app; any known id only)
  const character = b.character === undefined || b.character === null || b.character === '' ? null : characterById(String(b.character));
  if (b.character && !character) return NextResponse.json({ ok: false, error: 'Unknown character.' }, { status: 400 });
  if (character && b.photo === undefined && !(await store.readPhoto(a.id))) return NextResponse.json({ ok: false, error: 'Send the character picture.' }, { status: 400 });
  const old = await store.readMeta(a.id);
  let photo: { bytes: Uint8Array; kind: 'jpeg' | 'png' } | null = null;
  if (b.photo !== undefined) {
    const p = photoBytes(b.photo);
    if ('error' in p) return NextResponse.json({ ok: false, error: p.error }, { status: 400 });
    photo = p;
  } else if (!(await store.readPhoto(a.id))) {
    return NextResponse.json({ ok: false, error: 'Add your photo first.' }, { status: 400 });
  }
  let voice: { bytes: Uint8Array; seconds: number } | null = null;
  const vb = (b.voice ?? null) as Record<string, unknown> | null;
  if (vb) {
    const v = voiceBytes(vb.wav);
    if ('error' in v) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
    if (!cleanRefText(vb.refText)) return NextResponse.json({ ok: false, error: 'Type the exact words you said in the voice sample.' }, { status: 400 });
    voice = v;
  }
  let video: { bytes: Uint8Array; kind: 'mp4' | 'webm'; seconds: number } | null = null;
  const fb = (b.video ?? null) as Record<string, unknown> | null;
  if (fb) {
    const v = videoBytes(fb.data, fb.seconds);
    if ('error' in v) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
    video = v;
  }
  const now = new Date().toISOString();
  if (photo) await store.savePhoto(a.id, photo.bytes, photo.kind);
  if (voice) await store.saveVoice(a.id, voice.bytes);
  else if (b.removeVoice === true) await store.deleteVoice(a.id);
  if (video) await store.saveVideo(a.id, video.bytes, video.kind);
  else if (b.removeVideo === true) await store.deleteVideo(a.id);
  const meta: AvatarMeta = {
    id: a.id,
    name: String(b.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) || a.name,
    style: character ? (cleanStyle(b.style) === 'ai' ? 'lipsync' : cleanStyle(b.style)) : cleanStyle(b.style),
    marks: character ? CHARACTER_MARKS : cleanMarks(b.marks),
    ...(character ? { character: character.id } : {}),
    consent: { version: CONSENT_VERSION, at: now },
    shareWithStudents: b.shareWithStudents === true,
    voice: voice ? { refText: cleanRefText(vb!.refText), lang: vb!.lang === 'en' ? 'en' : 'ml', seconds: voice.seconds, at: now } : b.removeVoice === true ? undefined : old?.voice,
    video: video ? { seconds: video.seconds, at: now, type: video.kind } : b.removeVideo === true ? undefined : old?.video,
    at: photo || !old ? now : old.at,
  };
  if (meta.style === 'ai' && !meta.video && !character) return NextResponse.json({ ok: false, error: 'The AI lip-sync needs a short video of your face (5–10 seconds).' }, { status: 400 });
  await store.writeMeta(meta);
  return NextResponse.json({ ok: true, meta, avatar: await avatarForReel(a.id) });
}

/* ---------------- the local workers ---------------- */

export const VOICE_WORKER = () => process.env.AIGURU_TEACHER_VOICE_URL || 'http://127.0.0.1:8808';
export const LIPSYNC_WORKER = () => process.env.AIGURU_LIPSYNC_URL || 'http://127.0.0.1:8809';

/** POSTs JSON to a worker on this PC. Null when it is not running (the caller then uses the normal voice / lip-sync). */
export async function callWorker(base: string, route: string, body: unknown, timeoutMs: number): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; status: number; error: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${base.replace(/\/$/, '')}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok || json.ok === false) return { ok: false, status: 502, error: String(json.error || `worker HTTP ${r.status}`) };
    return { ok: true, json };
  } catch (e) {
    const timedOut = (e as Error)?.name === 'AbortError';
    return { ok: false, status: timedOut ? 504 : 503, error: timedOut ? 'The worker took too long.' : 'The worker is not running on this PC.' };
  } finally {
    clearTimeout(timer);
  }
}
