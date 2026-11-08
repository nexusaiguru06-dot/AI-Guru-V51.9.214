'use client';

/**
 * V51.9.98 — "Show your paper". The student holds a written page in front of the camera
 * (or picks a photo), AI Guru reads it line by line, the student checks the reading, then
 * asks about it — by typing, by voice, or with one tap ("Check my work", "Explain this page"…).
 * Answers name the lines they talk about (highlighted on the paper), point out mistakes on
 * the paper, and are read aloud in English or Malayalam.
 *
 * Opens as a full-screen sheet from the doubt dock in the classroom, or as its own page
 * (/ai-guru/student/paper). Inside a class it holds the lesson and knows the chapter.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lessonBridge } from '@/lib/ai-guru/doubt/lesson-bridge';
import { boardName, gradeBandGuidance, languageInstruction } from '@/lib/teacher-prompts-client';
import { READINESS_TEXT, readiness, steadyStep, type Grey, type Readiness } from '@/lib/ai-guru/doubt/paper/image';
import { editLine, insertLine, mustRetake, qualityNote, QUICK_ASKS, quickAsk, type PaperAnswer, type PaperLang, type PaperReading, type PaperTurn } from '@/lib/ai-guru/doubt/paper/paper';
import { askPaper, canListen, captureStill, hasGeminiKey, listen, lookAt, offlineVisionReady, photoFromFile, readPaper, speakAnswer, type PaperPhoto, type Speaking } from '@/lib/ai-guru/doubt/paper/client';

type Phase = 'camera' | 'pages' | 'reading' | 'confirm' | 'chat';
const MAX_PAGES = 4;

export interface PaperDoubtProps {
  grade: string;
  boardId?: string;
  language: PaperLang;
  /** 'sheet' covers the screen above the classroom; 'page' fills its own page. */
  mode?: 'sheet' | 'page';
  onClose?: () => void;
  /** Called once the student has confirmed the reading (the live voice session uses it). */
  onReading?: (reading: PaperReading, photos: PaperPhoto[]) => void;
  /** Pause a playing class while the sheet is open (default true; off when a live doubt session already holds it). */
  holdLesson?: boolean;
}

const T = (lang: PaperLang, en: string, ml: string) => (lang === 'malayalam' ? ml : en);

