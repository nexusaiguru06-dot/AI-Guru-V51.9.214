// @vitest-environment node
/**
 * V51.9.193 — contracted schools: school ID, teacher sign-up (subject + standards) and approval, teachers editing the AI
 * study materials for their school (recorded against them), students seeing their teacher's version, exams, the
 * school discount and the schools' separate commission account.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cleanTerms, commissionOf, questionsFromMaterial, scoreExam, teacherCovers } from './rules';

describe('rules (pure)', () => {
  it('a teacher covers only their subject and standards (and the school syllabus)', () => {
    const james = { subject: 'Physics', standards: ['8', '9', '10'] };
    expect(teacherCovers(james, { subject: 'Physics', grade: 'Std 9', syllabus: 'kerala' }, 'kerala')).toBe(true);
    expect(teacherCovers(james, { subject: 'Physics Part 1', grade: '8' })).toBe(true);
    expect(teacherCovers(james, { subject: 'Chemistry', grade: '8' })).toBe(false);
    expect(teacherCovers(james, { subject: 'Physics', grade: '11' })).toBe(false);
    expect(teacherCovers(james, { subject: 'Physics', grade: '8', syllabus: 'cbse' }, 'kerala')).toBe(false);
  });
  it('commission, terms, exams', () => {
    expect(commissionOf(1800, { schoolPct: 10, teacherPct: 5, studentDiscountPct: 10 }, true)).toEqual({ schoolAmount: 180, teacherAmount: 90 });
    expect(commissionOf(1800, { schoolPct: 10, teacherPct: 5, studentDiscountPct: 10 }, false).teacherAmount).toBe(0);
    expect(cleanTerms({ schoolPct: 50, teacherPct: 30, studentDiscountPct: 10 })).toMatch(/80%/);
    const qs = questionsFromMaterial([{ id: 'a', heading: 'Unit of force?', options: ['A) Newton', 'B) Joule'], answer: 'A' }, { id: 'b', heading: 'Speed of light?', options: ['3×10^8 m/s', '340 m/s'], answer: '3×10^8 m/s' }, { id: 'c', heading: 'No options' }]);
    expect(qs.map((q) => q.answer)).toEqual([0, 0]);
    expect(scoreExam({ questions: qs }, [0, 1])).toEqual({ score: 1, total: 2 });
  });
});

const R: Record<string, any> = {};
let ipN = 1;
const req = (body: unknown, cookie = '') => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': `67.0.0.${ipN++}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie = '', q = '') => new Request(`http://x/a${q}`, { headers: { cookie } });
const j = async (r: Response) => r.json();
const sess = (r: Response) => (r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie') ?? '']).map((c) => c.split(';')[0]).filter((c) => /^aig_(student|admin|teacher)=/.test(c)).join('; ');

describe('St. Joseph’s School and James (Physics, Std 8–10)', () => {
  let admin = '', james = '', schoolCode = '', teacherCode = '', schoolId = '', teacherId = '', kid = '', kidId = '', other = '', aiMcq = 'ai_mcq', mine = '';
  beforeAll(async () => {
    process.chdir(mkdtempSync(path.join(tmpdir(), 'schools193-')));
    process.env.ADMIN_USERNAME = 'office'; process.env.ADMIN_PASSWORD = 'office-pass-2026';
    for (const [k, p] of Object.entries({ login: 'admin/login', schools: 'admin/schools', enrol: 'admin/enrolment', fees: 'admin/fees', tsign: 'school-teacher/signup', tlogin: 'school-teacher/login', tme: 'school-teacher/me', tmat: 'school-teacher/materials', texam: 'school-teacher/exams', signup: 'student-portal/signup', coupon: 'student-portal/coupon', me: 'student-portal/me', sexam: 'student-portal/exams', mats: 'material-studio/materials' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
    const { sampleBook } = await import('../material-studio/locks.fixtures');
    const store = await import('../material-studio/store');
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.create(); for (let p = 0; p < 50; p++) pdf.addPage([200, 200]);
    const bytes = Buffer.from(await pdf.save());
    await store.saveDocument({ ...sampleBook(), id: 'doc:phy8', subject: 'Physics', grade: '8', syllabus: 'kerala', owner: { kind: 'admin' } }, bytes);
    await store.saveDocument({ ...sampleBook(), id: 'doc:chem8', subject: 'Chemistry', grade: '8', syllabus: 'kerala', owner: { kind: 'admin' } }, bytes);
    await store.saveMaterial({ id: aiMcq, documentId: 'doc:phy8', type: 'mcq', title: 'Force — MCQ', overview: 'AI', teachingLanguage: 'malayalam', materialLanguages: ['english'], sections: [{ id: 'q1', heading: 'Unit of force?', content: '', options: ['A) Newton', 'B) Joule', 'C) Watt'], answer: 'A', sourceIds: [], visuals: [] }, { id: 'q2', heading: 'Unit of energy?', content: '', options: ['A) Newton', 'B) Joule'], answer: 'B', sourceIds: [], visuals: [] }], sources: [{ id: 's3', page: 3, paragraph: 1, text: 'p3' }], qa: { status: 'passed', score: 90, issues: [], checkedAt: '' }, model: 'm', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', owner: { kind: 'admin' } });
    admin = sess(await R.login.POST(req({ username: 'office', password: 'office-pass-2026' })));
  });

  it('the office adds the school: school ID SC-…, its own terms', async () => {
    expect((await j(await R.schools.POST(req({ action: 'defaults', terms: { schoolPct: 10, teacherPct: 5, studentDiscountPct: 10 } }, admin)))).ok).toBe(true);
    const r = await j(await R.schools.POST(req({ action: 'school', school: { name: "St. Joseph's School", place: 'Aluva', district: 'Ernakulam', state: 'Kerala', syllabus: 'kerala', contactName: 'Principal', contactPhone: '9847000000' } }, admin)));
    expect(r.school).toMatchObject({ code: expect.stringMatching(/^SC-1-\d{2}$/), terms: { schoolPct: 10, teacherPct: 5, studentDiscountPct: 10 }, active: true });
    schoolCode = r.school.code; schoolId = r.school.id;
    expect((await R.schools.GET(get())).status).not.toBe(200);
  });

  it('James signs up with the school ID; signs in only after the office approves', async () => {
    const r = await j(await R.tsign.POST(req({ schoolCode: schoolCode.replace(/-/g, ''), name: 'James Mathew', phone: '9847111111', subject: 'Physics', standards: ['8', '9', '10'], password: 'physics1', confirm: 'physics1' })));
    expect(r).toMatchObject({ ok: true, teacher: { code: expect.stringMatching(/^TS-1-\d{2}$/), status: 'pending', standards: ['8', '9', '10'] }, school: { name: "St. Joseph's School" } });
    teacherCode = r.teacher.code;
    expect((await R.tsign.POST(req({ schoolCode: 'SC-99-26', name: 'X', phone: '9847111112', subject: 'Physics', standards: ['8'], password: 'xxxxxx', confirm: 'xxxxxx' }))).status).toBe(400);
    const early = await R.tlogin.POST(req({ code: teacherCode, password: 'physics1' }));
    expect(early.status).toBe(403);
    expect(await j(early)).toMatchObject({ pending: true });
    const s = await j(await R.schools.GET(get(admin)));
    teacherId = s.schools[0].teachers[0].id;
    expect(s.schools[0].teachers[0]).toMatchObject({ status: 'pending', subject: 'Physics' });
    await R.schools.POST(req({ action: 'teacher', id: teacherId, status: 'active' }, admin));
    const ok = await R.tlogin.POST(req({ code: teacherCode, password: 'physics1' }));
    expect(ok.status).toBe(200);
    james = sess(ok);
  });

  it('James sees only Physics Std 8–10 books, opens the AI MCQ, and makes the school’s version — recorded against him', async () => {
    const me = await j(await R.tme.GET(get(james)));
    expect(me.books.map((b: any) => b.id)).toEqual(['doc:phy8']);
    expect(me.books[0].materials.map((m: any) => m.id)).toEqual([aiMcq]);
    const m = (await j(await R.tmat.GET(get(james, `?id=${aiMcq}`)))).material;
    expect(m.sections).toHaveLength(2);
    const saved = await j(await R.tmat.POST(req({ action: 'save', material: { id: aiMcq, documentId: 'doc:phy8', type: 'mcq', title: 'Force — MCQ (St. Joseph’s)', overview: 'Checked by James', sections: [...m.sections, { heading: 'Unit of power?', content: '', options: ['A) Watt', 'B) Volt'], answer: 'A' }] } }, james)));
    expect(saved.material).toMatchObject({ basedOn: aiMcq, school: schoolId, teacher: { name: 'James Mathew' } });
    mine = saved.material.id;
    expect(mine).not.toBe(aiMcq);
    // editing his own version changes it in place
    const again = await j(await R.tmat.POST(req({ action: 'save', material: { id: mine, documentId: 'doc:phy8', title: 'Force — MCQ (St. Joseph’s) v2', overview: '', sections: saved.material.sections } }, james)));
    expect(again.material.id).toBe(mine);
    // not his subject
    expect((await R.tmat.POST(req({ action: 'save', material: { documentId: 'doc:chem8', type: 'mcq', part: 1, title: 'x', sections: [{ heading: 'q' }] } }, james))).status).toBe(403);
    // a new material for Part 2
    expect((await j(await R.tmat.POST(req({ action: 'save', material: { documentId: 'doc:phy8', type: 'revision-notes', part: 2, title: 'My notes on motion', overview: '', sections: [{ heading: 'Motion', content: 'Distance and displacement…' }] } }, james)))).ok).toBe(true);
    const log = (await j(await R.tme.GET(get(james)))).log.map((e: any) => e.action);
    expect(log).toEqual(expect.arrayContaining(['signup', 'approved', 'material-new', 'material-edit']));
  });

  it('a student joining with James’s ID: linked to the school and teacher; sees James’s version, not the AI one; others do not see it', async () => {
    expect(await j(await R.coupon.GET(get('', `?code=${teacherCode}`)))).toMatchObject({ valid: true, label: expect.stringMatching(/Joining St\. Joseph's School with James Mathew \(Physics\) · 10% off/) });
    const r = await R.signup.POST(req({ name: 'Anu Joseph', standard: '8', syllabus: 'kerala', medium: 'malayalam', school: '', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1', motherTongue: 'Malayalam', coupon: teacherCode }));
    kid = sess(r);
    const me = await j(await R.me.GET(get(kid)));
    kidId = me.student.id;
    const { readData } = await import('../admin/store');
    expect((await readData()).students.find((s) => s.id === kidId)!.schoolLink).toMatchObject({ schoolId, teacherName: 'James Mathew', discountPct: 10 });
    const ids = (await j(await R.mats.GET(new Request('http://x/m?documentId=doc:phy8', { headers: { cookie: kid } })))).materials.map((m: any) => m.id);
    expect(ids).toContain(mine);
    expect(ids).not.toContain(aiMcq);
    other = sess(await R.signup.POST(req({ name: 'Bilal K', standard: '8', syllabus: 'kerala', medium: 'malayalam', school: 'GHSS', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1', motherTongue: 'Malayalam' })));
    const otherIds = (await j(await R.mats.GET(new Request('http://x/m?documentId=doc:phy8', { headers: { cookie: other } })))).materials.map((m: any) => m.id);
    expect(otherIds).toContain(aiMcq);
    expect(otherIds).not.toContain(mine);
  });

  it('school discount on the part fees; each payment adds the school’s and teacher’s commission to the schools account', async () => {
    await R.enrol.POST(req({ action: 'settings', access: { enabled: true, freeParts: [1], partPlan: { enabled: true, partPrice: 2000, upfrontPrice: 7000, trialDays: 7 } } }, admin));
    await R.me.GET(get(kid)); // makes the part bills
    const { readData } = await import('../admin/store');
    const { invoiceDue } = await import('../admin/fees');
    const p2 = (await readData()).invoices.find((i) => i.studentId === kidId && i.partBill?.part === 2)!;
    expect(invoiceDue(p2)).toBe(1800);
    expect((await j(await R.fees.POST(req({ action: 'pay', invoiceId: p2.id, amount: 1800, date: '2026-11-03', mode: 'cash' }, admin)))).ok).toBe(true);
    const s = (await j(await R.schools.GET(get(admin)))).schools[0];
    expect(s.account).toEqual({ fees: 1800, schoolEarned: 180, schoolPending: 180, teachersEarned: 90, teachersPending: 90 });
    expect(s.students).toHaveLength(1);
    expect(s.teachers[0].commission).toEqual({ earned: 90, pending: 90 });
    expect((await j(await R.schools.POST(req({ action: 'paid', ids: [s.commissions[0].id], who: 'school', on: '2026-12-04' }, admin)))).marked).toBe(1);
    expect((await j(await R.schools.GET(get(admin)))).schools[0].account.schoolPending).toBe(0);
  });

  it('James sets an exam from his MCQ; his student takes it once; he sees the score', async () => {
    const from = await j(await R.texam.GET(get(james, `?from=${mine}`)));
    expect(from.questions).toHaveLength(3);
    const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
    const e = await j(await R.texam.POST(req({ action: 'create', title: 'Force test', standard: '8', opens: today, closes: today, minutes: 20, questions: from.questions, materialId: mine }, james)));
    expect(e.ok).toBe(true);
    expect((await R.texam.POST(req({ action: 'create', title: 'Bad', standard: '11', opens: today, closes: today, minutes: 20, questions: from.questions }, james))).status).toBe(400);
    const list = await j(await R.sexam.GET(get(kid)));
    expect(list.exams).toEqual([expect.objectContaining({ title: 'Force test', state: 'open', questions: 3 })]);
    const one = await j(await R.sexam.GET(get(kid, `?id=${e.exam.id}`)));
    expect(JSON.stringify(one.exam.questions)).not.toMatch(/"answer"/);
    expect((await R.sexam.GET(get(other, `?id=${e.exam.id}`))).status).toBe(404); // not his school
    const done = await j(await R.sexam.POST(req({ id: e.exam.id, answers: [0, 1, 1] }, kid)));
    expect(done).toMatchObject({ ok: true, score: 2, total: 3 });
    expect((await R.sexam.POST(req({ id: e.exam.id, answers: [0, 1, 0] }, kid))).status).toBe(409);
    const res = await j(await R.texam.GET(get(james)));
    expect(res.exams[0].results).toEqual([expect.objectContaining({ name: 'Anu Joseph', score: 2, total: 3 })]);
    const log = (await j(await R.schools.GET(get(admin)))).log;
    expect(log.some((x: any) => x.action === 'exam-new' && x.teacher === 'James Mathew')).toBe(true);
  });
});
