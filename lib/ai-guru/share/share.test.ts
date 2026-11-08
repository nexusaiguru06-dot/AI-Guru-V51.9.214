// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cleanRecord, itemKey, rollup, type SessionRecord } from '../quiz/records';
import { badgesOf, certificateHtml, istDay, streakOf } from './badges';
import { weeklyStats, weeklyText } from './weekly';
import { scoreCardSvg, scoreShareText } from './scorecard';
import { redeemable, validRedeem } from './redeem';

const opts = [{ id: 'A', text: '1' }, { id: 'B', text: '2' }, { id: 'C', text: '3' }, { id: 'D', text: '4' }];
const qn = (correct: boolean, withOptions = true, concept = 'tables') => ({ id: 'q', kind: 'standard', stem: 'What is 3 x 5?', concept, chosen: 'A', answer: 'B', correct, toffees: correct ? 1 : 0, seconds: 3, ...(withOptions ? { options: opts, why: 'because' } : {}) });
const rec = (id: string, at: string, items: ReturnType<typeof qn>[], extra: object = {}, stu = 'student:abc-123456') => cleanRecord({ id, studentId: stu, studentName: 'Anjali', at, items, toffees: items.reduce((s, i) => s + i.toffees, 0), section: 'Tables', ...extra })!;
const T = (d: string, h = 6) => `${d}T${String(h).padStart(2, '0')}:00:00Z`;

describe('streaks and badges', () => {
  it('counts days in a row in Indian time, alive until the day after the last quiz', () => {
    const rs = [rec('a', T('2026-10-14'), [qn(true)]), rec('b', T('2026-10-15'), [qn(true)]), rec('c', T('2026-10-16'), [qn(true)]), rec('d', T('2026-10-12'), [qn(true)])];
    expect(streakOf(rs, '2026-10-16')).toEqual({ current: 3, best: 3, days: 4 });
    expect(streakOf(rs, '2026-10-17').current).toBe(3); // yesterday still counts
    expect(streakOf(rs, '2026-10-18').current).toBe(0); // missed a day
    expect(istDay('2026-10-14T19:00:00Z')).toBe('2026-10-15'); // after 00:30 IST it is the next day
  });
  it('badges: lit at their goal, with progress before', () => {
    const rs = [rec('a', T('2026-10-14'), [qn(true), qn(true), qn(true)]), rec('b', T('2026-10-15'), [qn(true), qn(false)])];
    const { badges, stats } = badgesOf(rs, '2026-10-15');
    expect(stats).toMatchObject({ quizzes: 2, perfect: 1, bestStreak: 2 });
    const by = Object.fromEntries(badges.map((b) => [b.id, b]));
    expect([by.first.earned, by.perfect.earned, by.quiz5.earned, by.streak3.earned]).toEqual([true, true, false, false]);
    expect(by.quiz5).toMatchObject({ value: 2, goal: 5 });
  });
  it('certificate escapes the name', () => { expect(certificateHtml({ name: '<img onerror=x>', title: 't', line: 'l', date: 'd' })).not.toContain('<img onerror'); });
});

