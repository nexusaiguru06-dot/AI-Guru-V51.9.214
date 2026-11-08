import { describe, expect, it } from 'vitest';
import { applyEvent, buildRegister, lastDates, localDate, registerCsv, STALE_MS, type AttendanceSession } from './register';
import { cleanRecord } from '../quiz/records';

const T0 = Date.parse('2026-10-17T04:00:00Z');
const ev = (type: 'start' | 'beat' | 'end', at: number, sid = 'v1', stu = 'student:abc-111111', name = 'Asha') => ({ ev: { type, sessionId: sid, studentId: stu, studentName: name }, at });
const run = (events: ReturnType<typeof ev>[]) => events.reduce<AttendanceSession[]>((l, e) => applyEvent(l, e.ev, e.at), []);

describe('applyEvent', () => {
  it('start, two beats, end: counts the time in between', () => {
    const l = run([ev('start', T0), ev('beat', T0 + 60_000), ev('beat', T0 + 120_000), ev('end', T0 + 150_000)]);
    expect(l).toHaveLength(1);
    expect(l[0].activeSeconds).toBe(150);
    expect(l[0].exitedAt).toBe(new Date(T0 + 150_000).toISOString());
  });
  it('a long silence adds at most two minutes (a closed laptop is not time in class)', () => {
    const l = run([ev('start', T0), ev('beat', T0 + 3 * 3600_000)]);
    expect(l[0].activeSeconds).toBe(120);
  });
  it('coming back after hiding the tab continues the visit without adding the hidden time', () => {
    const l = run([ev('start', T0), ev('end', T0 + 60_000), ev('beat', T0 + 100_000)]);
    expect(l[0].exitedAt).toBeUndefined();
    expect(l[0].activeSeconds).toBe(60);
  });
  it('ignores an end with no start and events with no ids; keeps a name once known', () => {
    expect(run([ev('end', T0)])).toHaveLength(0);
    expect(applyEvent([], { type: 'start', sessionId: '', studentId: 'x' }, T0)).toHaveLength(0);
    expect(run([ev('start', T0, 'v', 's', ''), ev('beat', T0 + 1000, 'v', 's', 'Ravi')])[0].studentName).toBe('Ravi');
  });
});

describe('buildRegister', () => {
  const day = localDate(new Date(T0).toISOString());
  const quiz = (at: string, pct: number, toffees: number, stu = 'student:abc-111111') => cleanRecord({ id: at + stu, studentId: stu, at, items: Array.from({ length: 4 }, (_, i) => ({ id: 'q', kind: 'twist', stem: 's', concept: 'c', chosen: 'A', answer: 'A', correct: i < (pct / 25), toffees: 0, seconds: 1 })), toffees })!;
  it('first entry, last exit, minutes, visits, quiz score and toffees for the day', () => {
    const s = [...run([ev('start', T0), ev('beat', T0 + 60_000), ev('end', T0 + 90_000)]), ...run([ev('start', T0 + 3600_000, 'v2'), ev('end', T0 + 3600_000 + 30_000, 'v2')])];
    const now = T0 + 3 * 3600_000;
    const rows = buildRegister(s, [quiz(new Date(T0 + 1000).toISOString(), 75, 4), quiz(new Date(T0 + 2000).toISOString(), 25, 1)], [day], now);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ visits: 2, toffees: 5, pct: 50, inClassNow: false });
    expect(rows[0].firstIn).toBe(new Date(T0).toISOString());
    expect(rows[0].lastOut).toBe(new Date(T0 + 3600_000 + 30_000).toISOString());
    expect(rows[0].seconds).toBe(90 + 30);
  });
  it('a visit with no end counts as left at its last beat once stale, and "in class" while fresh', () => {
    const s = run([ev('start', T0), ev('beat', T0 + 60_000)]);
    const fresh = buildRegister(s, [], [day], T0 + 60_000 + STALE_MS - 1)[0];
    expect(fresh.inClassNow).toBe(true);
    expect(fresh.lastOut).toBeNull();
    const stale = buildRegister(s, [], [day], T0 + 60_000 + STALE_MS + 1)[0];
    expect(stale.inClassNow).toBe(false);
    expect(stale.lastOut).toBe(new Date(T0 + 60_000).toISOString());
  });
  it('a student who only took a quiz still has a row; other days are left out; names come from nameOf', () => {
    const rows = buildRegister([], [quiz(new Date(T0).toISOString(), 100, 6, 'student:zzz-222222')], [day], T0, (id) => (id.endsWith('222222') ? 'Meera' : ''));
    expect(rows[0]).toMatchObject({ name: 'Meera', firstIn: '', visits: 0, toffees: 6, pct: 100 });
    expect(buildRegister(run([ev('start', T0)]), [], ['2000-01-01'], T0)).toHaveLength(0);
  });
  it('lastDates and csv', () => {
    expect(lastDates('2026-03-01', 3)).toEqual(['2026-03-01', '2026-02-28', '2026-02-27']);
    const csv = registerCsv(buildRegister(run([ev('start', T0), ev('end', T0 + 60_000)]), [], [day], T0 + 1e7));
    expect(csv.split('\r\n')).toHaveLength(2);
    expect(csv).toContain('"Asha"');
  });
});
