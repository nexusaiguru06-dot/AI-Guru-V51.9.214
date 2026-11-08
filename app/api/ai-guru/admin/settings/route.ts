import { NextResponse } from 'next/server';
import { bad, denied } from '../guard';
import { readData, update } from '@/lib/ai-guru/admin/store';
import { addressProblems, cleanAddress } from '@/lib/ai-guru/admin/address';
import { changePassword } from '@/lib/ai-guru/admin/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const d = await denied(req); if (d) return d;
  return NextResponse.json({ ok: true, school: (await readData()).school, signupNeedsCoupon: (await readData()).settings.signupNeedsCoupon, envLogin: !!(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) });
}

/** POST { school: { name, address } } or { password: { current, next, username? } }. */
export async function POST(req: Request) {
  const d = await denied(req); if (d) return d;
  const b = await req.json().catch(() => ({}));
  if (typeof b.signupNeedsCoupon === 'boolean') { await update((data) => { data.settings.signupNeedsCoupon = b.signupNeedsCoupon; }); return NextResponse.json({ ok: true }); }
  if (b.password) {
    const err = await changePassword(String(b.password.current ?? ''), String(b.password.next ?? ''), b.password.username ? String(b.password.username) : undefined);
    return err ? bad(err) : NextResponse.json({ ok: true });
  }
  const address = cleanAddress(b.school?.address);
  const problems = addressProblems(address, false);
  if (problems.length) return bad(problems);
  const school = { name: String(b.school?.name ?? '').trim().slice(0, 120), address };
  await update((data) => { data.school = school; });
  return NextResponse.json({ ok: true, school });
}
