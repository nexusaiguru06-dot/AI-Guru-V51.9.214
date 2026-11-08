// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cleanItem, cleanQuestions, scoreAttempt, studentView, ensureSerials, assignSerial, type ClassItem } from './class-content';

describe('class content rules', () => {
  const q = (o: object = {}) => ({ q: '2+2?', options: ['3', '4'], answer: 1, ...o });
  it('checks notes and exams', () => {
    expect(cleanItem({ kind: 'note', title: '', body: 'x' })).toBe('Give it a title');
    expect(cleanItem({ kind: 'note', title: 'T', body: '' })).toBe('Write something in it');
    expect(cleanItem({ kind: 'note', title: 'T', body: 'hi' })).toMatchObject({ kind: 'note' });
    expect(cleanQuestions([q({ answer: 5 })])).toMatch(/right answer/);
    expect(cleanQuestions([q({ options: ['a'] })])).toMatch(/2 to 5/);
    expect(cleanQuestions([q({ options: ['a', 'A'] })])).toMatch(/same/);
    expect(typeof cleanQuestions([q()])).toBe('object');
  });
  it('scores and hides answers until handed in', () => {
    const it: ClassItem = { id: 'i', classId: 'c', kind: 'exam', title: 'T', body: '', questions: [q(), q({ answer: 0 })], shared: true, open: true, createdAt: '', updatedAt: '' };
    expect(scoreAttempt(it, [1, 1])).toEqual({ answers: [1, 1], score: 1, total: 2 });
    expect(scoreAttempt(it, 'junk')).toMatchObject({ score: 0 });
    expect(JSON.stringify(studentView(it))).not.toContain('"answer"');
    expect(JSON.stringify(studentView(it, { id: 'a', itemId: 'i', classId: 'c', studentId: 's', answers: [1, 1], score: 1, total: 2, at: '' }))).toContain('"answer"');
    expect(studentView({ ...it, shared: false })).toBeNull();
  });
  it('gives roll numbers in joining order and never reuses them', () => {
    const g: any = { id: 'c' }, a: any = { id: 'a', classId: 'c', createdAt: '2026-01-02' }, b: any = { id: 'b', classId: 'c', createdAt: '2026-01-01' };
    expect(ensureSerials([g], [a, b])).toBe(true);
    expect([b.classSerial, a.classSerial]).toEqual([1, 2]);
    const n: any = { id: 'n', classId: 'c', createdAt: 'x' };
    expect(assignSerial(g, n)).toBe(3);
    expect(ensureSerials([g], [a, b, n])).toBe(false);
  });
});

