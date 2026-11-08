import { NextResponse } from 'next/server';
import { bad, denied } from '../guard';
import { readData, update } from '@/lib/ai-guru/admin/store';
import { cleanTerms, DEFAULT_SCHOOL_TERMS, type School } from '@/lib/ai-guru/schools/rules';
import { audit, getSchool, getTeacher, listAudit, listAttempts, listCommissions, listExams, listSchools, listTeachers, newRowId, nextSchoolCode, saveCommission, saveSchool, saveTeacher, teacherPassword } from '@/lib/ai-guru/schools/store';
import { SYLLABI } from '@/lib/ai-guru/library/catalog';
import { randomInt } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const clip = (x: unknown, n: number) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * V51.9.193 — contracted schools (the office only), a separate record from the ordinary students:
 * GET — the schools with their teachers, students and commission account; the teachers' activity; the default terms.
 * POST { action: 'school', school: {id?, name, place, district, state, syllabus, contactName, contactPhone, email, terms, active} }
 *      { action: 'teacher', id, status: 'active' | 'off' }     approve / switch off a teacher
 *      { action: 'password', id }                              a new password for a teacher (shown once)
 *      { action: 'paid', ids: [...], who: 'school' | 'teacher', on }   commission paid out
 *      { action: 'defaults', terms }                           default terms for new schools
 */
