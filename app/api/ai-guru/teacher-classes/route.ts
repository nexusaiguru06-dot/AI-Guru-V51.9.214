import { NextResponse } from 'next/server';
import { clientIp, lockedOut, noteMiss, verifyPin } from '@/lib/ai-guru/admin/auth';
import { readData, update } from '@/lib/ai-guru/admin/store';
import { ensureSerials } from '@/lib/ai-guru/admin/class-content';
import { rollup } from '@/lib/ai-guru/quiz/records';
import { groupView } from '@/lib/ai-guru/admin/class-view';
import { normaliseCode } from '@/lib/ai-guru/admin/fees';
import { duesOf } from '@/lib/ai-guru/admin/dues';
import { readAll } from '@/lib/ai-guru/quiz/server-store';
import { istDay } from '@/lib/ai-guru/share/badges';
import { inviteText } from '@/lib/ai-guru/admin/groups';
import { inviteLink, SITE_URL } from '@/lib/ai-guru/site';

export const dynamic = 'force-dynamic';

/** POST { code, key } — a teacher opens their class with the class code and the 6-digit key the office gave them. */
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (await lockedOut(`t:${ip}`)) return NextResponse.json({ ok: false, error: 'Too many tries. Wait a few minutes.' }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  let data = await readData();
  if (data.classes.some((c) => data.students.some((s) => s.classId === c.id && !s.classSerial))) { await update((d) => { ensureSerials(d.classes, d.students); }); data = await readData(); }
  const g = data.classes.find((x) => x.code === normaliseCode(b.code));
  if (!g || !verifyPin(String(b.key ?? '').trim(), g.key)) { await noteMiss(`t:${ip}`); return NextResponse.json({ ok: false, error: 'The class code or key is not right' }, { status: 401 });
  }
  const records = await readAll(), today = istDay(new Date().toISOString());
  const v = groupView(g, data, records, today);
  const link = inviteLink(SITE_URL, g.code);
  // the teacher's student list: roll number, our student number and how each one is doing
  const plans = [...data.yearly, ...data.monthly];
  const roster = data.students.filter((s) => s.classId === g.id).sort((a, z) => (a.classSerial ?? 1e9) - (z.classSerial ?? 1e9)).map((s) => {
    const rs = records.filter((r) => r.studentId === (s.quizId ?? `student:${s.id}`));
    const t = rollup(rs);
    // V51.9.185: only whether a fee is past its due date (never the amount) — the office handles the money
    const feePending = duesOf(s, data.invoices, plans, today, data.settings.plans.graceDays).some((d) => d.stage === 'grace' || d.stage === 'over');
    return { serial: s.classSerial ?? null, studentCode: s.studentCode ?? '', name: s.name, standard: s.standard, feePending, sessions: t.sessions, pct: t.pct, toffees: t.toffees, chillies: t.chillies, weak: t.weak.slice(0, 3), last: rs.length ? rs.map((r) => r.at).sort().at(-1)!.slice(0, 10) : null };
  });
  return NextResponse.json({ ok: true, group: v, link, invite: inviteText(g, link), members: roster.map((r) => ({ name: r.name, standard: r.standard })), roster });
}
