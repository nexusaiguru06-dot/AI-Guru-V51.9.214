// @vitest-environment node
import { describe, it, expect, beforeAll, vi, afterAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { dailyFive, dailyStreak, istToday, reminderIcs } from './daily';
import { CONTESTS, activeContests, nextContest } from './contests';
import { revisePack } from './revise';
import { LESSONS } from './lessons';
import { winnersCardSvg } from '../share/scorecard';

describe('daily challenge', () => {
  it('five questions from five lessons, the same all day, different next day', () => {
    const a = dailyFive('2026-11-02'), b = dailyFive('2026-11-02'), c = dailyFive('2026-11-03');
    expect(a).toHaveLength(5);
    expect(new Set(a.map((x) => x.slug)).size).toBe(5);
    expect(a.map((x) => x.q.en)).toEqual(b.map((x) => x.q.en));
    expect(a.map((x) => x.q.en)).not.toEqual(c.map((x) => x.q.en));
    for (const q of a) expect(q.answer).toBeLessThan(q.options.length);
  });
  it('streak counts back from today, or from yesterday while today is still to do', () => {
    expect(dailyStreak(['2026-11-01', '2026-11-02', '2026-11-03'], '2026-11-03')).toBe(3);
    expect(dailyStreak(['2026-11-01', '2026-11-02'], '2026-11-03')).toBe(2);
    expect(dailyStreak(['2026-11-01'], '2026-11-03')).toBe(0);
    expect(dailyStreak([], '2026-11-03')).toBe(0);
  });
  it('IST day rolls over at 18:30 UTC; the reminder repeats daily', () => {
    expect(istToday(Date.parse('2026-11-02T18:29:00Z'))).toBe('2026-11-02');
    expect(istToday(Date.parse('2026-11-02T18:31:00Z'))).toBe('2026-11-03');
    const ics = reminderIcs('https://x/y', 17, '2026-11-02');
    expect(ics).toContain('RRULE:FREQ=DAILY'); expect(ics).toContain('DTSTART;TZID=Asia/Kolkata:20261102T170000');
  });
});

describe('festival contests', () => {
  it('every contest has 5 well-formed questions with a valid answer key', () => {
    for (const c of CONTESTS) {
      expect(c.questions).toHaveLength(5);
      for (const q of c.questions) { expect(q.options).toHaveLength(4); expect(new Set(q.options.map((o) => o.en)).size).toBe(4); expect(q.answer).toBeGreaterThanOrEqual(0); expect(q.answer).toBeLessThan(4); expect(q.why.ml.length).toBeGreaterThan(3); }
    }
  });
  it('windows: open inside, closed outside; next contest counted in days', () => {
    expect(activeContests('2026-11-14').map((c) => c.id)).toEqual(['childrens-day']);
    expect(activeContests('2026-10-18')).toEqual([]);
    expect(nextContest('2026-10-18')).toMatchObject({ contest: { id: 'childrens-day' }, inDays: 23 });
    expect(nextContest('2026-12-30')?.contest.id).toBe('republic-day');
  });
  it('winners card and revise packs', () => {
    expect(winnersCardSvg({ title: 'Onam <quiz>', emoji: '🌼', lang: 'en', link: 'https://a.b/c', winners: [{ short: 'A B.', correct: 5, total: 5, seconds: 40 }] })).toContain('Onam &#60;quiz&#62;');
    for (const l of LESSONS) { const r = revisePack(l); expect(r.points.length).toBeGreaterThan(0); expect(r.examples).toHaveLength(3); expect(r.minutes.reduce((t, m) => t + m.min, 0)).toBe(10); }
  });
});

const R: Record<string, any> = {};
const req = (body: unknown, cookie = '', ip = '1.1.1.1') => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (q = '', cookie = '') => new Request(`http://x/a${q}`, { headers: { cookie } });
describe('contest API and public stats', () => {
  beforeAll(async () => {
    process.chdir(mkdtempSync(path.join(tmpdir(), 'p4-')));
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-12T06:00:00Z'));
    R.contest = await import('@/app/api/ai-guru/contest/route');
    R.signup = await import('@/app/api/ai-guru/student-portal/signup/route');
    R.stats = await import('@/app/api/ai-guru/public-stats/route');
  });
  afterAll(() => vi.useRealTimers());
  const form = (name: string) => ({ name, standard: '6', school: 'GHSS Aluva', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1' });
  it('needs sign-in, validates, keeps the best result, ranks by right then speed', async () => {
    expect((await R.contest.POST(req({ contest: 'childrens-day', correct: 3, seconds: 30 }))).status).toBe(401);
    const cookie = async (n: string, ip: string) => (await R.signup.POST(req(form(n), '', ip))).headers.get('set-cookie')!.split(';')[0];
    const a = await cookie('Anjali Menon', '5.0.0.1'), b = await cookie('Arjun Nair', '5.0.0.2');
    expect((await R.contest.POST(req({ contest: 'onam', correct: 3, seconds: 30 }, a))).status).toBe(409); // closed now
    expect((await R.contest.POST(req({ contest: 'childrens-day', correct: 9, seconds: 30 }, a))).status).toBe(400);
    expect((await R.contest.POST(req({ contest: 'childrens-day', correct: 4, seconds: 50 }, a))).status).toBe(200);
    expect((await (await R.contest.POST(req({ contest: 'childrens-day', correct: 2, seconds: 10 }, a))).json()).result).toBe('kept');
    const r = await (await R.contest.POST(req({ contest: 'childrens-day', correct: 4, seconds: 40 }, b))).json();
    expect(r).toMatchObject({ result: 'new', rank: 1, entries: 2 });
    const top = await (await R.contest.GET(get('?contest=childrens-day&year=2026', a))).json();
    expect(top.top.map((t: any) => [t.short, t.rank, t.you])).toEqual([['Arjun N.', 1, false], ['Anjali M.', 2, true]]);
    expect(JSON.stringify(top)).not.toMatch(/Menon|Nair/);
  });
  it('public stats are counted from real data and carry no student names', async () => {
    const j = await (await R.stats.GET()).json();
    expect(j).toMatchObject({ ok: true, students: 2, quizzes: 0, schools: 1, classes: 0, testimonials: [] });
    expect(JSON.stringify(j)).not.toMatch(/Anjali|Arjun/);
  });
});