export async function GET(req: Request) {
  const d = await denied(req); if (d) return d;
  const [schools, teachers, commissions, log, exams, data, attempts] = await Promise.all([listSchools(), listTeachers(), listCommissions(), listAudit(), listExams(), readData(), listAttempts()]);
  const stu = (id: string) => data.students.filter((s) => s.schoolLink?.schoolId === id);
  const name = new Map(data.students.map((s) => [s.id, `${s.name} (${s.studentCode ?? ''})`]));
  const tname = new Map(teachers.map((t) => [t.id, t.name]));
  const rows = schools.map((s) => {
    const cs = commissions.filter((c) => c.schoolId === s.id);
    const sum = (f: (c: (typeof cs)[number]) => number) => r2(cs.reduce((a, c) => a + f(c), 0));
    return {
      ...s,
      teachers: teachers.filter((t) => t.schoolId === s.id).map(({ login: _l, ...t }) => ({ ...t, students: data.students.filter((x) => x.schoolLink?.teacherId === t.id).length, exams: exams.filter((e) => e.teacherId === t.id).length, edits: log.filter((e) => e.teacherId === t.id && e.action.startsWith('material')).length,
        commission: { earned: r2(cs.filter((c) => c.teacherId === t.id).reduce((a, c) => a + c.teacherAmount, 0)), pending: r2(cs.filter((c) => c.teacherId === t.id && !c.teacherPaidOn).reduce((a, c) => a + c.teacherAmount, 0)) } })),
      students: stu(s.id).map((x) => ({ id: x.id, studentCode: x.studentCode ?? '', name: x.name, standard: x.standard, teacher: x.schoolLink?.teacherName ?? '', joined: x.createdAt.slice(0, 10) })),
      account: { fees: sum((c) => c.paid), schoolEarned: sum((c) => c.schoolAmount), schoolPending: sum((c) => (c.schoolPaidOn ? 0 : c.schoolAmount)), teachersEarned: sum((c) => c.teacherAmount), teachersPending: sum((c) => (c.teacherPaidOn ? 0 : c.teacherAmount)) },
      commissions: cs.map((c) => ({ ...c, student: name.get(c.studentId) ?? '?', teacher: c.teacherId ? tname.get(c.teacherId) ?? '?' : '' })),
      // V51.9.195: the office sees every exam and each student's score
      exams: exams.filter((e) => e.schoolId === s.id).map((e) => ({ id: e.id, title: e.title, subject: e.subject, standard: e.standard, teacher: e.teacherName, opens: e.opens, closes: e.closes, questions: e.questions.length,
        results: attempts.filter((a) => a.examId === e.id).map((a) => ({ student: name.get(a.studentId) ?? '?', score: a.score, total: a.total, late: !!a.late, at: a.submittedAt })).sort((a, b) => b.score - a.score) })),
    };
  });
  return NextResponse.json({ ok: true, schools: rows, log: log.slice(0, 500).map((e) => ({ ...e, teacher: tname.get(e.teacherId) ?? '?' })), defaults: data.settings.schools ?? DEFAULT_SCHOOL_TERMS, syllabi: SYLLABI }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: Request) {
  const d = await denied(req); if (d) return d;
  const b = await req.json().catch(() => ({}));
  if (b.action === 'defaults') {
    const t = cleanTerms(b.terms); if (typeof t === 'string') return bad(t);
    await update((data) => { data.settings.schools = t; });
    return NextResponse.json({ ok: true, defaults: t });
  }
  if (b.action === 'school') {
    const x = (b.school ?? {}) as Record<string, unknown>;
    const before = x.id ? await getSchool(String(x.id)) : null;
    const defaults = (await readData()).settings.schools ?? DEFAULT_SCHOOL_TERMS;
    const terms = cleanTerms(x.terms ?? before?.terms ?? defaults); if (typeof terms === 'string') return bad(terms);
    const name = clip(x.name, 120);
    if (!name) return bad('The school’s name is needed');
    const s: School = { id: before?.id ?? newRowId('sch'), code: before?.code ?? await nextSchoolCode('SC'), name, place: clip(x.place, 80), district: clip(x.district, 60), state: clip(x.state, 60) || 'Kerala', syllabus: SYLLABI.some(([v]) => v === x.syllabus) ? String(x.syllabus) : '', contactName: clip(x.contactName, 80), contactPhone: String(x.contactPhone ?? '').replace(/[^\d+]/g, '').slice(0, 15), email: clip(x.email, 120), terms, active: x.active === undefined ? before?.active ?? true : !!x.active, createdAt: before?.createdAt ?? new Date().toISOString() };
    await saveSchool(s);
    return NextResponse.json({ ok: true, school: s });
  }
  if (b.action === 'teacher') {
    const t = await getTeacher(String(b.id ?? '')); if (!t) return bad('Teacher not found', 404);
    const status = b.status === 'active' ? 'active' : 'off';
    await saveTeacher({ ...t, status, ...(status === 'active' && !t.approvedAt ? { approvedAt: new Date().toISOString() } : {}) });
    if (status === 'active' && t.status === 'pending') await audit({ schoolId: t.schoolId, teacherId: t.id, action: 'approved', what: `${t.name} approved by the office (${t.subject}, Std ${t.standards.join(', ')})` });
    // V51.9.195 (review): a message the office can send the teacher at once (WhatsApp, with the text filled in)
    if (status === 'active' && t.status !== 'active') {
      const digits = String(t.phone ?? '').replace(/\D/g, '');
      const to = digits.length === 10 ? `91${digits}` : digits;
      const text = `Hello ${t.name}, your AI Guru teacher account is approved. Sign in at /ai-guru/school-teacher with your teacher ID ${t.code} and your password. You can open and edit the study materials for ${t.subject} (Std ${t.standards.join(', ')}) and set exams.`;
      return NextResponse.json({ ok: true, tell: { text, ...(to.length >= 10 ? { whatsapp: `https://wa.me/${to}?text=${encodeURIComponent(text)}` } : {}) } });
    }
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'password') {
    const t = await getTeacher(String(b.id ?? '')); if (!t) return bad('Teacher not found', 404);
    const pw = String(randomInt(10_000_000, 99_999_999));
    await saveTeacher({ ...t, login: teacherPassword(pw) });
    return NextResponse.json({ ok: true, password: pw, code: t.code });
  }
  if (b.action === 'paid') {
    const ids = new Set(Array.isArray(b.ids) ? b.ids.map(String) : []);
    const on = /^\d{4}-\d{2}-\d{2}$/.test(String(b.on ?? '')) ? String(b.on) : new Date().toISOString().slice(0, 10);
    let n = 0;
    for (const c of await listCommissions()) {
      if (!ids.has(c.id)) continue;
      if (b.who === 'school' && !c.schoolPaidOn) { await saveCommission({ ...c, schoolPaidOn: on }); n++; }
      if (b.who === 'teacher' && c.teacherId && !c.teacherPaidOn) { await saveCommission({ ...c, teacherPaidOn: on }); n++; }
    }
    return NextResponse.json({ ok: true, marked: n });
  }
  return bad('Unknown action');
}
