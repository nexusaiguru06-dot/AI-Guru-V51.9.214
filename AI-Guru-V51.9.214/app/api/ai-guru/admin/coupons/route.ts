import { NextResponse } from 'next/server';
import { bad, denied } from '../guard';
import { readData, update } from '@/lib/ai-guru/admin/store';
import { normaliseCode, type Coupon } from '@/lib/ai-guru/admin/fees';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const d = await denied(req); if (d) return d;
  const data = await readData();
  const own = data.coupons.filter((c) => !c.ownerStudentId && !c.ownerClassId); // personal affiliate coupons live on the Affiliates page
  return NextResponse.json({ ok: true, coupons: own, students: Object.fromEntries(own.map((c) => [c.code, data.students.filter((s) => s.coupon === c.code).length])) });
}

/** POST { coupon: { code, kind, value, maxUses?, expires?, note? } } adds or changes; POST { action: 'toggle', code } switches it on/off. */
export async function POST(req: Request) {
  const d = await denied(req); if (d) return d;
  const b = await req.json().catch(() => ({}));
  if (b.action === 'toggle') {
    const r = await update((data) => { const c = data.coupons.find((x) => x.code === normaliseCode(b.code) && !x.ownerStudentId && !x.ownerClassId); if (!c) return false; c.active = !c.active; return true; });
    return r ? NextResponse.json({ ok: true }) : bad('Coupon not found', 404);
  }
  const x = b.coupon ?? {};
  const code = normaliseCode(x.code), kind = x.kind === 'flat' ? 'flat' : 'percent', value = Math.round(Number(x.value) * 100) / 100;
  const maxUses = x.maxUses ? Math.floor(Number(x.maxUses)) : undefined;
  const problems: string[] = [];
  if (code.length < 4) problems.push('Code needs at least 4 letters or digits');
  if (!(value > 0)) problems.push('Value must be above zero');
  if (kind === 'percent' && value > 100) problems.push('A percentage cannot be more than 100');
  if (x.expires && !/^\d{4}-\d{2}-\d{2}$/.test(String(x.expires))) problems.push('Expiry date is not valid');
  if (problems.length) return bad(problems);
  const c = await update((data) => {
    const i = data.coupons.findIndex((k) => k.code === code);
    if (i >= 0 && (data.coupons[i].ownerStudentId || data.coupons[i].ownerClassId)) return null;
    const v: Coupon = { code, kind, value, maxUses: maxUses && maxUses > 0 ? maxUses : undefined, used: i >= 0 ? data.coupons[i].used : 0, expires: x.expires || undefined, note: String(x.note ?? '').slice(0, 80) || undefined, active: i >= 0 ? data.coupons[i].active : true };
    if (i >= 0) data.coupons[i] = v; else data.coupons.push(v);
    return v;
  });
  return c ? NextResponse.json({ ok: true, coupon: c }) : bad('That is a student’s affiliate code; change it on the Affiliates page', 409);
}

/** DELETE ?code= — only a coupon nobody has used. */
export async function DELETE(req: Request) {
  const d = await denied(req); if (d) return d;
  const code = normaliseCode(new URL(req.url).searchParams.get('code'));
  const r = await update((data) => { const c = data.coupons.find((x) => x.code === code && !x.ownerStudentId && !x.ownerClassId); if (!c) return 'none'; if (c.used > 0) return 'used'; data.coupons = data.coupons.filter((x) => x.code !== code); return 'ok'; });
  return r === 'ok' ? NextResponse.json({ ok: true }) : bad(r === 'used' ? 'This coupon has been used, so it can only be switched off' : 'Coupon not found', r === 'used' ? 409 : 404);
}
