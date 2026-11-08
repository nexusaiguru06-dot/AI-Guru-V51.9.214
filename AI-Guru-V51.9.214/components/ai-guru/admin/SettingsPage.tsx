'use client';
/**
 * V51.9.189 — ⚙ Settings: every setting the school office makes, on one page.
 * Each section saves on its own, through the same address as before (so the same checks apply):
 *   School & sign-up · Free trial & locked parts · Free doubt clearing · AI key & study materials · Fees, plans & grace ·
 *   Referral commission · Class & centre groups · UPI payments · Daily reminders · Office password
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS0 = ['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
type Pp = { enabled: boolean; partPrice: number; upfrontPrice: number; trialDays: number; months: string[] };
const PP0: Pp = { enabled: false, partPrice: 800, upfrontPrice: 6500, trialDays: 7, months: MONTHS0 };
type Td = { days: number; perDay: number; minutes: number; afterPerDay: number; afterMinutes: number; dailyMinutes: number; schoolPerDay: number };
interface All {
  school: { name: string; address: Record<string, string> };
  signupNeedsCoupon: boolean;
  affiliate: { enabled: boolean; commissionPct: number; discountPct: number; discountKind?: 'percent' | 'flat'; payoutDay: number };
  groups: { discountPct: number; tiers: Array<{ at: number; reward: string }> };
  access: { enabled: boolean; freeParts: number[]; partPlan?: Pp };
  plans: { prices: Array<{ standard: string; monthly: number }>; yearlyReductionPct: number; graceDays: number };
  library: { cloudKey: string; hasEnvKey: boolean; autoFreeParts: boolean; reviewStudentWork: boolean; dailyLimit: number; trialDoubts: Td };
  upi: { vpa: string; payee: string; auto?: boolean };
  daily: { lastRun: { at: string; sent: number } | null; scheduled: boolean };
  envLogin: boolean;
  schoolTerms: { schoolPct: number; teacherPct: number; studentDiscountPct: number };
}

const inp = 'mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400';
const btn = 'rounded-xl bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f] disabled:opacity-50';
const lab = 'block text-xs font-bold text-slate-300';
const help = 'mt-0.5 block text-[11px] font-normal text-slate-500';
const n = (v: string) => (v === '' ? NaN : Number(v));

async function post(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  const e = j.error ?? j.problems;
  return { ok: r.ok && j.ok !== false, error: Array.isArray(e) ? e.join(' · ') : e };
}

function Section({ id, title, children, onSave, busy, note }: { id: string; title: string; children: ReactNode; onSave?: () => void; busy?: boolean; note?: { ok: boolean; text: string } | null }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3 rounded-2xl border border-white/10 bg-white/[.04] p-4" data-settings-section={id}>
      <h2 className="text-lg font-extrabold">{title}</h2>
      {children}
      {onSave && <div className="flex flex-wrap items-center gap-3"><button className={btn} disabled={busy} onClick={onSave} data-save={id}>Save</button>
        {note && <span role="status" className={`text-sm ${note.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{note.text}</span>}</div>}
    </section>
  );
}

export function SettingsPage() {
  const [a, setA] = useState<All | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [notes, setNotes] = useState<Record<string, { ok: boolean; text: string } | null>>({});
  const [key, setKey] = useState('');
  const [pw, setPw] = useState({ current: '', next: '', username: '' });

  const load = useCallback(async () => {
    const r = await fetchIfSignedIn(['admin'], '/api/ai-guru/admin/all-settings', { cache: 'no-store' });
    if (r.status === 401 || r.status === 404) { window.location.href = '/ai-guru/admin'; return; }
    const j = await r.json().catch(() => null);
    if (!j?.ok) { setErr('Could not load the settings.'); return; }
    setA(j);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = (id: string, url: string, body: () => unknown) => async () => {
    setBusy(id); setNotes((x) => ({ ...x, [id]: null }));
    try {
      const r = await post(url, body());
      setNotes((x) => ({ ...x, [id]: { ok: r.ok, text: r.ok ? 'Saved ✓' : r.error || 'Could not save' } }));
      if (r.ok) await load();
    } catch { setNotes((x) => ({ ...x, [id]: { ok: false, text: 'Could not reach the server' } })); }
    finally { setBusy(''); }
  };

  if (!a) return <main className="min-h-screen bg-[#06101c] p-8 text-slate-300">{err || 'Loading…'}</main>;
  const set = <K extends keyof All>(k: K, v: All[K]) => setA({ ...a, [k]: v });
  const td = a.library.trialDoubts;
  const ppNow = { ...PP0, ...(a.access.partPlan ?? {}) }; // V51.9.195: one trial
  const setTd = (k: keyof Td, v: number) => set('library', { ...a.library, trialDoubts: { ...td, [k]: v } });
  const addr = a.school.address ?? {};
  const setAddr = (k: string, v: string) => set('school', { ...a.school, address: { ...addr, [k]: v } });
  const toc: Array<[string, string]> = [['school', 'School & sign-up'], ['trial', 'Free trial & part fees'], ['doubts', 'Free doubt clearing'], ['ai', 'AI key & materials'], ['fees', 'Grace days'], ['referral', 'Referral commission'], ['schools', 'Schools'], ['groups', 'Class groups'], ['upi', 'UPI'], ['daily', 'Daily reminders'], ['password', 'Password']];

  return (
    <main className="min-h-screen bg-[#06101c] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="flex flex-wrap items-center gap-3">
          <a href="/ai-guru/admin" className="text-xs text-slate-400">← Office</a>
          <h1 className="text-2xl font-extrabold">⚙ Settings </h1>
        </header>
        <p className="text-sm text-slate-400">Every setting of the school office, in one place. Each part saves on its own.</p>
        <nav className="flex flex-wrap gap-1.5" aria-label="Settings sections">{toc.map(([id, l]) => <a key={id} href={`#${id}`} className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold text-slate-200 hover:bg-white/5">{l}</a>)}</nav>

        <Section id="school" title="School & sign-up" busy={busy === 'school'} note={notes.school}
          onSave={async () => { await post('/api/ai-guru/admin/settings', { signupNeedsCoupon: a.signupNeedsCoupon }); await save('school', '/api/ai-guru/admin/settings', () => ({ school: a.school }))(); }}>
          <label className={lab}>School name (on receipts)<input className={inp} value={a.school.name} onChange={(e) => set('school', { ...a.school, name: e.target.value })} /></label>
          <div className="grid gap-3 sm:grid-cols-3">
            {([['line1', 'Building / street'], ['area', 'Place'], ['postOffice', 'Post office'], ['district', 'District'], ['state', 'State'], ['pincode', 'PIN code']] as const).map(([k, l]) => <label key={k} className={lab}>{l}<input className={inp} value={addr[k] ?? ''} onChange={(e) => setAddr(k, e.target.value)} /></label>)}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={a.signupNeedsCoupon} onChange={(e) => set('signupNeedsCoupon', e.target.checked)} />A coupon code is needed to sign up</label>
        </Section>

        <Section id="trial" title="Free trial & part fees" busy={busy === 'trial'} note={notes.trial} onSave={save('trial', '/api/ai-guru/admin/enrolment', () => ({ action: 'settings', access: { ...a.access, partPlan: { ...PP0, ...(a.access.partPlan ?? {}) } } }))}>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={a.access.enabled} onChange={(e) => set('access', { ...a.access, enabled: e.target.checked })} data-lock /><span>Lock the paid parts for students who have not paid<span className={help}>Off: every part of every book is open to everyone.</span></span></label>
          <fieldset><legend className={lab}>Free parts of every book (the free trial)</legend>
            <div className="mt-1 flex flex-wrap gap-3">{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => <label key={p} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={a.access.freeParts.includes(p)} onChange={(e) => set('access', { ...a.access, freeParts: e.target.checked ? [...a.access.freeParts, p].sort() : a.access.freeParts.filter((x) => x !== p) })} />Part {p}</label>)}</div>
            <span className={help}>A book can have its own free parts (Study materials → the book).</span></fieldset>
          {(() => { const pp = { ...PP0, ...(a.access.partPlan ?? {}) }; const paid = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((p) => !a.access.freeParts.includes(p)); const put = (k: keyof Pp, v: number | boolean | string[]) => set('access', { ...a.access, partPlan: { ...pp, [k]: v } }); const inr = (x: number) => `₹${(x || 0).toLocaleString('en-IN')}`; return (
            <fieldset className="space-y-3 rounded-xl border border-cyan-300/20 p-3" data-part-plan-settings>
              <legend className="px-1 text-xs font-bold text-cyan-200">Pay by month (V51.9.211)</legend>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={pp.enabled} onChange={(e) => put('enabled', e.target.checked)} data-part-plan-on /><span>Students pay part by part: each paid part opens that part in every book<span className={help}>Turns the lock on. Part 1 is free; each later part is one month’s fee. There are no due dates — the student pays a month when ready and that part opens at once, with its study materials made automatically. A part that is not paid cannot be opened or used to make study materials, even with the student’s own AI key.</span></span></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={lab}>Monthly fee: price of one part (₹)<input type="number" min={1} className={inp} value={pp.partPrice} onChange={(e) => put('partPrice', n(e.target.value))} data-part-price /><span className={help}>{paid.length} paid part{paid.length === 1 ? '' : 's'} (Part {paid.join(', ')}) → {inr(pp.partPrice * paid.length)} by instalments.</span></label>
                <label className={lab}>All paid parts at once (₹, optional offer)<input type="number" min={1} className={inp} value={pp.upfrontPrice} onChange={(e) => put('upfrontPrice', n(e.target.value))} data-upfront-price /><span className={help}>Offered until the first part is paid{pp.partPrice * paid.length > pp.upfrontPrice ? ` — saves ${inr(pp.partPrice * paid.length - pp.upfrontPrice)}` : ''}.</span></label>
                <label className={lab}>Free trial (days from joining)<input type="number" min={0} max={90} className={inp} value={pp.trialDays} onChange={(e) => put('trialDays', n(e.target.value))} data-plan-trial /><span className={help}>The joining day is day 1. Only the free doubt-clearing trial follows this; part fees have no due dates.</span></label>
              </div>
              <div data-part-months>
                <div className={lab}>Month of each part (Kerala starts in June — change it for another state)</div>
                <div className="mt-1 grid gap-2 sm:grid-cols-5">{pp.months.map((m, i) => <label key={i} className="text-xs text-slate-400">Part {i + 1}{a.access.freeParts.includes(i + 1) ? ' (free)' : ''}<select className={inp} value={m} onChange={(e) => put('months', pp.months.map((x, j) => (j === i ? e.target.value : x)))}>{MONTHS.map((mm) => <option key={mm}>{mm}</option>)}</select></label>)}</div>
                <span className={help}>Paying a month opens that part in every book at once. The month names the part on bills and in the student’s “this month’s part”.</span>
              </div>
            </fieldset>); })()}
        </Section>

        <Section id="doubts" title="Free doubt clearing (camera, voice, typed)" busy={busy === 'doubts'} note={notes.doubts} onSave={save('doubts', '/api/ai-guru/admin/library', () => ({ action: 'settings', library: { trialDoubts: td } }))}>
          <p className="text-sm text-slate-400">Students without their own Gemini key ask doubts on the AI key below, within these limits. Each time, the student sees a notification with what is left and a tap to add their own free key. A student with their own key always uses it, with no limits.</p>
          <div className="grid gap-3 sm:grid-cols-3" data-trial-doubts>
            <label className={lab}>Trial days from joining<input type="number" min={0} max={90} className={inp} value={ppNow.enabled ? ppNow.trialDays : td.days} disabled={ppNow.enabled} onChange={(e) => setTd('days', n(e.target.value))} /><span className={help}>The joining day is day 1. 0 = no trial.{ppNow.enabled ? ' Set with the part plan above.' : ''}</span></label>
            <label className={lab}>Trial: sessions a day<input type="number" min={1} max={50} className={inp} value={td.perDay} onChange={(e) => setTd('perDay', n(e.target.value))} /></label>
            <label className={lab}>Trial: minutes a session<input type="number" min={2} max={30} className={inp} value={td.minutes} onChange={(e) => setTd('minutes', n(e.target.value))} /></label>
            <label className={lab}>Free doubt minutes a day (no own key)<input type="number" min={0} max={120} className={inp} value={td.dailyMinutes ?? 10} onChange={(e) => setTd('dailyMinutes', n(e.target.value))} data-daily-minutes /><span className={help}>After the trial, and for paying students, who have no key of their own. 0 = their own key only. A student with their own free key has unlimited doubt clearing.</span></label>
            <label className={lab}>All students together: free sessions a day<input type="number" min={0} className={inp} value={td.schoolPerDay ?? 200} onChange={(e) => setTd('schoolPerDay', n(e.target.value))} data-school-per-day /><span className={help}>A cap on AI Guru’s key for the whole day, so a busy day cannot run up a big bill. 0 = no cap.</span></label>
          </div>
          {ppNow.enabled && <p className="text-xs text-cyan-200" data-one-trial>While paying by part is on, the free doubt trial follows the part plan’s free trial ({ppNow.trialDays} days), so both end on the same day. Paying does not end the free doubts early.</p>}
        </Section>

        <Section id="ai" title="AI key & study materials" busy={busy === 'ai'} note={notes.ai} onSave={save('ai', '/api/ai-guru/admin/library', () => ({ action: 'settings', library: { cloudKey: key.trim() ? key.trim() : undefined, autoFreeParts: a.library.autoFreeParts, reviewStudentWork: a.library.reviewStudentWork, dailyLimit: a.library.dailyLimit } }))}>
          <label className={lab}>AI Guru’s Gemini key (the app key) {a.library.cloudKey ? <span className="font-mono text-emerald-300">({a.library.cloudKey} saved)</span> : a.library.hasEnvKey ? <span className="text-slate-400">(using GEMINI_API_KEY from the server)</span> : <span className="text-amber-200">(none)</span>}
            <input className={inp} type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={a.library.cloudKey ? 'Paste a new key to replace it' : 'AIza…'} /><span className={help}>Kept on the server only; never sent to a browser. It makes the common study materials and gives the free doubt clearing above.</span></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={a.library.autoFreeParts} onChange={(e) => set('library', { ...a.library, autoFreeParts: e.target.checked })} /><span>Make the free part in full on upload<span className={help}>Every study-material type for each new textbook’s free part, on the app key.</span></span></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={a.library.reviewStudentWork} onChange={(e) => set('library', { ...a.library, reviewStudentWork: e.target.checked })} /><span>Check students’ books and materials before others see them<span className={help}>Students make materials with their own key; they are shared in the library for their syllabus and standard.</span></span></label>
        </Section>

        <Section id="fees" title="Payment grace days" busy={busy === 'fees'} note={notes.fees} onSave={save('fees', '/api/ai-guru/admin/plans', () => ({ action: 'settings', plans: { ...a.plans, prices: [] } }))}>
          {/* V51.9.194: fees are paid by part only (one part, or all parts at once — Free trial & part fees above); no monthly or yearly plans */}
          <label className={`${lab} max-w-sm`}>Grace days after a part fee is due<input type="number" min={0} max={60} className={inp} value={a.plans.graceDays} onChange={(e) => set('plans', { ...a.plans, graceDays: n(e.target.value) })} data-grace /><span className={help}>Part 2 is due when the free trial ends; after this many more days, with daily reminders, it stays locked until paid. The part prices are set in “Free trial & part fees”.</span></label>
        </Section>

        <Section id="referral" title="Referral commission (Refer & earn)" busy={busy === 'referral'} note={notes.referral} onSave={save('referral', '/api/ai-guru/admin/affiliates', () => ({ action: 'settings', affiliate: a.affiliate }))}>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={a.affiliate.enabled} onChange={(e) => set('affiliate', { ...a.affiliate, enabled: e.target.checked })} />Students can invite friends and earn a commission</label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={lab}>Commission (% of each fee paid)<input type="number" min={0} max={100} step={0.5} className={inp} value={a.affiliate.commissionPct} onChange={(e) => set('affiliate', { ...a.affiliate, commissionPct: n(e.target.value) })} data-commission /></label>
            <label className={lab}>Friend’s discount<div className="flex gap-2"><input type="number" min={0} className={inp} value={a.affiliate.discountPct} onChange={(e) => set('affiliate', { ...a.affiliate, discountPct: n(e.target.value) })} />
              <select className={`${inp} max-w-[5.5rem]`} value={a.affiliate.discountKind ?? 'percent'} onChange={(e) => set('affiliate', { ...a.affiliate, discountKind: e.target.value as 'percent' | 'flat' })}><option value="percent">%</option><option value="flat">₹</option></select></div></label>
            <label className={lab}>Commission paid on day<input type="number" min={1} max={28} className={inp} value={a.affiliate.payoutDay} onChange={(e) => set('affiliate', { ...a.affiliate, payoutDay: n(e.target.value) })} /><span className={help}>Of the next month, at the school office.</span></label>
          </div>
        </Section>

        <Section id="schools" title="Contracted schools (default terms)" busy={busy === 'schools'} note={notes.schools} onSave={save('schools', '/api/ai-guru/admin/schools', () => ({ action: 'defaults', terms: a.schoolTerms }))}>
          <p className="text-sm text-slate-400">A separate scheme from Refer & earn, for schools on contract. New schools start with these terms; each school can have its own on the <a className="underline" href="/ai-guru/admin/schools">🏫 Schools</a> page (school ID, teachers, students, commission account, teachers’ activity).</p>
          <div className="grid gap-3 sm:grid-cols-3" data-school-defaults>
            <label className={lab}>School’s commission %<input type="number" min={0} max={60} step={0.5} className={inp} value={a.schoolTerms.schoolPct} onChange={(e) => set('schoolTerms', { ...a.schoolTerms, schoolPct: n(e.target.value) })} /></label>
            <label className={lab}>Teacher’s commission %<input type="number" min={0} max={60} step={0.5} className={inp} value={a.schoolTerms.teacherPct} onChange={(e) => set('schoolTerms', { ...a.schoolTerms, teacherPct: n(e.target.value) })} /></label>
            <label className={lab}>Students’ discount %<input type="number" min={0} max={60} step={0.5} className={inp} value={a.schoolTerms.studentDiscountPct} onChange={(e) => set('schoolTerms', { ...a.schoolTerms, studentDiscountPct: n(e.target.value) })} /><span className={help}>Off the part fees.</span></label>
          </div>
        </Section>

        <Section id="groups" title="Class & centre groups" busy={busy === 'groups'} note={notes.groups} onSave={save('groups', '/api/ai-guru/admin/classes', () => ({ action: 'settings', discountPct: a.groups.discountPct, tiers: a.groups.tiers }))}>
          <label className={`${lab} max-w-xs`}>Discount for students who join with a class code (%)<input type="number" min={0} max={100} className={inp} value={a.groups.discountPct} onChange={(e) => set('groups', { ...a.groups, discountPct: n(e.target.value) })} /></label>
          <p className={lab}>Teacher rewards (students joined → reward)</p>
          {a.groups.tiers.map((t, i) => <div key={i} className="flex gap-2"><input type="number" className={`${inp} max-w-[6rem]`} value={t.at} onChange={(e) => set('groups', { ...a.groups, tiers: a.groups.tiers.map((x, k) => (k === i ? { ...x, at: n(e.target.value) } : x)) })} /><input className={inp} value={t.reward} onChange={(e) => set('groups', { ...a.groups, tiers: a.groups.tiers.map((x, k) => (k === i ? { ...x, reward: e.target.value } : x)) })} /><button className="text-xs text-rose-300 underline" onClick={() => set('groups', { ...a.groups, tiers: a.groups.tiers.filter((_, k) => k !== i) })}>Remove</button></div>)}
          <button className="text-xs text-cyan-300 underline" onClick={() => set('groups', { ...a.groups, tiers: [...a.groups.tiers, { at: 100, reward: '' }] })}>＋ Add a reward</button>
        </Section>

        <Section id="upi" title="UPI payments" busy={busy === 'upi'} note={notes.upi} onSave={save('upi', '/api/ai-guru/admin/upi', () => ({ action: 'settings', vpa: a.upi.vpa, payee: a.upi.payee, auto: a.upi.auto !== false }))}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lab}>School’s UPI ID<input className={inp} value={a.upi.vpa} onChange={(e) => set('upi', { ...a.upi, vpa: e.target.value })} placeholder="schoolname@okaxis" /><span className={help}>Empty = UPI payment is off. Families pay straight to this account; the office confirms each payment.</span></label>
            <label className={lab}>Name shown to the payer<input className={inp} value={a.upi.payee} onChange={(e) => set('upi', { ...a.upi, payee: e.target.value })} /></label>
          </div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={a.upi.auto !== false} onChange={(e) => set('upi', { ...a.upi, auto: e.target.checked })} data-upi-auto-setting /><span>Confirm payments automatically from the bank<span className={help}>When the bank’s alert (or an uploaded statement) has the same UPI reference and amount the family gave, the payment is recorded and the student gets 🎉 Congratulations with the receipt. Connect the bank alerts once: docs step 11. Waiting payments and bank credits are on the <a className="underline" href="/ai-guru/admin/fees">Fees page</a>.</span></span></label>
        </Section>

        <Section id="daily" title="Daily reminders">
          <p className="text-sm text-slate-300" data-daily-status>{a.daily.lastRun ? `Last run ${new Date(a.daily.lastRun.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · ${a.daily.lastRun.sent} message(s) sent.` : 'Not run yet.'} {a.daily.scheduled ? 'The daily job is set up.' : 'The daily job is not set up: run scripts/cloud/setup-daily-reminders.sh in Cloud Shell (docs step 10).'}</p>
          <p className={help}>Each morning: fee reminders (soon, due, every grace day, grace over) and “add your free Gemini key” reminders. They are also sent when a student opens My account.</p>
        </Section>

        <Section id="password" title="Office password" busy={busy === 'password'} note={notes.password} onSave={a.envLogin ? undefined : save('password', '/api/ai-guru/admin/settings', () => ({ password: pw }))}>
          {a.envLogin ? <p className="text-sm text-slate-400">The office sign-in is set on the server (ADMIN_USERNAME / ADMIN_PASSWORD). Change it there.</p> : <div className="grid gap-3 sm:grid-cols-3">
            <label className={lab}>Current password<input type="password" className={inp} value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></label>
            <label className={lab}>New password<input type="password" className={inp} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></label>
            <label className={lab}>New username (optional)<input className={inp} value={pw.username} onChange={(e) => setPw({ ...pw, username: e.target.value })} /></label>
          </div>}
        </Section>
      </div>
    </main>
  );
}
