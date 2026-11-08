'use client';
/** The quiz button in the classroom. V51.9.180 (UX review): it and the reward counts sit in the classroom header, not floating over the lesson. It reads the lesson the class is on through the lesson bridge, and offers the teacher's question sets. */
import { useEffect, useState } from 'react';
import { lessonBridge } from '@/lib/ai-guru/doubt/lesson-bridge';
import type { QuestionSet } from '@/lib/ai-guru/quiz/sets';
import { currentStudentId } from '@/lib/ai-guru/motion-class/interactive/progress';
import { studentCode, type SessionRecord } from '@/lib/ai-guru/quiz/records';
import { redeemable, type RedoQuestion } from '@/lib/ai-guru/share/redeem';
import { Chilli } from './Chilli';
import { Toffee } from './Toffee';
import { RewardCounters } from './RewardCounters';
import { ToffeeQuiz, type QuizSource } from './ToffeeQuiz';

export function ToffeeQuizDock({ grade, language }: { grade: string | number; language: 'english' | 'malayalam' }) {
  const ml = language === 'malayalam';
  const [src, setSrc] = useState<QuizSource | null>(null);
  const [set, setSet] = useState<QuestionSet | null>(null);
  const [sets, setSets] = useState<QuestionSet[] | null>(null); // non-null: the chooser is open
  const [note, setNote] = useState('');
  const [redo, setRedo] = useState<RedoQuestion[]>([]);
  const [redoRun, setRedoRun] = useState<RedoQuestion[] | null>(null);
  useEffect(() => { if (!note) return; const id = setTimeout(() => setNote(''), 4000); return () => clearTimeout(id); }, [note]);

  const surprise = () => {
    const ctx = lessonBridge.get()?.context();
    const text = ctx?.extracts.map((e) => e.text).join('\n\n').trim() ?? '';
    if (!ctx || text.length < 80) { setNote(ml ? 'ആദ്യം ഒരു പാഠം തുറക്കൂ, പിന്നെ ക്വിസ് ബട്ടൺ അമർത്തൂ.' : 'Open a lesson first, then press the quiz button.'); return; }
    setSet(null); setSrc({ chapter: ctx.chapter, section: ctx.section, text });
  };

  const open = async () => {
    let list: QuestionSet[] = [];
    try { const r = await fetch('/api/ai-guru/question-sets?active=1', { cache: 'no-store' }); if (r.ok) list = ((await r.json()) as { sets: QuestionSet[] }).sets ?? []; } catch { /* offline: only the surprise quiz */ }
    let again: RedoQuestion[] = [];
    try { const r = await fetch(`/api/ai-guru/progress?role=parent&code=${encodeURIComponent(studentCode(currentStudentId()))}`, { cache: 'no-store' }); if (r.ok) again = redeemable(((await r.json()).recent ?? []) as SessionRecord[]); } catch { /* offline: no redo */ }
    setRedo(again);
    if (list.length || again.length) setSets(list); else surprise();
  };

  return (
    <>
      <button onClick={open} aria-label={ml ? 'ടോഫി ക്വിസ്' : 'Toffee quiz'} className="flex min-h-[40px] shrink-0 items-center gap-1 rounded-full border border-amber-300/40 bg-[#0b1426]/80 py-1 pl-1.5 pr-3 text-sm font-extrabold text-amber-200 hover:border-amber-300">
        <Toffee size={26} /> {ml ? 'ക്വിസ്' : 'Quiz'}
      </button>
      <RewardCounters ml={ml} inline />
      {/* while a quiz is open the counts also float above it, so the student sees each toffee land */}
      {(src || redoRun) && <RewardCounters high ml={ml} />}
      {note && <div role="status" className="fixed right-4 top-24 z-[9990] max-w-[280px] rounded-xl border border-amber-300/40 bg-[#0b1426] px-4 py-3 text-xs text-white shadow-xl">{note}</div>}
      {sets && !src && !set && !redoRun && (
        <div role="dialog" aria-modal="true" aria-label="Choose a quiz" className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-3" onClick={() => setSets(null)}>
          <div className="w-full max-w-[460px] space-y-3 rounded-3xl border border-white/10 bg-[#0b1426] p-5 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold">{ml ? 'ഒരു ക്വിസ് തിരഞ്ഞെടുക്കൂ' : 'Choose a quiz'}</h2>
            {redo.length > 0 && <button onClick={() => { setRedoRun(redo); setSets(null); }} className="flex w-full items-center gap-3 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-left hover:border-rose-300"><Chilli size={34} /><span><span className="block font-extrabold">{ml ? 'മുളക് ടോഫിയാക്കാം' : 'Turn my chillies into toffees'}</span><span className="text-xs text-slate-400">{ml ? `${redo.length} ചോദ്യം വീണ്ടും ചെയ്യൂ` : `Redo ${redo.length} missed question${redo.length === 1 ? '' : 's'}`}</span></span></button>}
            {sets.map((s) => (
              <button key={s.id} onClick={() => { setSet(s); setSrc({ chapter: s.chapter || s.name, section: s.name, text: '' }); setSets(null); }} className="flex w-full items-center gap-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-left hover:border-amber-300">
                <Toffee size={36} /><span className="min-w-0 flex-1"><span className="block truncate font-extrabold">{s.name}</span><span className="text-xs text-slate-400">{ml ? 'ടീച്ചറുടെ ക്വിസ്' : 'From your teacher'} · {s.items.length} {ml ? 'ചോദ്യങ്ങൾ' : 'questions'}</span></span>
              </button>))}
            <button onClick={() => { setSets(null); surprise(); }} className="flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-left hover:border-cyan-400"><span className="text-2xl">🎲</span><span><span className="block font-extrabold">{ml ? 'സർപ്രൈസ് ക്വിസ്' : 'Surprise quiz'}</span><span className="text-xs text-slate-400">{ml ? 'ഈ പാഠത്തിൽ നിന്ന്' : 'Made from the lesson you are in'}</span></span></button>
            <button onClick={() => setSets(null)} className="w-full rounded-xl border border-white/20 py-2 text-sm font-bold">{ml ? 'അടയ്ക്കുക' : 'Close'}</button>
          </div>
        </div>)}
      {redoRun && <ToffeeQuiz source={{ chapter: '', section: '', text: '' }} redeem={redoRun} grade={grade} language={language} onClose={() => setRedoRun(null)} />}
      {src && <ToffeeQuiz source={src} set={set} grade={grade} language={language} onClose={() => { setSrc(null); setSet(null); }} />}
    </>
  );
}
