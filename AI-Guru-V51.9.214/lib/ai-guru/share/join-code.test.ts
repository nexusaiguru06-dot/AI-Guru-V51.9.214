/** V51.9.91: join code next to every QR, and rich link previews for /j/CODE. */
import { describe, expect, it } from 'vitest';
import { cleanCode, codeFromLink, codeLine, isCode, spacedCode, typePlace } from './join-code';
import { cardGroup, invitePreviewHtml, isPreviewBot, previewText } from './invite-preview';

const LINK = 'https://aiguru.example/j/ANJAK7Q2';
const WA = 'WhatsApp/2.24.10.85 A';
const PHONE = 'Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const INSTA = PHONE + ' Instagram 350.0.0.0 Android';

describe('join code', () => {
  it('cleans what people type or read out, and refuses anything odd', () => {
    expect(cleanCode(' anja k7q2 ')).toBe('ANJAK7Q2');
    expect(cleanCode('ANJA-K7Q2')).toBe('ANJAK7Q2');
    expect(cleanCode('anja.k7q2')).toBe('ANJAK7Q2');
    expect(isCode(cleanCode('<script>'))).toBe(false);
    expect(isCode(cleanCode('a'))).toBe(false);
    expect(isCode(cleanCode(undefined))).toBe(false);
  });
  it('reads the code from a short link only', () => {
    expect(codeFromLink(LINK)).toBe('ANJAK7Q2');
    expect(codeFromLink('https://x/j/anjak7q2?x=1')).toBe('ANJAK7Q2');
    expect(codeFromLink('https://x/ai-guru/student/signup?ref=ANJAK7Q2')).toBe('');
    expect(codeFromLink('https://x/j/ANJAK7Q2/card')).toBe('ANJAK7Q2');
    expect(codeFromLink('https://x/jj/ANJAK7Q2')).toBe('');
  });
  it('groups the code in fours and says where to type it', () => {
    expect(spacedCode('ANJAK7Q2')).toBe('ANJA K7Q2');
    expect(spacedCode('ABC')).toBe('ABC');
    expect(spacedCode('STM8B')).toBe('STM8B');
    expect(spacedCode('ABCDEFGHJKLM')).toBe('ABCD EFGH JKLM');
    expect(typePlace(LINK)).toBe('aiguru.example/j');
    expect(codeLine('ANJAK7Q2', LINK, 'en')).toBe('Code: ANJA K7Q2 — type it at aiguru.example/j');
    expect(codeLine('ANJAK7Q2', LINK, 'ml')).toMatch(/[ഀ-ൿ]/);
  });
});

describe('code next to the QR, in captions and on the score card', () => {
  it('QR card shows and says the code; a link without a code keeps the old card', async () => {
    const { qrScene } = await import('./qr-scene');
    const s = JSON.stringify(qrScene({ link: LINK, lang: 'en' }));
    expect(s).toContain('ANJA K7Q2');
    expect(s).toContain('aiguru.example/j');
    expect(s).toContain('or type the code ANJA K7Q2');
    const plain = JSON.stringify(qrScene({ link: 'https://aiguru.example/ai-guru/student/signup', lang: 'en' }));
    expect(plain).toContain('aiguru.example/ai-guru/student/signup');
    expect(plain).not.toContain('type this code');
  });
  it('caption carries the code (Instagram links cannot be tapped)', async () => {
    const { clipCaption } = await import('./clip');
    expect(clipCaption('Fractions', LINK, 'en')).toContain('Code: ANJA K7Q2');
    expect(clipCaption('Fractions', 'https://x/y', 'en')).not.toContain('Code:');
  });
  it('score card picture and share text carry the code', async () => {
    const { scoreCardSvg, scoreShareText } = await import('./scorecard');
    const d = { name: 'Anjali', correct: 8, total: 10, pct: 80, toffees: 3, chillies: 1, link: LINK, lang: 'en' as const };
    expect(scoreCardSvg(d)).toContain('Code ANJA K7Q2 · type it at aiguru.example/j');
    expect(scoreShareText(d)).toContain('Code: ANJA K7Q2');
    expect(scoreCardSvg({ ...d, link: 'https://x/ai-guru/student/signup' })).not.toContain('Code ');
  });
  it('poster says where to type the code', async () => {
    const { posterHtml } = await import('./poster');
    expect(posterHtml({ name: '8 B', code: 'STM8B', kind: 'class', discountPct: 0 }, 'https://aiguru.example/j/STM8B')).toContain('aiguru.example/j</b> and type the code');
  });
});

