// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cleanTiers, tierProgress } from './groups';
import { leaderboard, schoolBoard, shortName } from '../share/leaderboard';

let admin = '';
const R: Record<string, any> = {};
const req = (body: unknown, cookie = '', ip = '1.1.1.1') => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie = '') => new Request('http://x/a', { headers: { cookie } });
const j = async (r: Response) => r.json();
beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'cls-')));
  process.env.ADMIN_USERNAME = 'boss'; process.env.ADMIN_PASSWORD = 'correct-horse-battery';
  R.login = await import('@/app/api/ai-guru/admin/login/route');
  R.classes = await import('@/app/api/ai-guru/admin/classes/route');
  R.coupons = await import('@/app/api/ai-guru/admin/coupons/route');
  R.signup = await import('@/app/api/ai-guru/student-portal/signup/route');
  R.coupon = await import('@/app/api/ai-guru/student-portal/coupon/route');
  R.me = await import('@/app/api/ai-guru/student-portal/me/route');
  R.mine = await import('@/app/api/ai-guru/student-portal/class/route');
  R.teacher = await import('@/app/api/ai-guru/teacher-classes/route');
  admin = (await R.login.POST(req({ username: 'boss', password: 'correct-horse-battery' }))).headers.get('set-cookie')!.split(';')[0];
});
const form = (name: string, extra = {}) => ({ name, standard: '6', school: 'GHSS Aluva', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1', ...extra });

describe('group rules', () => {
  it('tiers: earned vs given vs locked; cleaning', () => {
    const p = tierProgress(12, [{ at: 25, reward: 'b' }, { at: 10, reward: 'a' }], []);
    expect(p.tiers.map((t) => t.status)).toEqual(['earned', 'locked']);
    expect(p.next?.left).toBe(13);
    expect(tierProgress(12, [{ at: 10, reward: 'a' }], [10]).tiers[0].status).toBe('given');
    expect(typeof cleanTiers([{ at: 5, reward: 'x' }, { at: 5, reward: 'y' }])).toBe('string');
    expect(cleanTiers([{ at: 9, reward: 'x' }, { at: 2, reward: 'y' }])).toEqual([{ at: 2, reward: 'y' }, { at: 9, reward: 'x' }]);
  });
  it('leaderboard ranks effort, shows short names, school board needs 3', () => {
    expect(shortName('Anjali Menon')).toBe('Anjali M.');
    const now = new Date().toISOString();
    const rec = (id: string, pct: number) => ({ id: Math.random().toString(), studentId: id, code: '', studentName: '', at: now, grade: '', chapter: '', section: '', total: 5, correct: 0, pct, toffees: 0, items: [] }) as any;
    const rows = leaderboard([{ id: 'a', name: 'A One' }, { id: 'b', name: 'B Two' }], [rec('a', 40), rec('a', 40), rec('b', 100)], now.slice(0, 10));
    expect(rows[0].id).toBe('a'); // two quizzes beat one perfect one
    const sb = schoolBoard([{ id: 'a', name: 'A', school: 'S1' }, { id: 'b', name: 'B', school: 'S1' }, { id: 'c', name: 'C', school: 'S1' }, { id: 'd', name: 'D', school: 'S2' }], [rec('a', 50)], now.slice(0, 10));
    expect(sb.map((r) => r.school)).toEqual(['S1']);
  });
});

describe('classes end to end', () => {
  it('create → join → discount → tiers → teacher view → key check', async () => {
    const c = await j(await R.classes.POST(req({ action: 'create', kind: 'class', name: 'Class 6B', teacherName: 'Mrs Nair', school: 'GHSS Aluva' }, admin)));
    expect(c.teacherKey).toMatch(/^\d{6}$/);
    expect(c.group.teacherCode).toMatch(/^TE-1-\d{2}$/);
    // the same teacher's second class keeps the number; a different teacher gets the next one
    const c2 = await j(await R.classes.POST(req({ action: 'create', kind: 'class', name: 'Class 7A', teacherName: ' mrs nair ', school: 'ghss aluva' }, admin)));
    expect(c2.group.teacherCode).toBe(c.group.teacherCode);
    const c3 = await j(await R.classes.POST(req({ action: 'create', kind: 'class', name: 'Class 8A', teacherName: 'Mr Menon', school: 'GHSS Aluva' }, admin)));
    expect(c3.group.teacherCode).toMatch(/^TE-2-\d{2}$/);
    expect(JSON.stringify(c.group)).not.toMatch(/hash|salt/);
    const code = c.group.code as string;
    // class codes are hidden from the ordinary coupon list
    expect((await j(await R.coupons.GET(get(admin)))).coupons?.some((x: any) => x.code === code) ?? false).toBe(false);
    const chk = await j(await R.coupon.GET(new Request(`http://x/c?code=${code}`, { headers: { 'x-forwarded-for': '30.0.0.1' } })));
    expect(chk).toMatchObject({ valid: true, group: 'Class 6B' });
    let cookie = '';
    for (let i = 0; i < 3; i++) {
      const r = await R.signup.POST(req(form(`Pupil Number${'abc'[i]}`, { coupon: code }), '', `30.0.1.${i}`));
      expect(r.status).toBe(200);
      cookie ||= r.headers.get('set-cookie')!.split(';')[0];
    }
    const me = await j(await R.me.GET(get(cookie)));
    expect(me.student.coupon).toBe(code);
    const mine = await j(await R.mine.GET(get(cookie)));
    expect(mine.class).toMatchObject({ name: 'Class 6B', size: 3 });
    expect(mine.class.top[0].short).toMatch(/^Pupil N\.$/);
    expect(mine.school).toMatchObject({ name: 'GHSS Aluva', members: 3 });
    // admin numbers and tiers
    let list = await j(await R.classes.GET(get(admin)));
    expect(list.groups[0]).toMatchObject({ joined: 3 });
    expect((await R.classes.POST(req({ action: 'reward', id: c.group.id, at: 10 }, admin))).status).toBe(409);
    // teacher view
    const bad = await R.teacher.POST(req({ code, key: '000000' }, '', '31.0.0.1'));
    expect(bad.status).toBe(401);
    const t = await j(await R.teacher.POST(req({ code, key: c.teacherKey }, '', '31.0.0.2')));
    expect(t.ok).toBe(true);
    expect(t.members).toHaveLength(3);
    expect(JSON.stringify(t)).not.toMatch(/"hash"|"salt"/);
    // new key replaces the old
    const nk = await j(await R.classes.POST(req({ action: 'newkey', id: c.group.id }, admin)));
    expect((await R.teacher.POST(req({ code, key: c.teacherKey }, '', '31.0.0.3'))).status).toBe(401);
    expect((await R.teacher.POST(req({ code, key: nk.teacherKey }, '', '31.0.0.4'))).status).toBe(200);
    // switching the class off stops new joins
    await R.classes.POST(req({ action: 'toggle', id: c.group.id }, admin));
    const r = await R.signup.POST(req(form('Late Joiner', { coupon: code }), '', '30.0.2.1'));
    expect(r.status).toBe(400);
    // non-admins get nothing
    expect((await R.classes.GET(get(''))).status).toBe(404);
  });
});
