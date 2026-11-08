/** V51.9.153 — who is who in the messages: students, teachers (one per teacher code) and their students. Server only. */
import type { AdminData } from '../admin/store';
import type { ClassGroup } from '../admin/groups';
import type { Student } from '../admin/fees';
import type { Party } from './core';

export const teacherKeyOf = (g: ClassGroup) => g.teacherCode || `class-${g.id}`;
export const studentParty = (s: Student): Party => ({ role: 'student', id: s.id, name: s.name, code: s.studentCode || s.admissionNo || undefined });
export const teacherParty = (g: ClassGroup): Party => ({ role: 'teacher', id: teacherKeyOf(g), name: g.teacherName || g.name, code: g.teacherCode });

/** Every class that belongs to this teacher (same teacher code; or just this class). */
export const classesOfTeacher = (d: AdminData, key: string) => d.classes.filter((c) => teacherKeyOf(c) === key);
/** The teacher's students, by roll number. */
export const studentsOfTeacher = (d: AdminData, key: string) => {
  const ids = new Set(classesOfTeacher(d, key).map((c) => c.id));
  return d.students.filter((s) => s.classId && ids.has(s.classId)).sort((a, b) => (a.classSerial ?? 1e9) - (b.classSerial ?? 1e9));
};
/** The student's teacher (through the class they joined), if any. */
export function teacherOfStudent(d: AdminData, s: Student): { g: ClassGroup; party: Party } | null {
  const g = s.classId ? d.classes.find((c) => c.id === s.classId) : undefined;
  return g ? { g, party: teacherParty(g) } : null;
}
/** One row per teacher (for the office's "new message" search). */
export function allTeachers(d: AdminData): Party[] {
  const seen = new Map<string, Party>();
  for (const g of d.classes) if (!seen.has(teacherKeyOf(g))) seen.set(teacherKeyOf(g), teacherParty(g));
  return [...seen.values()];
}
