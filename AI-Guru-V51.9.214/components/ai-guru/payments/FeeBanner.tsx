'use client';
/**
 * V51.9.185 — the fee banner for a signed-in student (classroom, My account, library):
 *  over  → "Your grace period is over, please make payment to continue" (red; Parts 2–10 are locked until paid)
 *  grace → the fee was due on …, pay by … to keep Parts 2–10 open (amber)
 *  today / soon → a reminder (blue)
 * With "💳 Pay by UPI". Nothing shows when no fee is due (or the office gave extra days).
 */
import { useEffect, useState } from 'react';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';
import type { Due, DueStage } from '@/lib/ai-guru/admin/dues';

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function FeeBanner({ payHref = '/ai-guru/student#pay' }: { payHref?: string }) {
  const [d, setD] = useState<{ stage: DueStage | null; items: Due[] } | null>(null);
  useEffect(() => { fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/me', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => j?.dues && setD(j.dues)).catch(() => undefined); }, []);
  if (!d?.stage || d.stage === 'held') return null;
  const items = d.items.filter((x) => x.stage === d.stage);
  const total = items.reduce((a, x) => a + x.amount, 0);
  const first = items[0];
  const tone = d.stage === 'over' ? 'border-rose-400/60 bg-rose-500/15 text-rose-50' : d.stage === 'grace' ? 'border-amber-300/60 bg-amber-400/15 text-amber-50' : 'border-cyan-300/40 bg-cyan-400/10 text-cyan-50';
  return (
    <section role={d.stage === 'over' ? 'alert' : 'status'} className={`mx-auto my-3 flex w-full max-w-5xl flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${tone}`} data-fee-banner={d.stage}>
      <span className="text-2xl" aria-hidden>{d.stage === 'over' ? '⚠️' : d.stage === 'grace' ? '⏳' : '🔔'}</span>
      <span className="min-w-0 flex-1 text-sm">
        {d.stage === 'over' ? <>
          <b className="block text-base">Your grace period is over, please make payment to continue.</b>
          <span className="block">{inr(total)} was due on {first.dueDate}. Parts 2–10 are locked until it is paid; Part 1, your progress and your Student ID are safe.</span>
          
        </> : d.stage === 'grace' ? <>
          <b className="block">Your fee of {inr(total)} was due on {first.dueDate}.</b>
          <span className="block">Please pay by {first.graceUntil} to keep Parts 2–10 open.</span>
        </> : <>
          <b className="block">{d.stage === 'today' ? `Your fee of ${inr(total)} is due today.` : `Your fee of ${inr(total)} is due on ${first.dueDate}.`}</b>
        </>}
      </span>
      <a href={payHref} className={`inline-flex min-h-[44px] items-center rounded-xl px-4 font-extrabold ${d.stage === 'over' ? 'bg-rose-400 text-[#2a0b10]' : 'bg-amber-300 text-[#1a1200]'}`} data-fee-pay>💳 Pay by UPI</a>
    </section>
  );
}
