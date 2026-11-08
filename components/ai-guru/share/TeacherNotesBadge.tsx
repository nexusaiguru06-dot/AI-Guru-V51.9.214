'use client';
import { useEffect, useState } from 'react';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';

/** Red dot (with the number) on the "Teachers Notes" menu item while the teacher has sent something the student has not opened yet. */
export function TeacherNotesBadge() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    const load = () => fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/class-content?count=1', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && j?.ok) setN(j.unseen ?? 0); }).catch(() => {});
    load();
    const id = setInterval(load, 60000);
    const seen = () => setN(0);
    window.addEventListener('aig-teacher-seen', seen);
    return () => { live = false; clearInterval(id); window.removeEventListener('aig-teacher-seen', seen); };
  }, []);
  if (!n) return null;
  return <span role="status" aria-label={`${n} new from your teacher`} className="ml-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold leading-4 text-white shadow-[0_0_8px_rgba(239,68,68,.9)]">{n > 9 ? '9+' : n}</span>;
}
