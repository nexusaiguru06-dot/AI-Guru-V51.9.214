/**
 * V51.9.100 — the teacher's avatar: the teacher's own face (and voice) in a small corner bubble on reels.
 *
 * A teacher sets it up once in the Teacher Portal → My avatar:
 *   - a front-facing photo (square, 512 × 512), with the mouth and eyes marked so the lips can move;
 *   - optionally a short clip of their own voice + the exact words, for the teacher's voice (IndicF5 on the AI Guru PC);
 *   - optionally a 5–10 s video of their face, for the AI lip-sync (LatentSync on a GPU PC);
 *   - the face style: 'lipsync' (the photo's lips move with the voice, any computer), 'still' (photo + glowing ring),
 *     or 'ai' (AI lip-sync from the video; falls back to 'lipsync' when the GPU worker is not running);
 *   - a consent tick ("this is my own face and voice"), and whether the teacher's students may use it on their reels.
 * Only the teacher's own face and voice: never a film star's or anyone else's (personality rights).
 *
 * Pure (no DOM, no I/O): the server, the browser and the tests share it.
 */

export type AvatarStyle = 'lipsync' | 'still' | 'ai';
export const AVATAR_STYLES: readonly AvatarStyle[] = ['lipsync', 'still', 'ai'];

/** Bump when the consent wording changes, so teachers agree to the new text. */
export const CONSENT_VERSION = 1;
export const CONSENT_TEXT =
  'This is my own face and my own voice. I allow AI Guru to show my face and use my voice in the reels and videos made with my avatar, and I can remove it at any time.';
export const CONSENT_TEXT_ML = 'ഇത് എന്റെ സ്വന്തം മുഖവും ശബ്ദവുമാണ്. AI Guru റീലുകളിൽ ഇവ ഉപയോഗിക്കാൻ ഞാൻ അനുവദിക്കുന്നു.';
/** V51.9.103: the confirmation for a ready-made character (it is nobody real; the voice sample, if any, is still the teacher's own). */
export const CHARACTER_CONSENT_TEXT = 'I am using an AI Guru character (not a photo of any real person). Any voice sample I add is my own voice.';

/** A sentence for the teacher to read for the voice sample (any clear sentence works; the words must be typed exactly). */
export const VOICE_PROMPT = {
  ml: 'നമസ്കാരം കുട്ടികളേ, ഇന്ന് നമുക്ക് ഗണിതം ലളിതമായും രസകരമായും പഠിക്കാം. ഓരോ ഘട്ടവും ശ്രദ്ധിച്ച് കേൾക്കൂ.',
  en: 'Hello children, today we will learn mathematics in a simple and interesting way. Listen carefully to every step.',
} as const;

/** Where the mouth and eyes are on the square photo, as fractions (0–1) of its side. */
export interface FaceMarks {
  mouth: { x: number; y: number; w: number };
  /** Left and right eye centres (for blinking); optional. */
  eyes?: [{ x: number; y: number }, { x: number; y: number }];
}

/** Where faces usually are on a square cut a little above the middle (what the editor starts with). */
export const DEFAULT_MARKS: FaceMarks = { mouth: { x: 0.5, y: 0.71, w: 0.2 }, eyes: [{ x: 0.38, y: 0.45 }, { x: 0.62, y: 0.45 }] };

export interface AvatarVoiceMeta {
  /** The exact words spoken in the sample. */
  refText: string;
  lang: 'ml' | 'en';
  seconds: number;
  at: string;
}

/** What the server keeps about a teacher's avatar (the picture, voice and video are separate files). */
export interface AvatarMeta {
  /** TE-34-26 (the teacher's number), or class-<id> for an older class without one. */
  id: string;
  name: string;
  style: AvatarStyle;
  marks: FaceMarks;
  consent: { version: number; at: string };
  /** The teacher's students may put this face (and voice) on the reels they make. */
  shareWithStudents: boolean;
  voice?: AvatarVoiceMeta;
  video?: { seconds: number; at: string; type: 'mp4' | 'webm' };
  /** V51.9.103: a ready-made AI Guru character (no real person's photo) instead of the teacher's own face. */
  character?: string;
  at: string;
}

