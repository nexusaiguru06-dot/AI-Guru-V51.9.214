import { describe, expect, it } from 'vitest';
import { LESSONS, lessonBySlug } from './lessons';
import { endCardScene, shareClip, clipCaption } from '../share/clip';
import { buildReel, makeReel } from '../reels/motion/reel';

const text = (slug: string, qi: number) => { const l = lessonBySlug(slug)!; return l.quiz[qi].options[l.quiz[qi].answer].en; };

describe('public sample lessons', () => {
  it('have unique slugs, 3 steps, 3 questions of 4 options each, a valid answer, and both languages everywhere', () => {
    expect(new Set(LESSONS.map((l) => l.slug)).size).toBe(LESSONS.length);
    for (const l of LESSONS) {
      expect(l.steps).toHaveLength(3); expect(l.quiz).toHaveLength(3);
      for (const q of l.quiz) {
        expect(q.options).toHaveLength(4);
        expect(q.answer).toBeGreaterThanOrEqual(0); expect(q.answer).toBeLessThan(4);
        expect(new Set(q.options.map((o) => o.en)).size).toBe(4); // no repeated option
        expect(q.why.en && q.why.ml).toBeTruthy();
      }
      for (const s of [l.title, l.summary, ...l.steps.flatMap((x) => [x.h, x.p])]) { expect(s.en.length).toBeGreaterThan(3); expect(s.ml).toMatch(/[ഀ-ൿ]/); }
    }
  });
  it('the answer keys are right (worked out here, not copied)', () => {
    expect(text('add-fractions-same-denominator', 0)).toBe(`${1 + 2}/5`);
    expect(text('add-fractions-same-denominator', 1)).toBe(`${3 + 4}/9`);
    expect(text('add-fractions-same-denominator', 2)).toBe('1'); // 5/12 + 7/12 = 12/12
    const hcf = (a: number, b: number): number => (b ? hcf(b, a % b) : a);
    expect([hcf(8, 12), hcf(15, 25), hcf(7, 9)].map(String)).toEqual([0, 1, 2].map((i) => text('hcf-by-listing-factors', i)));
    expect([9 * 4, 2 * (6 + 4), 6 * 6].map(String)).toEqual([0, 1, 2].map((i) => text('area-and-perimeter-of-a-rectangle', i)));
    expect([150 * 20 / 100, 200 * 5 / 100, 40 * 75 / 100].map(String)).toEqual([0, 1, 2].map((i) => text('percentage-of-a-number', i)));
    expect(text('photosynthesis-how-plants-make-food', 0)).toBe('Carbon dioxide');
    expect(text('photosynthesis-how-plants-make-food', 2)).toBe('Oxygen');
    expect(text('solid-liquid-gas', 1)).toBe('Evaporation');
    expect(text('solid-liquid-gas', 2)).toBe('Condensation');
  });
  it('worked numbers in the steps are right', () => {
    const all = JSON.stringify(LESSONS);
    for (const s of ['2/7 + 3/7 = 5/7', '3/8 + 5/8 = 8/8 = 1', '8 × 5 = 40', '2 × 13 = 26', '7 × 7'.slice(0, 0), '80 × 25/100 = 20', '10% of 250 = 25']) expect(all).toContain(s);
  });
});

describe('share clip', () => {
  const reel = buildReel({ kind: 'arithmetic', text: '478 + 356', lang: 'en' });
  it('adds the end card with the link, then the QR card (V51.9.90) as the last part', () => {
    const c = shareClip(reel, { link: 'https://aiguru.in/ai-guru/student/signup?ref=ANJA7K2Q', lang: 'en' });
    expect(c.parts.at(-2)!.group).toBe('end-card');
    expect(c.parts.at(-1)!.group).toBe('qr-card');
    expect(c.parts.length).toBe(reel.parts.length + 2);
    const words = c.parts.at(-2)!.items.map((i) => JSON.stringify(i)).join(' ');
    expect(words).toContain('ref=ANJA7K2Q');
    expect(c.durationMs).toBe(c.parts.reduce((s, p) => s + p.durationMs, 0));
  });
  it('keeps the first part even when it is long, and drops whole parts that would pass the limit', () => {
    const a = reel.parts[0];
    const long = makeReel('x', [a, a, a, a, a, a, a, a, a, a]);
    const c = shareClip(long, { link: 'https://x/y', lang: 'en', maxMs: a.durationMs * 2.5 });
    expect(c.parts.length).toBe(4); // 2 lesson parts + end card + QR card
    expect(shareClip(long, { link: 'https://x/y', lang: 'en', maxMs: 10 }).parts.length).toBe(3); // first part always kept
  });
  it('Malayalam end card and caption', () => {
    expect(JSON.stringify(endCardScene({ link: 'https://x/y', lang: 'ml' }).items)).toMatch(/[ഀ-ൿ]/);
    expect(clipCaption('Fractions', 'https://x/y', 'ml')).toContain('https://x/y');
  });
});

describe('short invite link', () => {
  it('sends a valid code to sign-up with the code filled, and anything odd to plain sign-up', async () => {
    const { GET } = await import('@/app/j/[code]/route');
    const go = async (c: string) => (await GET(new Request('https://aiguru.example/j/x'), { params: Promise.resolve({ code: c }) })).headers.get('location');
    expect(await go('anjak7q2')).toBe('/ai-guru/student/signup?ref=ANJAK7Q2');
    expect(await go('a')).toBe('/ai-guru/student/signup');
    expect(await go('<script>')).toBe('/ai-guru/student/signup');
  });
});
