import { NextResponse } from 'next/server';
import { schoolTeacherFromRequest } from '@/lib/ai-guru/schools/session';
import { teacherMayUse } from '@/lib/ai-guru/schools/teacher-view';
import { audit, getExam, listAttempts, listExams, newRowId, saveExam } from '@/lib/ai-guru/schools/store';
import { questionsFromMaterial, type Exam, type ExamQuestion } from '@/lib/ai-guru/schools/rules';
import { getMaterial } from '@/lib/ai-guru/material-studio/store';
import { readData } from '@/lib/ai-guru/admin/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const day = (x: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(x ?? '')) ? String(x) : '');
const clip = (x: unknown, n: number) => String(x ?? '').slice(0, n);

function cleanQuestions(raw: unknown): ExamQuestion[] | string {
  if (!Array.isArray(raw)) return 'Questions are needed';
  const qs = raw.slice(0, 100).map((q, i) => {
    const o = (q ?? {}) as Record<string, unknown>;
    const options = Array.isArray(o.options) ? o.options.map((x) => clip(x, 300).trim()).filter(Boolean).slice(0, 6) : [];
    return { id: clip(o.id, 40) || `q${i + 1}`, q: clip(o.q, 600).trim(), options, answer: Math.round(Number(o.answer)) };
  });
  const bad = qs.findIndex((q) => !q.q || q.options.length < 2 || !(q.answer >= 0 && q.answer < q.options.length));
  if (!qs.length) return 'Add at least one question';
  if (bad >= 0) return `Question ${bad + 1} needs its text, at least two options and the right answer`;
  return qs;
}

/**
 * V51.9.193 — exams by a school teacher, for their own students (their school, one of their standards).
 * GET  — the teacher's exams with every student's score.   GET ?from=<materialId> — questions taken from an MCQ material.
 * POST { action: 'create', title, standard, opens, closes, minutes, questions[], materialId? } · { action: 'close', id }
 */
export async function GET(request: Request) {
  const t = await schoolTeacherFromRequest(request);
  if (!t) return NextResponse.json({ ok: false }, { status: 401 });
  const from = new URL(request.url).searchParams.get('from');
  if (from) {
    const m = await getMaterial(from);
    if (!m || !(await teacherMayUse(t, t.school, m))) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, title: m.title, documentId: m.documentId, questions: questionsFromMaterial(m.sections) });
  }
  const [exams, attempts, data] = await Promise.all([listExams(), listAttempts(), readData()]);
  const name = new Map(data.students.map((s) => [s.id, { name: s.name, code: s.studentCode ?? '' }]));
  const mine = exams.filter((e) => e.teacherId === t.id).map((e) => ({ ...e, results: attempts.filter((a) => a.examId === e.id).map((a) => ({ studentId: a.studentId, ...(name.get(a.studentId) ?? { name: '?', code: '' }), score: a.score, total: a.total, submittedAt: a.submittedAt })).sort((x, y) => y.score - x.score) }));
  return NextResponse.json({ ok: true, exams: mine }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: Request) {
  const t = await schoolTeacherFromRequest(request);
  if (!t) return NextResponse.json({ ok: false, error: 'Sign in first' }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (b.action === 'close') {
    const e = await getExam(String(b.id ?? ''));
    if (!e || e.teacherId !== t.id) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    await saveExam({ ...e, closed: true });
    await audit({ schoolId: t.schoolId, teacherId: t.id, action: 'exam-close', what: `Closed the exam “${e.title}”`, examId: e.id });
    return NextResponse.json({ ok: true });
  }
  if (b.action !== 'create') return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  const title = clip(b.title, 120).trim(), standard = String(b.standard ?? ''), opens = day(b.opens), closes = day(b.closes), minutes = Math.round(Number(b.minutes));
  const qs = cleanQuestions(b.questions);
  const problems = [!title && 'A title is needed', !t.standards.includes(standard) && `Choose one of your standards (${t.standards.join(', ')})`, !opens && 'The opening date is needed', !closes && 'The closing date is needed', opens && closes && closes < opens && 'It cannot close before it opens', !(minutes >= 5 && minutes <= 180) && 'Time allowed: 5 to 180 minutes', typeof qs === 'string' && qs].filter(Boolean) as string[];
  if (problems.length) return NextResponse.json({ ok: false, error: problems.join('. ') }, { status: 400 });
  const e: Exam = { id: newRowId('exam'), schoolId: t.schoolId, teacherId: t.id, teacherName: t.name, subject: t.subject, standard, title, ...(b.materialId ? { materialId: clip(b.materialId, 80) } : {}), questions: qs as ExamQuestion[], opens, closes, minutes, createdAt: new Date().toISOString() };
  await saveExam(e);
  await audit({ schoolId: t.schoolId, teacherId: t.id, action: 'exam-new', what: `Exam “${title}” for Std ${standard}: ${e.questions.length} questions, ${minutes} min, ${opens} to ${closes}`, examId: e.id });
  return NextResponse.json({ ok: true, exam: e });
}
