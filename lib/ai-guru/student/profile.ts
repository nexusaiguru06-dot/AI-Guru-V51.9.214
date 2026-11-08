/**
 * V51.9.66 — the student's profile (name, standard, school, place), kept in this browser and written
 * on the lower part of every vertical MP4 the student makes. Nothing leaves the browser.
 */

export interface StudentProfile {
  name: string;
  standard: string;
  school: string;
  place: string;
  /**
   * V51.9.125: a WhatsApp number for the reels' footer. It is written on a reel only when `whatsappOnReels` is on,
   * which the form allows only after "my parent or guardian agrees" is ticked (reels are shared in public).
   */
  whatsapp?: string;
  whatsappOnReels?: boolean;
}

export const PROFILE_KEY = 'aiguru_student_profile_v1';
/** V51.9.125: fired on window when the details are saved (the Reel Studio redraws its footer). */
export const PROFILE_EVENT = 'aiguru-profile-changed';
/** The quiz and the attendance register already keep the student's name under this key. */
const NAME_KEY_FALLBACK = 'ai-guru:student-name';

const clip = (v: unknown, n: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');

export function cleanProfile(p: unknown): StudentProfile {
  const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
  const wa = cleanWhatsapp(o.whatsapp);
  return { name: clip(o.name, 40), standard: clip(o.standard, 12), school: clip(o.school, 60), place: clip(o.place, 40), whatsapp: wa, whatsappOnReels: !!wa && o.whatsappOnReels === true };
}

/** Digits, spaces and one leading +, 7 to 15 digits; anything else gives ''. */
export function cleanWhatsapp(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.replace(/[-.()]/g, ' ').replace(/[^\d+ ]/g, '').replace(/\s+/g, ' ').trim();
  const plus = s.startsWith('+');
  const digits = s.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return '';
  return (plus ? '+' : '') + s.replace(/\+/g, '').trim();
}

/** The WhatsApp line of the footer, or '' when there is no number or it is not to be shown. */
export function profileWhatsapp(p?: StudentProfile | null): string {
  return p?.whatsappOnReels && p.whatsapp ? p.whatsapp : '';
}

export const profileIsEmpty = (p?: StudentProfile | null): boolean => !p || !(p.name || p.standard || p.school || p.place);

export function loadProfile(): StudentProfile {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PROFILE_KEY) : null;
    const p = cleanProfile(raw ? JSON.parse(raw) : {});
    if (!p.name) p.name = clip(typeof localStorage !== 'undefined' ? localStorage.getItem(NAME_KEY_FALLBACK) : '', 40);
    return p;
  } catch {
    return cleanProfile({});
  }
}

export function saveProfile(p: StudentProfile): StudentProfile {
  const c = cleanProfile(p);
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(c));
    if (c.name) localStorage.setItem(NAME_KEY_FALLBACK, c.name);
  } catch { /* storage may be blocked; the profile then lasts only for this page */ }
  try { if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROFILE_EVENT)); } catch { /* not in a browser */ }
  return c;
}

/** "Name · Std 8" and "School, Place" for the footer; empty lines are left out. */
export function profileLines(p?: StudentProfile | null): string[] {
  if (!p) return [];
  const std = p.standard ? (/^\d+$/.test(p.standard) ? `Std ${p.standard}` : p.standard) : '';
  const l1 = [p.name, std].filter(Boolean).join(' · ');
  const l2 = [p.school, p.place].filter(Boolean).join(', ');
  return [l1, l2].filter(Boolean);
}
