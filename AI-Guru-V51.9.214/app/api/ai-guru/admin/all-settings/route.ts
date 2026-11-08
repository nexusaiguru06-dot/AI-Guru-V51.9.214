import { NextResponse } from 'next/server';
import { denied } from '../guard';
import { readData } from '@/lib/ai-guru/admin/store';
import { maskKey, trialDoubtsOf } from '@/lib/ai-guru/library/settings';
import { readUpi } from '@/lib/ai-guru/payments/upi';
import { readLastRun } from '@/lib/ai-guru/messages/notify';
import { DEFAULT_SCHOOL_TERMS } from '@/lib/ai-guru/schools/rules';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * V51.9.189 — every office setting in one read, for "⚙ Settings" (/ai-guru/admin/settings). Each section is still saved
 * through its own address (school & sign-up: admin/settings; referral: admin/affiliates; class groups: admin/classes;
 * free parts & lock: admin/enrolment; fees & grace: admin/plans; AI key, free study materials and free doubts:
 * admin/library; UPI: admin/upi), so the rules that check each value stay in one place.
 */
export async function GET(req: Request) {
  const d = await denied(req); if (d) return d;
  const data = await readData();
  const s = data.settings;
  return NextResponse.json({
    ok: true,
    school: data.school,
    signupNeedsCoupon: s.signupNeedsCoupon,
    affiliate: s.affiliate,
    groups: s.groups,
    access: s.access,
    plans: s.plans,
    library: { cloudKey: maskKey(s.library.cloudKey), hasEnvKey: !!process.env.GEMINI_API_KEY, autoFreeParts: s.library.autoFreeParts !== false, reviewStudentWork: !!s.library.reviewStudentWork, dailyLimit: s.library.dailyLimit, trialDoubts: trialDoubtsOf(s.library) },
    upi: (await readUpi()) ?? { vpa: '', payee: '' },
    daily: { lastRun: (await readLastRun()) ?? null, scheduled: !!process.env.AI_GURU_CRON_SECRET },
    schoolTerms: s.schools ?? DEFAULT_SCHOOL_TERMS, // V51.9.193
    envLogin: !!(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD),
  }, { headers: { 'cache-control': 'no-store' } });
}
