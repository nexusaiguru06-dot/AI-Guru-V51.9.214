'use client';
import { useEffect, useState } from 'react';
import { ExamRunner, type ExamItem } from './ExamRunner';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';

/**
 * Inside the regular class: when the teacher sends an exam into the class, a red "Quiz from your teacher" button appears for that
 * class's students (nobody else). They answer here without leaving the lesson; the mark goes straight to the teacher's results.
 */
export function TeacherQuizDock() {
  const [live, setLive] = useState<{ id: string; title: string } | null>(null);
  const [item, setItem] = useState<ExamItem | null>(null); const [open, setOpen] = useState(false);
  useEffect(() => {
    let on = true;
    const poll = () => fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/class-content?count=1', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (on && j?.ok) setLive(j.live ?? null); }).catch(() => {});
    poll(); const id = setInterval(poll, 30000);
    return () => { on = false; clearInterval(id); };
  }, []);
  const start = async () => {
    const j = await fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/class-content', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    const it = (j?.items ?? []).find((x: { id: string }) => x.id === live?.id);
    if (it) { setItem(it); setOpen(true); }
  };
  if (!live && !open) return null;
  return (
    <>
      {live && !open && <button onClick={() => void start()} className="fixed bottom-40 left-4 z-[9990] flex items-center gap-2 rounded-full border border-red-400/60 bg-[#2a0b10]/95 py-2 pl-3 pr-4 text-sm font-extrabold text-white shadow-xl" aria-label="Quiz from your teacher"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)]" /> 📝 Quiz from your teacher</button>}
      {open && item && (
        <div role="dialog" aria-modal="true" aria-label={item.title} className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-3">
          <div className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-3xl border border-white/10 bg-[#0b1426] p-5 text-white shadow-2xl">
            <h2 className="text-lg font-extrabold">📝 {item.title}</h2>
            <ExamRunner item={item} onDone={() => setLive(null)} />
            <button onClick={() => setOpen(false)} className="mt-4 w-full rounded-xl border border-white/20 py-2 text-sm font-bold">Close</button>
          </div>
        </div>
      )}
    </>
  );
}
