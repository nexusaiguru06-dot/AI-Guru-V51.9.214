/**
 * V51.9.193 — schools on contract (e.g. St. Joseph's School): pure types and rules, also used by the pages.
 *
 *  • The office adds a school → school ID (SC-1-26) and its own commission terms: the school's %, the teacher's % and
 *    the students' discount % of every fee its students pay (defaults in ⚙ Settings → Schools).
 *  • Teachers sign up with the school ID, their subject and standards → teacher ID (TS-1-26), active once the office
 *    approves. James (Physics, Std 8–10) works only on Physics books of Std 8–10 of his school's syllabus.
 *  • Students join with the school ID or their teacher's ID (the code box at sign-up): linked to the school (and the
 *    teacher), with the school's discount on the part fees. They keep their own invite link and commission as before.
 */
export interface SchoolTerms { schoolPct: number; teacherPct: number; studentDiscountPct: number }
export const DEFAULT_SCHOOL_TERMS: SchoolTerms = { schoolPct: 10, teacherPct: 5, studentDiscountPct: 10 };

export interface School {
  id: string; code: string; name: string; place: string; district: string; state: string; syllabus: string;
  contactName: string; contactPhone: string; email: string;
  terms: SchoolTerms; active: boolean; createdAt: string;
}
export type TeacherStatus = 'pending' | 'active' | 'off';
export interface SchoolTeacher {
  id: string; code: string; schoolId: string; name: string; phone: string; email: string;
  subject: string; standards: string[]; status: TeacherStatus;
  login: { salt: string; hash: string }; createdAt: string; approvedAt?: string;
}
/** One line of the schools' commission account: one fee payment by a school's student. */
export interface SchoolCommission {
  id: string; paymentId: string; receiptNo: string; schoolId: string; teacherId?: string; studentId: string;
  date: string; paid: number; schoolAmount: number; teacherAmount: number; payoutDate: string;
  schoolPaidOn?: string; teacherPaidOn?: string;
}
export type AuditAction = 'signup' | 'approved' | 'material-new' | 'material-edit' | 'material-remove' | 'exam-new' | 'exam-edit' | 'exam-close';
export interface AuditEntry { id: string; at: string; schoolId: string; teacherId: string; action: AuditAction; what: string; materialId?: string; examId?: string; documentId?: string }

export interface ExamQuestion { id: string; q: string; options: string[]; answer: number }
export interface Exam {
  id: string; schoolId: string; teacherId: string; teacherName: string; subject: string; standard: string;
  title: string; documentId?: string; materialId?: string; questions: ExamQuestion[];
  opens: string; closes: string; minutes: number; createdAt: string; closed?: boolean;
}
export interface ExamAttempt { id: string; examId: string; studentId: string; answers: number[]; score: number; total: number; startedAt: string; submittedAt: string; /** V51.9.195: handed in after the time limit (answers not counted) */ late?: boolean }

/** V51.9.195 — a little extra time for a slow connection when handing in. */
export const EXAM_GRACE_SECONDS = 90;
/** Seconds left on the clock, from the server's start time (never negative). */
export const examSecondsLeft = (startedAt: string, minutes: number, now = Date.now()) => Math.max(0, Math.round((Date.parse(startedAt) + minutes * 60_000 - now) / 1000));
/** Whether the right answers may be shown: only once the exam is closed, so no one can pass them on. */
export const answersShown = (e: Pick<Exam, 'closed' | 'closes'>, today: string) => !!e.closed || today > e.closes;

export const SUBJECTS = ['Maths', 'Physics', 'Chemistry', 'Biology', 'Science', 'Social Science', 'History', 'Geography', 'Economics', 'English', 'Malayalam', 'Hindi', 'Computer Science', 'Other'];
export const STANDARDS = Array.from({ length: 12 }, (_, i) => String(i + 1));

const r2 = (n: number) => Math.round(n * 100) / 100;
export const isSchoolCode = (c: string) => /^SC-\d{1,6}-\d{2}$/i.test(c.trim());
export const isTeacherCode = (c: string) => /^TS-\d{1,6}-\d{2}$/i.test(c.trim());

