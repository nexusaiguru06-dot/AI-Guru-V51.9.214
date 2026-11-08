import { NextResponse } from 'next/server';
import { ACCOUNT_LIMIT, ADDRESS_LIMIT, clientIp, LOCKED_MESSAGE, lockedOut, makeTeacherSession, noteMiss, TEACHER_COOKIE } from '@/lib/ai-guru/admin/auth';
import { writeHint } from '@/lib/ai-guru/net/session-hint';
import { getSchool, teacherByCode, teacherPasswordOk } from '@/lib/ai-guru/schools/store';
import { SCHOOL_TEACHER_PREFIX } from '@/lib/ai-guru/schools/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** V51.9.193 — a school teacher signs in: POST { code: 'TS-4-26', password }. */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const b = await request.json().catch(() => ({}));
  const code = String(b.code ?? '').trim().toUpperCase().replace(/^(TS)-?(\d+)-?(\d{2})$/, '$1-$2-$3');
  const acct = `tl:${ip}:${code.toLowerCase()}`;
  const anyWhere = `tl:*:${code.toLowerCase()}`; // V51.9.196: the account from every address
  if (await lockedOut(acct) || await lockedOut(`tl:${ip}`, Date.now(), ADDRESS_LIMIT) || (code && await lockedOut(anyWhere, Date.now(), ACCOUNT_LIMIT))) return NextResponse.json({ ok: false, error: LOCKED_MESSAGE }, { status: 429 });
  const t = code ? await teacherByCode(code) : null;
  if (!t || !teacherPasswordOk(t, String(b.password ?? ''))) { await noteMiss(acct); await noteMiss(`tl:${ip}`); if (code) await noteMiss(anyWhere); return NextResponse.json({ ok: false, error: 'Teacher ID or password is not right.' }, { status: 401 }); }
  if (t.status === 'pending') return NextResponse.json({ ok: false, pending: true, error: 'Your sign-up is waiting for the school office to approve it. Please try again later.' }, { status: 403 });
  const school = await getSchool(t.schoolId);
  if (t.status !== 'active' || !school?.active) return NextResponse.json({ ok: false, error: 'This teacher account is not active. Please ask the school office.' }, { status: 403 });
  const s = await makeTeacherSession(`${SCHOOL_TEACHER_PREFIX}${t.id}`);
  const res = NextResponse.json({ ok: true, name: t.name, school: school.name });
  res.cookies.set(TEACHER_COOKIE, s.value, { httpOnly: true, sameSite: 'strict', path: '/', maxAge: s.maxAge, secure: new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https' });
  writeHint(res, request, { add: 'teacher' });
  return res;
}
