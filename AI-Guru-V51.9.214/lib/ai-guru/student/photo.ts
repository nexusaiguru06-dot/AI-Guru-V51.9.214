/**
 * V51.9.99 — the student's photo.
 *
 * Kept in two places:
 *   - on the AI Guru server with the student's record (signed-in students): the admin portal shows
 *     it, and it follows the student to another phone;
 *   - in this browser (localStorage, ~25 KB), where the reel maker reads it — reels are made in
 *     the browser, so no network is needed while exporting.
 * It is drawn on the reels the student downloads and shares only when BOTH are ticked:
 * "show my photo on the reels I share" and "my parent or guardian agrees" (most students are
 * children, and a shared reel travels far).
 *
 * This file is pure (no DOM), so the server and the tests use it too.
 */

export const PHOTO_SIZE = 512;
/** Largest photo the server keeps (a 512 × 512 JPEG is usually 25–60 KB). */
export const MAX_PHOTO_BYTES = 400_000;
export const PHOTO_KEY = 'aiguru_student_photo_v1';
/** Fired on window when the photo or its switches change (the reel maker listens). */
export const PHOTO_EVENT = 'aiguru-photo-changed';

export interface PhotoPrefs {
  /** Show the photo on the reels this student downloads and shares. */
  onReels: boolean;
  /** A parent or guardian agreed to the photo being on shared reels. */
  guardianOk: boolean;
}

export interface LocalPhoto extends PhotoPrefs {
  /** data:image/jpeg;base64,… (square) */
  dataUrl: string;
  at: string;
}

/** What the server keeps on the student record (the picture itself is a separate file). */
export interface PhotoMeta extends PhotoPrefs {
  at: string;
  by: 'student' | 'admin';
}

export const cleanPrefs = (p: unknown): PhotoPrefs => {
  const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
  const guardianOk = o.guardianOk === true;
  return { guardianOk, onReels: o.onReels === true && guardianOk };
};

/** The photo goes on reels only with both switches on. */
export const showOnReels = (p?: PhotoPrefs | null) => !!p && p.onReels && p.guardianOk;

/** 'jpeg' | 'png' from the first bytes, or null for anything else (the server accepts only these). */
export function imageKind(bytes: Uint8Array): 'jpeg' | 'png' | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  return null;
}

/** data:image/…;base64,… → bytes, or a reason it is not acceptable. */
export function photoBytes(dataUrl: unknown): { bytes: Uint8Array; kind: 'jpeg' | 'png' } | { error: string } {
  const m = /^data:image\/(jpeg|jpg|png);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl ?? ''));
  if (!m) return { error: 'Send the photo as a JPEG or PNG.' };
  const b64 = m[2].replace(/\s+/g, '');
  if (b64.length * 0.75 > MAX_PHOTO_BYTES + 4) return { error: 'The photo is too large (keep it under 400 KB).' };
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const kind = imageKind(bytes);
  if (!kind) return { error: 'That file is not a JPEG or PNG photo.' };
  if (bytes.length > MAX_PHOTO_BYTES) return { error: 'The photo is too large (keep it under 400 KB).' };
  return { bytes, kind };
}

/**
 * The square to cut out of a w × h picture: `zoom` ≥ 1 (1 = the largest square that fits),
 * `cx`, `cy` (0–1) = where the centre of the square sits. Always stays inside the picture.
 */
export function cropSquare(w: number, h: number, zoom = 1, cx = 0.5, cy = 0.5): { sx: number; sy: number; size: number } {
  const size = Math.max(1, Math.min(w, h) / Math.max(1, Math.min(zoom, 8)));
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const sx = clamp(cx * w - size / 2, 0, w - size);
  const sy = clamp(cy * h - size / 2, 0, h - size);
  return { sx, sy, size };
}

/* ---------------- this browser's copy ---------------- */

export function loadLocalPhoto(): LocalPhoto | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PHOTO_KEY) : null;
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<LocalPhoto>;
    if (typeof o.dataUrl !== 'string' || !o.dataUrl.startsWith('data:image/')) return null;
    return { dataUrl: o.dataUrl, at: String(o.at ?? ''), ...cleanPrefs(o) };
  } catch {
    return null;
  }
}

function changed() {
  try { if (typeof window !== 'undefined') window.dispatchEvent(new Event(PHOTO_EVENT)); } catch { /* no window */ }
}

/** Saves (or with dataUrl null, removes) this browser's copy. Returns false if the browser refused to store it. */
export function saveLocalPhoto(p: { dataUrl: string | null } & Partial<PhotoPrefs>, at = new Date().toISOString()): boolean {
  try {
    if (!p.dataUrl) localStorage.removeItem(PHOTO_KEY);
    else localStorage.setItem(PHOTO_KEY, JSON.stringify({ dataUrl: p.dataUrl, at, ...cleanPrefs(p) }));
    changed();
    return true;
  } catch {
    return false;
  }
}

/** Changes only the two switches of the saved photo. */
export function setLocalPrefs(prefs: Partial<PhotoPrefs>): LocalPhoto | null {
  const cur = loadLocalPhoto();
  if (!cur) return null;
  const next = { ...cur, ...cleanPrefs({ ...cur, ...prefs }) };
  saveLocalPhoto(next, cur.at);
  return next;
}

/** The photo to draw on reels, or null (no photo, or a switch is off). */
export function reelPhotoUrl(): string | null {
  const p = loadLocalPhoto();
  return p && showOnReels(p) ? p.dataUrl : null;
}