/** What a reel needs to draw the bubble (sent to the teacher's own browser and to their students when shared). */
export interface AvatarForReel {
  id: string;
  name: string;
  style: AvatarStyle;
  marks: FaceMarks;
  /** data:image/jpeg;base64,… */
  photo: string;
  hasVoice: boolean;
  hasVideo: boolean;
  /** For a student: whose avatar this is ("your teacher"). */
  shared?: boolean;
  /** V51.9.103: a ready-made character, and its free classroom voices for the reel. */
  character?: string;
  edge?: { en: string; ml: string };
  at: string;
}

export const MAX_VOICE_BYTES = 2_000_000;
export const MAX_VIDEO_BYTES = 15_000_000;
export const VOICE_SECONDS = { min: 3, max: 25 } as const;
export const VIDEO_SECONDS = { min: 2, max: 15 } as const;

const clamp = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};

/** Marks from the editor, kept inside the picture and in sensible ranges. */
export function cleanMarks(raw: unknown): FaceMarks {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const m = (o.mouth ?? {}) as Record<string, unknown>;
  const mouth = { x: clamp(m.x, 0.1, 0.9, DEFAULT_MARKS.mouth.x), y: clamp(m.y, 0.2, 0.95, DEFAULT_MARKS.mouth.y), w: clamp(m.w, 0.06, 0.45, DEFAULT_MARKS.mouth.w) };
  const e = Array.isArray(o.eyes) && o.eyes.length === 2 ? o.eyes : null;
  if (!e) return { mouth };
  const eye = (p: any, d: { x: number; y: number }) => ({ x: clamp(p?.x, 0.05, 0.95, d.x), y: clamp(p?.y, 0.05, 0.9, d.y) });
  const eyes: FaceMarks['eyes'] = [eye(e[0], DEFAULT_MARKS.eyes![0]), eye(e[1], DEFAULT_MARKS.eyes![1])];
  // eyes must sit above the mouth; otherwise blinking would draw lids on the cheeks
  return eyes[0].y < mouth.y - 0.05 && eyes[1].y < mouth.y - 0.05 ? { mouth, eyes } : { mouth };
}

export const cleanStyle = (s: unknown): AvatarStyle => (AVATAR_STYLES.includes(s as AvatarStyle) ? (s as AvatarStyle) : 'lipsync');

export const cleanRefText = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);

/** The avatar may be drawn only with a consent tick for the current wording. */
export const hasConsent = (m?: Pick<AvatarMeta, 'consent'> | null) => !!m && m.consent?.version === CONSENT_VERSION && !!m.consent.at;

/** A student may use their teacher's avatar only when the teacher agreed and switched sharing on. */
export const studentsMayUse = (m?: AvatarMeta | null) => !!m && hasConsent(m) && m.shareWithStudents === true;

/** The style actually drawn: 'ai' needs the face video (and, at render time, the GPU worker). */
export const effectiveStyle = (style: AvatarStyle, hasVideo: boolean): AvatarStyle => (style === 'ai' && !hasVideo ? 'lipsync' : style);

/* ---------------- the files ---------------- */

function b64Bytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '');
  const bin = typeof atob === 'function' ? atob(clean) : Buffer.from(clean, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));

