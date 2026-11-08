/**
 * V51.9.197 — AI Guru as an app on the phone's home screen (a web app the phone installs: no Play Store needed).
 * The manifest names the app, its logo and where it opens. Opened from a friend's invite link, it opens with that friend's
 * code (?ref=CODE), so an iPhone — whose home-screen app keeps its own storage — still counts the invite.
 */
import { cleanCode, isCode } from '../share/join-code';
import { SITE_DESCRIPTION, SITE_NAME } from '../site';

export const APP_BG = '#06101c';

export function appManifest(ref?: string | null) {
  const code = cleanCode(ref ?? '');
  return {
    id: '/ai-guru',
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    lang: 'en-IN',
    start_url: isCode(code) ? `/?source=app&ref=${code}` : '/?source=app', // V51.9.198: opens on "Get started"
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: APP_BG,
    theme_color: APP_BG,
    categories: ['education'],
    icons: [
      { src: '/app-icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app-icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/app-icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

/** Which way this phone / browser installs the app. Pure: from the user agent (and whether it already runs as the app). */
export type InstallWay = 'installed' | 'prompt' | 'ios-safari' | 'ios-other' | 'android-inapp' | 'android' | 'desktop';
export function installWay(ua: string, standalone: boolean, hasPrompt: boolean): InstallWay {
  if (standalone) return 'installed';
  if (hasPrompt) return 'prompt';
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua));
  if (ios) return /CriOS|FxiOS|EdgiOS|FBAN|FBAV|Instagram|WhatsApp|Line\//i.test(ua) || !/Safari/i.test(ua) ? 'ios-other' : 'ios-safari';
  if (/Android/i.test(ua)) return /; wv\)|FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|GSA\//i.test(ua) ? 'android-inapp' : 'android';
  return 'desktop';
}

/** An Android link that opens this page in Chrome (from WhatsApp's or Instagram's own browser, which cannot install apps). */
export const chromeIntent = (href: string) => {
  const u = new URL(href);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
};
