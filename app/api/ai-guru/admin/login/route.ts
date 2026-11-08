import { NextResponse } from 'next/server';
import { checkCredentials, clientIp, COOKIE, lockedOut, makeSession, noteMiss } from '@/lib/ai-guru/admin/auth';
import { writeHint } from '@/lib/ai-guru/net/session-hint';

export const dynamic = 'force-dynamic';

/**
 * POST { username, password } — called by the sign-in box of every portal.
 * Admin credentials → { ok: true, admin: true } and the session cookie. Anything else → { ok: false } and nothing more,
 * so a teacher or parent typing here learns nothing about an admin.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (await lockedOut(ip)) return NextResponse.json({ ok: false, error: 'Too many tries. Wait a few minutes.' }, { status: 429 });
  let u = '', p = '';
  try { const b = await request.json(); u = String(b?.username ?? '').slice(0, 100); p = String(b?.password ?? '').slice(0, 200); } catch { /* empty */ }
  if (!u || !p || !(await checkCredentials(u, p))) {
    await noteMiss(ip);
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const s = await makeSession();
  const res = NextResponse.json({ ok: true, admin: true });
  const secure = request.headers.get('x-forwarded-proto') === 'https' || new URL(request.url).protocol === 'https:';
  res.cookies.set(COOKIE, s.value, { httpOnly: true, sameSite: 'strict', path: '/', maxAge: s.maxAge, secure });
  writeHint(res, request, { add: 'admin' }); // V51.9.181 fix: the page knows at once
  return res;
}