let admin = '';
const R: Record<string, any> = {};
const req = (body: unknown, cookie = '', ip = '1.1.1.1') => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie = '') => new Request('http://x/a', { headers: { cookie } });
const j = async (r: Response) => r.json();
const form = (name: string, extra = {}) => ({ name, standard: '6', school: 'GHSS Aluva', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1', ...extra });

describe('teachers and their own students', () => {
  beforeAll(async () => {
    process.chdir(mkdtempSync(path.join(tmpdir(), 'cc-')));
    process.env.ADMIN_USERNAME = 'boss'; process.env.ADMIN_PASSWORD = 'correct-horse-battery';
    R.login = await import('@/app/api/ai-guru/admin/login/route');
    R.classes = await import('@/app/api/ai-guru/admin/classes/route');
    R.signup = await import('@/app/api/ai-guru/student-portal/signup/route');
    R.teacher = await import('@/app/api/ai-guru/teacher-classes/route');
    R.content = await import('@/app/api/ai-guru/teacher-content/route');
    R.mine = await import('@/app/api/ai-guru/student-portal/class-content/route');
    R.cls = await import('@/app/api/ai-guru/student-portal/class/route');
    admin = (await R.login.POST(req({ username: 'boss', password: 'correct-horse-battery' }))).headers.get('set-cookie')!.split(';')[0];
  });
  it('roll numbers, roster, and content visible only to the teacher’s own students', async () => {
    const mk = async (name: string, teacher: string) => j(await R.classes.POST(req({ action: 'create', kind: 'class', name, teacherName: teacher, school: 'S' }, admin)));
    const A = await mk('Class A', 'Teacher A'), B = await mk('Class B', 'Teacher B');
    const join = async (n: string, cls: any, ip: string) => { const r = await R.signup.POST(req(form(n, { coupon: cls?.group.code }), '', ip)); expect(r.status).toBe(200); return { cookie: r.headers.get('set-cookie')!.split(';')[0], code: (await j(r)).studentCode as string }; };
    const a1 = await join('Anu One', A, '40.0.0.1'), a2 = await join('Anu Two', A, '40.0.0.2'), b1 = await join('Bini One', B, '40.0.0.3');
    const solo = await R.signup.POST(req(form('Solo Student'), '', '40.0.0.4')); const solo1 = solo.headers.get('set-cookie')!.split(';')[0];
    // roll numbers count inside each class
    expect((await j(await R.cls.GET(get(a1.cookie)))).class.serial).toBe(1);
    expect((await j(await R.cls.GET(get(a2.cookie)))).class.serial).toBe(2);
    expect((await j(await R.cls.GET(get(b1.cookie)))).class.serial).toBe(1);
    // the teacher's list shows roll no. AND our student number
    const t = await j(await R.teacher.POST(req({ code: A.group.code, key: A.teacherKey }, '', '41.0.0.1')));
    expect(t.roster.map((r: any) => [r.serial, r.studentCode, r.name])).toEqual([[1, a1.code, 'Anu One'], [2, a2.code, 'Anu Two']]);
    expect(t.roster[0]).toMatchObject({ sessions: 0, pct: 0 });
    // wrong key
    expect((await R.content.POST(req({ code: A.group.code, key: '000000', action: 'list' }, '', '41.0.0.2'))).status).toBe(401);
    const ctA = (b: object) => R.content.POST(req({ code: A.group.code, key: A.teacherKey, ...b }, '', '41.0.0.3')).then(j);
    const ctB = (b: object) => R.content.POST(req({ code: B.group.code, key: B.teacherKey, ...b }, '', '41.0.0.4')).then(j);
    const note = await ctA({ action: 'save', item: { kind: 'note', title: 'Chapter 1 notes', body: 'Sets are collections.' } });
    const tpl = await ctA({ action: 'save', item: { kind: 'template', title: 'Worksheet', body: 'Name: ___' } });
    const exam = await ctA({ action: 'save', item: { kind: 'exam', title: 'Test 1', minutes: 20, open: true, questions: [{ q: '1+1?', options: ['1', '2'], answer: 1 }, { q: '2+2?', options: ['3', '4'], answer: 1 }] } });
    expect([note.ok, tpl.ok, exam.ok]).toEqual([true, true, true]);
    expect(tpl.item.shared).toBe(false); expect(note.item.shared).toBe(true);
    // students of A see the note and exam (not the private template); no right answers yet
    const seen = await j(await R.mine.GET(get(a1.cookie)));
    expect(seen.items.map((i: any) => i.title).sort()).toEqual(['Chapter 1 notes', 'Test 1']);
    expect(JSON.stringify(seen)).not.toContain('"answer"');
    // students of B, and a student with no class, see nothing of A's
    expect((await j(await R.mine.GET(get(b1.cookie)))).items).toEqual([]);
    expect((await j(await R.mine.GET(get(solo1)))).items).toEqual([]);
    expect((await R.mine.GET(get(''))).status).toBe(401);
    // teacher B cannot read, change, delete or copy A's items
    expect((await ctB({ action: 'list' })).items).toEqual([]);
    expect((await ctB({ action: 'save', item: { id: note.item.id, kind: 'note', title: 'x', body: 'y' } })).ok).toBe(false);
    expect((await ctB({ action: 'delete', id: note.item.id })).ok).toBe(false);
    expect((await ctB({ action: 'use', id: note.item.id })).ok).toBe(false);
    expect((await ctB({ action: 'results', id: exam.item.id })).ok).toBe(false);
    // student of B cannot hand in A's exam
    const sneaky = await R.mine.POST(req({ id: exam.item.id, answers: [1, 1] }, b1.cookie));
    expect(sneaky.status).toBe(404);
    // A's student hands in: one try, answers shown after
    const done = await j(await R.mine.POST(req({ id: exam.item.id, answers: [1, 0] }, a1.cookie)));
    expect(done.item.attempt).toMatchObject({ score: 1, total: 2 });
    expect(JSON.stringify(done)).toContain('"answer"');
    expect((await R.mine.POST(req({ id: exam.item.id, answers: [1, 1] }, a1.cookie))).status).toBe(400);
    // results: roll no, student number, mark; the other student has not handed in
    const res = await ctA({ action: 'results', id: exam.item.id });
    expect(res.rows.map((r: any) => [r.serial, r.studentCode, r.score])).toEqual([[1, a1.code, 1], [2, a2.code, null]]);
    expect(res.handedIn).toBe(1);
    // closing the exam stops new hand-ins; questions are locked once taken
    await ctA({ action: 'toggle', id: exam.item.id, field: 'open' });
    expect((await R.mine.POST(req({ id: exam.item.id, answers: [1, 1] }, a2.cookie))).status).toBe(400);
    expect((await ctA({ action: 'save', item: { id: exam.item.id, kind: 'exam', title: 'Test 1', questions: [{ q: 'new', options: ['a', 'b'], answer: 0 }] } })).ok).toBe(false);
    // templates: use copies into a new private item; sharing makes it visible
    const copy = await ctA({ action: 'use', id: tpl.item.id, kind: 'note' });
    expect(copy.item).toMatchObject({ kind: 'note', shared: false });
    await ctA({ action: 'toggle', id: copy.item.id, field: 'shared' });
    expect((await j(await R.mine.GET(get(a2.cookie)))).items.some((i: any) => i.id === copy.item.id)).toBe(true);
    // send into the regular class: open + shown + live; the student's menu counts it, and it is a "live" quiz only for A's students
    const fresh = await ctA({ action: 'save', item: { kind: 'exam', title: 'Live quiz', questions: [{ q: 'x?', options: ['a', 'b'], answer: 0 }] } });
    expect(fresh.item.live ?? false).toBe(false);
    const n0 = (await j(await R.mine.GET(new Request('http://x/a?count=1', { headers: { cookie: a2.cookie } })))).unseen;
    expect(await ctA({ action: 'toggle', id: fresh.item.id, field: 'live' })).toMatchObject({ ok: true, value: true });
    const cnt = (ck: string) => R.mine.GET(new Request('http://x/a?count=1', { headers: { cookie: ck } })).then(j);
    const afterSend = await cnt(a2.cookie);
    expect(afterSend.live).toMatchObject({ id: fresh.item.id, title: 'Live quiz' });
    expect(afterSend.unseen).toBeGreaterThan(n0 - 1);
    expect((await cnt(b1.cookie)).live).toBeNull(); expect((await cnt(b1.cookie)).unseen).toBe(0);
    expect((await cnt(solo1)).live).toBeNull();
    // opening Teachers Notes clears the red dot; a new send brings it back
    expect((await j(await R.mine.POST(req({ action: 'seen' }, a2.cookie)))).ok).toBe(true);
    expect((await cnt(a2.cookie)).unseen).toBe(0);
    await new Promise((r) => setTimeout(r, 5));
    await ctA({ action: 'save', item: { kind: 'note', title: 'Fresh note', body: 'new' } });
    expect((await cnt(a2.cookie)).unseen).toBe(1);
    // the student answers inside the class; the mark lands in the teacher's results; the quiz stops being live for that student
    const hand = await j(await R.mine.POST(req({ id: fresh.item.id, answers: [0] }, a2.cookie)));
    expect(hand.item.attempt).toMatchObject({ score: 1, total: 1 });
    expect((await cnt(a2.cookie)).live).toBeNull();
    expect((await ctA({ action: 'results', id: fresh.item.id })).rows.find((r: any) => r.studentCode === a2.code).score).toBe(1);
    // stop sending
    await ctA({ action: 'toggle', id: fresh.item.id, field: 'live' });
    expect((await cnt(a1.cookie)).live).toBeNull();
    // starters can be copied too
    expect((await ctA({ action: 'use', id: 'mcq-exam' })).item.kind).toBe('exam');
  });
});
