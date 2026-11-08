'use client';

/**
 * Motion Class as the RAG Classroom's teaching board (V51.9.51).
 *
 * Same job as the older ThreeB1BTeachingBoard: teach ONE textbook passage, then report "completed" so the
 * classroom moves to the next section. The difference is HOW: the passage goes through the Motion Class
 * pipeline (selectDna → plan → quality gate → deterministic scenes → voice), so every subject (maths,
 * science, history, grammar…) is drawn by templates the app computes, never by free-form AI drawing.
 *
 * V51.9.56: TWO boards. The lecture board (meaning, importance, the Malayalam retelling) is on top and the
 * problem board (anything worked out step by step) is below it. The lesson is cut into runs; each run plays on
 * its own board, one after the other. A draggable divider sets how much room each board gets, and every problem
 * can be saved as its own MP4.
 *
 * V51.9.57: each board has its own controls (only one teaches at a time: playing one stops the other), and can be
 * floated anywhere on the screen, dragged, resized up to the full screen, or snapped to the left / right half.
 */

import { openRouter } from '@/lib/ai-guru/openrouter';
import { planSubjects, compileMixed, type SubjectPlan } from '@/lib/ai-guru/subjects';
import { loadPlan, savePlan } from '@/lib/ai-guru/motion-class/plan-store';
import { passageHash } from '@/lib/ai-guru/motion-class/plan-hash';
import { fetchServerPlan } from '@/lib/ai-guru/motion-class/server-plan-client';
import { StudentProfileButton } from '@/components/ai-guru/student/StudentProfileButton';
import { ClassHistoryFeed, type HistoryBusy } from '@/components/ai-guru/ClassHistoryFeed';
import { addHistory, clearHistory, getHistory, removeHistory, subscribeHistory, type HistoryEntry } from '@/lib/ai-guru/motion-class/class-history';
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { stepButtonsOf } from '@/lib/ai-guru/reels/motion/draw';
import { rewardClassAnswer } from '@/lib/ai-guru/motion-class/interactive/class-rewards';
import { currentStudentId } from '@/lib/ai-guru/motion-class/interactive/progress';
import { loadProfile } from '@/lib/ai-guru/student/profile';
import { loadReelFonts } from '@/lib/ai-guru/reels/motion/fonts';
import { passageBlocks } from '@/lib/ai-guru/motion-class/passage';
import { selectDna } from '@/lib/ai-guru/motion-class/dna/registry';
import { pullTeacherDna } from '@/lib/ai-guru/teacher/sync';
import type { BlockPlan } from '@/lib/ai-guru/motion-class/dna/types';
import { offlinePlan } from '@/lib/ai-guru/motion-class/plan/offline';
import { aiPlanBlock, type Llm } from '@/lib/ai-guru/motion-class/plan/ai';
import { compileClass, type ClassSegment } from '@/lib/ai-guru/motion-class/class';
import { fetchPageFigures, figureScript } from '@/lib/ai-guru/motion-class/figures';
import { buildExplainer } from '@/lib/ai-guru/reels/explainer/build';
import { explainerPhotosReady } from '@/lib/ai-guru/reels/explainer/draw';
import { splitRuns, type BoardKind } from '@/lib/ai-guru/motion-class/board-kind';
import { introBlock } from '@/lib/ai-guru/motion-class/plan/chapter-intro';
import type { ChapterIntroPlan } from '@/lib/ai-guru/motion-class/dna/types';
import { exportMotionReelMp4 } from '@/lib/ai-guru/reels/motion/export';
import { downloadClip, makeClip, saveClip, type ClassClip } from '@/lib/ai-guru/reels/class-clip';
import { ReelPreviewDialog, type PreviewState } from '@/components/ai-guru/reels/ReelPreviewDialog';
import { reelFileName, reelInLanguage, reelLanguages } from '@/lib/ai-guru/reels/share-reel';
import { clipCaption, shareClip } from '@/lib/ai-guru/share/clip';
import { useJoinLink } from '@/lib/ai-guru/share/join-link';
import { addPart, addVideo, thumbFromBlob } from '@/lib/ai-guru/reels/my-reels';
import type { Lang } from '@/lib/ai-guru/reels/motion';
import { prepareSegment, type PreparedSegment } from '@/lib/ai-guru/motion-class/player';
import { MOVES_NAME, MOVES_SETTINGS, readMovesSetting, saveMovesSetting, type MovesSetting } from '@/lib/ai-guru/reels/motion/camera-presets';
import { buildClassTimeline, ClassPlayer, readBoardLook, readStepGap, saveBoardLook, saveStepGap, STEP_GAPS, type BoardLook, type ClassTimeline, type PlayerState } from '@/lib/ai-guru/motion-class/interactive-player';
import { frameTargets, placeQuestions, type FrameTarget, type PlacedQuestion } from '@/lib/ai-guru/motion-class/interactive/questions';
import { ClassQuestionOverlay } from '@/components/ai-guru/motion-class/ClassQuestionOverlay';
import { StepStrip } from '@/components/ai-guru/motion-class/StepStrip';
import { microClassPlan } from '@/lib/ai-guru/motion-class/plan/micro';
import { lessonBridge, type LessonContext, type MicroResult } from '@/lib/ai-guru/doubt/lesson-bridge';
import { studentKey } from '@/lib/student-key';
import { callAiGuruText, getProvider, type FallbackProvider } from '@/lib/ai-guru/byok-providers';

/** Any saved AI key works: OpenAI first, then the Gemini key pool, Agnes AI, Sarvam AI (the classroom's own order). */
const aiLlm: Llm = async (system, user) => (await callAiGuruText(system, user, { json: true, maxOutputTokens: 12000 })).text;

function hasAnyAiKey(): boolean {
  if (studentKey.hasValidatedKey() || openRouter.hasUsable()) return true; // V51.9.158
  return (['openai', 'agnes', 'sarvam'] as FallbackProvider[]).some((p) => {
    const s = getProvider(p);
    return !!s?.key && !s.invalid;
  });
}

export interface MotionTeachingBoardProps {
  /** The textbook passage to teach. */
  passage: string;
  /**
   * V51.9.141: where the pictures of the textbook pages are cut out (…/page-figures/{documentId}) and the passage's
   * pages: every picture on those pages is shown on the whiteboard and explained before the lesson.
   */
  figuresBase?: string;
  pages?: number[];
  heading?: string;
  chapterTitle: string;
  grade?: number | string;
  language: 'english' | 'malayalam';
  /** Malayalam wording of the passage when the textbook (or an earlier pass) has it. */
  passageMalayalam?: string;
  /** V51.9.209: which material section this is, so the plan the server made for it can be used (no AI key needed). */
  materialId?: string;
  sectionId?: string;
  autoPlay?: boolean;
  /** The classroom's own pause (# icon): true holds the lesson, false carries on. */
  paused?: boolean;
  /** Teach in both languages, English first and then the same lesson in Malayalam (Malayalam class: the other way round). Default true. */
  bilingual?: boolean;
  /** V51.9.58: the chapter introduction, played first on the lecture board (the first section of a chapter). */
  chapterIntro?: ChapterIntroPlan | null;
  /** The board's own pause / play button was used. */
  onPausedChange?: (paused: boolean) => void;
  onStatus?: (status: 'planning' | 'ready' | 'playing' | 'completed' | 'error', detail?: string) => void;
  onNotice?: (message: string, level: 'info' | 'ok' | 'warn' | 'err') => void;
  onCue?: (text: string, language: 'english' | 'malayalam') => void;
  onClose?: () => void;
  /** V51.9.145: make this section's lesson again (the old board's ↻ Regenerate). */
  onRegenerate?: () => void;
}

interface Run {
  kind: BoardKind;
  tl: ClassTimeline;
  placed: PlacedQuestion[];
  /** 1-based position among the runs of the same kind (Problem 2, Lecture 3 …). */
  nth: number;
  /** V51.9.59: a micro class made from a student's doubt; `backTo` is the run to go back to. */
  micro?: boolean;
  backTo?: number;
  /** Step the lesson was at, so "Back to lesson" puts the lecture board back exactly as it was. */
  backStep?: number;
  /** V51.9.120: the material this part was built from, to take it to the Reel Studio. */
  clip?: ClassClip;
}

/** Where a board is: docked in the page, or floating anywhere on the screen. */
interface Float {
  floating: boolean;
  x: number;
  y: number;
  /** Width of the floating board in px (its height follows: 16:9 plus the small control bars). */
  w: number;
}

const SPLIT_KEY = 'aiGuruBoardSplit';
const FLOAT_KEY = 'aiGuruBoardFloat';
const HANDLE_H = 14;
/** Header with the board's own controls, and the thin step bar under the board. */
const PANE_HEAD_H = 30;
const PANE_FOOT_H = 26;
const MIN_FLOAT_W = 260;
const TOP_GAP = 52;

type Pair<T> = Record<BoardKind, T>;

function readSplit(): number {
  try {
    const v = Number(localStorage.getItem(SPLIT_KEY));
    return v >= 0.2 && v <= 0.8 ? v : 0.5;
  } catch {
    return 0.5;
  }
}

function readFloat(): Pair<Float> {
  const none: Float = { floating: false, x: 0, y: 0, w: 0 };
  try {
    const j = JSON.parse(localStorage.getItem(FLOAT_KEY) || 'null');
    const ok = (f: unknown): f is Float => !!f && typeof (f as Float).x === 'number' && typeof (f as Float).y === 'number' && typeof (f as Float).w === 'number';
    return { lecture: ok(j?.lecture) ? { ...j.lecture, floating: !!j.lecture.floating } : none, problem: ok(j?.problem) ? { ...j.problem, floating: !!j.problem.floating } : none };
  } catch {
    return { lecture: none, problem: none };
  }
}

const both = <T,>(v: T): Pair<T> => ({ lecture: v, problem: v });

/**
 * V51.9.167 — which languages the class teaches in, chosen by the student on the board (kept on this device):
 * 'both' = English then Malayalam (the class language first), 'en' = English only, 'ml' = Malayalam only.
 * Works whatever languages the study materials were made in; switching does not ask the AI again.
 */
