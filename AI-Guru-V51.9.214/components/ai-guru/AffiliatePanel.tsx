'use client';
import { useState } from 'react';
import { rupees } from '@/lib/ai-guru/admin/fees';
import { shareText, type AffiliateReport } from '@/lib/ai-guru/admin/affiliate';

export interface AffiliateInfo { enabled: boolean; code: string; rate: number; friendDiscountPct: number; friendDiscountKind?: 'percent' | 'flat'; payoutDay: number; report: AffiliateReport }
const ST: Record<string, string> = { paid: 'bg-emerald-400/15 text-emerald-300', due: 'bg-amber-400/15 text-amber-300', pending: 'bg-slate-400/15 text-slate-300' };
const LABEL: Record<string, string> = { paid: 'Paid', due: 'To be paid', pending: 'Pending' };
const Chip = ({ s }: { s: string }) => <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ST[s]}`}>{LABEL[s]}</span>;

/** The referral report: totals, month-wise payouts and every referred student with each payment. Used by the student and the admin. */
export function ReferralReport({ report }: { report: AffiliateReport }) {
  const t = report.totals;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {([['Students joined', String(t.referrals), ''], ['Commission earned', rupees(t.earned), ''], ['Pending', rupees(t.pending), 'text-slate-200'], ['To be paid now', rupees(t.dueNow), 'text-amber-300'], ['Paid to you', rupees(t.paidOut), 'text-emerald-300']] as const).map(([l, v, c]) => <div key={l} className="rounded-2xl border border-white/10 bg-white/[.04] p-3"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{l}</div><div className={`mt-1 text-xl font-black ${c}`}>{v}</div></div>)}
      </div>
      {report.nextPayout && <p className="text-sm text-slate-300">Next payout: <b className="text-cyan-300">{report.nextPayout.payoutDate}</b> · {rupees(report.nextPayout.amount)}</p>}
      {report.months.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full text-left text-sm"><caption className="sr-only">Commission by payout date</caption>
          <thead className="bg-white/5 text-xs uppercase text-slate-400"><tr><th className="p-2">Payout date</th><th className="p-2">Payments</th><th className="p-2 text-right">Commission</th><th className="p-2">Status</th></tr></thead>
          <tbody>{report.months.map((m) => <tr key={m.payoutDate} className="border-t border-white/10"><td className="p-2 font-mono">{m.payoutDate}</td><td className="p-2">{m.payments}</td><td className="p-2 text-right font-bold">{rupees(m.amount)}</td><td className="p-2"><Chip s={m.status} /></td></tr>)}</tbody></table></div>)}
      {report.referrals.length === 0 ? <p className="text-slate-400">Nobody has joined with this link yet.</p> : report.referrals.map((r) => (
        <div key={r.student.id} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
          <div className="flex flex-wrap items-baseline gap-x-3"><b>{r.student.name}</b><span className="text-xs text-slate-400">Std {r.student.standard}{r.student.school ? ` · ${r.student.school}` : ''}{r.student.place ? ` · ${r.student.place}` : ''} · joined {r.student.joined}</span>
            <span className="ml-auto text-sm">Billed {rupees(r.billed)} · Paid <b className="text-emerald-300">{rupees(r.paid)}</b> · Pending <b className="text-amber-300">{rupees(r.due)}</b> · You earn <b className="text-cyan-300">{rupees(r.commission)}</b></span></div>
          {r.payments.length === 0 ? <p className="mt-2 text-xs text-slate-400">No payment yet. You earn when this student pays.</p> : (
            <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-slate-400"><tr><th className="py-1 pr-2">Date</th><th className="pr-2 text-right">Amount</th><th className="pr-2 text-right">Your commission</th><th className="pr-2">Payout on</th><th>Status</th></tr></thead>
              <tbody>{r.payments.map((p) => <tr key={p.id} className="border-t border-white/5"><td className="py-1 pr-2 font-mono">{p.date}</td><td className="pr-2 text-right">{rupees(p.amount)}</td><td className="pr-2 text-right font-bold">{rupees(p.commission)} <span className="font-normal text-slate-500">({p.rate}%)</span></td><td className="pr-2 font-mono">{p.payoutDate || '—'}</td><td>{p.commission ? <Chip s={p.status} /> : '—'}</td></tr>)}</tbody></table></div>)}
        </div>))}
    </div>
  );
}

/** "Refer & earn" on the student dashboard: personal link, share buttons and the report.
 *  V51.9.183 (newcomer review): worded for a child — "Invite your friends", how many joined — with the money part
 *  (commission, payouts, each payment) folded under "For parents", in English and Malayalam. */
export default function AffiliatePanel({ info, admin }: { info: AffiliateInfo; admin?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!info.enabled) return null;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const link = `${origin}/ai-guru/student/signup?ref=${info.code}`;
  const text = shareText('', link), enc = encodeURIComponent;
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt('Copy your link', link); } };
  const share = () => { if (navigator.share) navigator.share({ title: 'AI Guru', text, url: link }).catch(() => undefined); else copy(); };
  const btn = 'rounded-xl border border-white/15 px-3 py-2 text-sm font-bold hover:bg-white/5';
  return (
    <section aria-label="Invite your friends" className="space-y-3 rounded-3xl border border-cyan-400/25 bg-cyan-400/[.05] p-4 sm:p-5" data-invite-friends>
      <div><h2 className="text-lg font-extrabold">🤝 Invite your friends</h2><p className="text-sm text-slate-300">Send your link to a friend. When they join AI Guru with it, they get <b>{info.friendDiscountKind === 'flat' ? `₹${info.friendDiscountPct} off their first fee` : `${info.friendDiscountPct}% off their fees`}</b>, and they appear here.</p>
        <p className="mt-1 text-sm font-bold text-emerald-300" data-friends-joined>{info.report.totals.referrals === 1 ? '1 friend has joined' : `${info.report.totals.referrals} friends have joined`}</p></div>
      <div className="flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-xl bg-black/30 px-3 py-2 text-sm text-cyan-200">{link}</code><button type="button" onClick={copy} className={btn}>{copied ? 'Copied ✓' : 'Copy link'}</button></div>
      <p className="text-xs text-slate-400">Your code: <b className="font-mono text-cyan-300">{info.code}</b> · <a href="/ai-guru/subscribers" className="font-bold text-cyan-300 underline">👥 See all your subscribers, QR and poster →</a></p>
      <div className="flex flex-wrap gap-2">
        <a className={btn} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${enc(text)}`}>WhatsApp</a>
        <a className={btn} target="_blank" rel="noreferrer" href={`https://t.me/share/url?url=${enc(link)}&text=${enc(text)}`}>Telegram</a>
        <a className={btn} target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${enc(link)}`}>Facebook</a>
        <a className={btn} target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${enc(text)}`}>X</a>
        <button type="button" onClick={share} className={btn}>More…</button>
      </div>
      {admin && <p className="text-xs text-amber-200">Admin view.</p>}
      <details open={admin} className="rounded-2xl border border-white/10 bg-black/20 p-3" data-parents-earnings>
        <summary className="cursor-pointer text-sm font-bold text-slate-200">For parents: Refer &amp; earn rewards</summary>
        <p className="mt-2 text-sm text-slate-300">For every fee a friend you invited pays, the school gives <b>{info.rate}%</b> back as a reward. It is paid on the {info.payoutDay}th of the next month — please collect it at the school office.</p>
        <div className="mt-3"><ReferralReport report={info.report} /></div>
      </details>
    </section>
  );
}
