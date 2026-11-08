import { NextResponse } from 'next/server';
import { bad, denied } from '../guard';
import { hashPin, newPin } from '@/lib/ai-guru/admin/auth';
import { newId, nextTeacherCode, readData, update } from '@/lib/ai-guru/admin/store';
import { cleanTiers, groupCodeFor, groupCoupon, type ClassGroup } from '@/lib/ai-guru/admin/groups';
import { sameTeacher } from '@/lib/ai-guru/admin/member-codes';
import { groupView } from '@/lib/ai-guru/admin/class-view';
import { readAll } from '@/lib/ai-guru/quiz/server-store';
import { istDay } from '@/lib/ai-guru/share/badges';

export const dynamic = 'force-dynamic';
/** The teacher's number: the one their other classes already have, else the next TE-n-yy. */
function teacherCodeFor(data: Parameters<Parameters<typeof update>[0]>[0], g: ClassGroup): string {
  return data.classes.find((o) => o.teacherCode && sameTeacher(o, g))?.teacherCode ?? nextTeacherCode(data, new Date(g.createdAt));
}
const clip = (x: unknown, n: number) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** GET — settings and every class / centre with its numbers (members' names are for the teacher page, not listed here). */
export async function GET(req: Request) {
  const d = await denied(req); if (d) return d;
  if ((await readData()).classes.some((c) => !c.teacherCode)) {
    // classes made before teacher numbers existed get theirs now (numbered by the year the class was made)
    await update((dd) => { for (const c of [...dd.classes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) if (!c.teacherCode) c.teacherCode = teacherCodeFor(dd, c); });
  }
  const data = await readData(), records = await readAll(), today = istDay(new Date().toISOString());
  const groups = data.classes.map((g) => { const { board, ...v } = groupView(g, data, records, today); return { ...v, top: board.slice(0, 3).map((r) => ({ short: r.short, points: r.points })) }; });
  return NextResponse.json({ ok: true, settings: data.settings.groups, groups });
}

/**
 * POST { action: 'create', kind, name, teacherName, teacherPhone?, school?, standard?, pilotUntil? } → the teacher key, shown once
 *      { action: 'update', id, ...fields }  { action: 'toggle', id }  { action: 'newkey', id }
 *      { action: 'reward', id, at }   marks a reward tier as given     { action: 'settings', discountPct, tiers }
 */
export async function POST(req: Request) {
  const d = await denied(req); if (d) return d;
  const b = await req.json().catch(() => ({}));
  if (b.action === 'create') {
    const name = clip(b.name, 80), teacherName = clip(b.teacherName, 80);
    if (!name || !teacherName) return bad('Give the class or centre a name and the teacher’s name');
    const kind = b.kind === 'centre' ? 'centre' : 'class';
    const pilotUntil = /^\d{4}-\d{2}-\d{2}$/.test(String(b.pilotUntil ?? '')) ? String(b.pilotUntil) : undefined;
    const key = newPin();
    const g = await update((data) => {
      const taken = new Set([...data.coupons.map((c) => c.code), ...data.students.map((s) => s.referralCode ?? '')]);
      const g: ClassGroup = { id: newId('cls'), kind, name, code: groupCodeFor(name, taken), teacherName, teacherPhone: clip(b.teacherPhone, 20) || undefined, school: clip(b.school, 100) || undefined, standard: clip(b.standard, 8) || undefined, createdAt: new Date().toISOString(), active: true, discountPct: data.settings.groups.discountPct, key: hashPin(key), pilotUntil: kind === 'centre' ? pilotUntil : undefined, rewardsGiven: [] };
      g.teacherCode = teacherCodeFor(data, g);
      data.classes.push(g); data.coupons.push(groupCoupon(g));
      return g;
    });
    const { key: _h, ...pub } = g;
    return NextResponse.json({ ok: true, group: pub, teacherKey: key });
  }
  if (b.action === 'update') {
    const r = await update((data) => {
      const g = data.classes.find((x) => x.id === b.id); if (!g) return false;
      if (b.name !== undefined) g.name = clip(b.name, 80) || g.name;
      if (b.teacherName !== undefined) g.teacherName = clip(b.teacherName, 80) || g.teacherName;
      if (b.teacherPhone !== undefined) g.teacherPhone = clip(b.teacherPhone, 20) || undefined;
      if (b.school !== undefined) g.school = clip(b.school, 100) || undefined;
      if (b.testimonial !== undefined) g.testimonial = clip(b.testimonial, 400) || undefined;
      if (b.pilotUntil !== undefined) g.pilotUntil = /^\d{4}-\d{2}-\d{2}$/.test(String(b.pilotUntil)) ? String(b.pilotUntil) : undefined;
      // V51.9.92: this class's own discount (the class-code coupon follows it).
      if (b.discountPct !== undefined) {
        const p = Math.round(Number(b.discountPct) * 100) / 100; if (!(p >= 0 && p <= 100)) return 'pct';
        g.discountPct = p; const c = data.coupons.find((x) => x.ownerClassId === g.id); if (c) c.value = p;
      }
      return true;
    });
    if (r === 'pct') return bad('Discount must be between 0 and 100 per cent');
    return r ? NextResponse.json({ ok: true }) : bad('Not found', 404);
  }
  if (b.action === 'toggle') {
    const r = await update((data) => { const g = data.classes.find((x) => x.id === b.id); if (!g) return null; g.active = !g.active; const c = data.coupons.find((x) => x.ownerClassId === g.id); if (c) c.active = g.active; return g.active; });
    return r === null ? bad('Not found', 404) : NextResponse.json({ ok: true, active: r });
  }
  if (b.action === 'newkey') {
    const key = newPin();
    const r = await update((data) => { const g = data.classes.find((x) => x.id === b.id); if (!g) return false; g.key = hashPin(key); return true; });
    return r ? NextResponse.json({ ok: true, teacherKey: key }) : bad('Not found', 404);
  }
  if (b.action === 'reward') {
    const r = await update((data) => {
      const g = data.classes.find((x) => x.id === b.id); if (!g) return 'Not found';
      const at = Number(b.at);
      if (!data.settings.groups.tiers.some((t) => t.at === at)) return 'No such reward';
      const joined = data.students.filter((s) => s.classId === g.id).length;
      if (joined < at) return `Only ${joined} students have joined; this reward is for ${at}`;
      if (!g.rewardsGiven.includes(at)) g.rewardsGiven.push(at);
      return null;
    });
    return r ? bad(r, r === 'Not found' ? 404 : 409) : NextResponse.json({ ok: true });
  }
  if (b.action === 'settings') {
    const discountPct = Math.round(Number(b.discountPct) * 100) / 100;
    if (!(discountPct >= 0 && discountPct <= 100)) return bad('Discount must be between 0 and 100 per cent');
    const tiers = cleanTiers(b.tiers); if (typeof tiers === 'string') return bad(tiers);
    await update((data) => { data.settings.groups = { discountPct, tiers }; for (const g of data.classes) { g.discountPct = discountPct; const c = data.coupons.find((x) => x.ownerClassId === g.id); if (c) c.value = discountPct; } });
    return NextResponse.json({ ok: true });
  }
  return bad('Unknown action');
}
