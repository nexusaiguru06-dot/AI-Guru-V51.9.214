import { deletePhoto } from '@/lib/ai-guru/admin/photo-store';
import { NextResponse } from 'next/server';
import { bad, denied } from '../guard';
import { ensureReferral, newId, nextStudentCode, readData, update } from '@/lib/ai-guru/admin/store';
import { hashPin, newPin } from '@/lib/ai-guru/admin/auth';
import { cleanStudent, invoicePaid, normaliseCode, publicStudent } from '@/lib/ai-guru/admin/fees';
import { assignSerial } from '@/lib/ai-guru/admin/class-content';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const d = await denied(req); if (d) return d;
  return NextResponse.json({ ok: true, ...(await (async () => { const d2 = await readData(); return { students: d2.students.map(publicStudent), pinRequests: d2.pinRequests }; })()) });
}

/** POST { student } adds; POST { action: 'import', students: [{ quizId, name }] } adds the quiz students that are not yet listed. */
export async function POST(req: Request) {
  const d = await denied(req); if (d) return d;
  const b = await req.json().catch(() => ({}));
  if (b.action === 'import') {
    const list = (Array.isArray(b.students) ? b.students : []) as Array<{ quizId?: string; name?: string }>;
    const added = await update((data) => {
      let n = 0;
      for (const s of list) {
        const quizId = String(s.quizId ?? ''), name = String(s.name ?? '').trim();
        if (!quizId || !name || data.students.some((x) => x.quizId === quizId)) continue;
        const imp = { id: newId('stu'), studentCode: nextStudentCode(data), source: 'office' as const, name: name.slice(0, 80), standard: '', admissionNo: '', guardianName: '', guardianPhone: '', address: { line1: '', area: '', district: '', state: 'Kerala', pincode: '' }, quizId, createdAt: new Date().toISOString() };
        data.students.push(imp); ensureReferral(data, imp);
        n++;
      }
      return n;
    });
    return NextResponse.json({ ok: true, added });
  }
  if (b.action === 'setReferrer') {
    // V51.9.92: the office records who brought a student in (a friend's code or a class code), e.g. for a student who
    // came through a friend but was added at the office. An empty code removes the friend. Fee bills made from now on
    // get the code's discount; commission is earned on payments recorded from now on.
    const code = normaliseCode(b.code);
    const r = await update((data) => {
      const st = data.students.find((x) => x.id === b.id);
      if (!st) return 'Student not found';
      if (!code) { delete st.referredBy; if (st.coupon && data.coupons.find((c) => c.code === st.coupon)?.ownerStudentId) delete st.coupon; return ''; }
      const cp = data.coupons.find((c) => c.code === code);
      const friend = data.students.find((x) => x.referralCode === code) ?? (cp?.ownerStudentId ? data.students.find((x) => x.id === cp.ownerStudentId) : undefined);
      const grp = cp?.ownerClassId ? data.classes.find((g) => g.id === cp.ownerClassId) : undefined;
      if (!friend && !grp && !cp) return 'No student, class or coupon has this code';
      if (friend?.id === st.id) return 'A student cannot be their own referral';
      if (friend) st.referredBy = friend.id;
      if (grp && st.classId !== grp.id) { st.classId = grp.id; delete st.classSerial; assignSerial(grp, st); }
      if (cp) st.coupon = cp.code;
      st.signupCode ??= code;
      return '';
    });
    return r ? bad(r) : NextResponse.json({ ok: true });
  }
  if (b.action === 'setPin' || b.action === 'clearPin') {
    const pin = b.action === 'setPin' ? (/^\d{4,8}$/.test(String(b.pin ?? '')) ? String(b.pin) : newPin()) : '';
    const r = await update((data) => {
      const st = data.students.find((x) => x.id === b.id);
      if (!st) return 'Student not found';
      if (b.action === 'clearPin') { delete st.login; return ''; }
      if (!st.studentCode) st.studentCode = nextStudentCode(data);
      st.login = hashPin(pin);
      data.pinRequests = data.pinRequests.filter((r) => r.studentId !== st.id);
      if (!st.quizId) st.quizId = `student:${st.id}`;
      return '';
    });
    return r ? bad(r) : NextResponse.json({ ok: true, ...(pin ? { pin } : {}) });
  }
  const { value, problems } = cleanStudent(b.student ?? {});
  if (problems.length) return bad(problems);
  const s = await update((data) => {
    if (value.admissionNo && data.students.some((o) => o.admissionNo.toLowerCase() === value.admissionNo.toLowerCase())) return 'Another student already has that admission number';
    const x = { ...value, id: newId('stu'), studentCode: nextStudentCode(data), source: 'office' as const, createdAt: new Date().toISOString() }; data.students.push(x); ensureReferral(data, x); return x;
  });
  return typeof s === 'string' ? bad(s, 409) : NextResponse.json({ ok: true, student: publicStudent(s) });
}

export async function PUT(req: Request) {
  const d = await denied(req); if (d) return d;
  const b = await req.json().catch(() => ({}));
  const { value, problems } = cleanStudent(b.student ?? {});
  if (problems.length) return bad(problems);
  const r = await update((data) => {
    const i = data.students.findIndex((s) => s.id === b.student?.id);
    if (i < 0) return null;
    if (value.admissionNo && data.students.some((o, k) => k !== i && o.admissionNo.toLowerCase() === value.admissionNo.toLowerCase())) return 'dup';
    data.students[i] = { ...data.students[i], ...value, quizId: value.quizId ?? data.students[i].quizId };
    return data.students[i];
  });
  return r === 'dup' ? bad('Another student already has that admission number', 409) : r ? NextResponse.json({ ok: true, student: publicStudent(r) }) : bad('Student not found', 404);
}

/** DELETE ?id= — refused while the student has recorded payments (their receipts must stay). */
export async function DELETE(req: Request) {
  const d = await denied(req); if (d) return d;
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const r = await update((data) => {
    if (data.invoices.some((i) => i.studentId === id && invoicePaid(i) > 0)) return 'paid';
    const n = data.students.length;
    data.students = data.students.filter((s) => s.id !== id);
    data.invoices = data.invoices.filter((i) => i.studentId !== id);
    data.yearly = data.yearly.filter((r) => r.studentId !== id); data.monthly = data.monthly.filter((r) => r.studentId !== id); // V51.9.94
    return data.students.length < n ? 'ok' : 'none';
  });
  if (r === 'ok') await deletePhoto(id); // V51.9.99: the photo goes with the record
  return r === 'ok' ? NextResponse.json({ ok: true }) : bad(r === 'paid' ? 'This student has payments on record, so they cannot be deleted' : 'Student not found', r === 'paid' ? 409 : 404);
}
