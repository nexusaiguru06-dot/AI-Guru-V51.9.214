import { NextResponse } from 'next/server';
import { ADDRESS_LIMIT, clientIp, LOCKED_MESSAGE, lockedOut, noteMiss } from '@/lib/ai-guru/admin/auth';
import { readData } from '@/lib/ai-guru/admin/store';
import { couponLabel, couponProblem, normaliseCode } from '@/lib/ai-guru/admin/fees';
import { isSchoolCode, isTeacherCode } from '@/lib/ai-guru/schools/rules';
import { getSchool, schoolByCode, teacherByCode } from '@/lib/ai-guru/schools/store';

export const dynamic = 'force-dynamic';

/** GET ?code= — the sign-up page asks whether a coupon works (and whether one is required). Wrong guesses count against the caller. */
export async function GET(request: Request) {
  const ip = clientIp(request);
  const data = await readData();
  const required = data.settings.signupNeedsCoupon;
  const code = normaliseCode(new URL(request.url).searchParams.get('code'));
  if (!code) { const a = data.settings.access; return NextResponse.json({ ok: true, required, access: { enabled: a.enabled, freeParts: a.freeParts } }); }
  if (await lockedOut(`c:${ip}`, Date.now(), ADDRESS_LIMIT)) return NextResponse.json({ ok: false, error: LOCKED_MESSAGE }, { status: 429 }); // V51.9.182: a class checks one code together
  // V51.9.193: a contracted school's ID or its teacher's ID
  const typed = String(new URL(request.url).searchParams.get('code') ?? '').trim().toUpperCase().replace(/\s+/g, '').replace(/^(SC|TS)-?(\d+)-?(\d{2})$/, '$1-$2-$3');
  if (isSchoolCode(typed) || isTeacherCode(typed)) {
    const t = isTeacherCode(typed) ? await teacherByCode(typed) : null;
    const sc = t ? await getSchool(t.schoolId) : await schoolByCode(typed);
    if (!sc || !sc.active || (t && t.status !== 'active')) { await noteMiss(`c:${ip}`); return NextResponse.json({ ok: true, required, valid: false, error: 'That school ID or teacher ID is not right, or not active yet. Ask your teacher.' }); }
    return NextResponse.json({ ok: true, required, valid: true, label: `Joining ${sc.name}${t ? ` with ${t.name} (${t.subject})` : ''}${sc.terms.studentDiscountPct ? ` · ${sc.terms.studentDiscountPct}% off the part fees` : ''}`, school: sc.name });
  }
  const c = data.coupons.find((x) => x.code === code);
  const why = couponProblem(c);
  if (why) { await noteMiss(`c:${ip}`); return NextResponse.json({ ok: true, required, valid: false, error: why }); }
  const owner = c!.ownerStudentId ? data.students.find((x) => x.id === c!.ownerStudentId) : undefined;
  const grp = c!.ownerClassId ? data.classes.find((g) => g.id === c!.ownerClassId) : undefined;
  // V51.9.182 (newcomer review): a class code names the class and the teacher; a stopped class is said plainly
  if (grp && !grp.active) return NextResponse.json({ ok: true, required, valid: false, error: `${grp.name} is not taking new students right now. Ask your teacher.` });
  if (grp) return NextResponse.json({ ok: true, required, valid: true, label: `Joining ${grp.name}${grp.teacherName ? ` with ${grp.teacherName}` : ''}${c!.value > 0 ? ` · ${couponLabel(c!)}` : ''}`, group: grp.name, teacher: grp.teacherName || undefined });
  return NextResponse.json({ ok: true, required, valid: true, label: owner ? `Referred by ${owner.name.split(' ')[0]}${c!.value > 0 ? ` · ${couponLabel(c!)}` : ''}` : couponLabel(c!), referrer: owner?.name.split(' ')[0] });
}