export function PaperDoubt({ grade, boardId = 'kerala', language, mode = 'sheet', onClose, onReading, holdLesson = true }: PaperDoubtProps) {
  const [lang, setLang] = useState<PaperLang>(language);
  const [phase, setPhase] = useState<Phase>('camera');
  const [photos, setPhotos] = useState<PaperPhoto[]>([]);
  const [reading, setReading] = useState<PaperReading | null>(null);
  const [turns, setTurns] = useState<PaperTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ n: number; text: string; add?: boolean } | null>(null);
  const [focusLines, setFocusLines] = useState<number[]>([]);
  const [voiceOn, setVoiceOn] = useState(true);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const [paperOpen, setPaperOpen] = useState(true);

  // camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const lookCanvas = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camError, setCamError] = useState('');
  const [ready, setReady] = useState<Readiness | null>(null);
  const [auto, setAuto] = useState(true);
  const [steadyPct, setSteadyPct] = useState(0);
  const [torch, setTorch] = useState<boolean | null>(null); // null = not supported
  const [flash, setFlash] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const speakRef = useRef<Speaking | null>(null);
  const listenRef = useRef<{ stop(): void } | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const lastTurn = useRef<HTMLDivElement>(null);

  const canAI = hasGeminiKey() || offlineVisionReady();

  // a class that is playing waits while the student asks about their paper
  useEffect(() => {
    if (!holdLesson) return;
    lessonBridge.get()?.hold();
    return () => lessonBridge.get()?.release();
  }, [holdLesson]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    setCamError('');
    stopCamera();
    try {
      let s: MediaStream;
      try {
        s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } } });
      } catch {
        s = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }
      streamRef.current = s;
      const track = s.getVideoTracks()[0];
      const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean; focusMode?: string[] };
      setTorch(caps.torch ? false : null);
      if (caps.focusMode?.includes('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {});
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCamError(T(lang, 'Allow the camera to show your paper — or choose a photo instead.', 'പേപ്പർ കാണിക്കാൻ ക്യാമറ അനുവദിക്കൂ — അല്ലെങ്കിൽ ഒരു ഫോട്ടോ തിരഞ്ഞെടുക്കൂ.'));
    }
  }, [lang, stopCamera]);

  useEffect(() => {
    if (phase === 'camera') void startCamera();
    else stopCamera();
    return undefined;
  }, [phase, startCamera, stopCamera]);
  useEffect(() => () => { stopCamera(); speakRef.current?.stop(); listenRef.current?.stop(); abortRef.current?.abort(); }, [stopCamera]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || torch === null) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch { setTorch(null); }
  };

  const addPhoto = useCallback((p: PaperPhoto) => {
    setPhotos((ps) => [...ps, p].slice(0, MAX_PAGES));
    setPhase('pages');
  }, []);

  const shoot = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
      addPhoto(await captureStill(v));
    } catch (e) {
      setCamError((e as Error).message);
    }
  }, [addPhoto]);

  // look at the camera a few times a second; take the photo when the page is steady and sharp
  useEffect(() => {
    if (phase !== 'camera') return;
    let prev: Grey | null = null;
    let state: { since: number | null } = { since: null };
    let fired = false;
    const opened = performance.now(); // give the student a moment to lift the paper before anything is taken
    const t = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      lookCanvas.current ??= document.createElement('canvas');
      const res = lookAt(v, lookCanvas.current, prev);
      if (!res) return;
      prev = res.grey;
      const r = readiness(res.look);
      setReady(r);
      const step = steadyStep(state, r, performance.now());
      state = step;
      setSteadyPct(step.since === null ? 0 : Math.min(1, (performance.now() - step.since) / 1200));
      if (auto && step.fire && !fired && performance.now() - opened > 2000) {
        fired = true;
        void shoot();
      }
    }, 250);
    return () => window.clearInterval(t);
  }, [phase, auto, shoot]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError('');
    try { addPhoto(await photoFromFile(f)); } catch (e) { setError((e as Error).message); }
  };

  /* ---------------- reading ---------------- */

  const read = async () => {
    if (!photos.length) return;
    setError('');
    if (!hasGeminiKey()) {
      // the on-device model cannot write the page out reliably: go straight to questions about the photo
      setReading(null);
      setPhase('chat');
      return;
    }
    setPhase('reading');
    abortRef.current = new AbortController();
    try {
      const r = await readPaper(photos, abortRef.current.signal);
      setReading(r);
      setPhase('confirm');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError((e as Error).message);
      setPhase('pages');
    }
  };

  const confirmed = () => {
    if (!reading) return;
    setPhase('chat');
    onReading?.(reading, photos);
  };

  const retake = () => {
    abortRef.current?.abort();
    setPhotos([]);
    setReading(null);
    setTurns([]);
    setFocusLines([]);
    setError('');
    setPhase('camera');
  };

  /* ---------------- asking ---------------- */

  const lessonCtx = () => {
    const c = lessonBridge.get()?.context();
    return c ? { lessonNote: `Chapter "${c.chapter}", section "${c.section}". ${c.now}`.trim(), extracts: c.extracts } : {};
  };

  const say = (idx: number, text: string) => {
    speakRef.current?.stop();
    setSpeakingIdx(idx);
    const s = speakAnswer(text, lang);
    speakRef.current = s;
    void s.done.finally(() => setSpeakingIdx((i) => (i === idx ? null : i)));
  };

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    speakRef.current?.stop();
    setError('');
    setInput('');
    const next: PaperTurn[] = [...turns, { role: 'student', text: q }];
    setTurns(next);
    setBusy(true);
    abortRef.current = new AbortController();
    try {
      const a: PaperAnswer = await askPaper(reading, next, photos, {
        grade,
        boardName: boardName(boardId),
        gradeGuidance: gradeBandGuidance(grade),
        languageLine: lang === 'malayalam'
          ? 'Reply mainly in Malayalam using Malayalam script. Keep subject technical terms, formulas, symbols and numbers as they are (English terms may stay in English).'
          : languageInstruction('english'),
        lang,
        ...lessonCtx(),
      }, abortRef.current.signal);
      const all: PaperTurn[] = [...next, { role: 'guru', text: a.answer, answer: a }];
      setTurns(all);
      setFocusLines(a.lines);
      if (voiceOn) say(all.length - 1, a.answer);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
      setTurns(turns); // the question can be asked again
      setInput(q);
    } finally {
      setBusy(false);
    }
  };

  const mic = () => {
    if (listening) { listenRef.current?.stop(); return; }
    speakRef.current?.stop();
    setListening(true);
    setError('');
    listenRef.current = listen(lang, (t) => setInput(t), (t, err) => {
      setListening(false);
      if (t) void ask(t);
      else if (err) setError(err);
    });
  };

  useEffect(() => {
    if (mode !== 'sheet' || !onClose) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !editing) close(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, onClose, editing]);

  // a new answer is shown from its first line (long answers would otherwise open at their end)
  useEffect(() => {
    const last = turns[turns.length - 1];
    if (last?.role === 'guru' && !busy) lastTurn.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, busy]);

  const close = () => {
    speakRef.current?.stop();
    listenRef.current?.stop();
    abortRef.current?.abort();
    stopCamera();
    onClose?.();
  };

  const lineById = useMemo(() => new Map((reading?.lines ?? []).map((l) => [l.n, l])), [reading]);
  const qNote = reading ? qualityNote(reading.quality, lang) : null;

  /* ---------------- view ---------------- */

  const shell = mode === 'sheet'
    ? 'fixed inset-0 z-[1100] flex flex-col bg-[#050915] text-white'
    : 'flex min-h-[calc(100vh-56px)] flex-col bg-[#050915] text-white';
  const chip = 'rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40';

  const PaperLines = ({ compact = false }: { compact?: boolean }) => (
    <ol className={`space-y-1 ${compact ? 'text-[13px]' : 'text-sm'}`}>
      {reading?.lines.map((l) => {
        const hot = focusLines.includes(l.n);
        const wrong = turns.some((t) => t.answer?.mistakes.some((m) => m.line === l.n));
        return (
          <li key={l.n} id={`paper-line-${l.n}`}
            className={`flex gap-2 rounded-lg px-2 py-1 transition ${hot ? 'bg-amber-400/15 ring-1 ring-amber-400/60' : ''} ${l.unclear ? 'border-l-2 border-amber-400/70' : ''}`}>
            <span className="w-6 shrink-0 text-right font-mono text-[11px] leading-6 text-slate-500">{l.n}</span>
            <span className={`flex-1 whitespace-pre-wrap leading-6 ${l.kind === 'heading' ? 'font-bold text-cyan-200' : l.kind === 'math' ? 'font-mono text-slate-100' : l.kind === 'diagram' ? 'italic text-violet-200' : 'text-slate-200'} ${wrong ? 'decoration-rose-400 decoration-wavy underline underline-offset-4' : ''}`}>
              {l.text}
              {l.edited && <span className="ml-1 text-[10px] text-emerald-300">✎</span>}
            </span>
            {phase === 'confirm' && (
              <button className="shrink-0 text-[11px] text-cyan-300 hover:underline" onClick={() => setEditing({ n: l.n, text: l.text })}>{T(lang, 'Fix', 'തിരുത്തുക')}</button>
            )}
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className={shell} role="dialog" aria-label="Ask about your paper">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="text-xl">📄</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-extrabold">{T(lang, 'Ask about your paper', 'നിങ്ങളുടെ പേപ്പറിനെക്കുറിച്ച് ചോദിക്കൂ')}</div>
          <div className="truncate text-[11px] text-slate-400">
            {phase === 'camera' && T(lang, 'Hold your notes, homework or question paper in front of the camera', 'നോട്ട്, ഹോംവർക്ക് അല്ലെങ്കിൽ ചോദ്യപേപ്പർ ക്യാമറയുടെ മുന്നിൽ പിടിക്കൂ')}
            {phase === 'pages' && T(lang, `${photos.length} page${photos.length > 1 ? 's' : ''} ready`, `${photos.length} പേജ് തയ്യാർ`)}
            {phase === 'reading' && T(lang, 'Reading your paper…', 'പേപ്പർ വായിക്കുന്നു…')}
            {phase === 'confirm' && T(lang, 'Check that I read it right', 'ഞാൻ ശരിയായി വായിച്ചോ എന്ന് നോക്കൂ')}
            {phase === 'chat' && (reading?.title || reading?.summary || T(lang, 'Ask anything about this paper', 'ഈ പേപ്പറിനെക്കുറിച്ച് എന്തും ചോദിക്കൂ'))}
          </div>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-white/15 text-[11px] font-bold">
          <button className={`px-2 py-1 ${lang === 'english' ? 'bg-cyan-500 text-[#04121f]' : 'text-slate-300'}`} onClick={() => setLang('english')}>EN</button>
          <button className={`px-2 py-1 ${lang === 'malayalam' ? 'bg-cyan-500 text-[#04121f]' : 'text-slate-300'}`} onClick={() => setLang('malayalam')}>ML</button>
        </div>
        {onClose && <button onClick={close} className="rounded-lg px-2 py-1 text-lg text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close">✕</button>}
      </div>

      {!canAI && (
        <div className="mx-4 mt-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {T(lang, 'Add your free Gemini key in Settings first — AI Guru uses it to read your paper.', 'ആദ്യം Settings-ൽ നിങ്ങളുടെ സൗജന്യ Gemini key ചേർക്കൂ.')}{' '}
          <a href="/ai-guru/settings/gemini" className="font-bold underline">Settings →</a>
        </div>
      )}

      {/* CAMERA */}
      {phase === 'camera' && (
        <div className="ag-keep-dark relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-black">
          <video ref={videoRef} playsInline muted autoPlay className="h-full max-h-[calc(100vh-170px)] w-full object-contain" />
          {/* page frame */}
          <div className={`pointer-events-none absolute inset-[7%] rounded-2xl border-[3px] border-dashed transition ${ready === 'ready' ? 'border-emerald-400' : ready === 'moving' ? 'border-amber-300' : 'border-white/50'}`}>
            {['left-0 top-0 border-l-4 border-t-4', 'right-0 top-0 border-r-4 border-t-4', 'left-0 bottom-0 border-l-4 border-b-4', 'right-0 bottom-0 border-r-4 border-b-4'].map((c) => (
              <span key={c} className={`absolute h-8 w-8 rounded-sm border-white ${c}`} />
            ))}
          </div>
          {flash && <div className="absolute inset-0 bg-white/80" />}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold">
            {camError || (ready ? READINESS_TEXT[ready][lang === 'malayalam' ? 'ml' : 'en'] : T(lang, 'Starting the camera…', 'ക്യാമറ തുടങ്ങുന്നു…'))}
            {auto && ready === 'ready' && <span className="ml-2 inline-block h-1.5 w-16 overflow-hidden rounded bg-white/20 align-middle"><span className="block h-full bg-emerald-400" style={{ width: `${Math.round(steadyPct * 100)}%` }} /></span>}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 bg-gradient-to-t from-black/90 to-transparent px-4 pb-5 pt-10">
            <button onClick={() => fileRef.current?.click()} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-xl" title={T(lang, 'Choose a photo', 'ഫോട്ടോ തിരഞ്ഞെടുക്കൂ')}>🖼️</button>
            <button onClick={() => void shoot()} disabled={!!camError} className="h-[72px] w-[72px] rounded-full border-4 border-white bg-white/25 shadow-[0_0_0_4px_rgba(0,0,0,0.4)] disabled:opacity-40" aria-label="Take the photo" />
            {torch !== null
              ? <button onClick={toggleTorch} className={`flex h-12 w-12 items-center justify-center rounded-full text-xl ${torch ? 'bg-amber-400 text-black' : 'bg-white/15'}`} title="Torch">🔦</button>
              : <span className="h-12 w-12" />}
          </div>
          <label className="absolute bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-[11px] text-slate-200">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            {T(lang, 'Take the photo by itself when the paper is still', 'പേപ്പർ അനങ്ങാതാകുമ്പോൾ തനിയെ ഫോട്ടോ എടുക്കും')}
          </label>
          {photos.length > 0 && (
            <button onClick={() => setPhase('pages')} className="absolute right-3 top-3 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-bold">{T(lang, `Done (${photos.length})`, `മതി (${photos.length})`)}</button>
          )}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />

      {/* PAGES */}
      {phase === 'pages' && (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((p, i) => (
              <div key={i} className="relative overflow-hidden rounded-xl border border-white/15 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Page ${i + 1}`} className="h-48 w-full object-contain" />
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 text-[11px] font-bold">{i + 1}</span>
                <button onClick={() => setPhotos((ps) => { const n = ps.filter((_, j) => j !== i); if (!n.length) setPhase('camera'); return n; })} className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-[11px]">✕</button>
              </div>
            ))}
          </div>
          {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void read()} disabled={!canAI} className="rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-5 py-2.5 text-sm font-extrabold disabled:opacity-40">
              {hasGeminiKey() ? T(lang, '👀 Read my paper', '👀 എന്റെ പേപ്പർ വായിക്കൂ') : T(lang, 'Ask about this photo', 'ഈ ഫോട്ടോയെക്കുറിച്ച് ചോദിക്കൂ')}
            </button>
            {photos.length < MAX_PAGES && <button onClick={() => setPhase('camera')} className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold">{T(lang, '+ Add another page', '+ മറ്റൊരു പേജ്')}</button>}
            <button onClick={retake} className="rounded-xl bg-white/5 px-4 py-2.5 text-sm text-slate-300">{T(lang, 'Start again', 'വീണ്ടും തുടങ്ങൂ')}</button>
          </div>
        </div>
      )}

      {/* READING */}
      {phase === 'reading' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[0]?.url} alt="" className="h-56 rounded-xl border border-white/15 bg-white object-contain opacity-80" />
            <div className="absolute inset-x-0 top-0 h-1 animate-[scan_1.6s_ease-in-out_infinite] bg-cyan-400 shadow-[0_0_16px_4px_rgba(34,211,238,0.6)]" />
          </div>
          <p className="text-sm text-slate-300">{T(lang, 'Reading every line of your paper…', 'പേപ്പറിലെ ഓരോ വരിയും വായിക്കുന്നു…')}</p>
          <button onClick={() => { abortRef.current?.abort(); setPhase('pages'); }} className="text-xs text-slate-400 underline">{T(lang, 'Cancel', 'റദ്ദാക്കൂ')}</button>
          <style>{'@keyframes scan{0%{transform:translateY(0)}50%{transform:translateY(220px)}100%{transform:translateY(0)}}'}</style>
        </div>
      )}

      {/* CONFIRM */}
      {phase === 'confirm' && reading && (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {qNote && <p className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">⚠ {qNote}</p>}
          <div className="flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[0]?.url} alt="Your paper" className="hidden h-64 w-48 shrink-0 rounded-xl border border-white/15 bg-white object-contain sm:block" />
            <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                {T(lang, 'This is what I read', 'ഞാൻ വായിച്ചത് ഇതാണ്')}
                {reading.subject !== 'other' && <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 normal-case tracking-normal text-slate-300">{reading.subject}</span>}
              </div>
              {reading.lines.length ? <PaperLines /> : <p className="text-sm text-slate-400">—</p>}
              {reading.lines.some((l) => l.unclear) && <p className="mt-2 text-[11px] text-amber-200">{T(lang, 'Lines with an orange edge have a word I could not read ([?]). Tap Fix to write it.', 'ഓറഞ്ച് അടയാളമുള്ള വരികളിൽ വായിക്കാനാവാത്ത വാക്കുണ്ട് ([?]). "തിരുത്തുക" അമർത്തൂ.')}</p>}
              <button className="mt-2 text-xs text-cyan-300 hover:underline" onClick={() => setEditing({ n: reading.lines.length, text: '', add: true })}>{T(lang, '+ Add a line I missed', '+ വിട്ടുപോയ വരി ചേർക്കൂ')}</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={confirmed} disabled={mustRetake(reading)} className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 text-sm font-extrabold text-[#04121f] disabled:opacity-40">{T(lang, '✓ Looks right — ask', '✓ ശരിയാണ് — ചോദിക്കാം')}</button>
            <button onClick={retake} className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold">📷 {T(lang, 'Take it again', 'വീണ്ടും എടുക്കൂ')}</button>
          </div>
        </div>
      )}

      {/* CHAT */}
      {phase === 'chat' && (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* the paper */}
          <div className={`border-b border-white/10 lg:w-[42%] lg:border-b-0 lg:border-r ${paperOpen ? 'max-h-[30vh] lg:max-h-none' : ''} flex min-h-0 flex-col`}>
            <button onClick={() => setPaperOpen((o) => !o)} className="flex items-center justify-between px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-cyan-300 lg:pointer-events-none">
              <span>📄 {T(lang, 'Your paper', 'നിങ്ങളുടെ പേപ്പർ')} {photos.length > 1 ? `· ${photos.length} ${T(lang, 'pages', 'പേജ്')}` : ''}</span>
              <span className="lg:hidden">{paperOpen ? '▲' : '▼'}</span>
            </button>
            {paperOpen && (
              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                {reading?.lines.length ? <PaperLines compact /> : (
                  <div className="flex gap-2 overflow-x-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {photos.map((p, i) => <img key={i} src={p.url} alt={`Page ${i + 1}`} className="h-48 rounded-lg border border-white/15 bg-white object-contain" />)}
                  </div>
                )}
                <button onClick={retake} className="mt-2 text-[11px] text-slate-400 underline">{T(lang, 'Show another paper', 'മറ്റൊരു പേപ്പർ കാണിക്കൂ')}</button>
              </div>
            )}
          </div>

          {/* the conversation */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {!turns.length && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                  {T(lang, 'Ask anything about your paper — type, tap 🎤 and speak, or pick one:', 'പേപ്പറിനെക്കുറിച്ച് എന്തും ചോദിക്കൂ — ടൈപ്പ് ചെയ്യൂ, 🎤 അമർത്തി പറയൂ, അല്ലെങ്കിൽ ഒന്ന് തിരഞ്ഞെടുക്കൂ:')}
                </div>
              )}
              {turns.map((t, i) => t.role === 'student' ? (
                <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-violet-600/80 px-3 py-2 text-sm">{t.text}</div>
              ) : (
                <div key={i} ref={i === turns.length - 1 ? lastTurn : undefined} className="max-w-[92%] scroll-mt-2 space-y-2 rounded-2xl rounded-bl-sm border border-white/10 bg-[#0c1424] px-3 py-2.5 text-sm">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-400">
                    AI Guru
                    <button onClick={() => (speakingIdx === i ? (speakRef.current?.stop(), setSpeakingIdx(null)) : say(i, t.text))} className="ml-auto rounded px-1.5 py-0.5 text-[11px] normal-case tracking-normal text-slate-300 hover:bg-white/10">{speakingIdx === i ? '⏹ Stop' : '🔊'}</button>
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed text-slate-100">{t.text}</div>
                  {!!t.answer?.lines.length && (
                    <div className="flex flex-wrap gap-1">
                      {t.answer.lines.map((n) => (
                        <button key={n} onClick={() => { setFocusLines([n]); setPaperOpen(true); document.getElementById(`paper-line-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                          className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-200" title={lineById.get(n)?.text}>
                          {T(lang, 'line', 'വരി')} {n}
                        </button>
                      ))}
                    </div>
                  )}
                  {t.answer?.mistakes.map((m, k) => (
                    <div key={k} className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-2 text-[13px]">
                      <div className="text-[10px] font-black uppercase tracking-wider text-rose-300">{T(lang, `Mistake in line ${m.line}`, `വരി ${m.line}-ലെ തെറ്റ്`)}</div>
                      {m.wrote && <div className="font-mono text-rose-200 line-through decoration-rose-400/80">{m.wrote}</div>}
                      <div className="font-mono text-emerald-200">✓ {m.correct}</div>
                      {m.why && <div className="mt-0.5 text-slate-300">{m.why}</div>}
                    </div>
                  ))}
                  {!!t.answer?.next.length && i === turns.length - 1 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {t.answer.next.map((n) => <button key={n} onClick={() => void ask(n)} disabled={busy} className={chip}>{n}</button>)}
                    </div>
                  )}
                </div>
              ))}
              {busy && <div className="w-fit animate-pulse rounded-2xl border border-white/10 bg-[#0c1424] px-3 py-2 text-xs text-slate-400">{T(lang, 'Looking at your paper…', 'പേപ്പർ നോക്കുന്നു…')}</div>}
              {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
              <div ref={chatEnd} />
            </div>

            <div className="border-t border-white/10 p-3">
              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                {QUICK_ASKS.map((q) => (
                  <button key={q.id} onClick={() => void ask(quickAsk(q.id, lang))} disabled={busy} className={`${chip} shrink-0`}>{q.label[lang === 'malayalam' ? 'ml' : 'en']}</button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {canListen() && (
                  <button onClick={mic} disabled={busy} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${listening ? 'animate-pulse bg-rose-500' : 'bg-white/10'}`} title={T(lang, 'Ask by voice', 'ശബ്ദത്തിലൂടെ ചോദിക്കൂ')}>🎤</button>
                )}
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void ask(input)}
                  placeholder={listening ? T(lang, 'Listening…', 'കേൾക്കുന്നു…') : T(lang, 'e.g. Why is line 3 wrong? What does this word mean?', 'ഉദാ: വരി 3 എന്തുകൊണ്ട് തെറ്റാണ്?')}
                  className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-cyan-400" />
                <button onClick={() => void ask(input)} disabled={busy || !input.trim()} className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-extrabold text-[#050915] disabled:opacity-40">➤</button>
                <button onClick={() => { setVoiceOn((v) => !v); speakRef.current?.stop(); }} className={`h-10 w-10 shrink-0 rounded-full text-base ${voiceOn ? 'bg-cyan-500/20 text-cyan-200' : 'bg-white/5 text-slate-500'}`} title={voiceOn ? T(lang, 'Answers are read aloud', 'ഉത്തരങ്ങൾ വായിച്ചു കേൾപ്പിക്കും') : T(lang, 'Answers are not read aloud', 'ഉത്തരങ്ങൾ വായിക്കില്ല')}>{voiceOn ? '🔊' : '🔇'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* fix / add a line */}
      {editing && reading && (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#0b1220] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 text-sm font-bold">{editing.add ? T(lang, 'Add a line', 'വരി ചേർക്കൂ') : T(lang, `Line ${editing.n} — write it as it is on your paper`, `വരി ${editing.n} — പേപ്പറിൽ ഉള്ളതുപോലെ എഴുതൂ`)}</div>
            <textarea autoFocus value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} rows={3}
              className="w-full rounded-xl border border-white/15 bg-black/30 p-3 font-mono text-sm outline-none focus:border-cyan-400" />
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {!editing.add && <button onClick={() => { setReading(editLine(reading, editing.n, '')); setEditing(null); }} className="mr-auto rounded-lg px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/10">{T(lang, 'Remove line', 'വരി നീക്കൂ')}</button>}
              <button onClick={() => setEditing(null)} className="rounded-lg bg-white/10 px-3 py-2 text-sm">{T(lang, 'Cancel', 'റദ്ദാക്കൂ')}</button>
              <button onClick={() => { setReading(editing.add ? insertLine(reading, editing.n, editing.text) : editLine(reading, editing.n, editing.text)); setEditing(null); }} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-[#04121f]">{T(lang, 'Save', 'സേവ്')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaperDoubt;
