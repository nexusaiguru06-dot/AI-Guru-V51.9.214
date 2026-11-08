'use client';
import { useEffect, useState } from 'react';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';

/** V51.9.155: green dot (with the number) on "Subscribers" when friends joined through the student's link since they last looked. */
export function SubscribersBadge() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    const load = () => fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/subscribers?count=1', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && j?.ok) setN(j.unseen ?? 0); }).catch(() => {});
    load();
    const id = setInterval(load, 120000);
    const seen = () => setN(0);
    window.addEventListener('aig-subscribers-seen', seen);
    return () => { live = false; clearInterval(id); window.removeEventListener('aig-subscribers-seen', seen); };
  }, []);
  if (!n) return null;
  return <span role="status" aria-label={`${n} new subscribers`} className="ml-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-extrabold leading-4 text-[#04121f] shadow-[0_0_8px_rgba(16,185,129,.9)]">{n > 9 ? '9+' : n}</span>;
}
