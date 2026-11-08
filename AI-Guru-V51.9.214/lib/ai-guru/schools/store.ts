/**
 * V51.9.193 — the schools' own records (server only), kept apart from the ordinary students' data:
 *   data/ai-guru/schools/{schools,teachers,commissions,audit,exams,attempts,starts}/…  and  counters.json
 */
import { docs } from '../storage';
import { rowKey } from '../storage/rows';
import { hashPin, verifyPin } from '../admin/auth';
import { yearTag } from '../admin/member-codes';
import type { AuditEntry, Exam, ExamAttempt, School, SchoolCommission, SchoolTeacher } from './rules';

const ROOT = 'data/ai-guru/schools';
const dir = (k: string) => `${ROOT}/${k}`;
const key = (k: string, id: string) => rowKey(dir(k), id);
const all = async <T extends { id: string }>(k: string) => (await docs.values<T>(dir(k))).filter((x) => x && x.id);
export const newRowId = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** SC-1-26 (schools) and TS-1-26 (school teachers): numbered per Indian-time year, never given twice. */
export async function nextSchoolCode(kind: 'SC' | 'TS', now = new Date()): Promise<string> {
  const yy = yearTag(now);
  return docs.update<Record<string, number>, string>(`${ROOT}/counters.json`, (cur) => {
    const c = { ...(cur ?? {}) }; const k = `${kind}-${yy}`; c[k] = (c[k] ?? 0) + 1;
    return { value: c, result: `${kind}-${c[k]}-${yy}` };
  });
}

export const listSchools = () => all<School>('schools').then((l) => l.sort((a, b) => a.name.localeCompare(b.name)));
export const getSchool = (id: string) => docs.get<School>(key('schools', id));
export const saveSchool = (s: School) => docs.put(key('schools', s.id), s);
export const schoolByCode = async (code: string) => (await listSchools()).find((s) => s.code.toLowerCase() === code.trim().toLowerCase()) ?? null;

export const listTeachers = (schoolId?: string) => all<SchoolTeacher>('teachers').then((l) => l.filter((t) => !schoolId || t.schoolId === schoolId).sort((a, b) => a.name.localeCompare(b.name)));
export const getTeacher = (id: string) => docs.get<SchoolTeacher>(key('teachers', id));
export const saveTeacher = (t: SchoolTeacher) => docs.put(key('teachers', t.id), t);
export const teacherByCode = async (code: string) => (await listTeachers()).find((t) => t.code.toLowerCase() === code.trim().toLowerCase()) ?? null;
export const teacherPassword = (pin: string) => hashPin(pin);
export const teacherPasswordOk = (t: SchoolTeacher, pin: string) => verifyPin(pin, t.login);

export const listCommissions = () => all<SchoolCommission>('commissions').then((l) => l.sort((a, b) => b.date.localeCompare(a.date)));
export const saveCommission = (c: SchoolCommission) => docs.put(key('commissions', c.id), c);
/** Keeps one line per payment (a payment is never counted twice). */
export async function addCommissionOnce(c: SchoolCommission): Promise<boolean> {
  return docs.update<SchoolCommission, boolean>(key('commissions', c.id), (cur) => (cur ? { value: cur, result: false } : { value: c, result: true }));
}

export async function audit(e: Omit<AuditEntry, 'id' | 'at'>): Promise<void> {
  const row: AuditEntry = { ...e, id: newRowId('aud'), at: new Date().toISOString() };
  await docs.put(key('audit', row.id), row);
}
export const listAudit = () => all<AuditEntry>('audit').then((l) => l.sort((a, b) => b.at.localeCompare(a.at)));

export const listExams = () => all<Exam>('exams').then((l) => l.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
export const getExam = (id: string) => docs.get<Exam>(key('exams', id));
export const saveExam = (e: Exam) => docs.put(key('exams', e.id), e);
export const attemptKey = (examId: string, studentId: string) => key('attempts', `${examId}__${studentId}`);
export const getAttempt = (examId: string, studentId: string) => docs.get<ExamAttempt>(attemptKey(examId, studentId));
export const listAttempts = (examId?: string) => all<ExamAttempt>('attempts').then((l) => l.filter((a) => !examId || a.examId === examId));
/** V51.9.195 — when this student first opened the exam (kept once, on the server, so reopening does not restart the clock). */
export async function startAttempt(examId: string, studentId: string, now = new Date().toISOString()): Promise<string> {
  return docs.update<{ id: string; startedAt: string }, string>(key('starts', `${examId}__${studentId}`), (cur) => (cur ? { value: cur, result: cur.startedAt } : { value: { id: `${examId}__${studentId}`, startedAt: now }, result: now }));
}
export const getStart = async (examId: string, studentId: string) => (await docs.get<{ startedAt: string }>(key('starts', `${examId}__${studentId}`)))?.startedAt ?? null;

/** One attempt per student per exam. */
export async function submitAttemptOnce(a: ExamAttempt): Promise<ExamAttempt | null> {
  return docs.update<ExamAttempt, ExamAttempt | null>(attemptKey(a.examId, a.studentId), (cur) => (cur ? { value: cur, result: null } : { value: a, result: a }));
}