/** "Physics" book for James (Physics)? Subject names are matched loosely ("physics", "Physics Part 1"). */
export const subjectMatches = (bookSubject: string, teacherSubject: string) => {
  const a = bookSubject.toLowerCase(), b = teacherSubject.toLowerCase();
  return !!a && !!b && (a.includes(b) || b.includes(a) || (b === 'maths' && /math/.test(a)));
};
const stdKey = (g: string) => { const m = String(g ?? '').match(/\d+/); return m ? String(Number(m[0])) : String(g ?? '').toLowerCase(); };
/** The teacher may work on this book: their subject, one of their standards (and the school's syllabus when set). */
export function teacherCovers(t: Pick<SchoolTeacher, 'subject' | 'standards'>, doc: { subject: string; grade: string; syllabus?: string }, schoolSyllabus?: string): boolean {
  if (!subjectMatches(doc.subject, t.subject)) return false;
  if (!t.standards.map(stdKey).includes(stdKey(doc.grade))) return false;
  return !schoolSyllabus || !doc.syllabus || doc.syllabus.toLowerCase().includes(schoolSyllabus.toLowerCase()) || schoolSyllabus.toLowerCase().includes(doc.syllabus.toLowerCase());
}

/** The school's and the teacher's share of one payment. */
export function commissionOf(paid: number, terms: SchoolTerms, hasTeacher: boolean) {
  return { schoolAmount: r2(paid * terms.schoolPct / 100), teacherAmount: hasTeacher ? r2(paid * terms.teacherPct / 100) : 0 };
}

export function cleanTerms(raw: unknown): SchoolTerms | string {
  const a = { ...DEFAULT_SCHOOL_TERMS, ...((raw ?? {}) as Partial<SchoolTerms>) };
  const t = { schoolPct: r2(Number(a.schoolPct)), teacherPct: r2(Number(a.teacherPct)), studentDiscountPct: r2(Number(a.studentDiscountPct)) };
  for (const [k, v] of Object.entries(t)) if (!(v >= 0 && v <= 60)) return `${k === 'schoolPct' ? 'School' : k === 'teacherPct' ? 'Teacher' : 'Student discount'} % must be between 0 and 60`;
  if (t.schoolPct + t.teacherPct + t.studentDiscountPct > 80) return 'School + teacher + discount cannot be more than 80% together';
  return t;
}

/** Scores an exam: answers[i] is the chosen option (−1 = none). */
export function scoreExam(e: Pick<Exam, 'questions'>, answers: number[]): { score: number; total: number } {
  return { score: e.questions.reduce((s, q, i) => s + (answers[i] === q.answer ? 1 : 0), 0), total: e.questions.length };
}

/** MCQ sections of a study material → exam questions (only those with options and a clear answer). */
export function questionsFromMaterial(sections: Array<{ id: string; heading: string; content?: string; options?: string[]; answer?: string }>): ExamQuestion[] {
  return sections.flatMap((s) => {
    const opts = (s.options ?? []).map((o) => String(o).trim()).filter(Boolean);
    if (opts.length < 2 || !s.answer) return [];
    const ans = String(s.answer).trim();
    const letter = /^\(?([A-Da-d])[).:]?(\s|$)/.exec(ans)?.[1];
    let i = letter ? letter.toUpperCase().charCodeAt(0) - 65 : opts.findIndex((o) => o.toLowerCase() === ans.toLowerCase() || o.toLowerCase().replace(/^\(?[a-d][).:]\s*/i, '') === ans.toLowerCase());
    if (i < 0) i = opts.findIndex((o) => ans.toLowerCase().includes(o.toLowerCase().replace(/^\(?[a-d][).:]\s*/i, '')));
    if (i < 0 || i >= opts.length) return [];
    return [{ id: s.id, q: (s.heading || s.content || '').trim().slice(0, 600), options: opts.slice(0, 6), answer: i }];
  });
}
