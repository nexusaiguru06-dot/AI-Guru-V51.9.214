'use client';
/**
 * The two reward counters, fixed to the screen: toffees at the bottom LEFT, chillies at the bottom RIGHT.
 * `studentId` picks whose counters; `server` (optional) is the server-side total used to raise them. `high` lifts them above a quiz window.
 * `inline` (V51.9.180) draws both as one small pill in the page instead, for the classroom header.
 */
import { useEffect, useState } from 'react';
import { currentStudentId } from '@/lib/ai-guru/motion-class/interactive/progress';
import { readRewards, REWARDS_EVENT, seedRewards, shownChillies, type Rewards } from '@/lib/ai-guru/quiz/rewards';
import { studentCode } from '@/lib/ai-guru/quiz/records';
import { Chilli } from './Chilli';
import { Toffee } from './Toffee';

export function useRewards(studentId?: string, server?: Partial<Rewards>): Rewards {
  const [id, setId] = useState('');
  const [r, setR] = useState<Rewards>({ toffees: 0, chillies: 0, redeemed: 0 });
  useEffect(() => { setId(studentId || currentStudentId()); }, [studentId]);
  const sT = server?.toffees, sC = server?.chillies, sR = server?.redeemed;
  useEffect(() => {
    if (!id) return;
    const refresh = () => setR(readRewards(id));
    refresh();
    let live = true;
    if (sT !== undefined || sC !== undefined) setR(seedRewards(id, { toffees: sT ?? 0, chillies: sC ?? 0, redeemed: sR ?? 0 }));
    else fetch(`/api/ai-guru/progress?role=parent&code=${encodeURIComponent(studentCode(id))}`, { cache: 'no-store' }).then((x) => (x.ok ? x.json() : null)).then((j) => { if (live && j?.ok) setR(seedRewards(id, { toffees: j.toffees, chillies: j.chilliesEarned ?? j.chillies, redeemed: j.redeemed ?? 0 })); }).catch(() => undefined);
    const on = (e: Event) => { if (!(e as CustomEvent).detail || (e as CustomEvent).detail === id) refresh(); };
    window.addEventListener(REWARDS_EVENT, on);
    return () => { live = false; window.removeEventListener(REWARDS_EVENT, on); };
  }, [id, sT, sC, sR]);
  return r;
}

export function RewardCounters({ studentId, server, high, ml, inline }: { studentId?: string; server?: Partial<Rewards>; high?: boolean; ml?: boolean; inline?: boolean }) {
  const r = useRewards(studentId, server);
  // V51.9.180 (UX review): in the classroom both counts sit in the header as one small pill, so nothing floats over the lesson.
  if (inline) return (
    <div role="status" data-reward="both" className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-[#0b1426]/80 py-0.5 pl-1.5 pr-2.5 text-sm font-black tabular-nums">
      <span className="flex items-center text-amber-200" data-reward="toffee"><Toffee size={24} /><span aria-hidden>{r.toffees}</span><span className="sr-only">{r.toffees} {ml ? 'ടോഫി' : 'toffees'}</span></span>
      <span className="flex items-center gap-0.5 text-rose-300" data-reward="chilli"><span aria-hidden>{shownChillies(r)}</span><Chilli size={24} /><span className="sr-only">{shownChillies(r)} {ml ? 'മുളക്' : 'chillies'}</span></span>
    </div>
  );
  const z = high ? 'z-[10010]' : 'z-[9980]';
  const base = `fixed bottom-4 ${z} flex items-center gap-2 rounded-full border bg-[#0b1426]/95 py-1.5 shadow-xl`;
  return (
    <>
      <div role="status" aria-label={`${r.toffees} ${ml ? 'ടോഫി' : 'toffees'}`} data-reward="toffee" className={`${base} left-4 border-amber-300/40 pl-2.5 pr-4 text-amber-200`}>
        <Toffee size={34} /><span className="text-lg font-black tabular-nums" aria-live="polite">{r.toffees}</span>
      </div>
      <div role="status" aria-label={`${shownChillies(r)} ${ml ? 'മുളക്' : 'chillies'}`} data-reward="chilli" className={`${base} right-4 border-rose-400/40 pl-4 pr-2.5 text-rose-300`}>
        <span className="text-lg font-black tabular-nums" aria-live="polite">{shownChillies(r)}</span><Chilli size={34} />
      </div>
    </>
  );
}
