'use client';
/**
 * Toffee quiz (V51.9.62): surprising multiple-choice questions on what the student is learning. Each right answer
 * earns a toffee that is stuck to the progress bar; the end shows "You earned = N Toffees". The finished session is
 * saved for the teacher and parent portals (lib/ai-guru/quiz/records.ts).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { callAiGuruText } from '@/lib/ai-guru/byok-providers';
import { currentStudentId } from '@/lib/ai-guru/motion-class/interactive/progress';
import { generateMcqs, summarise, chilliesFor, toffeesFor, type McqAnswer, type McqItem, type McqKind } from '@/lib/ai-guru/quiz/mcq';
import { saveRecord, studentCode, type SessionRecord } from '@/lib/ai-guru/quiz/records';
import type { QuestionSet } from '@/lib/ai-guru/quiz/sets';
import { Toffee } from './Toffee';
import { Chilli } from './Chilli';
import { ShareCard } from '@/components/ai-guru/share/ShareCard';
import type { RedoQuestion } from '@/lib/ai-guru/share/redeem';
import { addReward } from '@/lib/ai-guru/quiz/rewards';

type Lang = 'english' | 'malayalam';
const T = {
  english: { title: 'Surprise quiz', make: 'Making your surprise questions…', start: 'Start', next: 'Next', finish: 'See my toffees', name: 'Your name', nameHint: 'Your teacher and parents will see it', earned: 'You earned', toffees: 'Toffees', again: 'New quiz', close: 'Close', golden: 'Golden question · 2 toffees', redoTitle: 'Redo my chillies', redoSub: 'Answer right: a chilli turns into a toffee', redoWin: 'Right! A chilli became a toffee +1', redoStays: 'Not yet. It stays a chilli. Try again later.', chilli: 'chilli', chillies: 'chillies', right: 'Right!', wrong: 'Not this time', streak: 'Streak bonus +1', box: 'Perfect box bonus', saved: 'Sent to your teacher and parents', pending: 'Saved on this device. It will be sent when you are online.', code: 'Parent code', retry: 'Try again', noLesson: 'Open a lesson first, then press the quiz button.', high: 'Brilliant! You really know this.', mid: 'Good work! A little more practice and it is perfect.', low: 'Nice try! Watch the lesson once more and take the quiz again.' },
  malayalam: { title: 'സർപ്രൈസ് ക്വിസ്', make: 'ചോദ്യങ്ങൾ ഒരുക്കുന്നു…', start: 'തുടങ്ങാം', next: 'അടുത്തത്', finish: 'എന്റെ ടോഫികൾ കാണാം', name: 'നിങ്ങളുടെ പേര്', nameHint: 'ടീച്ചറും രക്ഷിതാക്കളും ഇത് കാണും', earned: 'നിങ്ങൾ നേടി', toffees: 'ടോഫികൾ', again: 'പുതിയ ക്വിസ്', close: 'അടയ്ക്കുക', golden: 'ഗോൾഡൻ ചോദ്യം', redoTitle: 'മുളക് ടോഫിയാക്കാം', redoSub: 'ശരിയാക്കിയാൽ ഒരു മുളക് ടോഫിയാകും', redoWin: 'ശരി! ഒരു മുളക് ടോഫിയായി +1', redoStays: 'ഇനിയും ശരിയായില്ല. മുളക് അങ്ങനെ തന്നെ. പിന്നെ വീണ്ടും ശ്രമിക്കൂ.', chilli: 'മുളക്', chillies: 'മുളകുകൾ', right: 'ശരി!', wrong: 'ഇത്തവണ ശരിയായില്ല', streak: 'തുടർച്ച ബോണസ് +1', box: 'പെർഫെക്റ്റ് ബോക്സ് ബോണസ്', saved: 'ടീച്ചർക്കും രക്ഷിതാക്കൾക്കും അയച്ചു', pending: 'ഈ ഉപകരണത്തിൽ സൂക്ഷിച്ചു. ഓൺലൈനിൽ വരുമ്പോൾ അയയ്ക്കും.', code: 'രക്ഷിതാവിന്റെ കോഡ്', retry: 'വീണ്ടും ശ്രമിക്കൂ', noLesson: 'ആദ്യം ഒരു പാഠം തുറക്കൂ, പിന്നെ ക്വിസ് ബട്ടൺ അമർത്തൂ.', high: 'തകർപ്പൻ! നിങ്ങൾക്ക് ഇത് നന്നായി അറിയാം.', mid: 'നന്നായി! കുറച്ചുകൂടി പരിശീലിച്ചാൽ പൂർണ്ണം.', low: 'നല്ല ശ്രമം! പാഠം ഒന്നുകൂടി കണ്ട് വീണ്ടും ക്വിസ് എടുക്കൂ.' },
} as const;

const KIND: Record<McqKind, { icon: string; en: string }> = {
  standard: { icon: '❓', en: 'Question' }, twist: { icon: '🌀', en: 'Twist' }, 'spot-the-mistake': { icon: '🕵️', en: 'Spot the mistake' },
  'what-if': { icon: '🔮', en: 'What if…' }, 'real-life': { icon: '🛒', en: 'Real life' }, 'odd-one-out': { icon: '🎯', en: 'Odd one out' },
};

export interface QuizSource { chapter: string; section: string; text: string }

const llm = async (system: string, user: string) => (await callAiGuruText(system, user, { json: true, maxOutputTokens: 6000 })).text;
const NAME_KEY = 'ai-guru:student-name';
const readName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };

export function ToffeeQuiz({ source, grade, language, onClose, set, redeem }: { source: QuizSource; /** Redo: missed questions asked again. A right answer turns one chilli into a toffee. */ redeem?: RedoQuestion[] | null; grade: string | number; language: Lang; onClose: () => void; /** A teacher's question set: its questions are asked as written. */ set?: QuestionSet | null }) {
  const t = T[language];
  const [phase, setPhase] = useState<'name' | 'making' | 'asking' | 'done' | 'error'>(() => (readName() ? 'making' : 'name'));
  const [name, setName] = useState(readName);
  const [items, setItems] = useState<McqItem[]>([]);
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [answers, setAnswers] = useState<McqAnswer[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<boolean | null>(null);
  const shownAt = useRef(0);
  const [round, setRound] = useState(0);
  const studentId = useMemo(() => currentStudentId(), []);

  useEffect(() => {
    if (phase !== 'making') return;
    let live = true;
    setItems([]); setI(0); setChosen(null); setAnswers([]); setSaved(null);
    if (redeem?.length) { setItems(redeem.map((q) => q.item)); setPhase('asking'); shownAt.current = Date.now(); return; }
    if (set) { setItems(set.items); setPhase('asking'); shownAt.current = Date.now(); return; }
    generateMcqs(llm, { ...source, count: 5, language, grade })
      .then((q) => { if (live) { setItems(q); setPhase('asking'); shownAt.current = Date.now(); } })
      .catch((e) => { if (live) { setError(e instanceof Error ? e.message : String(e)); setPhase('error'); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === 'making', round]);

  const q = items[i];
  const streakBefore = useMemo(() => { let s = 0; for (const a of answers) s = a.correct ? s + 1 : 0; return s; }, [answers]);
  const total = answers.reduce((s, a) => s + a.toffees, 0);
  const chillyTotal = answers.reduce((s, a) => s + a.chillies, 0);

  const pick = useCallback((id: string) => {
    if (!q || chosen) return;
    const correct = id === q.answer;
    setChosen(id);
    const toffees = redeem ? (correct ? 1 : 0) : toffeesFor(q, correct, streakBefore), chillies = redeem ? 0 : chilliesFor(correct);
    setAnswers((a) => [...a, { id: q.id, chosen: id as McqAnswer['chosen'], correct, toffees, chillies, ms: Date.now() - shownAt.current }]);
    addReward(studentId, redeem ? (correct ? { toffees: 1, redeemed: 1 } : {}) : { toffees, chillies }, { reported: true }); // the counters at the bottom of the screen move at once
  }, [q, chosen, streakBefore, studentId]);

  const summary0 = useMemo(() => summarise(answers, items.length || answers.length), [answers, items.length]);
  const summary = redeem ? { ...summary0, toffees: summary0.correct, chillies: 0, fullBox: 0 } : summary0;

  const next = () => {
    if (i + 1 < items.length) { setI(i + 1); setChosen(null); shownAt.current = Date.now(); return; }
    setPhase('done');
    const rec: SessionRecord = {
      id: `${studentId}:${redeem ? 'redo:' : ''}${Date.now()}`, ...(redeem ? { kind: 'redo' as const, redeem: answers.flatMap((a, k) => (a.correct && redeem[k] ? [redeem[k].key] : [])) } : {}), studentId, code: studentCode(studentId), studentName: name || 'Student', at: new Date().toISOString(), grade: String(grade),
      chapter: set ? set.chapter || set.name : source.chapter, section: set ? set.name : source.section, ...(set ? { setId: set.id, setName: set.name } : {}), total: summary.total, correct: summary.correct, pct: summary.pct, toffees: summary.toffees, chillies: summary.chillies, tier: summary.tier, bestStreak: summary.bestStreak,
      seconds: Math.round(answers.reduce((s, a) => s + a.ms, 0) / 1000),
      items: answers.map((a, k) => ({ id: a.id, kind: items[k].kind, stem: items[k].stem, concept: items[k].concept, chosen: a.chosen, answer: items[k].answer, correct: a.correct, toffees: a.toffees, chillies: a.chillies, seconds: Math.round(a.ms / 1000), options: items[k].options, why: items[k].why })),
    };
    saveRecord(rec).then(setSaved).catch(() => setSaved(false));
  };

  const last = answers.at(-1);
  const gotStreak = !!last?.correct && q && last.toffees > (q.golden ? 2 : 1);

  return (
    <div role="dialog" aria-modal="true" aria-label={t.title} className="tq-root fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <style>{CSS}</style>
      <div className="relative flex max-h-[94vh] w-full max-w-[640px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b1426] text-white shadow-2xl">
        <header className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
          <Toffee size={44} />
          <div className="min-w-0 flex-1"><div className="text-lg font-extrabold">{redeem ? t.redoTitle : t.title}</div><div className="truncate text-xs text-slate-400">{redeem ? t.redoSub : set ? set.name : source.section || source.chapter}</div></div>
          <div className="flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-sm font-extrabold text-amber-300" aria-live="polite"><Toffee size={22} /> {total}</div>
          <div className="flex items-center gap-1.5 rounded-full bg-rose-500/15 px-3 py-1 text-sm font-extrabold text-rose-300" aria-live="polite"><Chilli size={22} /> {chillyTotal}</div>
          <button onClick={onClose} aria-label={t.close} className="grid h-9 w-9 place-items-center rounded-full text-slate-300 hover:bg-white/10">✕</button>
        </header>

        <div className="overflow-y-auto px-5 py-5">
          {phase === 'name' && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const n = name.trim().slice(0, 40); if (!n) return; try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } setName(n); setPhase('making'); }}>
              <label className="block text-sm font-bold">{t.name}<input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base outline-none focus:border-cyan-400" /></label>
              <p className="text-xs text-slate-400">{t.nameHint}</p>
              <button className="rounded-xl bg-cyan-400 px-6 py-3 font-extrabold text-[#04121f]">{t.start}</button>
            </form>
          )}
          {phase === 'making' && <div className="py-14 text-center"><div className="tq-wob inline-block"><Toffee size={96} /></div><p className="mt-4 text-slate-300">{t.make}</p></div>}
          {phase === 'error' && <div className="space-y-4 py-8 text-center"><p className="text-sm text-rose-300">{error}</p><button onClick={() => { setRound((r) => r + 1); setPhase('making'); }} className="rounded-xl bg-cyan-400 px-5 py-2.5 font-extrabold text-[#04121f]">{t.retry}</button></div>}

          {phase === 'asking' && q && (
            <div className="space-y-4">
              <div className="flex items-center gap-2" aria-label={`${i + 1} / ${items.length}`}>
                {items.map((it, k) => {
                  const a = answers[k];
                  return (
                    <div key={it.id} className={`relative h-9 flex-1 rounded-lg border ${k === i ? 'border-cyan-400' : 'border-white/10'} ${a ? (a.correct ? 'bg-emerald-500/15' : 'bg-rose-500/10') : 'bg-white/5'}`}>
                      {a?.correct && <span className="tq-stick absolute inset-0 grid place-items-center"><Toffee size={34} /></span>}
                      {a && !a.correct && <span className="tq-stick absolute inset-0 grid place-items-center"><Chilli size={30} /></span>}
                      {!a && <span className="absolute inset-0 grid place-items-center text-xs text-slate-500">{k + 1}{it.golden ? ' ✨' : ''}</span>}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="rounded-full bg-violet-400/15 px-3 py-1 text-violet-200">{KIND[q.kind].icon} {KIND[q.kind].en}</span>
                {q.golden && <span className="tq-gold rounded-full bg-amber-400/20 px-3 py-1 text-amber-200">✨ {t.golden}</span>}
              </div>
              <h2 className="text-xl font-extrabold leading-snug">{q.stem}</h2>
              <div className="grid gap-2.5">
                {q.options.map((o) => {
                  const done = !!chosen; const isAns = o.id === q.answer; const mine = o.id === chosen;
                  const cls = !done ? 'border-white/15 bg-white/5 hover:border-cyan-400 hover:bg-cyan-400/10' : isAns ? 'border-emerald-400 bg-emerald-500/20' : mine ? 'tq-shake border-rose-400 bg-rose-500/15' : 'border-white/10 bg-white/[.03] opacity-60';
                  return (
                    <button key={o.id} disabled={done} onClick={() => pick(o.id)} className={`flex min-h-[52px] items-center gap-3 rounded-2xl border px-4 py-2.5 text-left text-base font-semibold transition ${cls}`}>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-extrabold">{o.id}</span><span>{o.text}</span>
                    </button>
                  );
                })}
              </div>
              {chosen && last && (
                <div className={`rounded-2xl border p-4 ${last.correct ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-rose-400/40 bg-rose-500/10'}`} role="status">
                  <div className="flex items-center gap-2 font-extrabold">
                    {last.correct ? <><span className="tq-pop"><Toffee size={44} /></span><span className="text-emerald-300">{redeem ? t.redoWin : `${t.right} +${last.toffees}`}</span></> : <><span className="tq-pop"><Chilli size={44} /></span><span className="text-rose-300">{redeem ? t.redoStays : `${t.wrong} · +1 ${t.chilli}`}</span></>}
                    {gotStreak && <span className="ml-auto text-xs text-amber-300">{t.streak}</span>}
                  </div>
                  <p className="mt-2 text-sm text-slate-200">{q.why}</p>
                </div>
              )}
              {chosen && <button onClick={next} className="w-full rounded-xl bg-cyan-400 px-6 py-3 font-extrabold text-[#04121f]">{i + 1 < items.length ? t.next : t.finish}</button>}
            </div>
          )}

          {phase === 'done' && (
            <div className="space-y-5 text-center">
              <Ring pct={summary.pct} />
              <div>
                <div className="text-sm font-bold uppercase tracking-widest text-slate-400">{summary.correct} / {summary.total}</div>
                <div className="mt-1 text-3xl font-black text-amber-300">{t.earned} = {summary.toffees} {t.toffees}</div>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5" aria-hidden>{Array.from({ length: Math.min(summary.toffees, 24) }, (_, k) => <span key={k} className="tq-pop" style={{ animationDelay: `${k * 70}ms` }}><Toffee size={34} /></span>)}</div>
              {summary.chillies > 0 && <div className="flex flex-wrap items-center justify-center gap-1.5 text-sm font-bold text-rose-300"><span>{summary.chillies} {summary.chillies === 1 ? t.chilli : t.chillies}</span>{Array.from({ length: Math.min(summary.chillies, 12) }, (_, k) => <span key={k} className="tq-pop" style={{ animationDelay: `${k * 70}ms` }}><Chilli size={30} /></span>)}</div>}
              {summary.fullBox > 0 && <div className="text-sm font-bold text-amber-200">🎁 {t.box} +{summary.fullBox}</div>}
              <p className="text-slate-200">{t[summary.tier]}</p>
              <p className="text-xs text-slate-400">{saved === null ? '…' : saved ? `✓ ${t.saved}` : t.pending} · {t.code}: <b className="text-white">{studentCode(studentId)}</b></p>
              {!redeem && <ShareCard name={name || 'Student'} correct={summary.correct} total={summary.total} pct={summary.pct} toffees={summary.toffees} chillies={summary.chillies} lang={language} />}
              <div className="flex justify-center gap-3">
                <button onClick={() => { setRound((r) => r + 1); setPhase('making'); }} className={`rounded-xl bg-cyan-400 px-5 py-2.5 font-extrabold text-[#04121f] ${redeem ? 'hidden' : ''}`}>{t.again}</button>
                <button onClick={onClose} className="rounded-xl border border-white/20 px-5 py-2.5 font-bold">{t.close}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 52; const c = 2 * Math.PI * r;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className="mx-auto" role="img" aria-label={`${pct}%`}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="12" />
      <circle cx="70" cy="70" r={r} fill="none" stroke="#fbbf24" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 70 70)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <text x="70" y="78" textAnchor="middle" fontSize="30" fontWeight="800" fill="#fff">{pct}%</text>
    </svg>
  );
}

const CSS = `
@keyframes tq-pop{0%{transform:scale(0) rotate(-25deg);opacity:0}60%{transform:scale(1.25) rotate(8deg);opacity:1}100%{transform:scale(1) rotate(0)}}
@keyframes tq-stick{0%{transform:translateY(-26px) scale(1.7);opacity:0}70%{transform:translateY(2px) scale(.95);opacity:1}100%{transform:none}}
@keyframes tq-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes tq-wob{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg) translateY(-6px)}}
@keyframes tq-gold{0%,100%{box-shadow:0 0 0 0 rgba(251,191,36,.5)}50%{box-shadow:0 0 0 7px rgba(251,191,36,0)}}
.tq-pop{display:inline-block;animation:tq-pop .5s cubic-bezier(.2,1.4,.4,1) both}
.tq-stick{animation:tq-stick .55s ease-out both}
.tq-shake{animation:tq-shake .35s}
.tq-wob{animation:tq-wob 1.2s ease-in-out infinite}
.tq-gold{animation:tq-gold 1.6s infinite}
@media (prefers-reduced-motion:reduce){.tq-pop,.tq-stick,.tq-shake,.tq-wob,.tq-gold{animation:none}}
`;