export type ClassLangs = 'both' | 'en' | 'ml';
const CLASS_LANGS_KEY = 'ai-guru-class-languages';
const readClassLangs = (): ClassLangs => { try { const v = localStorage.getItem(CLASS_LANGS_KEY); return v === 'en' || v === 'ml' ? v : 'both'; } catch { return 'both'; } };
const saveClassLangs = (v: ClassLangs) => { try { localStorage.setItem(CLASS_LANGS_KEY, v); } catch { /* private mode */ } };
/** Lesson plans already made for a passage (by AI or built in), so changing the class languages does not plan again. */
const PLAN_CACHE = new Map<string, { plans: Map<string, BlockPlan>; subjects?: Map<string, SubjectPlan>; at: number }>();

export default function MotionTeachingBoard({ figuresBase, pages = [], passage, heading, chapterTitle, grade, language, passageMalayalam, materialId, sectionId, autoPlay = true, paused = false, bilingual = true, chapterIntro = null, onPausedChange, onStatus, onNotice, onCue, onClose, onRegenerate }: MotionTeachingBoardProps) {
  const hostRefs = { lecture: useRef<HTMLDivElement>(null), problem: useRef<HTMLDivElement>(null) };
  const canvasRefs = { lecture: useRef<HTMLCanvasElement>(null), problem: useRef<HTMLCanvasElement>(null) };
  const players = useRef<Pair<ClassPlayer | null>>({ lecture: null, problem: null });
  const areaRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const cb = useRef({ onStatus, onNotice, onCue, onPausedChange });
  cb.current = { onStatus, onNotice, onCue, onPausedChange };
  const [rate, setRate] = useState<number>(() => readRate());
  // V51.9.136: the speed controller — the time a finished step stays before the next one (kept on this device)
  const [gap, setGap] = useState<number>(() => (typeof window === 'undefined' ? 2 : readStepGap()));
  // V51.9.137: the board's look — cinematic by default
  const [boardLook, setBoardLook] = useState<BoardLook>(() => (typeof window === 'undefined' ? 'cinematic' : readBoardLook()));
  const [classLangs, setClassLangs] = useState<ClassLangs>(() => (typeof window === 'undefined' ? 'both' : readClassLangs()));
  // V51.9.161: camera moves per step (the board reads this setting on every frame, so a change shows at once)
  const [moves, setMoves] = useState<MovesSetting>(() => (typeof window === 'undefined' ? 'auto' : readMovesSetting()));
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const readyRef = useRef(false);
  const prevPaused = useRef(paused);
  const [phase, setPhase] = useState<string>('Planning the lesson…');
  const [runs, setRuns] = useState<Run[]>([]);
  const runsRef = useRef<Run[]>([]);
  const [runIdx, setRunIdx] = useState(0);
  const runIdxRef = useRef(0);
  /** The run each board is showing right now (-1 = nothing yet). */
  const [shown, setShown] = useState<Pair<number>>({ lecture: -1, problem: -1 });
  const shownRef = useRef(shown);
  shownRef.current = shown;
  // Each board has its own player state, its own seen steps and its own question.
  const [stateBy, setStateBy] = useState<Pair<PlayerState | null>>({ lecture: null, problem: null });
  const [visitedBy, setVisitedBy] = useState<Pair<Set<number>>>({ lecture: new Set(), problem: new Set() });
  const [questionBy, setQuestionBy] = useState<Pair<{ q: PlacedQuestion; targets: FrameTarget[] } | null>>({ lecture: null, problem: null });
  const [answers, setAnswers] = useState<Map<string, boolean>>(() => new Map());
  const [split, setSplit] = useState<number>(() => readSplit());
  const [areaH, setAreaH] = useState(440);
  const [exporting, setExporting] = useState<number | null>(null);
  /**
   * V51.9.138: after each solution the class asks "Send it to the Reel Studio? Download it to your device?" and waits.
   * idx = the run that just finished; the class goes on with the next run when the student presses Continue.
   */
  const [askAfter, setAskAfter] = useState<{ k: BoardKind; idx: number; sent?: boolean; saved?: string; making?: number; error?: string; jobId?: string } | null>(null);
  /**
   * V51.9.140: videos being made in the background. The class goes on while a video is made; a small chip in the
   * corner shows its progress, and the MP4 is saved by itself when it is ready.
   */
  const [jobs, setJobs] = useState<Array<{ id: string; label: string; progress?: number; saved?: string; error?: string }>>([]);
  const setJob = (id: string, patch: Partial<{ progress?: number; saved?: string; error?: string }>) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  useEffect(() => {
    // finished chips go away after a while
    const done = jobs.filter((j) => j.saved || j.error);
    if (!done.length) return;
    const tm = setTimeout(() => setJobs((js) => js.filter((j) => !done.some((d) => d.id === j.id))), 9000);
    return () => clearTimeout(tm);
  }, [jobs]);
  /**
   * V51.9.139: every part that has played stays above the live board (scroll up), with its pages, in every section of
   * this visit; each can still be downloaded or sent to the Reel Studio.
   */
  const sectionKey = `${chapterTitle}|${heading ?? ''}|${language}|${passage.slice(0, 120)}`;
  const history = useSyncExternalStore(subscribeHistory, getHistory, getHistory);
  const [histBusy, setHistBusy] = useState<Record<string, HistoryBusy>>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const [rootH, setRootH] = useState(0);
  const stickBottom = useRef(true);
  // V51.9.121: 📱 Share reel — which board, the reel's language, and the preview window's state
  const [shareFor, setShareFor] = useState<{ k: BoardKind; lang: Lang; state: PreviewState } | null>(null);
  // V51.9.150: the student's join link: on every frame, as a QR + join code at the end, and in the caption
  const join = useJoinLink();
  const joinRef = useRef(join);
  joinRef.current = join;
  /** A part as a reel others can join from: the lesson, then the AI Guru end card and the QR code with the join code. */
  const withJoin = (reel: Parameters<typeof shareClip>[0], lang: Lang) => shareClip(reel, { link: joinRef.current.link, lang, maxMs: Number.MAX_SAFE_INTEGER, variant: Math.floor(Math.random() * 5) });
  const advancedFrom = useRef(-1);
  const pendingStart = useRef<{ go: boolean } | null>(null);
  const pendingMicro = useRef<number | null>(null);
  const langsRef = useRef<Array<'en' | 'ml'>>(['en']);
  const [microBusy, setMicroBusy] = useState(false);
  // Floating boards.
  const [fl, setFl] = useState<Pair<Float>>(() => both<Float>({ floating: false, x: 0, y: 0, w: 0 }));
  const [vp, setVp] = useState({ w: 1280, h: 720 });
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [top, setTop] = useState<BoardKind>('problem');

  const activeRun = runs[runIdx];
  const activeKind: BoardKind | null = activeRun?.kind ?? null;
  const activeKindRef = useRef<BoardKind | null>(null);
  activeKindRef.current = activeKind;
  const activeState = activeKind ? stateBy[activeKind] : null;
  const waitLeft = activeState?.waitingMs ?? 0;

  const setState = (kind: BoardKind, s: PlayerState | null) => setStateBy((p) => ({ ...p, [kind]: s }));
  const setQuestion = (kind: BoardKind, v: { q: PlacedQuestion; targets: FrameTarget[] } | null) => setQuestionBy((p) => ({ ...p, [kind]: v }));

  // Two players, one per board.
  useEffect(() => {
    const make = (kind: BoardKind) => {
      const host = hostRefs[kind].current;
      const canvas = canvasRefs[kind].current;
      if (!host || !canvas) return null;
      return new ClassPlayer(host, canvas, {
        format: 'landscape',
        stepNotes: kind === 'problem', // V51.9.110: each step's caption beside its line
        onUpdate: (s) => setState(kind, s),
        onQuestion: (q) => {
          const run = runsRef.current[shownRef.current[kind]];
          const ctx = canvas.getContext('2d');
          setQuestion(kind, q ? { q, targets: run && ctx ? frameTargets(q, run.tl.reel, 'landscape', ctx) : [] } : null);
        },
      });
    };
    players.current = { lecture: make('lecture'), problem: make('problem') };
    players.current.lecture?.setStepGap(readStepGap());
    players.current.problem?.setStepGap(readStepGap());
    players.current.lecture?.setBoardLook(readBoardLook());
    players.current.problem?.setBoardLook(readBoardLook());
    return () => {
      players.current.lecture?.dispose();
      players.current.problem?.dispose();
      players.current = { lecture: null, problem: null };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // V51.9.142: the class is a chat-like scroll area with a FIXED height (the window below its top). Measuring its own
  // height fed back into the live area's height and grew without end (over a million pixels), pushing the live board
  // far below the screen. Now the height comes from the window, so the live board always fills the view and the earlier
  // pages stay above it, out of sight until the student scrolls up.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const read = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      setRootH(Math.max(460, Math.round(window.innerHeight - Math.min(top, window.innerHeight * 0.45) - 8)));
    };
    read();
    const onScroll = () => { stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; };
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', read);
    return () => { window.removeEventListener('resize', read); el.removeEventListener('scroll', onScroll); };
  }, []);

  // How tall the docked boards' area is, so each 16:9 board fits its share without being cut off.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const read = () => setAreaH(el.clientHeight || 440);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The screen size, the saved places of the floating boards, and where "fixed" really starts
  // (a page wrapper with a filter or transform would move it).
  useEffect(() => {
    setFl(readFloat());
    const read = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight });
      const r = probeRef.current?.getBoundingClientRect();
      if (r) setOff({ x: r.left, y: r.top });
    };
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);

  const saveFloat = (v: Pair<Float>) => {
    try {
      localStorage.setItem(FLOAT_KEY, JSON.stringify(v));
    } catch {
      /* the places just are not remembered */
    }
  };

  /** Put run `i` on its board and (optionally) play it. */
  const startRun = (i: number, play = true) => {
    const run = runsRef.current[i];
    if (!run) return;
    const p = players.current[run.kind];
    if (!p) return;
    players.current[run.kind === 'lecture' ? 'problem' : 'lecture']?.pause();
    runIdxRef.current = i;
    activeKindRef.current = run.kind;
    advancedFrom.current = -1;
    setAskAfter(null);
    // V51.9.139: the part joins the class history (its pages appear above the board as they pass)
    addHistory({ key: `${sectionKey}#${i}`, section: sectionKey, heading: heading ?? '', chapter: chapterTitle, kind: run.kind, nth: run.nth, runIdx: i, tl: run.tl, clip: run.clip });
    setRunIdx(i);
    setState(run.kind, null);
    setQuestion(run.kind, null);
    setVisitedBy((v) => ({ ...v, [run.kind]: new Set() }));
    setShown((s) => ({ ...s, [run.kind]: i }));
    shownRef.current = { ...shownRef.current, [run.kind]: i };
    p.load(run.tl);
    p.setQuestions(run.placed, []);
    p.setRate(rateRef.current);
    if (play) void p.play();
  };

  useEffect(() => {
    let alive = true;
    const ctl = new AbortController();
    doneRef.current = false;
    readyRef.current = false;
    const lang = language === 'malayalam' ? 'ml' : 'en';
    (async () => {
      try {
        cb.current.onStatus?.('planning');
        await loadReelFonts();
        await pullTeacherDna(); // the teacher's chosen templates (V51.9.63)
        const title = heading || chapterTitle;
        const blocks = passageBlocks(passage, heading, `rag${Math.abs(hash(passage))}`);
        if (!blocks.length) throw new Error('This section has no text to teach.');
        const useAi = hasAnyAiKey();
        const cacheKey = `${hash(passage)}:${lang}:${useAi ? 'ai' : 'off'}`;
        // V51.9.208: a plan the AI made on an earlier visit is read back from this device, not made again
        // V51.9.209: the plan the AI Guru server made for this section (no key of the student's own is needed); it is also kept on this
        // device, so the class opens again without the network
        let fromServer = false;
        let cached = PLAN_CACHE.get(cacheKey) ?? (useAi ? loadPlan<BlockPlan, SubjectPlan>(cacheKey) ?? undefined : undefined);
        if (materialId && sectionId) {
          const srvKey = `srv:${materialId}:${sectionId}:${passageHash(passage)}`;
          const sp = await fetchServerPlan<BlockPlan, SubjectPlan>(materialId, sectionId, passageHash(passage));
          if (sp && sp.plans.size >= blocks.length) { fromServer = true; cached = { plans: sp.plans, subjects: sp.subjects, at: Date.now() }; savePlan(srvKey, { plans: sp.plans, subjects: sp.subjects }); }
          else { const dev = loadPlan<BlockPlan, SubjectPlan>(srvKey); if (dev && dev.plans.size >= blocks.length) { fromServer = true; cached = dev; } }
        }
        if (!alive) return;
        const plans = new Map<string, BlockPlan>(cached?.plans ?? []);
        const wantMl = classLangs !== 'en';
        for (let i = 0; i < blocks.length; i++) {
          if (cached && plans.has(blocks[i].id)) continue; // V51.9.167: already planned (the student only changed the class languages)
          if (!alive) return;
          const b = blocks[i];
          const selection = selectDna(b, chapterTitle);
          let plan: BlockPlan = offlinePlan(b, chapterTitle, title, selection);
          if (useAi) {
            setPhase(`Planning the lesson ${i + 1}/${blocks.length}…`);
            try {
              const r = await aiPlanBlock(b, { chapterTitle, sectionTitle: title, before: blocks.slice(Math.max(0, i - 1), i).map((x) => x.text), after: blocks.slice(i + 1, i + 2).map((x) => x.text) }, aiLlm, { maxAttempts: 2, selection });
              plan = r.plan;
            } catch (e) {
              cb.current.onNotice?.(`AI plan failed for part ${i + 1}; using the built-in plan. ${(e as Error).message}`, 'warn');
            }
          }
          if ((lang === 'ml' || wantMl) && !plan.read.ml && passageMalayalam && blocks.length === 1) plan = { ...plan, read: { ...plan.read, ml: passageMalayalam } };
          plans.set(b.id, plan);
        }
        // the textbook's own Malayalam for a one-part section (also when the plan came from the cache)
        if ((lang === 'ml' || wantMl) && passageMalayalam && blocks.length === 1) { const p0 = plans.get(blocks[0].id); if (p0 && !p0.read.ml) plans.set(blocks[0].id, { ...p0, read: { ...p0.read, ml: passageMalayalam } }); }
        PLAN_CACHE.set(cacheKey, { plans: new Map(plans), subjects: cached?.subjects, at: Date.now() });
        if (useAi && !cached && !fromServer) savePlan(cacheKey, { plans });
        if (PLAN_CACHE.size > 40) PLAN_CACHE.delete([...PLAN_CACHE.entries()].sort((a, b) => a[1].at - b[1].at)[0][0]);
        if (lang === 'ml' && !useAi && !fromServer) cb.current.onNotice?.('Malayalam teaching needs an AI key (OpenAI, Gemini, Agnes or Sarvam) for the translated captions; the built-in plan speaks the English text.', 'warn');
        // English first, then the same lesson in Malayalam (a Malayalam class goes the other way round).
        // compileClass leaves out a Malayalam part that has no Malayalam words, so nothing is spoken twice.
        // V51.9.167: the student's choice on the board — both languages, English only or Malayalam only
        const hasMl = useAi || fromServer || !!(passageMalayalam && blocks.length === 1);
        let languages: Array<'en' | 'ml'> = classLangs === 'en' ? ['en'] : classLangs === 'ml' ? ['ml'] : !bilingual ? [lang] : lang === 'ml' ? ['ml', 'en'] : ['en', 'ml'];
        if (classLangs === 'ml' && !hasMl) { languages = ['en']; cb.current.onNotice?.('Malayalam only needs an AI key (OpenAI, Gemini, OpenRouter, Agnes or Sarvam) to translate this lesson; it is taught in English now.', 'warn'); }
        else if (classLangs === 'both' && bilingual && lang === 'en' && !hasMl) cb.current.onNotice?.('Malayalam repeat needs an AI key (OpenAI, Gemini, OpenRouter, Agnes or Sarvam) to translate the lesson; only English will be taught now.', 'warn');
        else if (classLangs !== 'both') cb.current.onNotice?.(classLangs === 'en' ? 'Teaching in English only.' : 'Teaching in Malayalam only.', 'info');
        langsRef.current = languages;
        // V51.9.56: cut the lesson into lecture runs and problem runs; each run is its own small class.
        // The chapter introduction (first section of a chapter) plays first, on the lecture board.
        if (chapterIntro) {
          const intro = introBlock(chapterIntro);
          blocks.unshift(intro.block);
          plans.set(intro.block.id, intro.plan);
        }
        const cut = splitRuns(blocks, plans);
        // V51.9.69: other subjects (physics, chemistry, biology, earth science, computer science) are planned by
        // their own agents; blocks no agent claims go through the maths compiler exactly as before.
        let subjectPlans = new Map<string, SubjectPlan>();
        try {
          if (cached?.subjects) subjectPlans = new Map(cached.subjects); // V51.9.208: the subject agents already read this section
          else {
          setPhase('Subject agents are reading the lesson…');
          subjectPlans = await planSubjects(blocks, { chapterTitle, sectionTitle: title }, {
            llm: useAi ? aiLlm : null,
            onEvent: (e) => { if (!e.ok && e.stage !== 'plan') return; console.info(`[subject-agent:${e.agent}] ${e.stage} ${e.note}`); },
          });
          if (subjectPlans.size) cb.current.onNotice?.(`Subject agents: ${[...new Set([...subjectPlans.values()].map((p) => p.agent))].join(', ')}.`, 'info');
          const keep = PLAN_CACHE.get(cacheKey);
          if (keep) { keep.subjects = new Map(subjectPlans); if (useAi && !fromServer) savePlan(cacheKey, { plans: keep.plans, subjects: keep.subjects }); }
          }
        } catch (e) {
          cb.current.onNotice?.(`Subject agents skipped: ${(e as Error).message}`, 'warn');
        }
        const compiled = cut.map((r) => compileMixed(r.blocks, plans, subjectPlans, { title }, { order: 'per-language', languages, mistakes: true }));
        const total = compiled.reduce((n, c) => n + c.length, 0);
        const built: Run[] = [];
        const count = { lecture: 0, problem: 0 };
        let done = 0;
        for (let r = 0; r < cut.length; r++) {
          const prepared: PreparedSegment[] = [];
          for (const seg of compiled[r]) {
            if (!alive) return;
            setPhase(`Preparing voice and animation ${++done}/${total}…`);
            prepared.push(await prepareSegment(seg, true, ctl.signal));
          }
          if (!prepared.length) continue;
          const tl = buildClassTimeline(title, prepared);
          count[cut[r].kind] += 1;
          let clip: ClassClip | undefined;
          try { clip = makeClip({ title, chapter: chapterTitle, kind: cut[r].kind, nth: count[cut[r].kind], blocks: cut[r].blocks, plans, subject: subjectPlans, languages }); } catch { /* the part still plays */ }
          built.push({ kind: cut[r].kind, tl, placed: placeQuestions(tl, plans), nth: count[cut[r].kind], clip });
        }
        if (!alive) return;
        // V51.9.141: the pictures of the textbook page, on the whiteboard and explained, before the lesson
        if (figuresBase && pages.length) {
          try {
            setPhase('Finding the pictures on the textbook page…');
            const figs = (await Promise.all([...new Set(pages)].slice(0, 2).map((pg) => fetchPageFigures(figuresBase, pg, ctl.signal)))).flat();
            if (alive && figs.length) {
              setPhase(`Explaining ${figs.length} picture${figs.length === 1 ? '' : 's'} from the textbook…`);
              const vision = useAi ? async (system: string, prompt: string, b64: string, mime: string) => { const { callGeminiClientVision } = await import('@/lib/student-key'); return callGeminiClientVision(system, prompt, b64, mime); } : null;
              const made = await figureScript(figs, { passage, chapter: chapterTitle, heading, standard: grade ? String(grade) : undefined }, vision);
              if (alive && made) {
                // decoded now, so the board shows each picture from its first frame
                await Promise.race([explainerPhotosReady(made.script.shots), new Promise((r) => setTimeout(r, 4000))]);
                // both languages only when the AI wrote the Malayalam too
                const figLangs: Array<'en' | 'ml'> = made.by === 'ai' ? languages : [languages.includes('en') ? 'en' : languages[0]];
                const segs: ClassSegment[] = figLangs.map((l) => ({
                  id: `figures:${l}`, blockId: 'figures', phase: 'teach', lang: l, dna: 'concept-board', label: `Picture · ${l === 'ml' ? 'Malayalam' : 'English'}`, title,
                  pill: l === 'ml' ? 'ചിത്രം' : 'PICTURE',
                  build: () => buildExplainer(made.script, l, 'landscape'),
                }));
                const prepared: PreparedSegment[] = [];
                for (const seg of segs) { if (!alive) return; prepared.push(await prepareSegment(seg, true, ctl.signal)); }
                if (prepared.length) {
                  const tl = buildClassTimeline(title, prepared);
                  // after the chapter's introduction (when there is one), before the lesson
                  built.splice(chapterIntro && built.length ? 1 : 0, 0, { kind: 'lecture', tl, placed: [], nth: 0 });
                  let n = 0;
                  for (const b of built) if (b.kind === 'lecture' && !b.micro) b.nth = ++n;
                  cb.current.onNotice?.(`Showing ${figs.length} picture${figs.length === 1 ? '' : 's'} from the textbook on the whiteboard${made.by === 'ai' ? ' (explained by AI looking at the picture)' : ''}.`, 'ok');
                }
              }
            }
          } catch (e) {
            if (!alive) return;
            cb.current.onNotice?.(`Textbook pictures skipped: ${(e as Error).message}`, 'warn');
          }
          if (!alive) return;
        }
        if (!built.length) throw new Error('This section has nothing to teach.');
        runsRef.current = built;
        setRuns(built);
        setShown({ lecture: -1, problem: -1 });
        shownRef.current = { lecture: -1, problem: -1 };
        setAnswers(new Map());
        readyRef.current = true;
        setPhase('');
        cb.current.onStatus?.('ready');
        // The first run starts from the effect below, once the boards have been drawn with these runs
        // (an animation frame would never come while the tab is in the background).
        pendingStart.current = { go: autoPlay && !prevPaused.current };
      } catch (e) {
        if (!alive) return;
        setPhase('');
        cb.current.onStatus?.('error', (e as Error).message);
      }
    })();
    return () => {
      alive = false;
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passage, language, classLangs]);

  useEffect(() => {
    if (pendingMicro.current !== null && runs[pendingMicro.current]) {
      const at = pendingMicro.current;
      pendingMicro.current = null;
      startRun(at, true);
      return;
    }
    const p = pendingStart.current;
    if (!p || !runs.length) return;
    pendingStart.current = null;
    startRun(0, p.go);
    if (p.go) cb.current.onStatus?.('playing');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs]);

  // The classroom's pause (# icon) reaches the board that is teaching; so does carrying on.
  useEffect(() => {
    if (prevPaused.current === paused) return;
    prevPaused.current = paused;
    const k = activeKindRef.current;
    const p = k ? players.current[k] : null;
    if (!p || !readyRef.current) return;
    if (paused) p.pause();
    else if (!p.state().finished) void p.play();
  }, [paused]);

  useEffect(() => {
    players.current.lecture?.setBoardLook(boardLook);
    players.current.problem?.setBoardLook(boardLook);
    saveBoardLook(boardLook);
  }, [boardLook]);

  // V51.9.136: the wait between steps, at once on both boards
  useEffect(() => {
    players.current.lecture?.setStepGap(gap);
    players.current.problem?.setStepGap(gap);
    saveStepGap(gap);
  }, [gap]);

  // Speed: slow teaching for those who need it; the choice is kept for the next sections.
  useEffect(() => {
    players.current.lecture?.setRate(rate);
    players.current.problem?.setRate(rate);
    try {
      localStorage.setItem('aiGuruMotionRate', String(rate));
    } catch {
      /* private window: the speed just is not remembered */
    }
  }, [rate]);

  useEffect(() => {
    const s = stateBy.lecture;
    if (s) setVisitedBy((v) => (v.lecture.has(s.step) ? v : { ...v, lecture: new Set(v.lecture).add(s.step) }));
  }, [stateBy.lecture?.step]);
  useEffect(() => {
    const s = stateBy.problem;
    if (s) setVisitedBy((v) => (v.problem.has(s.step) ? v : { ...v, problem: new Set(v.problem).add(s.step) }));
  }, [stateBy.problem?.step]);

  // A run that ends hands over to the next one (on the other board); the last one ends the section.
  useEffect(() => {
    if (!activeState?.finished || advancedFrom.current === runIdx) return;
    advancedFrom.current = runIdx;
    // A micro class does not push the lesson on: the student chooses "Back to lesson".
    if (activeRun?.micro) {
      cb.current.onNotice?.('Micro class finished — press “Back to lesson” to carry on.', 'ok');
      return;
    }
    // V51.9.138: a worked solution ends with the question; the class waits for the student's answer
    if (activeRun?.kind === 'problem') {
      setAskAfter({ k: 'problem', idx: runIdx });
      return;
    }
    goOnFrom(runIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeState?.finished, runIdx]);
  /** The next run (on either board), or the end of the section. */
  function goOnFrom(idx: number) {
    if (idx + 1 < runsRef.current.length) startRun(idx + 1, !prevPaused.current);
    else if (!doneRef.current) {
      doneRef.current = true;
      cb.current.onStatus?.('completed');
    }
  }
  const continueClass = () => {
    const a = askAfter;
    setAskAfter(null);
    if (a) goOnFrom(a.idx);
  };
  /** V51.9.138/139: a part as a 9:16 MP4 (voice and captions, the class language), saved on this device. Returns the file name. */
  const saveRunVideo = async (run: { tl: ClassTimeline; kind: BoardKind; nth: number }, title: string, onProgress: (p: number) => void): Promise<string> => {
    const langs = reelLanguages(run.tl.segments as Array<{ lang: Lang }>);
    const want: Lang = language === 'malayalam' ? 'ml' : 'en';
    const lang = langs.includes(want) ? want : langs[0] ?? 'en';
    setExporting(0);
    try {
      const reel = withJoin(reelInLanguage(run.tl.reel, run.tl.segments as Array<{ id: string; lang: Lang }>, lang), lang);
      const res = await exportMotionReelMp4(reel, { format: 'vertical', handle: joinRef.current.short, voices: run.tl.clips, onProgress: (p) => { setExporting(p); onProgress(p); } });
      const name = reelFileName(title, lang, `${run.kind}-${run.nth}`);
      // V51.9.152: also kept in the Reel Studio (whiteboard videos: preview, Google Flow, delete)
      void thumbFromBlob(res.blob).then((thumb) => addVideo({ title: `${run.kind === 'problem' ? 'Problem' : 'Lecture'} ${run.nth} · ${title}`, way: 'whiteboard', name, blob: res.blob, seconds: res.durationMs / 1000, thumb })).catch(() => undefined);
      const url = URL.createObjectURL(res.blob);
      const el = document.createElement('a');
      el.href = url;
      el.download = name;
      document.body.appendChild(el);
      el.click();
      el.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return name;
    } finally {
      setExporting(null);
    }
  };
  /** V51.9.138: ⬇ the solution just finished. */
  const downloadSolution = async () => {
    const a = askAfter;
    const run = a ? runsRef.current[a.idx] : undefined;
    if (!a || !run || exporting !== null) return;
    const id = `j${Date.now()}`;
    setJobs((js) => [...js, { id, label: `${run.kind === 'problem' ? 'Problem' : 'Lecture'} ${run.nth}`, progress: 0 }]);
    setAskAfter({ ...a, making: 0, error: undefined, jobId: id });
    try {
      const name = await saveRunVideo(run, heading || chapterTitle, (p) => { setJob(id, { progress: p }); setAskAfter((s) => (s?.jobId === id ? { ...s, making: p } : s)); });
      setJob(id, { progress: undefined, saved: name });
      setAskAfter((s) => (s?.jobId === id ? { ...s, making: undefined, saved: name } : s));
    } catch (e) {
      const msg = `The video could not be made: ${(e as Error).message}`;
      setJob(id, { progress: undefined, error: msg });
      setAskAfter((s) => (s?.jobId === id ? { ...s, making: undefined, error: msg } : s));
    }
  };
  /** V51.9.145: ⬇ MP4 of the part on the board now (the old board's ⬇ MP4), made in the background. */
  const downloadCurrent = async () => {
    const run = runsRef.current[runIdx];
    if (!run || exporting !== null) return;
    const id = `j${Date.now()}`;
    setJobs((js) => [...js, { id, label: `${run.kind === 'problem' ? 'Problem' : 'Lecture'} ${run.nth}`, progress: 0 }]);
    try {
      const name = await saveRunVideo(run, heading || chapterTitle, (p) => setJob(id, { progress: p }));
      setJob(id, { progress: undefined, saved: name });
    } catch (e) {
      setJob(id, { progress: undefined, error: `The video could not be made: ${(e as Error).message}` });
    }
  };
  /** V51.9.140: while a video is being made, any choice tucks the question away and the class goes on. */
  const tuckAway = () => { if (askAfter?.making !== undefined) continueClass(); };
  /** V51.9.139: ⬇ any part from the class history (this section or an earlier one). */
  const downloadHistory = async (h: HistoryEntry) => {
    if (exporting !== null) { setHistBusy((b) => ({ ...b, [h.key]: { ...b[h.key], error: 'Another video is being made; try again when it is saved.' } })); return; }
    const id = `j${Date.now()}`;
    setJobs((js) => [...js, { id, label: `${h.kind === 'problem' ? 'Problem' : 'Lecture'} ${h.nth}`, progress: 0 }]);
    setHistBusy((b) => ({ ...b, [h.key]: { ...b[h.key], making: 0, error: undefined } }));
    try {
      const name = await saveRunVideo({ tl: h.tl, kind: h.kind, nth: h.nth }, h.heading || h.chapter, (p) => { setJob(id, { progress: p }); setHistBusy((b) => ({ ...b, [h.key]: { ...b[h.key], making: p } })); });
      setJob(id, { progress: undefined, saved: name });
      setHistBusy((b) => ({ ...b, [h.key]: { ...b[h.key], making: undefined, saved: name } }));
    } catch (e) {
      const msg = `The video could not be made: ${(e as Error).message}`;
      setJob(id, { progress: undefined, error: msg });
      setHistBusy((b) => ({ ...b, [h.key]: { ...b[h.key], making: undefined, error: msg } }));
    }
  };
  /** V51.9.139: 🎬 any part from the class history to the Reel Studio (new tab). */
  const sendHistory = (h: HistoryEntry) => {
    if (!h.clip) return;
    void addPart(h.clip).catch(() => undefined);
    if (!saveClip(h.clip)) downloadClip(h.clip);
    else window.open('/ai-guru/reels?from=class', '_blank', 'noopener');
    setHistBusy((b) => ({ ...b, [h.key]: { ...b[h.key], sent: true, error: undefined } }));
  };
  /** V51.9.138: 🎬 the solution goes to the Reel Studio (new tab); the question stays so the student can also download. */
  const sendSolution = () => {
    const a = askAfter;
    const run = a ? runsRef.current[a.idx] : undefined;
    if (!a || !run?.clip) { setAskAfter((s) => (s ? { ...s, error: 'This part cannot be taken to the Reel Studio.' } : s)); return; }
    void addPart(run.clip).catch(() => undefined);
    if (!saveClip(run.clip)) downloadClip(run.clip);
    else window.open('/ai-guru/reels?from=class', '_blank', 'noopener');
    setAskAfter({ ...a, sent: true, error: undefined });
  };

  useEffect(() => {
    // The caption of the step on screen goes to the classroom's caption strip.
    const tl = activeRun?.tl;
    const text = tl?.steps[activeState?.step ?? 0]?.text;
    const seg = tl?.segments[activeState?.segment ?? 0];
    if (text) cb.current.onCue?.(text, seg?.lang === 'ml' ? 'malayalam' : seg?.lang === 'en' ? 'english' : language);
  }, [activeState?.step, activeState?.segment, runIdx, language]);

  /* ---------------- one control bar per board; only one board teaches at a time ---------------- */

  /** Make `kind`'s board the one that teaches: the other one is stopped first. Returns false if it has nothing to teach. */
  const takeOver = (kind: BoardKind): boolean => {
    const idx = shownRef.current[kind];
    if (idx < 0) return false;
    const other: BoardKind = kind === 'lecture' ? 'problem' : 'lecture';
    players.current[other]?.pause();
    if (runIdxRef.current !== idx) {
      // The student chose another part. A part that was already finished is replayed on its own (the class does not
      // rush on from there); a part that was only paused carries on with the lesson when it ends.
      runIdxRef.current = idx;
      activeKindRef.current = kind;
      advancedFrom.current = players.current[kind]?.state().finished ? idx : -1;
      setRunIdx(idx);
    }
    return true;
  };

  /* ---------------- V51.9.59: the doubt pane (camera / mic / text) talks to the class through this bridge ---------------- */

  const nowText = (): string => {
    const run = runsRef.current[runIdxRef.current];
    const st = run ? players.current[run.kind]?.state() : null;
    const step = run?.tl.steps[st?.step ?? 0]?.text ?? '';
    return step ? `The class is on: ${run?.kind === 'problem' ? 'a problem' : 'a lecture part'}. The teacher has just said: "${step}"` : '';
  };

  const lessonContext = (): LessonContext => {
    const text = passage.replace(/\s+/g, ' ').trim();
    const extracts: LessonContext['extracts'] = [];
    for (let i = 0; i < text.length && extracts.length < 14; i += 1400) extracts.push({ page: extracts.length + 1, document: chapterTitle || heading || 'This chapter', text: text.slice(i, i + 1400) });
    return { chapter: chapterTitle, section: heading || chapterTitle, extracts, now: nowText() };
  };

  const boardSnapshot = (): string | null => {
    const k = activeKindRef.current ?? 'problem';
    const c = canvasRefs[k].current;
    if (!c || !c.width) return null;
    try {
      return c.toDataURL('image/jpeg', 0.6).split(',')[1] || null;
    } catch {
      return null;
    }
  };

  const playMicro = async (doubt: string): Promise<MicroResult> => {
    if (!readyRef.current) return { ok: false, message: 'The class is still being prepared; ask again in a moment.' };
    if (!hasAnyAiKey()) return { ok: false, message: 'A micro class needs an AI key (Settings).' };
    if (microBusy) return { ok: false, message: 'A micro class is already being made.' };
    setMicroBusy(true);
    cb.current.onNotice?.('Making a micro class for your doubt…', 'info');
    const lang = language === 'malayalam' ? 'ml' : 'en';
    try {
      // Where the lesson was (a second doubt during a micro class goes back to the same place).
      const cur = runsRef.current[runIdxRef.current];
      const back = cur?.micro ? cur.backTo ?? 0 : runIdxRef.current;
      const backStep = cur?.micro ? cur.backStep : players.current[cur?.kind ?? 'lecture']?.state().step;
      const r = await microClassPlan({ doubt, nowOnBoard: nowText(), lessonText: passage, chapterTitle, sectionTitle: heading || chapterTitle }, aiLlm);
      if (r.plan.source !== 'ai') return { ok: false, message: `I could not make a clear micro class for that${r.errors.length ? ` (${r.errors[r.errors.length - 1].slice(0, 120)})` : ''}. Please ask it another way.` };
      const plans = new Map([[r.block.id, r.plan]]);
      const segs = compileClass([r.block], plans, { title: 'Micro class' }, { order: 'per-language', languages: [lang], mistakes: false });
      const prepared: PreparedSegment[] = [];
      for (const seg of segs) prepared.push(await prepareSegment(seg, true));
      if (!prepared.length) return { ok: false, message: 'The micro class came out empty.' };
      const tl = buildClassTimeline('Micro class', prepared);
      const micros = runsRef.current.filter((x) => x.micro).length + 1;
      const run: Run = { kind: 'lecture', tl, placed: [], nth: micros, micro: true, backTo: back, backStep };
      heldRef.current = null;
      runsRef.current = [...runsRef.current, run];
      pendingMicro.current = runsRef.current.length - 1;
      setRuns(runsRef.current);
      cb.current.onPausedChange?.(false);
      return { ok: true, title: r.plan.read.en || r.plan.read.ml, message: 'The micro class is playing on the lecture board.' };
    } catch (e) {
      return { ok: false, message: `Micro class failed: ${(e as Error).message}` };
    } finally {
      setMicroBusy(false);
    }
  };

  /** The doubt pane was opened: stop the class where it is. Nothing on either board is cleared. */
  const heldRef = useRef<{ kind: BoardKind; idx: number; wasPlaying: boolean } | null>(null);
  const holdClass = () => {
    if (heldRef.current) return;
    const k = activeKindRef.current;
    if (!k) return;
    const wasPlaying = !!players.current[k]?.playing;
    players.current.lecture?.pause();
    players.current.problem?.pause();
    heldRef.current = { kind: k, idx: runIdxRef.current, wasPlaying };
    if (wasPlaying) cb.current.onPausedChange?.(true);
  };
  /** The doubt is cleared: carry on from the same spot (unless a micro class took over — it has its own "Back to lesson"). */
  const releaseClass = () => {
    const h = heldRef.current;
    heldRef.current = null;
    if (!h || runIdxRef.current !== h.idx || !h.wasPlaying) return;
    const p = players.current[h.kind];
    if (p && !p.state().finished) void p.play();
    cb.current.onPausedChange?.(false);
  };

  /** Leave the micro class and carry on where the lesson was. */
  const backToLesson = () => {
    const run = runsRef.current[runIdxRef.current];
    const back = run?.micro ? run.backTo ?? 0 : 0;
    const target = runsRef.current[back];
    if (!target) return;
    players.current.lecture?.pause();
    if (target.kind === 'problem' && shownRef.current.problem === back && takeOver('problem')) {
      const p = players.current.problem;
      if (p?.state().finished) {
        const next = back + 1;
        if (runsRef.current[next] && !runsRef.current[next].micro) startRun(next, true);
      } else void p?.play();
    } else {
      // The micro class used the lecture board: put the lesson back at the step it was on.
      startRun(back, false);
      const p = players.current[target.kind];
      if (run?.backStep) p?.goToStep(run.backStep);
      void p?.play();
    }
    heldRef.current = null;
    cb.current.onPausedChange?.(false);
  };

  const bridgeRef = useRef({ lessonContext, boardSnapshot, playMicro, holdClass, releaseClass });
  bridgeRef.current = { lessonContext, boardSnapshot, playMicro, holdClass, releaseClass };
  useEffect(() => {
    lessonBridge.set({ context: () => bridgeRef.current.lessonContext(), snapshot: () => bridgeRef.current.boardSnapshot(), playMicro: (d) => bridgeRef.current.playMicro(d), hold: () => bridgeRef.current.holdClass(), release: () => bridgeRef.current.releaseClass() });
    return () => lessonBridge.set(null);
  }, []);

  const togglePlay = (kind: BoardKind) => {
    const p = players.current[kind];
    if (!p || !readyRef.current) return;
    if (p.playing) {
      p.pause();
      cb.current.onPausedChange?.(true);
      return;
    }
    if (!takeOver(kind)) return;
    if (p.state().finished) p.restart();
    else void p.play();
    cb.current.onPausedChange?.(false);
  };

  const restartBoard = (kind: BoardKind) => {
    const p = players.current[kind];
    if (!p || !readyRef.current || !takeOver(kind)) return;
    if (askAfter?.k === kind) { advancedFrom.current = -1; setAskAfter(null); } // watching the solution again: ask again at its end
    p.restart();
    cb.current.onPausedChange?.(false);
  };

  /* V51.9.111: the small step buttons drawn after each line on the board: # pause · ✓ carry on · ^ step before · ⟲ start */
  const stepButtonAt = (k: BoardKind, e: { clientX: number; clientY: number }) => {
    const c = canvasRefs[k].current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) * c.width) / r.width, y = ((e.clientY - r.top) * c.height) / r.height;
    return stepButtonsOf(c).find((b) => x >= b.x - 2 && x <= b.x + b.w + 2 && y >= b.y - 2 && y <= b.y + b.h + 2) ?? null;
  };
  const onStepButton = (k: BoardKind, e: ReactMouseEvent<HTMLCanvasElement>) => {
    const b = stepButtonAt(k, e);
    const p = players.current[k];
    if (!b || !p || phase) return;
    e.preventDefault();
    e.stopPropagation();
    switch (b.action) {
      case 'pause': // stop at this step (an earlier line: go back to it and stop there)
        if (!b.current) p.seek(b.stepMs);
        if (p.playing) togglePlay(k);
        break;
      case 'go': // carry on (the step now: when playing, on to the next step); an earlier line: carry on from it
        if (b.current) { if (p.playing) p.nextStep(); else togglePlay(k); }
        else { p.seek(b.stepMs); if (!p.playing) togglePlay(k); }
        break;
      case 'up': // the step before
        if (b.current) p.prevStep(); else p.seek(b.prevMs);
        break;
      case 'restart':
        restartBoard(k);
        break;
    }
  };

  /**
   * V51.9.121: 📱 Share reel — this board's part as a 9:16 reel in one language (voice and captions), shown in a
   * preview first; from there it is shared (the phone's share menu), downloaded, or opened in the Reel Studio.
   */
  const openShare = (k: BoardKind) => {
    const run = runs[shown[k]];
    if (!run || exporting !== null) return;
    players.current[k]?.pause();
    cb.current.onPausedChange?.(true);
    const langs = reelLanguages(run.tl.segments as Array<{ lang: Lang }>);
    const want: Lang = language === 'malayalam' ? 'ml' : 'en';
    const lang = langs.includes(want) ? want : langs[0] ?? 'en';
    if (langs.length > 1) setShareFor({ k, lang, state: { phase: 'choose' } });
    else void makeShare(k, lang);
  };
  const makeShare = async (k: BoardKind, lang: Lang) => {
    const run = runs[shown[k]];
    if (!run) return;
    setShareFor({ k, lang, state: { phase: 'making', progress: 0 } });
    setExporting(0);
    try {
      const reel = withJoin(reelInLanguage(run.tl.reel, run.tl.segments as Array<{ id: string; lang: Lang }>, lang), lang);
      const res = await exportMotionReelMp4(reel, { format: 'vertical', handle: joinRef.current.short, voices: run.tl.clips, onProgress: (p) => { setExporting(p); setShareFor((s) => (s && s.state.phase === 'making' ? { ...s, state: { phase: 'making', progress: p } } : s)); } });
      const name = reelFileName(heading || chapterTitle, lang, `${run.kind}-${run.nth}`);
      void thumbFromBlob(res.blob).then((thumb) => addVideo({ title: `${run.kind === 'problem' ? 'Problem' : 'Lecture'} ${run.nth} · ${heading || chapterTitle}`, way: 'whiteboard', name, blob: res.blob, seconds: res.durationMs / 1000, thumb })).catch(() => undefined);
      setShareFor({ k, lang, state: { phase: 'ready', url: URL.createObjectURL(res.blob), blob: res.blob, name, check: res.check, seconds: res.durationMs / 1000 } });
    } catch (e) {
      setShareFor({ k, lang, state: { phase: 'error', message: `The reel could not be made: ${(e as Error).message}` } });
    } finally {
      setExporting(null);
    }
  };
  const closeShare = () => setShareFor((s) => { if (s?.state.phase === 'ready') URL.revokeObjectURL(s.state.url); return null; });

  /**
   * V51.9.120: this board's part goes to the Reel Studio to be changed (parts kept, words, design) and made into a
   * reel: opened in a new tab (the class carries on here), or saved as a small file to open there later.
   */
  const toReelStudio = (k: BoardKind, how: 'open' | 'file', lang?: Lang) => {
    const run0 = runs[shown[k]];
    const run = run0?.clip && lang ? { ...run0, clip: { ...run0.clip, lang } } : run0;
    if (!run?.clip) { cb.current.onNotice?.('This part cannot be taken to the Reel Studio (a micro class is made from your doubt only).', 'warn'); return; }
    if (how === 'file') { downloadClip(run.clip); cb.current.onNotice?.('Saved the class part as a file. In the Reel Studio choose 🎓 From class → Open a class file.', 'ok'); return; }
    void addPart(run.clip).catch(() => undefined);
    if (!saveClip(run.clip)) { downloadClip(run.clip); cb.current.onNotice?.('This device could not keep it, so it was saved as a file instead: open it in the Reel Studio.', 'warn'); return; }
    window.open('/ai-guru/reels/design?from=class', '_blank', 'noopener');
    cb.current.onNotice?.('Opened in the Reel Studio (new tab). Change it there and make your reel; the class goes on here.', 'ok');
  };

  /* ---------------- the divider between docked boards ---------------- */

  const setSplitSaved = (v: number) => {
    const c = Math.min(0.8, Math.max(0.2, v));
    setSplit(c);
    try {
      localStorage.setItem(SPLIT_KEY, String(c));
    } catch {
      /* the split just is not remembered */
    }
  };
  const dragSplit = (e: ReactPointerEvent<HTMLDivElement>) => {
    const area = areaRef.current;
    if (!area) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture?.(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = area.getBoundingClientRect();
      setSplit(Math.min(0.8, Math.max(0.2, (ev.clientY - r.top) / Math.max(1, r.height))));
    };
    const up = (ev: PointerEvent) => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      const r = area.getBoundingClientRect();
      setSplitSaved((ev.clientY - r.top) / Math.max(1, r.height));
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };

  /* ---------------- floating boards: drag, resize, snap to a half of the screen ---------------- */

  const maxW = Math.max(MIN_FLOAT_W, Math.min(vp.w - 4, (vp.h - 8 - PANE_HEAD_H - PANE_FOOT_H) * (16 / 9)));
  const halfW = Math.max(MIN_FLOAT_W, Math.min(vp.w / 2, maxW));
  const clampFloat = (f: Float): Float => {
    const w = Math.min(maxW, Math.max(MIN_FLOAT_W, f.w || halfW));
    return { floating: f.floating, w, x: Math.min(vp.w - 60, Math.max(60 - w, f.x)), y: Math.min(vp.h - 40, Math.max(0, f.y)) };
  };
  const updateFloat = (kind: BoardKind, f: Float, save = true) =>
    setFl((p) => {
      const n = { ...p, [kind]: f };
      if (save) saveFloat(n);
      return n;
    });
  const floatPlace = (kind: BoardKind): Float => {
    const f = fl[kind];
    if (f.w > 0) return clampFloat({ ...f, floating: true });
    return clampFloat({ floating: true, w: Math.min(halfW - 8, 640), x: kind === 'lecture' ? 4 : vp.w - Math.min(halfW - 8, 640) - 4, y: TOP_GAP });
  };
  const toggleFloat = (kind: BoardKind) => {
    setTop(kind);
    if (fl[kind].floating) updateFloat(kind, { ...fl[kind], floating: false });
    else updateFloat(kind, floatPlace(kind));
  };
  const snap = (kind: BoardKind, side: 'left' | 'right') => {
    setTop(kind);
    updateFloat(kind, clampFloat({ floating: true, w: halfW, x: side === 'left' ? 0 : vp.w - halfW, y: TOP_GAP }));
  };
  const dragBoard = (kind: BoardKind, e: ReactPointerEvent<HTMLDivElement>) => {
    if (!fl[kind].floating || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    setTop(kind);
    const start = clampFloat(fl[kind]);
    const sx = e.clientX;
    const sy = e.clientY;
    const handle = e.currentTarget;
    handle.setPointerCapture?.(e.pointerId);
    let last = start;
    const move = (ev: PointerEvent) => {
      last = clampFloat({ ...start, x: start.x + ev.clientX - sx, y: start.y + ev.clientY - sy });
      updateFloat(kind, last, false);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      updateFloat(kind, last);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };
  const resizeBoard = (kind: BoardKind, e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setTop(kind);
    const start = clampFloat(fl[kind]);
    const sx = e.clientX;
    const handle = e.currentTarget;
    handle.setPointerCapture?.(e.pointerId);
    let last = start;
    const move = (ev: PointerEvent) => {
      last = clampFloat({ ...start, w: start.w + ev.clientX - sx });
      updateFloat(kind, last, false);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      updateFloat(kind, last);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };

  /* ---------------- layout ---------------- */

  // V51.9.60: the page shows ONE board at a time — the one that is teaching now; the other is hidden (not removed: it keeps
  // what it shows) and comes back when its turn comes, so the student sees a single board. A board the student floated stays visible.
  const focusKind: BoardKind = activeKind ?? 'lecture';
  const isFloat = (k: BoardKind) => fl[k].floating;
  // V51.9.110: a board with nothing in this part is hidden (floating or not), so the student sees one board; it
  // comes back as soon as it has something to show.
  const isEmpty = (k: BoardKind) => runs.length > 0 && !runs[shown[k]];
  const isShown = (k: BoardKind) => !isEmpty(k) && (isFloat(k) || k === focusKind);
  const hasKind = isShown;
  const dockedKinds = (['lecture', 'problem'] as BoardKind[]).filter((k) => !fl[k].floating && k === focusKind);
  const bothDocked = dockedKinds.length === 2;
  const room = Math.max(120, areaH - (bothDocked ? HANDLE_H : 0));
  const paneH = (k: BoardKind) => (bothDocked ? room * (k === 'lecture' ? split : 1 - split) : room);

  const btn = 'rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-40';

  const pane = (k: BoardKind) => {
    const floating = isFloat(k);
    const f = floating ? clampFloat(fl[k]) : null;
    const st = stateBy[k];
    const runI = shown[k];
    const run = runs[runI];
    const isActive = activeKind === k;
    const label = k === 'lecture' ? 'Lecture' : 'Problem';
    const q = questionBy[k];
    const h = paneH(k);
    const boardW = Math.max(160, (h - PANE_HEAD_H - PANE_FOOT_H - 6) * (16 / 9));
    const playing = !!st?.playing;
    const style: CSSProperties = floating && f
      ? { position: 'fixed', left: f.x - off.x, top: f.y - off.y, width: f.w, zIndex: top === k ? 70 : 60 }
      : { height: h };
    if (!isShown(k)) style.display = 'none';
    return (
      <div
        key={k}
        className={`flex min-h-0 flex-col items-center overflow-hidden rounded-xl border ${isActive ? 'border-emerald-400/60' : 'border-white/10'} ${floating ? 'bg-[#0b1017] shadow-[0_18px_50px_rgba(0,0,0,.55)]' : ''}`}
        style={style}
        onPointerDownCapture={() => floating && setTop(k)}
        data-ai-guru-board={k}
        data-floating={floating ? 'true' : 'false'}
      >
        <div
          className={`flex w-full shrink-0 items-center gap-1.5 px-2 text-[11px] text-white/70 ${floating ? 'cursor-move' : ''}`}
          style={{ height: PANE_HEAD_H, touchAction: floating ? 'none' : undefined }}
          onPointerDown={(e) => dragBoard(k, e)}
          title={floating ? 'Drag to move this board' : undefined}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${isActive && playing ? 'animate-pulse bg-emerald-400' : isActive ? 'bg-emerald-400' : 'bg-white/25'}`} />
          <span className="shrink-0 font-semibold text-white/85">{run?.micro ? '💡 Micro class' : <>{k === 'lecture' ? '📖' : '✏️'} {label}{run ? ` ${run.nth}` : ''}</>}</span>
          {run?.micro && <button type="button" className={`${btn} bg-amber-500/80 text-black`} onClick={backToLesson} title="Leave the micro class and carry on with the lesson">↩ Back to lesson</button>}
          {/* This board's own controls. */}
          <button type="button" className={btn} onClick={() => restartBoard(k)} disabled={!run || !!phase} title="Start this part again">⟲</button>
          <button type="button" className={btn} onClick={() => players.current[k]?.prevStep()} disabled={!run || !!phase} title="Previous step">⏮</button>
          <button type="button" className={`${btn} min-w-[58px] bg-emerald-600/70`} onClick={() => togglePlay(k)} disabled={!run || !!phase} title={`Play / pause the ${label.toLowerCase()} board — the other board stops`}>{playing ? '⏸ Pause' : '▶ Play'}</button>
          <button type="button" className={btn} onClick={() => players.current[k]?.nextStep()} disabled={!run || !!phase} title="Next step">⏭</button>
          {/* V51.9.143: the wait and the language, on the playing board's own bar (the controls above stay one line) */}
          {isActive && waitLeft > 0 && <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 font-semibold text-amber-200" data-step-wait>Next step in {Math.ceil(waitLeft / 1000)} s</span>}
          {isActive && segLang && <span className="shrink-0 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 font-bold text-cyan-200">{segLang === 'ml' ? 'Malayalam' : 'English'}</span>}
          <span className="ml-auto flex shrink-0 items-center gap-1">
            {k === 'problem' && run && <StudentProfileButton inline />}
            {run && !run.micro && (
              <button type="button" onClick={() => openShare(k)} disabled={exporting !== null || !!phase} className="rounded-md border border-emerald-300/40 bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-60" title="Make this part a reel (9:16, voice and captions), see it, then share it on WhatsApp, Instagram or YouTube">
                {exporting !== null && shareFor?.k === k ? `${Math.round(exporting * 100)}%` : '📱 Share reel'}
              </button>
            )}
            {run?.clip && <button type="button" onClick={() => toReelStudio(k, 'open')} className="rounded-md border border-violet-300/40 bg-violet-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-violet-100 hover:bg-violet-500/30" title="Change this part in the Reel Studio — sizes, colours, headings, words — then share it (new tab; the class goes on)">🎬 Edit</button>}
            <button type="button" className={btn} onClick={() => snap(k, 'left')} title="Float this board on the left half of the screen">◧</button>
            <button type="button" className={btn} onClick={() => snap(k, 'right')} title="Float this board on the right half of the screen">◨</button>
            <button type="button" className={btn} onClick={() => toggleFloat(k)} title={floating ? 'Put this board back in the page' : 'Float this board — move it anywhere'}>{floating ? '⤓' : '⧉'}</button>
          </span>
        </div>
        <div className="flex w-full min-h-0 flex-col items-center gap-2 md:flex-row md:items-start md:justify-center">
        <div
          ref={hostRefs[k]}
          className={`relative shrink-0 overflow-hidden rounded-xl bg-white shadow-xl outline-none ${isActive ? '' : 'opacity-85'}`}
          // Docked: each 16:9 board fits its own share of the height. Floating: it fills the floating window.
          style={{ width: floating ? '100%' : `min(100%, ${boardW}px)` }}
          tabIndex={0}
        >
          <canvas ref={canvasRefs[k]} width={1280} height={720} className="block h-auto w-full" onClick={(e) => onStepButton(k, e)} onMouseMove={(e) => { e.currentTarget.style.cursor = stepButtonAt(k, e) ? 'pointer' : ''; }} />
          {q && (
            <ClassQuestionOverlay
              key={q.q.id}
              question={q.q}
              targets={q.targets}
              frame={{ width: 1280, height: 720 }}
              onAnswer={(a) => {
                // V51.9.111: the first answer to a question earns a toffee (right) or a chilli (wrong), like the quiz
                if (!answers.has(q.q.id)) rewardClassAnswer(q.q, a, { studentId: currentStudentId(), studentName: loadProfile().name, grade, chapter: chapterTitle, section: heading || chapterTitle });
                setAnswers((m) => new Map(m).set(q.q.id, a.correct && !a.skipped));
              }}
              onContinue={() => players.current[k]?.answerQuestion(q.q.id)}
            />
          )}
          {askAfter?.k === k && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-3 backdrop-blur-[2px]" data-ask-after-solution role="dialog" aria-label="What next with this solution" onClick={tuckAway}>
              <div className="w-full max-w-md space-y-3 rounded-2xl border border-white/15 bg-[#0b1426]/95 p-4 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="text-base font-extrabold">✅ Solution finished</div>
                <p className="text-sm text-white/75">Do you want to send it to the Reel Studio, or download it to your device?</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => { sendSolution(); tuckAway(); }} className="rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-bold hover:bg-violet-500" data-ask-send>
                    {askAfter.sent ? '✓ Sent to Reel Studio' : '🎬 Send to Reel Studio'}
                  </button>
                  <button type="button" onClick={() => void downloadSolution()} disabled={askAfter.making !== undefined} className="rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold hover:bg-emerald-500 disabled:opacity-70" data-ask-download>
                    {askAfter.making !== undefined ? `Making video… ${Math.round(askAfter.making * 100)}%` : askAfter.saved ? '✓ Downloaded' : '⬇ Download to my device'}
                  </button>
                </div>
                {askAfter.sent && <p className="text-xs text-violet-200">Opened in the Reel Studio in a new tab: change it there and make your reel.</p>}
                {askAfter.saved && <p className="text-xs text-emerald-200">Saved as {askAfter.saved} (9:16 video with voice and captions).</p>}
                {askAfter.error && <p className="text-xs text-amber-200">{askAfter.error}</p>}
                {askAfter.saved && <JoinNote join={join} />}
                {askAfter.saved && <a href={`/ai-guru/reels/flow?topic=${encodeURIComponent(heading || chapterTitle)}`} target="_blank" rel="noopener" className="block text-xs font-semibold text-cyan-300 underline" data-flow-from-class>✨ Make it more beautiful with Google Flow (steps and a ready prompt) ↗</a>}
                {askAfter.making !== undefined && <p className="text-xs text-white/55">You don’t have to wait: continue the class — the video is made in the background and saved by itself.</p>}
                <div className="flex justify-end">
                  <button type="button" onClick={continueClass} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/15" data-ask-continue>
                    {askAfter.making !== undefined ? 'Continue the class ▶ (video keeps making)' : askAfter.sent || askAfter.saved ? 'Continue the class ▶' : 'No thanks, continue ▶'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {!run && !phase && <div className="absolute inset-0 flex items-center justify-center bg-slate-100 px-3 text-center text-xs font-semibold text-slate-500">{runs.length ? (k === 'lecture' ? 'Nothing to explain in words in this part — it is all worked on the problem board' : 'No problem in this part — it is all explained on the lecture board') : `${label} board · waits for its turn`}</div>}
          {phase && k === (hasKind('lecture') ? 'lecture' : 'problem') && <div className="absolute inset-0 flex items-center justify-center bg-black/55 px-2 text-center text-sm font-semibold text-white">{phase}</div>}
        </div>
        </div>
        <div className="w-full shrink-0 px-1 pt-1" style={{ height: PANE_FOOT_H }}>
          {run && (
            <StepStrip
              compact
              timeline={run.tl}
              current={st?.step ?? 0}
              visited={visitedBy[k]}
              questionSteps={new Map(run.placed.map((p) => [p.step, answers.has(p.id) ? answers.get(p.id)! : null] as [number, boolean | null]))}
              onJump={(i) => players.current[k]?.goToStep(i)}
            />
          )}
        </div>
        {floating && (
          <div
            onPointerDown={(e) => resizeBoard(k, e)}
            className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize"
            style={{ touchAction: 'none' }}
            title="Drag to make this board bigger or smaller"
          >
            <span className="absolute bottom-1 right-1 h-2.5 w-2.5 border-b-2 border-r-2 border-white/60" />
          </div>
        )}
      </div>
    );
  };

  const segLang = activeRun?.tl.segments[activeState?.segment ?? 0]?.lang;
  // V51.9.139: keep the live board in view as the history above it grows (unless the student scrolled up to read)
  const liveEntry = history.find((h) => h.key === `${sectionKey}#${runIdx}`);
  const historyPages = history.reduce((n, h) => n + (h === liveEntry ? h.pages.filter((t) => t < (activeState?.timeMs ?? 0) - 300).length : h.pages.length), 0);
  useEffect(() => {
    const el = rootRef.current;
    if (el && stickBottom.current) el.scrollTop = el.scrollHeight;
  }, [historyPages, rootH]);
  // V51.9.121: the 📱 Share reel window (language → making → preview → share / download / change)
  const shareRun = shareFor ? runs[shown[shareFor.k]] : undefined;
  const shareLangs = shareRun ? reelLanguages(shareRun.tl.segments as Array<{ lang: Lang }>) : [];
  const shareDialog = shareFor ? (
    <ReelPreviewDialog state={shareFor.state} title={`${heading || chapterTitle}${shareRun ? ` · ${shareRun.kind === 'problem' ? 'Problem' : 'Lecture'} ${shareRun.nth}` : ''}`}
      caption={clipCaption(heading || chapterTitle, join.link, shareFor.lang)}
      onClose={closeShare}
      onEdit={shareRun?.clip ? () => { closeShare(); toReelStudio(shareFor.k, 'open', shareFor.lang); } : undefined} editLabel="✏️ Change it in Reel Studio"
      onMake={() => void makeShare(shareFor.k, shareFor.lang)}
      chooser={
        <div className="space-y-2 text-sm">
          <p className="text-white/70">A 9:16 reel of this part, with voice and captions. Which language?</p>
          <div className="flex gap-2">{shareLangs.map((l) => <button key={l} onClick={() => setShareFor((s) => (s ? { ...s, lang: l } : s))} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${shareFor.lang === l ? 'bg-violet-600' : 'bg-white/10'}`}>{l === 'ml' ? 'Malayalam' : 'English'}</button>)}</div>
          {shareRun?.clip && <button onClick={() => toReelStudio(shareFor.k, 'file', shareFor.lang)} className="text-xs text-white/50 underline">or save it as a class file for the Reel Studio</button>}
          <JoinNote join={join} />
        </div>
      } />
  ) : null;

  return (
    <div ref={rootRef} className="relative flex min-h-0 flex-col items-center gap-2 overflow-y-auto p-2" style={{ height: rootH || undefined, flex: rootH ? '0 0 auto' : '1 1 0%' }} data-ai-guru-motion-board>
      {/* Where "fixed" starts on this page (see the effect that reads it). */}
      <div ref={probeRef} aria-hidden style={{ position: 'fixed', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none' }} />
      {shareDialog}
      {/* V51.9.140: videos being made in the background */}
      {jobs.length > 0 && (
        <div className="fixed right-4 top-20 z-[65] flex flex-col items-end gap-1.5" data-bg-jobs>
          {jobs.map((j) => (
            <div key={j.id} className={`flex max-w-[320px] items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-xl backdrop-blur ${j.error ? 'border-amber-300/40 bg-amber-950/85 text-amber-100' : j.saved ? 'border-emerald-300/40 bg-emerald-950/85 text-emerald-100' : 'border-white/15 bg-[#0b1426]/90 text-white'}`} role="status">
              {j.progress !== undefined ? (
                <>
                  <span>⬇ {j.label}: making video… {Math.round(j.progress * 100)}%</span>
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/15"><span className="block h-full bg-emerald-400" style={{ width: `${Math.round(j.progress * 100)}%` }} /></span>
                </>
              ) : j.saved ? <span>✓ {j.label} saved: {j.saved}</span> : <span>⚠ {j.label}: {j.error}</span>}
              {(j.saved || j.error) && <button type="button" onClick={() => setJobs((js) => js.filter((x) => x.id !== j.id))} className="ml-1 text-white/60 hover:text-white" aria-label="Close">✕</button>}
            </div>
          ))}
        </div>
      )}
      {/* V51.9.139: what the class has taught so far — scroll up */}
      <ClassHistoryFeed entries={history} liveKey={activeRun ? `${sectionKey}#${runIdx}` : null} liveTime={activeState?.timeMs ?? 0} section={sectionKey} look={boardLook}
        busy={histBusy} onWatch={(h) => { startRun(h.runIdx, true); rootRef.current?.scrollTo({ top: rootRef.current.scrollHeight, behavior: 'smooth' }); }} onSend={sendHistory} onDownload={(h) => void downloadHistory(h)}
        onDelete={(h) => removeHistory(h.key)} onDeleteAll={() => clearHistory()} />
      <div className="flex w-full shrink-0 flex-col items-center gap-2" style={{ height: rootH ? Math.max(360, rootH - 16) : undefined, flex: rootH ? undefined : '1 1 0%', minHeight: 0 }} data-live-class>
      <div className="flex w-full max-w-4xl shrink-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border border-white/10 bg-[#0b1017]/90 px-2 py-1 text-white" data-ai-guru-motion-controls>
        {/* V51.9.143: speed and the wait between steps sit on top of the whiteboard (the bottom is under the class dock) */}
        <button type="button" className="rounded-lg border border-white/15 bg-white/10 px-2 py-0.5 text-xs font-semibold hover:bg-white/20 disabled:opacity-50" onClick={() => startRun(0, !prevPaused.current)} disabled={!!phase || !runs.length} title="Start this whole section again">⟲ Start again</button>
        <button type="button" className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-2 py-0.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-50" onClick={() => void downloadCurrent()} disabled={!!phase || !activeRun || exporting !== null} title="Save the part on the board as an MP4 video (voice and captions) — the class goes on" data-download-mp4>⬇ MP4</button>
        {onRegenerate && <button type="button" className="rounded-lg border border-white/15 bg-white/10 px-2 py-0.5 text-xs font-semibold hover:bg-white/20 disabled:opacity-50" onClick={onRegenerate} disabled={!!phase} title="Make this section's lesson again" data-regenerate>↻ Regenerate</button>}
        {/* V51.9.180 (UX review): Close sits in this row — it used to float over the board's top-right corner, on top of "Regenerate" */}
        {onClose && <button type="button" onClick={onClose} className="rounded-lg border border-white/15 bg-white/10 px-2 py-0.5 text-xs font-semibold hover:bg-white/20" title="Close this lesson board" data-close-board>✕ Close</button>}
        <label className="flex items-center gap-1 text-xs text-white/70">
          Speed
          <select value={rate} onChange={(e) => setRate(Number(e.target.value))} className="rounded-lg border border-white/15 bg-[#0b1017] px-1.5 py-0.5 text-xs text-white" title="Teaching speed">
            {RATES.map((r) => (
              <option key={r.v} value={r.v}>{r.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs text-white/70" title="After each step the board waits this long, so there is time to read and think, then the next step starts by itself">
          Wait
          <select value={gap} onChange={(e) => setGap(Number(e.target.value))} className="rounded-lg border border-white/15 bg-[#0b1017] px-1.5 py-0.5 text-xs text-white" aria-label="Time before the next step" data-step-gap>
            {STEP_GAPS.map((g) => <option key={g} value={g}>{g === 0 ? 'no wait' : `${g} s`}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs text-white/70" title="Cinematic: night sky, glowing working and glass captions. Whiteboard: the classic white board.">
          Board
          <select value={boardLook} onChange={(e) => setBoardLook(e.target.value as BoardLook)} className="rounded-lg border border-white/15 bg-[#0b1017] px-1.5 py-0.5 text-xs text-white" aria-label="Board look" data-board-look>
            <option value="cinematic">🎬 Cinematic</option>
            <option value="classic">Whiteboard</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs text-white/70" title="Teach this class in both languages (one after the other), in English only, or in Malayalam only — whatever languages the study materials were made in. The lesson starts again in the chosen language.">
          Teach in
          <select value={classLangs} onChange={(e) => { const v = e.target.value as ClassLangs; saveClassLangs(v); setClassLangs(v); }} className="rounded-lg border border-white/15 bg-[#0b1017] px-1.5 py-0.5 text-xs text-white" aria-label="Class languages" data-class-languages>
            {/* V51.9.182: "both" teaches the class language first — say it in that order */}
            <option value="both">{language === 'malayalam' ? 'Malayalam + English' : 'English + Malayalam'}</option>
            <option value="en">English only</option>
            <option value="ml">Malayalam only</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs text-white/70" title="One camera move per step. Calm (for learning): push-in, pull-out reveal, pan follow, tilt-down steps, split focus. Lively adds crash zoom, whip pan, dutch tilt and rack focus. Auto: calm on the board, lively in the MP4.">
          Camera
          <select value={moves} onChange={(e) => { const v = e.target.value as MovesSetting; setMoves(v); saveMovesSetting(v); }} className="rounded-lg border border-white/15 bg-[#0b1017] px-1.5 py-0.5 text-xs text-white" aria-label="Camera moves" data-camera-moves>
            {MOVES_SETTINGS.map((m) => <option key={m} value={m}>{m === 'auto' ? 'Auto' : MOVES_NAME[m]}</option>)}
          </select>
        </label>
      </div>
      <div ref={areaRef} className={`flex w-full max-w-none flex-col ${dockedKinds.length ? 'min-h-[300px] flex-1 md:min-h-[72vh]' : ''}`}>{/* V51.9.208: the board fills its column and is taller (about half the height of the textbook page) */}
        {pane('lecture')}
        {bothDocked && (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Drag to give more room to the lecture board or the problem board"
            tabIndex={0}
            onPointerDown={dragSplit}
            onDoubleClick={() => setSplitSaved(0.5)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') { e.preventDefault(); setSplitSaved(split - 0.05); }
              else if (e.key === 'ArrowDown') { e.preventDefault(); setSplitSaved(split + 0.05); }
            }}
            className="group flex w-full shrink-0 cursor-row-resize items-center justify-center"
            style={{ height: HANDLE_H, touchAction: 'none' }}
            title="Drag to resize · double-click to reset"
          >
            <span className="h-1 w-16 rounded-full bg-white/25 group-hover:bg-white/50" />
          </div>
        )}
        {pane('problem')}
        {fl.lecture.floating && fl.problem.floating && (
          <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
            Both boards are floating.
            <button type="button" className={btn} onClick={() => { const n = { lecture: { ...fl.lecture, floating: false }, problem: { ...fl.problem, floating: false } }; setFl(n); saveFloat(n); }}>Put both back</button>
          </div>
        )}
      </div>
      {runs.length > 1 && (
        <div className="flex w-full max-w-4xl flex-wrap items-center justify-center gap-1 text-[11px]" data-ai-guru-run-chips>
          {runs.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => startRun(i, !prevPaused.current)}
              className={`rounded-full border px-2 py-0.5 ${i === runIdx ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-100' : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10'}`}
              title={`Go to ${r.kind} ${r.nth}`}
            >
              {r.micro ? '💡' : r.kind === 'lecture' ? '📖' : '✏️'} {r.nth}
            </button>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

const RATES = [
  { v: 0.5, label: '0.5× very slow' },
  { v: 0.75, label: '0.75× slow' },
  { v: 1, label: '1× normal' },
  { v: 1.25, label: '1.25× fast' },
  { v: 1.5, label: '1.5× faster' },
];

function readRate(): number {
  try {
    const v = Number(localStorage.getItem('aiGuruMotionRate'));
    return RATES.some((r) => r.v === v) ? v : 1;
  } catch {
    return 1;
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** The language of the segment the board is in (for the caption on the step rail). */
function segLang0(run: { tl: { segments: Array<{ lang: string }> } }, st: { segment: number } | null | undefined): string | undefined {
  return run.tl.segments[st?.segment ?? 0]?.lang;
}

/**
 * V51.9.150: how friends join from the reel (a video cannot be clicked), and a warning when the link is a local address
 * that nobody else can open.
 */
function JoinNote({ join }: { join: { short: string; code: string; local: boolean } }) {
  return (
    <div className="space-y-1 rounded-lg border border-white/10 bg-white/[0.04] p-2 text-[11px] leading-snug text-white/65" data-join-note>
      <div>A video cannot be tapped, so the reel carries your link <b className="text-white/85">{join.short}</b> on every frame, and ends with a <b className="text-white/85">QR code</b>{join.code ? <> and your join code <b className="font-mono text-amber-200">{join.code}</b></> : null}. Friends scan the QR from another screen, or type the code at <b className="text-white/85">…/j</b>. The caption carries the link too: it can be tapped on WhatsApp.</div>
      {join.local && <div className="text-amber-200">⚠ This link is a local address ({join.short.split('/')[0]}). It works only on this computer, so nobody else can join from it. Ask your teacher or admin to set the app’s public address (NEXT_PUBLIC_SITE_URL).</div>}
    </div>
  );
}
