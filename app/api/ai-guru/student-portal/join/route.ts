import { NextResponse } from 'next/server';
import { ADDRESS_LIMIT, clientIp, LOCKED_MESSAGE, lockedOut, noteMiss, studentFromRequest } from '@/lib/ai-guru/admin/auth';
import { update } from '@/lib/ai-guru/admin/store';
import { assignSerial } from '@/lib/ai-guru/admin/class-content';
import { normaliseCode } from '@/lib/ai-guru/admin/fees';

export const dynamic = 'force-dynamic';

/**
 * V51.9.182 (newcomer review) — POST { code }: a signed-in student joins their teacher's class with the class code, from
 * the dashboard, Teachers Notes or an invite link. Before this, the class could only be set at sign-up or by the office,
 * so a student who signed up without the code was stuck (or made a second account).
 * Only class and centre codes join; a wrong code counts against the address like the code check on the sign-up page.
 */
export async function POST(request: Request) {
  const id = await studentFromRequest(request);
  if (!id) return NextResponse.json({ ok: false, error: 'Please sign in first.' }, { status: 401 });
  const ip = clientIp(request);
  if (await lockedOut(`c:${ip}`, Date.now(), ADDRESS_LIMIT)) return NextResponse.json({ ok: false, error: LOCKED_MESSAGE }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  const code = normaliseCode(b.code);
  const r = await update((data) => {
    const st = data.students.find((s) => s.id === id);
    if (!st) return { error: 'Please sign in again.' };
    const cp = code ? data.coupons.find((c) => c.code === code) : undefined;
    const grp = cp?.ownerClassId ? data.classes.find((g) => g.id === cp.ownerClassId) : undefined;
    if (!grp) return { error: 'This is not a class code. Check it with your teacher.', miss: true };
    if (!grp.active) return { error: `${grp.name} is not taking new students right now. Ask your teacher.` };
    if (st.classId !== grp.id) { st.classId = grp.id; delete st.classSerial; assignSerial(grp, st); }
    st.coupon ??= cp!.code;
    st.signupCode ??= code;
    // V51.9.182 (re-check): a class for another standard still joins (a centre may mix standards) but the student is told
    const otherStandard = grp.standard && st.standard && String(grp.standard) !== String(st.standard) ? String(grp.standard) : undefined;
    return { className: grp.name, teacher: grp.teacherName || undefined, serial: st.classSerial, classStandard: otherStandard };
  });
  if ('error' in r) { if (r.miss) await noteMiss(`c:${ip}`); return NextResponse.json({ ok: false, error: r.error }, { status: 400 }); }
  return NextResponse.json({ ok: true, ...r });
}
