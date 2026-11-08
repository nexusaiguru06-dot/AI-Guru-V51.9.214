/**
 * V51.9.107 (server only) — working without signing in.
 *
 * A guest can upload a textbook PDF in the Material Studio and save the study materials they make. Their books and
 * materials are PRIVATE: kept on the AI Guru PC under a random guest id held in a cookie on that browser, never shown
 * in the shared library, and opened only by that browser (and the admin). A guest never uses the AI Guru cloud key
 * or the server's own Gemini key: only keys of their own, or no AI (the chapters are then found without AI).
 * Signing in later keeps working as before; sign-in is needed only to share with the library or create on the cloud.
 */

import { randomBytes } from 'node:crypto';

export const GUEST_COOKIE = 'aiguru_guest';
const ID = /^g_[a-z0-9]{24}$/;

export const newGuestId = () => `g_${randomBytes(18).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(24, '0').slice(0, 24)}`;

export function guestIdFrom(req: Request): string | null {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${GUEST_COOKIE}=([^;]+)`));
  const v = m ? decodeURIComponent(m[1]) : '';
  return ID.test(v) ? v : null;
}

/** The Set-Cookie value for a guest id (a year; http-only; this site only). */
export const guestCookie = (id: string, secure: boolean) => `${GUEST_COOKIE}=${id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;

/** A guest's own name, as typed on this device (shown to the admin only). */
export const cleanGuestName = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 40) : '');
