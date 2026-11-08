import { NextResponse } from 'next/server';
import { ADDRESS_LIMIT, clientIp, LOCKED_MESSAGE, lockedOut, noteMiss } from '@/lib/ai-guru/admin/auth';
import { STANDARDS, SUBJECTS, isSchoolCode, type SchoolTeacher } from '@/lib/ai-guru/schools/rules';
import { audit, listTeachers, newRowId, nextSchoolCode, saveTeacher, schoolByCode, teacherPassword } from '@/lib/ai-guru/schools/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const clip = (x: unknown, n: number) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * V51.9.193 — a teacher of a contracted school signs up: POST { schoolCode, name, phone, email?, subject, standards[],
 * password, confirm }. They get their teacher ID (TS-4-26) at once; they can sign in when the school office approves.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (await lockedOut(`ts:${ip}`, Date.now(), ADDRESS_LIMIT)) return NextResponse.json({ ok: false, error: LOCKED_MESSAGE }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  const fail = async (error: string, status = 400) => { await noteMiss(`ts:${ip}`); return NextResponse.json({ ok: false, error }, { status }); };
  const code = String(b.schoolCode ?? '').trim().toUpperCase().replace(/^(SC)-?(\d+)-?(\d{2})$/, '$1-$2-$3');
  if (!isSchoolCode(code)) return fail('The school ID looks like SC-1-26. Ask your school office.');
  const school = await schoolByCode(code);
  if (!school || !school.active) return fail('That school ID is not right, or the school is not active. Ask your school office.');
  const name = clip(b.name, 80), phone = String(b.phone ?? '').replace(/[^\d+]/g, '').slice(0, 15), email = clip(b.email, 120).toLowerCase();
  const subject = SUBJECTS.includes(String(b.subject)) ? String(b.subject) : '';
  const standards = Array.isArray(b.standards) ? [...new Set(b.standards.map(String).filter((s: string) => STANDARDS.includes(s)))] as string[] : [];
  const pw = String(b.password ?? '');
  const problems = [!name && 'Your name is needed', phone.replace(/\D/g, '').length < 10 && 'A 10-digit phone number is needed', email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) && 'The e-mail address does not look right', !subject && 'Choose your subject', !standards.length && 'Choose the standards you teach', pw.length < 6 && 'The password needs at least 6 characters', pw !== String(b.confirm ?? '') && 'The two passwords are not the same'].filter(Boolean) as string[];
  if (problems.length) return NextResponse.json({ ok: false, error: problems.join('. ') }, { status: 400 });
  if ((await listTeachers(school.id)).some((t) => t.status !== 'off' && t.name.toLowerCase() === name.toLowerCase() && t.subject === subject)) return NextResponse.json({ ok: false, error: `${name} (${subject}) has already signed up at ${school.name}. Sign in with your teacher ID, or ask the office.` }, { status: 409 });
  const t: SchoolTeacher = { id: newRowId('tch'), code: await nextSchoolCode('TS'), schoolId: school.id, name, phone, email, subject, standards: standards.sort((x, y) => Number(x) - Number(y)), status: 'pending', login: teacherPassword(pw), createdAt: new Date().toISOString() };
  await saveTeacher(t);
  await audit({ schoolId: school.id, teacherId: t.id, action: 'signup', what: `${name} signed up · ${subject} · Std ${t.standards.join(', ')}` });
  return NextResponse.json({ ok: true, teacher: { code: t.code, name, subject, standards: t.standards, status: t.status }, school: { name: school.name, code: school.code } });
}
