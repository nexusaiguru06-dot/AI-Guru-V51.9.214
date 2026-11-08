import { NextResponse } from 'next/server';
import { isAdmin, makeTeacherSession, TEACHER_COOKIE, teacherFromRequest } from '@/lib/ai-guru/admin/auth';
import { openClass } from '@/lib/ai-guru/admin/teacher-auth';
import { writeHint } from '@/lib/ai-guru/net/session-hint';

export const dynamic = 'force-dynamic';

/** V51.9.173 — the teacher portal's sign-in. GET: am I signed in? POST { code, key }: sign in. DELETE: sign out. */
export async function GET(request: Request) {
  const admin = await isAdmin(request);
  const classId = admin ? null : await teacherFromRequest(request);
  return NextResponse.json({ ok: true, signedIn: admin || !!classId, admin }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: Request) {
  let b: { code?: unknown; key?: unknown } = {};
  try { b = await request.json(); } catch { /* empty */ }
  const o = await openClass(request, b);
  if ('error' in o) return o.error;
  const s = await makeTeacherSession(o.g.id);
  const res = NextResponse.json({ ok: true, className: o.g.name ?? null });
  res.cookies.set(TEACHER_COOKIE, s.value, { httpOnly: true, sameSite: 'strict', path: '/', maxAge: s.maxAge, secure: new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https' });
  writeHint(res, request, { add: 'teacher' }); // V51.9.181 fix: the page knows at once
  return res;
}

export async function DELETE(request: Request) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TEACHER_COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
  writeHint(res, request, { remove: 'teacher' }); // V51.9.181 fix: the page knows at once
  return res;
}
