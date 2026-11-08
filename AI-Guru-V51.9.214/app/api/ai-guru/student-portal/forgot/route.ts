import { NextResponse } from 'next/server';
import { clientIp, LOCKED_MESSAGE, lockedOut, noteMiss } from '@/lib/ai-guru/admin/auth';
import { readData, update } from '@/lib/ai-guru/admin/store';

export const dynamic = 'force-dynamic';

const last10 = (s: string) => s.replace(/\D/g, '').slice(-10);

/**
 * POST { admissionNo (or Student ID), guardianPhone (the parent's mobile, or the student's full name) } — "I forgot my password". There is no e-mail or SMS yet, so a matching request is
 * put in front of the admin (Students tab), who makes a new PIN and hands it over. The answer is always the same,
 * so nobody can use this to find out which admission numbers exist.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  // V51.9.182: a class may ask together, so the address gets 20 requests per 15 minutes (it was 5)
  if (await lockedOut(`f:${ip}`, Date.now(), 20)) return NextResponse.json({ ok: false, error: LOCKED_MESSAGE }, { status: 429 });
  let adm = '', phone = '', who = '', standard = '', school = '', byPhone = false;
  try { const b = await request.json(); adm = String(b?.admissionNo ?? '').trim().slice(0, 30); who = String(b?.guardianPhone ?? '').trim().slice(0, 80); phone = last10(who); standard = String(b?.standard ?? '').trim().slice(0, 8); school = String(b?.school ?? '').trim().slice(0, 100); byPhone = b?.byPhone === true; } catch { /* empty */ }
  await noteMiss(`f:${ip}`); // every request counts, so this cannot be used to guess phone numbers
  const norm = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!adm && byPhone && phone.length === 10) {
    // V51.9.182: or by the parent's mobile given at sign-up (one exact match only)
    const d = await readData();
    const hits = d.students.filter((s) => s.guardianPhone && last10(s.guardianPhone) === phone);
    if (hits.length === 1) await update((data) => { if (!data.pinRequests.some((r) => r.studentId === hits[0].id)) data.pinRequests.push({ studentId: hits[0].id, at: new Date().toISOString() }); });
  }
  if (!adm && !byPhone && who.length > 2 && standard && school) {
    // V51.9.182 (newcomer review): a child who lost the Student ID can still ask — by full name, standard and school. Only
    // an exact single match asks the office (two children with the same details: the office is not told, the reply is the same).
    const d = await readData();
    const hits = d.students.filter((s) => norm(s.name) === norm(who) && s.standard === standard && norm(s.school ?? '') === norm(school));
    if (hits.length === 1) await update((data) => { if (!data.pinRequests.some((r) => r.studentId === hits[0].id)) data.pinRequests.push({ studentId: hits[0].id, at: new Date().toISOString() }); });
  }
  if (adm && who) {
    const d = await readData();
    const st = d.students.find((s) => [s.admissionNo, s.studentCode].some((c) => c && c.toLowerCase() === adm.toLowerCase()));
    // The admin still decides and hands the new password over in person, so a phone OR full-name match is enough to ask.
    if (st && ((phone.length === 10 && st.guardianPhone && last10(st.guardianPhone) === phone) || (who.length > 2 && norm(st.name) === norm(who)))) {
      await update((data) => { if (!data.pinRequests.some((r) => r.studentId === st.id)) data.pinRequests.push({ studentId: st.id, at: new Date().toISOString() }); });
    }
  }
  return NextResponse.json({ ok: true });
}
