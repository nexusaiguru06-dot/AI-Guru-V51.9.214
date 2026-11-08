import { NextResponse } from 'next/server';
import { ADDRESS_LIMIT, clientIp, hashPin, LOCKED_MESSAGE, lockedOut, makeStudentSession, noteMiss, STUDENT_COOKIE } from '@/lib/ai-guru/admin/auth';
import { moveVisitorRecords } from '@/lib/ai-guru/quiz/server-store';
import { ensureReferral, newId, nextStudentCode, readData, update } from '@/lib/ai-guru/admin/store';
import { addressProblems, cleanAddress } from '@/lib/ai-guru/admin/address';
import { assignSerial } from '@/lib/ai-guru/admin/class-content';
import { cleanEmail, couponProblem, normaliseCode, signupProblems, type Coupon, type Student } from '@/lib/ai-guru/admin/fees';
import { isSchoolCode, isTeacherCode } from '@/lib/ai-guru/schools/rules';
import { getSchool, schoolByCode, teacherByCode } from '@/lib/ai-guru/schools/store';
import { isCountry, isMotherTongue } from '@/lib/ai-guru/student/signup-options';
import { MEDIUMS, SYLLABI } from '@/lib/ai-guru/library/catalog';
import { writeHint } from '@/lib/ai-guru/net/session-hint';
import { notifyJoinedUnder, sendKeyWelcome } from '@/lib/ai-guru/messages/notify';
import { istToday } from '@/lib/ai-guru/admin/enrolment';
import { ensurePartBills } from '@/lib/ai-guru/admin/part-plan';

export const dynamic = 'force-dynamic';

