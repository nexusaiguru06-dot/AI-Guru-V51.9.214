'use client';
import type { AccessSettings } from '@/lib/ai-guru/admin/enrolment';
import { useEffect, useState } from 'react';
import { districtsOf, stateNames } from '@/lib/ai-guru/admin/address';
import { MEDIUMS, SYLLABI } from '@/lib/ai-guru/library/catalog';
import { signupProblems } from '@/lib/ai-guru/admin/fees';
import { loadProfile, saveProfile } from '@/lib/ai-guru/student/profile';
import { deviceProfileFrom } from '@/lib/ai-guru/student/signup-profile';
import { forgetRef, rememberRef } from '@/lib/ai-guru/share/ref-keep';
import { accountOnDevice, adoptAccount, visitorIdOnDevice } from '@/lib/ai-guru/student/device-session';
import { mayHaveSession } from '@/lib/ai-guru/net/session-hint';
import { StudentIdCard, type NewAccount } from '@/components/ai-guru/student/StudentIdCard';
import { InstallAppPrompt } from '@/components/pwa/InstallAppPrompt';
import { COUNTRIES, MOTHER_TONGUES } from '@/lib/ai-guru/student/signup-options';
import { PhotoEditor } from '@/components/ai-guru/student/PhotoEditor';
import { saveLocalPhoto, type PhotoPrefs } from '@/lib/ai-guru/student/photo';

const inp = 'mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base text-white outline-none focus:border-cyan-400';
const STANDARDS = ['LKG', 'UKG', ...Array.from({ length: 12 }, (_, i) => String(i + 1))];

/** Student sign-up: name, standard, school, state, district, place, password (twice), the parent's mobile and an optional class code.
 *  V51.9.182 (newcomer review): every label also in Malayalam; after sign-up the Student ID screen (StudentIdCard). */
