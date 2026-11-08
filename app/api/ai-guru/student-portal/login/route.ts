import { NextResponse } from 'next/server';
import { ACCOUNT_LIMIT, ADDRESS_LIMIT, clientIp, LOCKED_MESSAGE, lockedOut, makeStudentSession, noteMiss, STUDENT_COOKIE, verifyPin } from '@/lib/ai-guru/admin/auth';
import { readData } from '@/lib/ai-guru/admin/store';
import { writeHint } from '@/lib/ai-guru/net/session-hint';
import { moveVisitorRecords } from '@/lib/ai-guru/quiz/server-store';

export const dynamic = 'force-dynamic';

/** POST { admissionNo, pin } — the student's own sign-in: the Student ID (ST-42-26) or the admission number, and the password. Wrong details always get the same bare 401. */
export async function POST(request: Request) {
  const ip = clientIp(request);
  let adm = '', pin = '';
  let visitorId = '';
  try { const b = await request.json(); adm = String(b?.admissionNo ?? '').trim().slice(0, 30); pin = String(b?.pin ?? '').slice(0, 30); visitorId = String(b?.visitorId ?? ''); } catch { /* empty */ }
  // V51.9.182 (newcomer review): wrong tries lock that ACCOUNT from this address (5), and the address as a whole only at
  // 60 — a class of 40 on one school Wi-Fi no longer locks itself out after five typos.
  const acct = `s:${ip}:${adm.toLowerCase()}`;
  const anyWhere = `s:*:${adm.toLowerCase()}`; // V51.9.196: the account from every address
  if (await lockedOut(acct) || await lockedOut(`s:${ip}`, Date.now(), ADDRESS_LIMIT) || (adm && await lockedOut(anyWhere, Date.now(), ACCOUNT_LIMIT))) return NextResponse.json({ ok: false, error: LOCKED_MESSAGE }, { status: 429 });
  const st = adm && pin ? (await readData()).students.find((s) => [s.admissionNo, s.studentCode].some((c) => c && c.toLowerCase() === adm.toLowerCase())) : undefined;
  if (!st || !verifyPin(pin, st.login)) { await noteMiss(acct); await noteMiss(`s:${ip}`); if (adm) await noteMiss(anyWhere); return NextResponse.json({ ok: false }, { status: 401 }); }
  const s = await makeStudentSession(st.id);
  await moveVisitorRecords(visitorId, st.quizId ?? `student:${st.id}`).catch(() => 0); // V51.9.182: this device's visitor quizzes join the account
  const res = NextResponse.json({ ok: true, student: true, quizId: st.quizId ?? `student:${st.id}`, name: st.name, studentCode: st.studentCode ?? '',
    // V51.9.187: until a textbook is downloaded, sign-in opens "Download your study materials"
    books: (st.library ?? []).length, next: (st.library ?? []).length ? '/ai-guru/student' : '/ai-guru/student/library?welcome=1' });
  res.cookies.set(STUDENT_COOKIE, s.value, { httpOnly: true, sameSite: 'strict', path: '/', maxAge: s.maxAge, secure: request.headers.get('x-forwarded-proto') === 'https' || new URL(request.url).protocol === 'https:' });
  writeHint(res, request, { add: 'student' }); // V51.9.181 fix: the page knows at once
  return res;
}