/** Length in seconds of a PCM WAV (RIFF/WAVE with fmt + data chunks), or null when it is not one. */
export function wavSeconds(b: Uint8Array): number | null {
  if (b.length < 44 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WAVE') return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 12;
  let byteRate = 0;
  while (p + 8 <= b.length) {
    const id = ascii(b, p, 4);
    const size = v.getUint32(p + 4, true);
    if (id === 'fmt ' && p + 16 <= b.length) byteRate = v.getUint32(p + 16, true);
    if (id === 'data') return byteRate > 0 ? Math.min(size, b.length - p - 8) / byteRate : null;
    p += 8 + size + (size & 1);
  }
  return null;
}

/** 'mp4' | 'webm' from the first bytes, or null. */
export function videoKind(b: Uint8Array): 'mp4' | 'webm' | null {
  if (b.length > 12 && ascii(b, 4, 4) === 'ftyp') return 'mp4';
  if (b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm';
  return null;
}

/** The voice sample (base64 WAV) → bytes, or why it cannot be used. */
export function voiceBytes(b64: unknown): { bytes: Uint8Array; seconds: number } | { error: string } {
  const s = String(b64 ?? '').replace(/^data:audio\/[a-z0-9.+-]+;base64,/i, '');
  if (!s || !/^[A-Za-z0-9+/=\s]+$/.test(s)) return { error: 'Send the voice sample as a WAV recording.' };
  if (s.length * 0.75 > MAX_VOICE_BYTES + 4) return { error: 'The voice sample is too long (keep it under 25 seconds).' };
  const bytes = b64Bytes(s);
  const seconds = wavSeconds(bytes);
  if (seconds === null) return { error: 'That file is not a WAV recording.' };
  if (seconds < VOICE_SECONDS.min) return { error: `Record at least ${VOICE_SECONDS.min} seconds of your voice.` };
  if (seconds > VOICE_SECONDS.max) return { error: `Keep the voice sample under ${VOICE_SECONDS.max} seconds.` };
  return { bytes, seconds: Math.round(seconds * 10) / 10 };
}

/** The face video (base64 MP4 / WebM) → bytes, or why it cannot be used. The length is measured in the browser. */
export function videoBytes(b64: unknown, seconds: unknown): { bytes: Uint8Array; kind: 'mp4' | 'webm'; seconds: number } | { error: string } {
  const s = String(b64 ?? '').replace(/^data:video\/[a-z0-9.+-]+;base64,/i, '');
  if (!s || !/^[A-Za-z0-9+/=\s]+$/.test(s)) return { error: 'Send the face video as an MP4 or WebM.' };
  if (s.length * 0.75 > MAX_VIDEO_BYTES + 4) return { error: 'The face video is too large (keep it under 15 MB, about 10 seconds).' };
  const bytes = b64Bytes(s);
  const kind = videoKind(bytes);
  if (!kind) return { error: 'That file is not an MP4 or WebM video.' };
  const sec = Number(seconds);
  if (!(sec >= VIDEO_SECONDS.min && sec <= VIDEO_SECONDS.max)) return { error: `The face video should be ${VIDEO_SECONDS.min}–${VIDEO_SECONDS.max} seconds long.` };
  return { bytes, kind, seconds: Math.round(sec * 10) / 10 };
}

/** Avatar ids become folder names: only safe characters. */
export const safeAvatarId = (id: string) => /^[A-Za-z0-9_-]{1,80}$/.test(id);

/** The avatar id of a class's teacher. */
export const avatarIdFor = (g: { id: string; teacherCode?: string }) => g.teacherCode || `class-${g.id}`;

/* ---------------- the teacher's browser copy (the reel maker reads it with no network) ---------------- */

export const AVATAR_KEY = 'aiguru_teacher_avatar_v1';
export const AVATAR_EVENT = 'aiguru-avatar-changed';

export function loadLocalAvatar(): AvatarForReel | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(AVATAR_KEY) : null;
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<AvatarForReel>;
    if (typeof o.photo !== 'string' || !o.photo.startsWith('data:image/') || typeof o.id !== 'string') return null;
    const edge = o.edge && typeof o.edge.en === 'string' && typeof o.edge.ml === 'string' ? { en: o.edge.en, ml: o.edge.ml } : undefined;
    return { id: o.id, name: String(o.name ?? ''), style: cleanStyle(o.style), marks: cleanMarks(o.marks), photo: o.photo, hasVoice: !!o.hasVoice, hasVideo: !!o.hasVideo, at: String(o.at ?? ''), ...(o.character ? { character: String(o.character) } : {}), ...(edge ? { edge } : {}) };
  } catch {
    return null;
  }
}

export function saveLocalAvatar(a: AvatarForReel | null): boolean {
  try {
    if (!a) localStorage.removeItem(AVATAR_KEY);
    else localStorage.setItem(AVATAR_KEY, JSON.stringify({ ...a, shared: undefined }));
    try { window.dispatchEvent(new Event(AVATAR_EVENT)); } catch { /* no window */ }
    return true;
  } catch {
    return false;
  }
}
