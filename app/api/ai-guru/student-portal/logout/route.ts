import { NextResponse } from 'next/server';
import { STUDENT_COOKIE } from '@/lib/ai-guru/admin/auth';
import { writeHint } from '@/lib/ai-guru/net/session-hint';

export async function POST(request: Request) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STUDENT_COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
  writeHint(res, request, { remove: 'student' }); // V51.9.181 fix: the page knows at once
  return res;
}