export default function StudentSignUp() {
  const [f, setF] = useState({ name: '', standard: '', syllabus: '', medium: '', school: '', state: 'Kerala', district: '', place: '', password: '', confirm: '', coupon: '', guardianPhone: '', country: 'India', email: '', motherTongue: '' });
  const [required, setRequired] = useState(false);
  const [cp, setCp] = useState<{ valid: boolean; text: string } | null>(null);
  const [access, setAccess] = useState<AccessSettings | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  // V51.9.212: the student's photo, chosen here and saved to the new account (it then shows at the bottom of the reels)
  const [pic, setPic] = useState<{ image: string; prefs: PhotoPrefs } | null>(null);
  const [picOpen, setPicOpen] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((o) => ({ ...o, [k]: v, ...(k === 'state' ? { district: '' } : {}), ...(k === 'country' ? { state: v === 'India' ? 'Kerala' : '', district: '' } : {}) }));
  const [fromLink, setFromLink] = useState(false);
  const [refCode, setRefCode] = useState(''); // V51.9.155: the friend's code from their link (also the coupon box's placeholder)
  const [inviter, setInviter] = useState('');
  const [offer, setOffer] = useState('');
  const [teacher, setTeacher] = useState('');
  const [group, setGroup] = useState('');
  const [done, setDone] = useState<NewAccount | null>(null);
  const [dup, setDup] = useState(false);
  const check = async (code: string) => {
    if (!code.trim()) { setCp(null); return; }
    const j = await fetch(`/api/ai-guru/student-portal/coupon?code=${encodeURIComponent(code)}`).then((r) => r.json()).catch(() => null);
    setCp(j?.valid ? { valid: true, text: String(j.label) } : { valid: false, text: j?.error ?? 'Could not check the coupon' }); // the label already names the friend
    if (j?.valid && j.referrer) { setInviter(String(j.referrer)); setOffer(String(j.label).split(' · ').slice(1).join(' · ')); }
    setTeacher(j?.valid && j.teacher ? String(j.teacher) : ''); setGroup(j?.valid && j.group ? String(j.group) : '');
  };
  const checkCoupon = () => check(f.coupon);
  useEffect(() => {
    fetch('/api/ai-guru/student-portal/coupon').then((r) => r.json()).then((j) => { setRequired(!!j.required); if (j.access) setAccess(j.access); }).catch(() => undefined);
    // A friend's link (?ref=CODE) fills the coupon box by itself; the code is kept on this device so a later sign-up still gets it.
    // V51.9.155: kept for 60 days from any AI Guru link with the code (/j/CODE, a reel's link, ?ref=CODE)
    const ref = rememberRef(window.location.search);
    // V51.9.182 (newcomer review): a student who is already signed in and opens a class invite joins it from their
    // account instead of being shown a sign-up form (which made second accounts)
    if (ref && mayHaveSession('student')) { window.location.replace(`/ai-guru/student?join=${encodeURIComponent(ref)}`); return; }
    if (ref) { setF((o) => ({ ...o, coupon: ref })); setFromLink(true); setRefCode(ref); check(ref); }
    // V51.9.107: start from the details already kept on this device (name, standard, school)
    const p = loadProfile();
    // V51.9.182: not when a signed-in student's details are on this phone — a brother or sister signing up gets a clean form
    if (!accountOnDevice() && (p.name || p.standard || p.school)) setF((o) => ({ ...o, name: o.name || p.name, standard: o.standard || (/^(\d{1,2}|LKG|UKG)$/.test(p.standard) ? p.standard : ''), school: o.school || p.school }));
  }, []);
  // V51.9.107: an account is not needed. What is typed here is kept on this device at once and used on the reels
  // (name · Std, school, place), the Material Studio and the boards, with or without signing up.
  useEffect(() => {
    const t = setTimeout(() => { const next = deviceProfileFrom(f, loadProfile()); if (next) saveProfile(next); }, 400);
    return () => clearTimeout(t);
  }, [f]);
  const problems = signupProblems(f).concat(f.guardianPhone && f.guardianPhone.replace(/\D/g, '').length < 10 ? ["The parent's mobile number needs 10 digits"] : [], !f.syllabus ? ['Syllabus is needed'] : [], !f.medium ? ['Medium is needed'] : [], !f.state ? ['State is needed'] : [], f.country === 'India' && f.state && !f.district ? ['District is needed'] : [], !f.motherTongue ? ['Mother tongue is needed'] : [], f.email.trim() && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(f.email.trim()) ? ['The e-mail address does not look right'] : [], required && !f.coupon.trim() ? ['Coupon code is needed'] : []);
  const submit = async (e: React.FormEvent | null, differentStudent = false) => {
    e?.preventDefault(); setErr(''); setDup(false);
    if (problems.length) { setErr(problems.join('. ')); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/ai-guru/student-portal/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...f, fromLink, differentStudent, visitorId: visitorIdOnDevice() }) });
      const j = await r.json().catch(() => ({}));
      if (j.ok) {
        // V51.9.182: this phone now saves work under the account, and the next screen is the Student ID (not the library)
        forgetRef(); adoptAccount({ quizId: j.quizId, name: j.name, medium: f.medium });
        if (pic) { // V51.9.212: keep the photo on this device (the reel maker reads it) and on the new account
          saveLocalPhoto({ dataUrl: pic.image, ...pic.prefs });
          await fetch('/api/ai-guru/student-portal/photo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: pic.image, ...pic.prefs }) }).catch(() => undefined); // if it fails, the student page uploads the device copy later
        }
        setDone({ studentCode: String(j.studentCode), name: String(j.name ?? f.name), className: j.className, teacher: j.teacher, note: j.note });
        window.scrollTo(0, 0);
        return;
      }
      if (j.duplicate) { setDup(true); return; }
      setErr(j.error ?? 'Could not sign you up');
    } catch { setErr('Could not reach the server.'); } finally { setBusy(false); }
  };
  // V51.9.182: each label in English with Malayalam under it
  const L = (t: string, _ml: string, children: React.ReactNode) => <label className="block text-sm font-bold text-slate-200">{t}{children}</label>; // V51.9.198: English labels only
  if (done) return <StudentIdCard acct={done} password={f.password} />;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#06101c] px-4 py-8 text-slate-100">
      <form onSubmit={submit} className="w-full max-w-lg space-y-4 rounded-3xl border border-white/10 bg-white/[.04] p-6" noValidate>
        <div className="flex items-center gap-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/aiguru-logo.png" alt="" width={44} height={44} className="h-11 w-11 object-contain" /><div><h1 className="text-xl font-extrabold">Student sign-up</h1><p className="text-sm text-slate-400">Make your AI Guru account</p></div></div>
        {fromLink && refCode && <InstallAppPrompt refCode={refCode} />}{/* V51.9.197: opened from an invite link → "Download the AI Guru app?" */}
        {fromLink && refCode && ( // V51.9.155: who invited you, and the code already in the box below
          <div className="rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100" data-invited>
            {/* V51.9.182: a teacher's class code says so, with the teacher's name — not "a friend invited you" */}
            {group ? <>🏫 <b>{teacher ? `${teacher} invited you to ${group}` : `You are invited to ${group}`}</b>
              <span className="block text-xs text-emerald-100/85">Make your account below and you join this class. Code <b className="font-mono">{refCode}</b> is filled in.</span></>
            : <>🎁 <b>{inviter ? `${inviter} invited you to AI Guru` : 'A friend invited you to AI Guru'}</b>
              <span className="block text-xs text-emerald-100/80">Their code <b className="font-mono">{refCode}</b> is filled in below{offer ? ` — you get ${offer}` : ''}.</span></>}
          </div>
        )}
        {L('Name', '', <input className={inp} value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" />)}
        <div className="grid gap-4 sm:grid-cols-2">
          {L('Standard', '', <select className={inp} value={f.standard} onChange={(e) => set('standard', e.target.value)}><option value="">Choose…</option>{STANDARDS.map((s) => <option key={s} value={s}>{/^\d+$/.test(s) ? `Std ${s}` : s}</option>)}</select>)}
          {L('Syllabus', '', <select className={inp} value={f.syllabus} onChange={(e) => set('syllabus', e.target.value)}><option value="">Choose…</option>{SYLLABI.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>)}
          {L('Medium', '', <select className={inp} value={f.medium} onChange={(e) => set('medium', e.target.value)}><option value="">Choose…</option>{MEDIUMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>)}
          {L('School', '', <input className={inp} value={f.school} onChange={(e) => set('school', e.target.value)} placeholder="Name of your school" />)}
          {L('Mother tongue', '', <select className={inp} value={f.motherTongue} onChange={(e) => set('motherTongue', e.target.value)} data-mother-tongue><option value="">Choose…</option>{MOTHER_TONGUES.map(([v, l]) => <option key={v} value={v}>{v}</option>)}</select>)}
          {L('Country', '', <select className={inp} value={f.country} onChange={(e) => set('country', e.target.value)} data-country>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select>)}
          {/* V51.9.184: in India the state and district are chosen from the list; elsewhere they are typed */}
          {f.country === 'India' ? <>
            {L('State', '', <select className={inp} value={f.state} onChange={(e) => set('state', e.target.value)}><option value="">Choose…</option>{stateNames().map((s) => <option key={s}>{s}</option>)}</select>)}
            {L('District', '', <select className={inp} value={f.district} onChange={(e) => set('district', e.target.value)}><option value="">Choose…</option>{districtsOf(f.state).map((s) => <option key={s}>{s}</option>)}</select>)}
          </> : <>
            {L('State / emirate / region', '', <input className={inp} value={f.state} onChange={(e) => set('state', e.target.value)} />)}
            {L('District / city (optional)', '', <input className={inp} value={f.district} onChange={(e) => set('district', e.target.value)} />)}
          </>}
        </div>
        {L('Place (village or town)', '', <input className={inp} value={f.place} onChange={(e) => set('place', e.target.value)} autoComplete="address-level2" />)}
        <div className="grid gap-4 sm:grid-cols-2">
          {L('Password (6 to 30 characters)', '', <input className={inp} type={show ? 'text' : 'password'} value={f.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" />)}
          {L('Type the password again', '', <input className={inp} type={show ? 'text' : 'password'} value={f.confirm} onChange={(e) => set('confirm', e.target.value)} autoComplete="new-password" aria-invalid={!!f.confirm && f.confirm !== f.password} />)}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />Show passwords</label>
        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-3" data-signup-photo>
          <button type="button" onClick={() => setPicOpen(true)} className="shrink-0" aria-label={pic ? 'Change your photo' : 'Add your photo'}>
            {pic
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={pic.image} alt="Your photo" className="h-16 w-16 rounded-full border-2 border-white object-cover ring-2 ring-cyan-400/60" />
              : <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-cyan-300/60 bg-cyan-400/10 text-2xl">📷</span>}
          </button>
          <div className="min-w-0 flex-1 text-sm">
            <b className="text-slate-200">Your photo (optional)</b>
            <span className="block text-xs text-slate-400">{pic ? (pic.prefs.onReels && pic.prefs.guardianOk ? 'It will show at the bottom of the reels you make.' : 'Saved. To show it on reels, a parent must agree (tap the photo).') : 'Upload a photo or take a selfie. It is shown at the bottom of your reels.'}</span>
          </div>
          <button type="button" onClick={() => setPicOpen(true)} className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold">{pic ? 'Change' : 'Add photo'}</button>
        </div>
        {picOpen && <PhotoEditor current={pic?.image ?? null} prefs={pic?.prefs ?? { onReels: true, guardianOk: false }} name={f.name} onSave={async (image, prefs) => { const img = image ?? pic?.image; if (!img) return 'Choose a photo first.'; setPic({ image: img, prefs }); }} onRemove={pic ? async () => { setPic(null); } : undefined} onClose={() => setPicOpen(false)} />}
        {L("Phone / WhatsApp — parent's (optional)", '', <><input className={inp} type="tel" inputMode="tel" autoComplete="tel" value={f.guardianPhone} onChange={(e) => set('guardianPhone', e.target.value)} placeholder={f.country === 'India' ? '10 digits' : 'With country code, e.g. +971…'} data-guardian-phone /><span className="mt-1 block text-xs font-medium text-slate-400">If you forget your Student ID or password, the school office finds you with it.</span></>)}
        {L('E-mail (optional)', '', <input className={inp} type="email" inputMode="email" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} data-email />)}
        {L(required ? 'School ID, teacher ID, class code or coupon' : 'School ID (SC-…), teacher ID (TS-…), class code or coupon (optional)', '', <div className="flex gap-2"><input className={`${inp} font-mono uppercase`} value={f.coupon} onChange={(e) => { set('coupon', e.target.value); setCp(null); setFromLink(false); }} onBlur={checkCoupon} autoCapitalize="characters" placeholder={refCode ? `Code: ${refCode}` : '8 letters, e.g. ABCD1234'} data-coupon /><button type="button" onClick={checkCoupon} className="mt-1 shrink-0 rounded-xl border border-white/15 px-4 text-sm font-bold">Check</button></div>)}
        {fromLink && !group && <p className="text-xs text-cyan-300">This code came from your friend’s link.{cp && !cp.valid ? ' You can still sign up; you are counted as their invite.' : ''}</p>}
        {access?.enabled && ( // V51.9.93: the free trial is the free part of every book
          <p className="rounded-xl bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">🎁 <b>Free trial:</b> {access.freeParts.length ? `Part ${access.freeParts.join(', ')} of every book` : 'sample lessons'} with whiteboard notes, MCQ and revision. The other parts open once the fee is paid.</p>
        )}
        {cp && <p role="status" className={`text-sm ${cp.valid ? 'text-emerald-300' : 'text-rose-300'}`}>{cp.valid ? `✓ ${cp.text}` : cp.text}</p>}
        {err && <p role="alert" className="text-sm text-rose-300">{err}</p>}
        {dup && ( // V51.9.182: two children can share a name; the student decides
          <div role="alert" className="space-y-2 rounded-2xl border border-amber-300/40 bg-amber-400/10 p-4 text-sm text-amber-50" data-duplicate>
            <p><b>A student named {f.name} in Std {f.standard} at {f.school} already has an account. Is this you?</b></p>
            <a href="/ai-guru/student?forgot=id" className="block rounded-xl bg-amber-300 px-4 py-3 text-center font-extrabold text-[#1a1200]">Yes — help me sign in</a>
            <button type="button" onClick={() => void submit(null, true)} className="w-full rounded-xl border border-amber-200/50 px-4 py-3 font-bold">No — I am a different student</button>
          </div>)}
        <button disabled={busy} className="w-full rounded-xl bg-cyan-400 py-3 font-extrabold text-[#04121f] disabled:opacity-60">{busy ? 'Making your account…' : 'Create my account'}</button>
        <p className="text-center text-sm text-slate-400">Already have an account? <a href="/ai-guru/student" className="font-bold text-cyan-300 underline">Sign in</a></p>
        <div className="rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-center text-sm text-slate-300">
          No account? You can still use AI Guru: classes work without one, and what you typed above stays only on this phone (for your reels). An account keeps your Student ID, your class and your progress.
          <a href="/ai-guru/classroom" className="mt-1 block font-bold text-cyan-300 underline" onClick={() => { const next = deviceProfileFrom(f, loadProfile()); if (next) saveProfile(next); }}>Go to a class without an account →</a>
        </div>
      </form>
      <p className="mt-4 text-center text-xs text-slate-400"><a className="underline" href="/ai-guru/safety">How your child’s data is kept safe</a></p>
    </main>
  );
}
