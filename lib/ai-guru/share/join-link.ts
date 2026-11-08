'use client';
/**
 * V51.9.150 — the student's join link for videos and captions.
 *
 * An MP4 cannot hold a clickable link, so every reel carries the link three ways: written on every frame, as a QR code
 * with the join code at the end (scan from another screen, or type the code at /j), and in the caption (tappable on
 * WhatsApp). The link must be the app's PUBLIC address: a link made while the app runs on localhost opens nothing on
 * anyone else's phone, so the public address (NEXT_PUBLIC_SITE_URL) is used whenever it is set, and the student is
 * warned when only a local address is known.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';

const configured = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');
export const isLocalOrigin = (o: string) => !o || /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(o);

/** The address other people can open: the configured public site, else this page's own address. */
export function shareOrigin(pageOrigin: string): string {
  return configured && !isLocalOrigin(configured) ? configured : pageOrigin;
}

export interface JoinLink { link: string; short: string; code: string; local: boolean }

/** The signed-in student's join link (/j/CODE when they have a referral code, else the sign-up page). */
export function useJoinLink(): JoinLink {
  const page = useSyncExternalStore(() => () => {}, () => window.location.origin, () => '');
  const [code, setCode] = useState('');
  useEffect(() => {
    let live = true;
    fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live && j?.affiliate?.enabled && j.affiliate.code) setCode(String(j.affiliate.code)); })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);
  const origin = shareOrigin(page);
  const link = `${origin}${code ? `/j/${code}` : '/ai-guru/student/signup'}`;
  return { link, short: link.replace(/^https?:\/\//, ''), code, local: isLocalOrigin(origin) };
}
