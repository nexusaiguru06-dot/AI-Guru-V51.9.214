'use client';

/**
 * V51.9.155 — "Subscribers": a student's own distribution desk.
 *   1. how it works (share → friend joins with the code already filled in → you earn on every fee they pay)
 *   2. my link, my code, the QR, share buttons, a printable poster, and "make a reel" (every reel carries the link and QR)
 *   3. everyone who joined through me: free trial or enrolled, what I earned on each, new ones marked
 *   4. my commission: earned, pending, to be paid, paid, month by month
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { rupees } from '@/lib/ai-guru/admin/fees';
import { shareText } from '@/lib/ai-guru/admin/affiliate';
import { friendPosterHtml, qrSvg } from '@/lib/ai-guru/share/poster';
import { isLocalOrigin, shareOrigin } from '@/lib/ai-guru/share/join-link';
import { spacedCode, typePlace } from '@/lib/ai-guru/share/join-code';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';

type Row = { key: string; name: string; standard: string; school: string; joined: string; status: 'trial' | 'enrolled'; commission: number; isNew: boolean };
type View = {
  enabled: boolean; admin: boolean;
  me: { name: string; code: string };
  rate: number; offer: { kind: 'percent' | 'flat'; value: number }; payoutDay: number;
  subscribers: Row[];
  totals: { referrals: number; earned: number; pending: number; dueNow: number; paidOut: number; enrolled: number; trial: number; newCount: number };
  months: Array<{ payoutDate: string; amount: number; payments: number; status: 'pending' | 'due' | 'paid' }>;
  nextPayout: { payoutDate: string; amount: number } | null;
};

const ST: Record<string, string> = { paid: 'bg-emerald-400/15 text-emerald-300', due: 'bg-amber-400/15 text-amber-300', pending: 'bg-slate-400/15 text-slate-300' };
const LABEL: Record<string, string> = { paid: 'Paid to you', due: 'To be paid', pending: 'Pending' };
const card = 'rounded-2xl border border-white/10 bg-white/[.04] p-4';
const btn = 'rounded-xl border border-white/15 px-3 py-2 text-sm font-bold hover:bg-white/5';
const th = (d: number) => (d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th');

export const offerText = (o: View['offer']) => (o.value <= 0 ? '' : o.kind === 'flat' ? `₹${o.value.toLocaleString('en-IN')} off the first fee bill` : `${o.value}% off fees`);

export default function SubscribersPage() {
  const page = useSyncExternalStore(() => () => {}, () => window.location.origin, () => '');
  const [v, setV] = useState<View | null>(null);
  const [state, setState] = useState<'loading' | 'out' | 'ok' | 'error'>('loading');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const as = new URLSearchParams(window.location.search).get('as');
    void fetchIfSignedIn(['student', 'admin'], `/api/ai-guru/student-portal/subscribers${as ? `?as=${encodeURIComponent(as)}` : ''}`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) { setState('out'); return; }
        const j = await r.json().catch(() => null);
        if (!j?.ok) { setState('error'); return; }
        setV(j); setState('ok');
        if (!j.admin) { void fetch('/api/ai-guru/student-portal/subscribers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'seen' }) }); window.dispatchEvent(new Event('aig-subscribers-seen')); }
      })
      .catch(() => setState('error'));
  }, []);

  const origin = shareOrigin(page);
  const local = isLocalOrigin(origin);
  const link = v?.me.code ? `${origin}/j/${v.me.code}` : '';
  const qr = useMemo(() => (link ? qrSvg(link) : ''), [link]);

  if (state === 'loading') return <p className="px-4 py-10 text-white/60">Loading…</p>;
  if (state === 'out') return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-10" data-subscribers-signin>
      <h1 className="text-2xl font-extrabold">👥 Subscribers</h1>
      <p className="text-slate-300">Every AI Guru student gets a personal invite link and code. Friends who join with it get a discount, and you earn a share of every fee they pay. Sign in to see your link and everyone who joined through you.</p>
      
      <div className="flex gap-2"><a href="/ai-guru/student" className="rounded-xl bg-cyan-400 px-4 py-2 font-extrabold text-[#04121f]">Sign in</a><a href="/ai-guru/student/signup" className={btn}>Sign up free</a></div>
    </main>
  );
  if (state === 'error' || !v) return <p className="px-4 py-10 text-rose-300">Could not load your subscribers. Please try again.</p>;

  const offer = offerText(v.offer);
  const text = shareText(v.me.name, link), enc = encodeURIComponent;
  const copy = async (what: string, s: string) => { try { await navigator.clipboard.writeText(s); setCopied(what); setTimeout(() => setCopied(''), 2000); } catch { window.prompt('Copy', s); } };
  const share = () => { if (navigator.share) navigator.share({ title: 'AI Guru', text, url: link }).catch(() => undefined); else void copy('link', link); };
  const poster = () => { const w = window.open('', '_blank'); if (!w) return; w.document.write(friendPosterHtml({ firstName: v.me.name, code: spacedCode(v.me.code), offer }, link)); w.document.close(); setTimeout(() => w.print(), 400); };
  const t = v.totals;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 text-slate-100" data-subscribers>
      <header>
        <h1 className="text-2xl font-extrabold">👥 My Subscribers</h1>
        <p className="text-sm text-slate-400">Students who joined AI Guru through your link or code</p>
        {v.admin && <p className="mt-1 text-xs text-amber-200">Admin view of {v.me.name}’s page.</p>}
      </header>

      {!v.enabled && <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">Invites are paused by the AI Guru office right now. Friends can still join with your link and are counted as yours, but no discount or commission is added until invites are switched on again.</p>}

      {/* 1. how it works */}
      <section className="grid gap-3 sm:grid-cols-3" data-how>
        {[
          ['📣', 'Share your link', 'Send it on WhatsApp, Instagram, Facebook or Telegram. Every reel you make already shows your link, QR and code.'],
          ['🎁', 'Your friend joins', `They open the link and your code is filled in by itself on the sign-up form.${offer ? ` They get ${offer}.` : ''}`],
          ['💰', 'You earn', `${v.rate}% of every fee your friend pays, paid to you on the ${v.payoutDay}${th(v.payoutDay)} of the next month.`],
        ].map(([i, h, p], n) => (
          <div key={h} className={card}><div className="text-2xl">{i}</div><div className="mt-1 font-extrabold">{n + 1}. {h}</div><p className="mt-1 text-sm text-slate-300">{p}</p></div>
        ))}
      </section>

      {/* 2. my link */}
      <section className="grid gap-4 rounded-3xl border border-cyan-400/25 bg-cyan-400/[.05] p-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:p-5" data-my-link>
        <div className="mx-auto w-[180px] rounded-xl bg-white p-2.5" aria-label="QR code of your link" dangerouslySetInnerHTML={{ __html: qr }} data-qr />
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-xl bg-black/30 px-3 py-2 text-sm text-cyan-200" data-link>{link}</code><button type="button" onClick={() => void copy('link', link)} className={btn}>{copied === 'link' ? 'Copied ✓' : 'Copy link'}</button></div>
          <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-slate-400">Your code</span><b className="rounded-lg border-2 border-dashed border-cyan-400/60 px-3 py-1 font-mono text-lg tracking-widest text-amber-200" data-code>{spacedCode(v.me.code)}</b><button type="button" onClick={() => void copy('code', v.me.code)} className="text-xs text-cyan-300 underline">{copied === 'code' ? 'Copied ✓' : 'Copy code'}</button><span className="text-xs text-slate-400">Friends can also type it at {typePlace(link)}</span></div>
          {local && <p className="rounded-lg bg-amber-300/10 px-3 py-2 text-xs text-amber-200">⚠ This app is running on this computer ({origin.replace(/^https?:\/\//, '')}), so the link opens only here. Your friends need the app’s public web address: the office sets it once (NEXT_PUBLIC_SITE_URL), and then your link works everywhere.</p>}
          <div className="flex flex-wrap gap-2">
            <a className={btn} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${enc(text)}`}>WhatsApp</a>
            <a className={btn} target="_blank" rel="noreferrer" href={`https://t.me/share/url?url=${enc(link)}&text=${enc(text)}`}>Telegram</a>
            <a className={btn} target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${enc(link)}`}>Facebook</a>
            <a className={btn} target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${enc(text)}`}>X</a>
            <button type="button" onClick={() => void copy('caption', text)} className={btn} title="For Instagram, YouTube or your status">{copied === 'caption' ? 'Copied ✓' : 'Copy caption (Instagram)'}</button>
            <button type="button" onClick={share} className={btn}>More…</button>
            <button type="button" onClick={poster} className={btn} data-poster>🖨 Print a poster</button>
          </div>
          <a href="/ai-guru/reels" className="flex items-center gap-3 rounded-xl border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-sm hover:bg-violet-500/20" data-make-reel>
            <span className="text-2xl">🎬</span><span><b>Make a reel</b> — reels bring the most friends. Every reel you make from a class shows your link on each frame and ends with your QR and code.</span>
          </a>
        </div>
      </section>

      {/* 4. commission (numbers first, they are what students look for) */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5" data-totals>
        {([['Subscribers', String(t.referrals), t.newCount ? `${t.newCount} new` : `${t.enrolled} enrolled · ${t.trial} on trial`], ['Commission earned', rupees(t.earned), ''], ['Pending', rupees(t.pending), 'friends paid this month'], ['To be paid', rupees(t.dueNow), 'the office pays this'], ['Paid to you', rupees(t.paidOut), '']] as const).map(([l, val, sub]) => (
          <div key={l} className={card}><div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{l}</div><div className="mt-1 text-xl font-black">{val}</div>{sub && <div className="text-[11px] text-slate-400">{sub}</div>}</div>
        ))}
      </section>
      {v.nextPayout && <p className="text-sm text-slate-300">Next payout: <b className="text-cyan-300">{v.nextPayout.payoutDate}</b> · {rupees(v.nextPayout.amount)}</p>}

      {/* 3. subscribers */}
      <section className="space-y-2" data-subscriber-list>
        <h2 className="text-lg font-extrabold">Students who joined through you ({v.subscribers.length})</h2>
        {v.subscribers.length === 0 ? (
          <p className={`${card} text-slate-300`}>Nobody has joined with your link yet. Share it with classmates, cousins and friends in other schools — or make a reel from today’s class and post it.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full text-left text-sm"><caption className="sr-only">Your subscribers</caption>
            <thead className="bg-white/5 text-xs uppercase text-slate-400"><tr><th className="p-2">#</th><th className="p-2">Name</th><th className="p-2">Std</th><th className="p-2">School</th><th className="p-2">Joined</th><th className="p-2">Status</th><th className="p-2 text-right">You earned</th></tr></thead>
            <tbody>{v.subscribers.map((r, i) => (
              <tr key={r.key} className={`border-t border-white/10 ${r.isNew ? 'bg-emerald-400/[.06]' : ''}`} data-subscriber>
                <td className="p-2 text-slate-500">{i + 1}</td>
                <td className="p-2 font-bold">{r.name}{r.isNew && <span className="ml-2 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-extrabold text-[#04121f]">NEW</span>}</td>
                <td className="p-2">{r.standard}</td><td className="p-2 text-slate-300">{r.school || '—'}</td><td className="p-2 font-mono text-xs">{r.joined}</td>
                <td className="p-2">{r.status === 'enrolled' ? <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-bold text-emerald-300">Enrolled</span> : <span className="rounded-full bg-slate-400/15 px-2 py-0.5 text-xs font-bold text-slate-300">Free trial</span>}</td>
                <td className="p-2 text-right font-bold text-cyan-300">{rupees(r.commission)}</td>
              </tr>))}</tbody></table></div>
        )}
        {v.subscribers.some((r) => r.status === 'trial') && <p className="text-xs text-slate-400">Friends on the free trial earn you nothing yet; you earn when they pay their fee. A gentle reminder from you helps!</p>}
      </section>

      {v.months.length > 0 && (
        <section className="space-y-2"><h2 className="text-lg font-extrabold">Your commission, month by month</h2>
          <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full text-left text-sm"><thead className="bg-white/5 text-xs uppercase text-slate-400"><tr><th className="p-2">Payout date</th><th className="p-2">Payments</th><th className="p-2 text-right">Commission</th><th className="p-2">Status</th></tr></thead>
            <tbody>{v.months.map((m) => <tr key={m.payoutDate} className="border-t border-white/10"><td className="p-2 font-mono">{m.payoutDate}</td><td className="p-2">{m.payments}</td><td className="p-2 text-right font-bold">{rupees(m.amount)}</td><td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ST[m.status]}`}>{LABEL[m.status]}</span></td></tr>)}</tbody></table></div>
          <p className="text-xs text-slate-400">The AI Guru office pays your commission on the payout date. Questions? Write to the AI Guru office in 💬 Messages (choose “Fee / money”).</p>
        </section>
      )}
    </main>
  );
}
