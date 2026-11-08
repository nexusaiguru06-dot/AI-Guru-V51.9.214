import { NextResponse } from 'next/server';
import { schoolTeacherFromRequest } from '@/lib/ai-guru/schools/session';
import { teacherBooks, teacherStudents } from '@/lib/ai-guru/schools/teacher-view';
import { listAudit } from '@/lib/ai-guru/schools/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** V51.9.193 — the school teacher's portal: who they are, their books with materials, their students, their record. */
export async function GET(request: Request) {
  const t = await schoolTeacherFromRequest(request);
  if (!t) return NextResponse.json({ ok: false }, { status: 401, headers: { 'cache-control': 'no-store' } });
  const { login: _l, school, ...me } = t;
  const [books, students, log] = await Promise.all([teacherBooks(t, school), teacherStudents(t), listAudit()]);
  return NextResponse.json({ ok: true, teacher: me, school: { id: school.id, code: school.code, name: school.name, syllabus: school.syllabus }, books, students, log: log.filter((e) => e.teacherId === t.id).slice(0, 100) }, { headers: { 'cache-control': 'no-store' } });
}