describe('rich link previews', () => {
  it('knows preview robots from people (in-app browsers are people)', () => {
    for (const ua of [WA, 'facebookexternalhit/1.1', 'TelegramBot (like TwitterBot)', 'Twitterbot/1.0', 'Mozilla/5.0 (compatible; Discordbot/2.0)']) expect(isPreviewBot(ua)).toBe(true);
    for (const ua of [PHONE, INSTA, '', null, undefined]) expect(isPreviewBot(ua)).toBe(false);
  });
  it('friend invite never names the student; class invite names the class; invalid is generic', () => {
    const f = previewText({ code: 'ANJAK7Q2', offer: '10% off fees' });
    expect(f.title).toContain('invited');
    expect(f.description).toContain('ANJA K7Q2');
    expect(f.description).toContain('10% off fees');
    const g = previewText({ code: 'STM8B', group: '8 B, St Mary’s' });
    expect(g.title).toBe('Join 8 B, St Mary’s on AI Guru');
    expect(previewText({ code: '' }).description).not.toContain('Code');
    expect(cardGroup('8 B St Marys')).toBe('8 B St Marys');
    expect(cardGroup('എട്ടാം ക്ലാസ്')).toBeUndefined();
  });
  it('preview page has escaped Open Graph tags and forwards people', () => {
    const h = invitePreviewHtml({ pageUrl: LINK, image: LINK + '/card', to: 'https://aiguru.example/ai-guru/student/signup?ref=ANJAK7Q2', text: previewText({ code: 'ANJAK7Q2', group: '<b>"x"' }) });
    expect(h).toContain('<meta property="og:image" content="https://aiguru.example/j/ANJAK7Q2/card">');
    expect(h).toContain('og:image:width" content="1200"');
    expect(h).toContain('http-equiv="refresh" content="0;url=https://aiguru.example/ai-guru/student/signup?ref=ANJAK7Q2"');
    expect(h).not.toContain('<b>"x"');
    expect(h).toContain('&#60;b&#62;&#34;x&#34;');
  });
  it('/j/CODE: people get the same 307 as before, robots get the preview page', async () => {
    const { GET } = await import('@/app/j/[code]/route');
    const call = (code: string, ua: string) => GET(new Request('https://aiguru.example/j/x', { headers: { 'user-agent': ua } }), { params: Promise.resolve({ code }) });
    const person = await call('anja-k7q2', PHONE);
    expect(person.status).toBe(307);
    expect(person.headers.get('location')).toBe('/ai-guru/student/signup?ref=ANJAK7Q2');
    expect((await call('ANJA%20K7Q2', INSTA)).headers.get('location')).toBe('/ai-guru/student/signup?ref=ANJAK7Q2');
    expect((await call('%E0%A4', PHONE)).headers.get('location')).toBe('/ai-guru/student/signup');
    const bot = await call('ANJAK7Q2', WA);
    expect(bot.status).toBe(200);
    expect(bot.headers.get('content-type')).toContain('text/html');
    const html = await bot.text();
    expect(html).toContain('og:title');
    expect(html).toContain('http-equiv="refresh"');
    // no such coupon in this test store: generic preview, never a name
    expect(html).toContain('og:image" content="https://aiguru.example/j/AIGURU/card"');
  });
});