const clip = (x: unknown, n: number) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * POST { name, standard, syllabus, medium, school, state, district, place, password, confirm, coupon?, fromLink? } — a student makes their own
 * account and is signed in at once. The reply carries the new Student ID (ST-42-26), which is what they sign in with next time.
 * V51.9.92: a code that came from a friend's link never blocks sign-up: if it gives no discount now (expired, affiliates
 * switched off) the student still signs up and is still counted as that friend's referral. A typed code must be right.
 * A new student studies the free part of every book (the trial) until the first payment is recorded.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  // V51.9.182 (newcomer review): only FAILED sign-ups count, with a limit high enough for a class signing up together
  if (await lockedOut(`u:${ip}`, Date.now(), ADDRESS_LIMIT)) return NextResponse.json({ ok: false, error: LOCKED_MESSAGE }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  const fail = async (body: Record<string, unknown>, status = 400) => { await noteMiss(`u:${ip}`); return NextResponse.json({ ok: false, ...body }, { status }); };
  // the parent's mobile (optional): the way a child who forgets the Student ID or password is found again
  const guardianPhone = String(b.guardianPhone ?? '').replace(/[^\d+]/g, '').slice(0, 15);
  const f = { syllabus: SYLLABI.some(([v]) => v === b.syllabus) ? String(b.syllabus) : '', medium: MEDIUMS.some(([v]) => v === b.medium) ? String(b.medium) : '', name: clip(b.name, 80), standard: clip(b.standard, 8), school: clip(b.school, 100), state: clip(b.state, 60), district: clip(b.district, 60), place: clip(b.place, 80), password: String(b.password ?? ''), confirm: String(b.confirm ?? '') };
  const code = normaliseCode(b.coupon);
  // V51.9.193: a contracted school's ID (SC-1-26) or its teacher's ID (TS-4-26) links the student to that school
  let schoolLink: Student['schoolLink'];
  const typed = String(b.coupon ?? '').trim().toUpperCase().replace(/\s+/g, '').replace(/^(SC|TS)-?(\d+)-?(\d{2})$/, '$1-$2-$3');
  if (isSchoolCode(typed) || isTeacherCode(typed)) {
    const t = isTeacherCode(typed) ? await teacherByCode(typed) : null;
    const sc = t ? await getSchool(t.schoolId) : await schoolByCode(typed);
    if (!sc || !sc.active || (t && t.status !== 'active')) return fail({ error: 'That school ID or teacher ID is not right, or not active yet. Ask your teacher.' });
    if (!f.school) f.school = sc.name; // the school's name is known from its ID
    schoolLink = { schoolId: sc.id, schoolCode: sc.code, schoolName: sc.name, ...(t ? { teacherId: t.id, teacherName: t.name } : {}), discountPct: sc.terms.studentDiscountPct };
  }
  const problems = signupProblems(f);
  // Syllabus and medium are asked on the sign-up page; an older app that does not send them still works (the library asks).
  const addr = cleanAddress({ line1: '', area: f.place, state: f.state, district: f.district, pincode: '' });
  // V51.9.184: country, e-mail (optional) and mother tongue. Outside India the state and district are typed, not chosen.
  const country = isCountry(String(b.country ?? '')) ? String(b.country) : 'India';
  const email = cleanEmail(b.email);
  const motherTongue = String(b.motherTongue ?? '').trim();
  if (b.email && String(b.email).trim() && !email) problems.push('The e-mail address does not look right');
  if (b.motherTongue !== undefined && !isMotherTongue(motherTongue)) problems.push('Choose the mother tongue');
  if (country === 'India') problems.push(...addressProblems(addr, true).filter((p) => !/PIN/.test(p)));
  else { if (!addr.area) problems.push('Village or town is needed'); if (!addr.state) problems.push('State / emirate / region is needed'); }
  if (guardianPhone && guardianPhone.replace(/\D/g, '').length < 10) problems.push("The parent's mobile number needs 10 digits");
  if (problems.length) return fail({ error: problems.join('. ') });
  const fromLink = b.fromLink === true;
  const r = await update((data) => {
    if (data.settings.signupNeedsCoupon && !code) return 'A coupon code is needed to sign up';
    let cp: Coupon | undefined;
    let note = '';
    if (code && !schoolLink) {
      const found = data.coupons.find((c) => c.code === code);
      const why = couponProblem(found);
      if (!why) cp = found;
      else if (!fromLink || data.settings.signupNeedsCoupon) return why;
      else note = `${why}, so no discount was added. You are still counted as your friend's invite.`;
    }
    // V51.9.182: two real children can share a name, standard and school. The page asks "Is this you?" once; the
    // student can then sign in, ask for their Student ID, or go on as a different student.
    if (b.differentStudent !== true && data.students.some((s) => s.source === 'self' && s.name.toLowerCase() === f.name.toLowerCase() && (s.school ?? '').toLowerCase() === f.school.toLowerCase() && s.standard === f.standard)) return 'duplicate';
    if (cp) cp.used++;
    // A personal affiliate code makes the new student that sender's referral (never their own). The referral is kept even
    // when the code gave no discount today, so the admin sees who brought the student in.
    const referredBy = cp?.ownerStudentId ?? (code ? data.students.find((s) => s.referralCode === code)?.id : undefined);
    // A class or centre code puts the student in that group.
    const classId = cp?.ownerClassId && data.classes.some((g) => g.id === cp!.ownerClassId && g.active) ? cp.ownerClassId : undefined;
    const grp = classId ? data.classes.find((x) => x.id === classId) : undefined;
    const st = { id: newId('stu'), studentCode: nextStudentCode(data), source: 'self' as const, name: f.name, standard: f.standard, syllabus: f.syllabus, medium: f.medium, school: f.school, admissionNo: '', guardianName: '', guardianPhone, address: addr, country: country === 'India' ? undefined : country, email: email || undefined, motherTongue: motherTongue || undefined, coupon: cp?.code, signupCode: code || undefined, referredBy, classId, classSerial: undefined as number | undefined, login: hashPin(f.password), quizId: '', createdAt: new Date().toISOString() };
    st.quizId = `student:${st.id}`;
    if (grp) assignSerial(grp, st);
    if (schoolLink) { (st as Student).schoolLink = schoolLink; if (!st.school) st.school = schoolLink.schoolName; }
    data.students.push(st);
    ensureReferral(data, st); // the new student gets an affiliate link of their own
    return { st, note, grp };
  });
  if (r === 'duplicate') return fail({ duplicate: true, error: 'A student with this name, standard and school already has an account.' }, 409);
  if (typeof r === 'string') return fail({ error: r });
  // V51.9.185: "Congratulations! … joined with your link" to the student who brought this one in
  if (r.st.referredBy) await notifyJoinedUnder(await readData(), r.st).catch(() => undefined);
  await update((d) => { ensurePartBills(d, r.st.id); }).catch(() => undefined); // V51.9.191: the part bills (Part 2 due when the trial ends …)
  await sendKeyWelcome(await readData(), r.st, istToday()).catch(() => undefined); // V51.9.188: free trial doubts + how to add a key
  const s = await makeStudentSession(r.st.id);
  // the quizzes done on this device before signing up move to the new account (visitor ids only)
  const moved = await moveVisitorRecords(String(b.visitorId ?? ''), r.st.quizId!).catch(() => 0);
  const res = NextResponse.json({ ok: true, studentCode: r.st.studentCode, quizId: r.st.quizId, name: r.st.name, className: r.grp?.name, teacher: r.grp?.teacherName || undefined, moved, note: r.note || undefined });
  res.cookies.set(STUDENT_COOKIE, s.value, { httpOnly: true, sameSite: 'strict', path: '/', maxAge: s.maxAge, secure: request.headers.get('x-forwarded-proto') === 'https' || new URL(request.url).protocol === 'https:' });
  writeHint(res, request, { add: 'student' }); // V51.9.181 fix: the page knows at once
  return res;
}