describe('weekly report', () => {
  const rs = [rec('a', T('2026-10-16'), [qn(true), qn(false, true, 'fractions'), qn(false, true, 'fractions')]), rec('b', T('2026-10-17'), [qn(true), qn(true)]), rec('old', T('2026-09-01'), [qn(false)])];
  it('adds up only the last 7 days', () => {
    const w = weeklyStats(rs, '2026-10-18');
    expect(w).toMatchObject({ quizzes: 2, chillies: 2, toffees: 3, weak: ['fractions'] });
    expect(w.avgPct).toBe(Math.round((33 + 100) / 2));
  });
  it('writes English and Malayalam, and a nudge when there was no quiz', () => {
    const w = weeklyStats(rs, '2026-10-18');
    expect(weeklyText('Anjali', w, 'https://x/y', 'en')).toMatch(/Anjali's week[\s\S]*Quizzes: 2[\s\S]*fractions[\s\S]*https:\/\/x\/y/);
    expect(weeklyText('Anjali', w, 'https://x/y', 'ml')).toMatch(/ക്വിസുകൾ: 2/);
    expect(weeklyText('Anjali', weeklyStats([], '2026-10-18'), 'l', 'en')).toMatch(/not taken a quiz/);
  });
});

describe('score card', () => {
  const d = { name: 'Anjali <b>', correct: 4, total: 5, pct: 80, toffees: 6, chillies: 1, streak: 3, link: 'https://aiguru.in/ai-guru/student/signup?ref=ANJA7K2Q', lang: 'en' as const };
  it('is a valid picture with the numbers, the link, and no raw markup from the name', () => {
    const s = scoreCardSvg(d);
    expect(s).toMatch(/^<svg[\s\S]*<\/svg>$/);
    expect(s).toContain('80%'); expect(s).toContain('4/5'); expect(s).toContain('ref=ANJA7K2Q'); expect(s).toContain('3-day streak');
    expect(s).not.toContain('<b>');
    expect(scoreCardSvg({ ...d, lang: 'ml' })).toContain('ടോഫി');
  });
  it('the share text carries the link', () => { expect(scoreShareText(d)).toContain(d.link); });
});

describe('redo: a chilli becomes a toffee, once', () => {
  const a = rec('r1', T('2026-10-16'), [qn(true), qn(false), qn(false, false)]);
  it('only wrong questions that kept their choices can be redone', () => {
    const q = redeemable([a]);
    expect(q.map((x) => x.key)).toEqual([itemKey('r1', 1)]);
    expect(q[0].item.options).toHaveLength(4);
  });
  it('a redone question leaves the list, and the roll-up takes the chilli away', () => {
    const redo = rec('r2', T('2026-10-17'), [qn(true)], { kind: 'redo', redeem: [itemKey('r1', 1)] });
    expect(redeemable([a, redo])).toEqual([]);
    expect(rollup([a, redo])).toMatchObject({ sessions: 1, toffees: 2, chilliesEarned: 2, redeemed: 1, chillies: 1 });
  });
  it('the server only honours real, missed, own, unredeemed questions', () => {
    const k = itemKey('r1', 1);
    expect(validRedeem([a], 'student:abc-123456', [k, k, itemKey('r1', 0), 'nope#9'])).toEqual([k]);
    expect(validRedeem([a], 'student:other-999999', [k])).toEqual([]);
  });
  it('saving: toffee comes from the valid keys, not from what the browser says; a second redo earns nothing', async () => {
    process.chdir(mkdtempSync(path.join(tmpdir(), 'redo-')));
    const { addRecord, readAll } = await import('../quiz/server-store');
    await addRecord(a);
    const claim = (id: string) => ({ id, studentId: a.studentId, kind: 'redo', redeem: [itemKey('r1', 1), itemKey('r1', 0)], toffees: 99, items: [qn(true), qn(true)] });
    const first = await addRecord(claim('redo-1'));
    expect(first).toMatchObject({ toffees: 1, redeem: [itemKey('r1', 1)] });
    expect(await addRecord(claim('redo-2'))).toBeNull();
    expect(rollup(await readAll())).toMatchObject({ toffees: 2, chillies: 1 });
  });
});

describe('share clip with QR (V51.9.90)', () => {
  it('the QR scene draws the right modules and the clip ends with it', async () => {
    const { qrRuns, qrScene } = await import('./qr-scene');
    const { shareClip } = await import('./clip');
    const { makeReel } = await import('../reels/motion/reel');
    const link = 'https://aiguru.example/j/ANJAK7Q2';
    const { n, runs } = qrRuns(link);
    expect(n).toBeGreaterThanOrEqual(25);
    expect(runs.length).toBeGreaterThan(n); // many dark runs
    expect(runs.every((r) => r.c >= 0 && r.c + r.len <= n && r.len > 0)).toBe(true);
    // finder pattern: the top-left 7 modules of row 0 are all dark
    const first = runs.filter((r) => r.r === 0)[0];
    expect(first.c).toBe(0);
    expect(first.len).toBeGreaterThanOrEqual(7);
    const scene = qrScene({ link, lang: 'en' });
    expect(scene.durationMs).toBeGreaterThan(3000);
    const { newScene } = await import('../subjects/kit');
    const m = newScene('Base', 400);
    m.step('hello', 300, 1500);
    m.hold(2000);
    const reel = makeReel('T', [m.build()]);
    const clip = shareClip(reel, { link, lang: 'en' });
    expect(clip.parts[clip.parts.length - 1].group).toBe('qr-card');
    expect(clip.parts[clip.parts.length - 2].group).toBe('end-card');
    expect(shareClip(reel, { link, lang: 'en', qr: false }).parts.some((p) => p.group === 'qr-card')).toBe(false);
  });
});
