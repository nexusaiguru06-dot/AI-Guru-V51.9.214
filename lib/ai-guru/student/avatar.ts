/**
 * V51.9.100 — a student's own avatar: their photo in the corner of the reels they make, lips moving with the voice.
 *
 * Made and kept ON THE STUDENT'S PHONE ONLY, and paid for only by the student's own key (BYOK):
 *   - the face: the student's photo (V51.9.99, with the parent/guardian agreement and "show on my reels" both on)
 *     plus the mouth/eye marks; the lip-sync is drawn in the phone's browser (no server, no cost to anyone);
 *   - the voice: Gemini text-to-speech called from the phone with the student's own Gemini key (their bill, their
 *     choice: they tick it here). Nothing about the avatar is sent to the AI Guru server.
 * The AI Guru PC's teacher-voice and AI lip-sync workers are never used for students, so a student's reels can
 * never cause a surprise API or GPU cost for the company.
 *
 * Pure apart from the localStorage helpers (guarded), so tests can use it.
 */

import { cleanMarks, DEFAULT_MARKS, type FaceMarks } from '../teacher/avatar';
import { characterById, CHARACTER_MARKS } from '../avatar/characters';
import type { PhotoPrefs } from './photo';

/** Gemini's prebuilt voices offered to students (all work for English and Malayalam). */
export const BYOK_VOICES = [
  { id: 'Kore', label: 'Kore — warm, firm' },
  { id: 'Leda', label: 'Leda — young, bright' },
  { id: 'Aoede', label: 'Aoede — light, easy' },
  { id: 'Puck', label: 'Puck — lively' },
  { id: 'Charon', label: 'Charon — calm, deep' },
  { id: 'Fenrir', label: 'Fenrir — energetic' },
] as const;
export type ByokVoice = (typeof BYOK_VOICES)[number]['id'];

export interface StudentAvatar {
  /** V51.9.103: a ready-made AI Guru character instead of the student's photo (no photo, no guardian question). */
  character?: string;
  marks: FaceMarks;
  /** Gemini voice for the avatar (spoken with the student's own key). */
  voice: ByokVoice;
  at: string;
}

export const STUDENT_AVATAR_KEY = 'aiguru_student_avatar_v1';
export const STUDENT_AVATAR_EVENT = 'aiguru-student-avatar-changed';

export const cleanVoice = (v: unknown): ByokVoice => (BYOK_VOICES.some((x) => x.id === v) ? (v as ByokVoice) : 'Kore');

export function cleanStudentAvatar(raw: unknown): StudentAvatar | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const ch = characterById(typeof o.character === 'string' ? o.character : null);
  if (ch) return { character: ch.id, marks: CHARACTER_MARKS, voice: cleanVoice(o.voice ?? ch.gemini), at: String(o.at ?? '') };
  return { marks: cleanMarks(o.marks ?? DEFAULT_MARKS), voice: cleanVoice(o.voice), at: String(o.at ?? '') };
}

export type AvatarBlock = 'no-photo' | 'no-guardian' | 'no-key' | 'no-voice-ok' | null;

/**
 * Why a student cannot use their avatar yet (null = ready). The order is the order they fix things in:
 * a photo, the guardian's agreement + "show on reels", their own AI key, and agreeing to pay for the voice with it.
 */
export function studentAvatarBlock(s: { photo: (PhotoPrefs & { dataUrl?: string }) | null; hasOwnKey: boolean; voiceOptIn: boolean; character?: string | null }): AvatarBlock {
  // a character is nobody real: no photo and no guardian question (the voice still uses the student's own key)
  if (!s.character) {
    if (!s.photo?.dataUrl) return 'no-photo';
    if (!(s.photo.guardianOk && s.photo.onReels)) return 'no-guardian';
  }
  if (!s.hasOwnKey) return 'no-key';
  if (!s.voiceOptIn) return 'no-voice-ok';
  return null;
}

export const BLOCK_TEXT: Record<Exclude<AvatarBlock, null>, string> = {
  'no-photo': 'Add your photo first (My photo).',
  'no-guardian': 'Your parent or guardian must agree, and “show my photo on reels” must be on (My photo).',
  'no-key': 'Avatars use your own AI key, on your phone. Add your Gemini key in Settings → Your keys. AI Guru does not pay for avatars.',
  'no-voice-ok': 'Tick “use my own key for my avatar’s voice” (Google bills your key, not AI Guru).',
};

export function loadStudentAvatar(): StudentAvatar | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STUDENT_AVATAR_KEY) : null;
    return raw ? cleanStudentAvatar(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveStudentAvatar(a: StudentAvatar | null): boolean {
  try {
    if (!a) localStorage.removeItem(STUDENT_AVATAR_KEY);
    else localStorage.setItem(STUDENT_AVATAR_KEY, JSON.stringify(a));
    try { window.dispatchEvent(new Event(STUDENT_AVATAR_EVENT)); } catch { /* no window */ }
    return true;
  } catch {
    return false;
  }
}
