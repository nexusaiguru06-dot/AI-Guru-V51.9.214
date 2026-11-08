// @vitest-environment node
/** V51.9.197 — the app manifest and how each phone installs it. */
import { describe, expect, it } from 'vitest';
import { appManifest, chromeIntent, installWay } from './manifest';

const UA = {
  chrome: 'Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  whatsappAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-A146B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36',
  instagram: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 Instagram 300.0.0.0',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};

describe('app manifest', () => {
  it('names the app, its logo (incl. maskable) and opens standalone; a friend\'s code goes with it', () => {
    const m = appManifest('ANJAK7Q2');
    expect(m).toMatchObject({ name: 'AI Guru', short_name: 'AI Guru', display: 'standalone', scope: '/', start_url: '/?source=app&ref=ANJAK7Q2' });
    expect(m.icons.map((i) => `${i.sizes}:${i.purpose}`)).toEqual(['192x192:any', '512x512:any', '512x512:maskable']);
    expect(appManifest('<script>').start_url).toBe('/?source=app');
    expect(appManifest(null).start_url).toBe('/?source=app');
  });
  it('how each phone installs', () => {
    expect(installWay(UA.chrome, false, true)).toBe('prompt');
    expect(installWay(UA.chrome, true, true)).toBe('installed');
    expect(installWay(UA.chrome, false, false)).toBe('android');
    expect(installWay(UA.whatsappAndroid, false, false)).toBe('android-inapp');
    expect(installWay(UA.instagram, false, false)).toBe('android-inapp');
    expect(installWay(UA.iphoneSafari, false, false)).toBe('ios-safari');
    expect(installWay(UA.iphoneChrome, false, false)).toBe('ios-other');
    expect(installWay(UA.desktop, false, false)).toBe('desktop');
  });
  it('"Open in Chrome" link from WhatsApp keeps the page and the code', () => {
    expect(chromeIntent('https://aiguru.in/ai-guru/student/signup?ref=ANJAK7Q2')).toBe('intent://aiguru.in/ai-guru/student/signup?ref=ANJAK7Q2#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Faiguru.in%2Fai-guru%2Fstudent%2Fsignup%3Fref%3DANJAK7Q2;end');
  });
});
