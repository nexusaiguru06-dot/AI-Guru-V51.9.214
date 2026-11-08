/**
 * V51.9.193 — a school teacher's sign-in: the ordinary teacher session cookie, holding `sch:<teacher id>` (a class
 * teacher's holds the class id). Only an active teacher of an active school counts.
 */
import { teacherSessionValue } from '../admin/auth';
import { getSchool, getTeacher } from './store';
import type { School, SchoolTeacher } from './rules';

export const SCHOOL_TEACHER_PREFIX = 'sch:';

export async function schoolTeacherFromRequest(req: Request): Promise<(SchoolTeacher & { school: School }) | null> {
  const v = await teacherSessionValue(req).catch(() => null);
  if (!v || !v.startsWith(SCHOOL_TEACHER_PREFIX)) return null;
  const t = await getTeacher(v.slice(SCHOOL_TEACHER_PREFIX.length));
  if (!t || t.status !== 'active') return null;
  const school = await getSchool(t.schoolId);
  return school && school.active ? { ...t, school } : null;
}
