// @vitest-environment node
/**
 * V51.9.194 — fees are paid by part only (one part, or all parts at once): with the part plan on, no monthly or yearly
 * option is offered (even if old monthly prices are still saved), and "due" is the next part's fee.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const R: Record<string, any> = {};
let ipN = 1;
const req = (body: unknown, cookie = '') => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': `68.0.0.${ipN++}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie = '') => new Request('http://x/a', { headers: { cookie } });
const j = async (r: Response) => r.json();
const sess = (r: Response) => (r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie') ?? '']).map((c) => c.split(';')[0]).filter((c) => /^aig_(student|admin)=/.test(c)).join('; ');

describe('parts only', () => {
  let admin = '', kid = '';
  beforeAll(async () => {
    process.chdir(mkdtempSync(path.join(tmpdir(), 'parts194-')));
    process.env.ADMIN_USERNAME = 'office'; process.env.ADMIN_PASSWORD = 'office-pass-2026';
    for (const [k, p] of Object.entries({ login: 'admin/login', enrol: 'admin/enrolment', plans: 'admin/plans', upi: 'admin/upi', signup: 'student-portal/signup', pay: 'student-portal/pay' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
    admin = sess(await R.login.POST(req({ username: 'office', password: 'office-pass-2026' })));
    await R.upi.POST(req({ action: 'settings', vpa: 'manojkrish70@okhdfcbank', payee: 'Manoj Muthukrishnan' }, admin));
    // an old monthly price is still saved
    expect((await j(await R.plans.POST(req({ action: 'settings', plans: { prices: [{ standard: 'all', monthly: 500 }], yearlyReductionPct: 10, graceDays: 5 } }, admin)))).ok).toBe(true);
    await R.enrol.POST(req({ action: 'settings', access: { enabled: true, freeParts: [1], partPlan: { enabled: true, partPrice: 2000, upfrontPrice: 7000, trialDays: 7 } } }, admin));
    kid = sess(await R.signup.POST(req({ name: 'Nila Raj', standard: '6', syllabus: 'kerala', medium: 'malayalam', school: 'GHSS', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1', motherTongue: 'Malayalam' })));
  });

  it('pay options: the next part, or all parts at once — never a month or a year', async () => {
    const opts = (await j(await R.pay.GET(get(kid)))).options.map((o: any) => o.kind);
    expect(opts).toEqual(['invoice', 'parts-all']);
  });

  it('what a locked part asks for: the next part’s fee, not every part together, and no monthly offer', async () => {
    const { contentAccessFor } = await import('./content-access');
    const a = await contentAccessFor(get(kid));
    expect(a).toMatchObject({ due: 2000, partPrice: 2000 });
    expect(a.monthly).toBeUndefined();
  });
});
