import { NextResponse } from 'next/server';
import { studentFromRequest } from '@/lib/ai-guru/admin/auth';
import { readData } from '@/lib/ai-guru/admin/store';
import { istToday } from '@/lib/ai-guru/admin/enrolment';
import { getAttempt, getExam, getStart, listAttempts, listExams, newRowId, startAttempt, submitAttemptOnce } from '@/lib/ai-guru/schools/store';
import { answersShown, EXAM_GRACE_SECONDS, examSecondsLeft, scoreExam, type Exam } from '@/lib/ai-guru/schools/rules';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const noStore = { 'cache-control': 'no-store' };
const stdKey = (g: string) => String(Number(String(g).match(/\d+/)?.[0] ?? g));

/** An exam this student may take: their school, their standard. */
const forStudent = (e: Exam, st: { schoolLink?: { schoolId: string }; standard: string }) => !!st.schoolLink && e.schoolId === st.schoolLink.schoolId && stdKey(e.standard) === stdKey(st.standard);
const isOpen = (e: Exam, today: string) => !e.closed && e.opens <= today && today <= e.closes;

/**
 * V51.9.193 — exams from the student's school teachers.
 * GET            — the exams for this student (open, upcoming, done with score).
 * GET ?id=…      — one open exam to take: the questions WITHOUT the answers. V51.9.195: the first open starts the clock on
 *                  the server; `secondsLeft` comes from that start, so reopening the page does not restart it.
 * POST { id, answers[] } — hands it in once; the score. The right answers only once the exam has closed (V51.9.195).
 */
export async function GET(request: Request) {
  const sid = await studentFromRequest(request);
  if (!sid) return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
  const st = (await readData()).students.find((s) => s.id === sid);
  if (!st) return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
  const today = istToday();
  const id = new URL(request.url).searchParams.get('id');
  if (id) {
    const e = await getExam(id);
    if (!e || !forStudent(e, st)) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404, headers: noStore });
    const done = await getAttempt(e.id, sid);
    if (done) return NextResponse.json({ ok: true, done: { score: done.score, total: done.total, submittedAt: done.submittedAt, answers: done.answers, late: !!done.late, ...(answersShown(e, today) ? { right: e.questions.map((q) => q.answer) } : { answersOn: e.closes }) }, exam: { id: e.id, title: e.title, subject: e.subject, teacherName: e.teacherName, questions: e.questions.map(({ answer: _a, ...q }) => q) } }, { headers: noStore });
    if (!isOpen(e, today)) return NextResponse.json({ ok: false, error: e.opens > today ? `This exam opens on ${e.opens}.` : 'This exam is closed.' }, { status: 403, headers: noStore });
    const startedAt = await startAttempt(e.id, sid);
    return NextResponse.json({ ok: true, secondsLeft: examSecondsLeft(startedAt, e.minutes), exam: { id: e.id, title: e.title, subject: e.subject, teacherName: e.teacherName, minutes: e.minutes, closes: e.closes, questions: e.questions.map(({ answer: _a, ...q }) => q) } }, { headers: noStore });
  }
  const [exams, attempts] = await Promise.all([listExams(), listAttempts()]);
  const mine = exams.filter((e) => forStudent(e, st)).map((e) => {
    const a = attempts.find((x) => x.examId === e.id && x.studentId === sid);
    return { id: e.id, title: e.title, subject: e.subject, teacherName: e.teacherName, opens: e.opens, closes: e.closes, minutes: e.minutes, questions: e.questions.length, state: a ? 'done' : isOpen(e, today) ? 'open' : e.opens > today ? 'soon' : 'closed', ...(a ? { score: a.score, total: a.total } : {}) };
  }).filter((e) => e.state !== 'closed' || e.score !== undefined);
  return NextResponse.json({ ok: true, exams: mine }, { headers: noStore });
}

export async function POST(request: Request) {
  const sid = await studentFromRequest(request);
  if (!sid) return NextResponse.json({ ok: false, error: 'Sign in first' }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const st = (await readData()).students.find((s) => s.id === sid);
  const e = await getExam(String(b.id ?? ''));
  if (!st || !e || !forStudent(e, st)) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  if (!isOpen(e, istToday())) return NextResponse.json({ ok: false, error: 'This exam is not open now.' }, { status: 403 });
  const now = new Date().toISOString();
  // V51.9.195: the clock is the server's — from the first time this student opened the exam
  const startedAt = (await getStart(e.id, sid)) ?? now;
  const late = Date.now() > Date.parse(startedAt) + e.minutes * 60_000 + EXAM_GRACE_SECONDS * 1000;
  const sent = e.questions.map((_, i) => { const v = Math.round(Number(Array.isArray(b.answers) ? b.answers[i] : -1)); return v >= 0 && v < e.questions[i].options.length ? v : -1; });
  const answers = late ? e.questions.map(() => -1) : sent;
  const { score, total } = scoreExam(e, answers);
  const saved = await submitAttemptOnce({ id: newRowId('att'), examId: e.id, studentId: sid, answers, score, total, startedAt, submittedAt: now, ...(late ? { late: true } : {}) });
  if (!saved) return NextResponse.json({ ok: false, error: 'You have already handed in this exam.' }, { status: 409 });
  const today = istToday();
  return NextResponse.json({ ok: true, score, total, late, ...(answersShown(e, today) ? { right: e.questions.map((q) => q.answer) } : { answersOn: e.closes }) });
}
