'use client';

/**
 * Motion Class: teaches a textbook (e.g. SCERT Kerala Mathematics IX) paragraph by
 * paragraph as a bilingual 3B1B-style whiteboard class.
 *
 *   PDF → layout reader → teaching units → DNA selection (mandatory for problems,
 *   equations, formulas) → plans (AI, or offline / sample) → for every unit:
 *   Read EN → Teach EN → Read ML → Teach ML (same graphics) with voice + captions.
 *
 * The class is INTERACTIVE (drawn live, not a video): pause, restart, step
 * back/forward, replay a step, slow teaching 0.25×–2× with a natural voice,
 * "pause after each step", jump to the other language, fullscreen — using
 * manim-web's player bar and keyboard controller. The section can still be
 * saved as an MP4 (+ subtitles).
 */

import { openRouter } from '@/lib/ai-guru/openrouter';
import { loadIntroClips, type IntroClips } from '@/lib/ai-guru/motion-class/intro-clips';
import { useEffect, useMemo, useRef, useState } from 'react';
import { reelSubtitleCues, toSrt } from '@/lib/ai-guru/reels/motion';
import { loadReelFonts } from '@/lib/ai-guru/reels/motion/fonts';
import { pullTeacherDna } from '@/lib/ai-guru/teacher/sync';
import { exportMotionReelMp4 } from '@/lib/ai-guru/reels/motion/export';
import { checkSummary } from '@/lib/ai-guru/reels/motion/self-check';
import { segmentBook, teachingUnits, type BookStructure, type BookBlock, type BookSection } from '@/lib/ai-guru/motion-class/segment';
import { selectDna, DNA_BY_ID } from '@/lib/ai-guru/motion-class/dna/registry';
import { exportLearned, importLearned, learnedDnas } from '@/lib/ai-guru/motion-class/dna/learned';
import type { BlockPlan } from '@/lib/ai-guru/motion-class/dna/types';
import { offlinePlan } from '@/lib/ai-guru/motion-class/plan/offline';
import { planSection, regenerateBlock, type Llm } from '@/lib/ai-guru/motion-class/plan/ai';
import { samplePlanFor } from '@/lib/ai-guru/motion-class/samples/scert9-ch1-s1';
import { ensureHeadingIntro3d } from '@/lib/ai-guru/three-d/ensure';
import { compileClass, type ClassOrder, type ClassSegment } from '@/lib/ai-guru/motion-class/class';
import { prepareSegment, type PreparedSegment } from '@/lib/ai-guru/motion-class/player';
import { MOVES_NAME, MOVES_SETTINGS, readMovesSetting, saveMovesSetting, type MovesSetting } from '@/lib/ai-guru/reels/motion/camera-presets';
import { buildClassTimeline, ClassPlayer, readBoardLook, readStepGap, saveBoardLook, saveStepGap, SPEEDS, STEP_GAPS, type BoardLook, type ClassTimeline, type PlayerState } from '@/lib/ai-guru/motion-class/interactive-player';
import { loadBook, type LoadedBook } from '@/lib/ai-guru/motion-class/pdf-client';
import { callGeminiClient, callGeminiClientVision, studentKey } from '@/lib/student-key';
import { AiGuruTopNav } from './AiGuruTopNav';
import { useTeacherTools } from '@/lib/ai-guru/ui/teacher-tools';
import { TeacherQuizDock } from './share/TeacherQuizDock';
import { frameTargets, placeQuestions, type FrameTarget, type PlacedQuestion } from '@/lib/ai-guru/motion-class/interactive/questions';
import {
  currentStudentId,
  loadProgress,
  markPosition,
  progressKey,
  recordAnswer,
  resumePoint,
  saveProgress,
  clearProgress,
  type ClassProgress,
} from '@/lib/ai-guru/motion-class/interactive/progress';
import { ClassQuestionOverlay, type QuestionAnswer } from './motion-class/ClassQuestionOverlay';
import { StepStrip } from './motion-class/StepStrip';
import { exportOfflinePack } from '@/lib/ai-guru/motion-class/offline-pack';
import { lintTimeline, lintPlan, lintSummary, type LintIssue } from '@/lib/ai-guru/motion-class/lint';
import { promoteSketch, rejectSketch, sketchCandidates } from '@/lib/ai-guru/motion-class/dna/sketch-library';
import { AVATAR_EVENT, loadLocalAvatar, type AvatarForReel } from '@/lib/ai-guru/teacher/avatar';
import { fetchMyTeachersAvatar, preparedAvatar } from '@/lib/ai-guru/teacher/avatar-client';
import { AVATARS, MISTAKES } from '@/lib/ai-guru/features';
import type { PreparedAvatar } from '@/lib/ai-guru/reels/motion/avatar-draw';

const geminiLlm: Llm = (system, user, image) =>
  image ? callGeminiClientVision(system, `${user}\nReturn ONLY JSON.`, image.base64, image.mime) : callGeminiClient(system, user, undefined, { json: true, maxOutputTokens: 12000 });

const KIND_COLOR: Record<string, string> = {
  heading: 'bg-rose-500/20 text-rose-200',
  prose: 'bg-white/10 text-white/70',
  problem: 'bg-amber-500/20 text-amber-200',
  exercise: 'bg-amber-500/20 text-amber-200',
  math: 'bg-cyan-500/20 text-cyan-200',
  result: 'bg-violet-500/20 text-violet-200',
  aside: 'bg-white/5 text-white/40',
};

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export default function MotionClassroom({ embedded = false }: { embedded?: boolean } = {}) {
  const Main = embedded ? 'div' : 'main';
  const [book, setBook] = useState<LoadedBook | null>(null);
  const [teacherTools, toggleTeacherTools] = useTeacherTools(); // V51.9.180: template export/import and sketch review
  const [structure, setStructure] = useState<BookStructure | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [chapterIdx, setChapterIdx] = useState(0);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [plans, setPlans] = useState<Map<string, BlockPlan>>(new Map());
  const [planning, setPlanning] = useState<string | null>(null);
  const [order, setOrder] = useState<ClassOrder>('per-language');
  const [langs, setLangs] = useState<{ en: boolean; ml: boolean }>({ en: true, ml: true });
  const [voiceOn, setVoiceOn] = useState(true);
  const [includeAsides, setIncludeAsides] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [exporting, setExporting] = useState<number | null>(null);
  const [packing, setPacking] = useState<number | null>(null);
  const [lintOpen, setLintOpen] = useState(false);
  const [, setLearnedVersion] = useState(0);
  const [timeline, setTimeline] = useState<ClassTimeline | null>(null);
  const [prepProgress, setPrepProgress] = useState<string | null>(null);
  const [ps, setPs] = useState<PlayerState | null>(null);
  /* V51.9.50: questions inside the animation, step strip, saved progress. */
  const [questionsOn, setQuestionsOn] = useState(true);
  /** V51.9.51: the app's own common-mistake scenes (HCF/LCM, balance scale) where a plan has none. */
  const [mistakesOn, setMistakesOn] = useState(true);
  const [intro3dOn, setIntro3dOn] = useState(true);
  // V51.9.100: the teacher's face in the corner of the regular class and its MP4 (a choice; never on doubt clearing).
  // This computer's own teacher avatar, or the student's class teacher's when shared. Face only, free lip-sync on this device.
  const [faceAv, setFaceAv] = useState<AvatarForReel | null>(null);
  const [faceOn, setFaceOn] = useState(false);
  const [facePrep, setFacePrep] = useState<PreparedAvatar | null>(null);
  useEffect(() => {
    if (!AVATARS) return; // V51.9.122: avatars are switched off app-wide
    let live = true;
    const sync = () => { const mine = loadLocalAvatar(); if (mine) setFaceAv(mine); else void fetchMyTeachersAvatar().then((a) => { if (live) setFaceAv(a); }); };
    sync();
    window.addEventListener(AVATAR_EVENT, sync);
    return () => { live = false; window.removeEventListener(AVATAR_EVENT, sync); };
  }, []);
  useEffect(() => {
    if (!faceAv || !faceOn) return;
    let live = true;
    void preparedAvatar({ ...faceAv, style: faceAv.style === 'ai' ? 'lipsync' : faceAv.style }).then((p) => { if (live) setFacePrep(p); }).catch(() => {});
    return () => { live = false; };
  }, [faceAv, faceOn]);
  const classFace = AVATARS && faceOn && faceAv ? facePrep : null;
  const [intro3dReady, setIntro3dReady] = useState(false);
  useEffect(() => { if (intro3dOn) void ensureHeadingIntro3d().then(setIntro3dReady); }, [intro3dOn]);
  const [question, setQuestion] = useState<PlacedQuestion | null>(null);
  const [targets, setTargets] = useState<FrameTarget[]>([]);
  /** Bumped to re-read the saved progress (after "Reset progress"). */
  const [progressNonce, setProgressNonce] = useState(0);
  /** The progress record whose resume offer the student already used or dismissed. */
  const [resumeDismissed, setResumeDismissed] = useState<ClassProgress | null>(null);
  const [progressVersion, setProgressVersion] = useState(0);
  const timelineRef = useRef<ClassTimeline | null>(null);
  const progressRef = useRef<ClassProgress | null>(null);
  const lastSaveRef = useRef(0);
  /** Position is saved only once the student has started this class (loading it must not overwrite the saved place). */
  const startedRef = useRef(false);
  const [studentId] = useState(() => (typeof window === 'undefined' ? 'local-student' : currentStudentId()));

  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<ClassPlayer | null>(null);
  const cacheRef = useRef(new Map<string, Promise<PreparedSegment>>());
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadReelFonts();
    void pullTeacherDna();
  }, []);

  // One interactive player for the page, with manim-web's control bar + keyboard.
  useEffect(() => {
    if (!hostRef.current || !canvasRef.current) return;
    const p = new ClassPlayer(hostRef.current, canvasRef.current, {
      format: 'landscape',
      onUpdate: (s) => setPs(s),
      onExport: () => void exportSection(),
      onQuestion: (q) => {
        setQuestion(q);
        const tl = timelineRef.current;
        const ctx = canvasRef.current?.getContext('2d');
        setTargets(q && tl && ctx ? frameTargets(q, tl.reel, 'landscape', ctx) : []);
      },
    });
    playerRef.current = p;
    p.setStepGap(readStepGap()); // V51.9.136: the wait between steps chosen on this device
    p.setBoardLook(readBoardLook()); // V51.9.137: cinematic board by default
    void p.attachControls().catch((e) => setMessage(`Player controls: ${(e as Error).message}`));
    return () => {
      p.dispose();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // V51.9.100: the teacher's face on the class board (and in the class MP4) when switched on
  useEffect(() => { playerRef.current?.setTeacherFace(classFace); }, [classFace]);

  const chapter = structure?.chapters[chapterIdx];
  const section: BookSection | undefined = chapter?.sections[sectionIdx];
  const units = useMemo<BookBlock[]>(() => {
    if (!section) return [];
    return teachingUnits(section.blocks.filter((b) => includeAsides || b.kind !== 'aside'));
  }, [section, includeAsides]);

  // Default plans: sample (when this is the sample section) → offline. AI plans replace them.
  useEffect(() => {
    if (!chapter || !section) return;
    setPlans((prev) => {
      const next = new Map(prev);
      for (const u of units) if (!next.has(u.id)) next.set(u.id, samplePlanFor(u.id, u.text) ?? offlinePlan(u, chapter.title, section.title));
      return next;
    });
  }, [units, chapter, section]);

  // V51.9.88: rendered HyperFrames intro clips (public/ai-guru/intros); none yet → the three.js intros are used
  const [introClips, setIntroClips] = useState<IntroClips | null>(null);
  useEffect(() => {
    if (!intro3dOn) return;
    let live = true;
    void loadIntroClips().then((c) => { if (live) setIntroClips(c); });
    return () => { live = false; };
  }, [intro3dOn]);
  const segments = useMemo<ClassSegment[]>(() => {
    if (!section) return [];
    const languages = (['en', 'ml'] as const).filter((l) => langs[l]);
    return compileClass(units, plans, { title: section.title }, { order, languages: [...languages], mistakes: mistakesOn, headingIntro3d: intro3dOn, subject: book?.name, introClips: introClips ?? undefined });
  }, [units, plans, section, order, langs, mistakesOn, intro3dOn, book, introClips]);

  /* ---------------- prepare the class timeline ---------------- */

  // V51.9.50: key on a hash of the whole plan (it used the JSON length, so a same-length edit reused stale captions and voice).
  const prepKey = (seg: ClassSegment) => {
    const pl = plans.get(seg.blockId);
    let h = 2166136261;
    for (const ch of JSON.stringify([pl?.teach ?? null, pl?.read ?? null, pl?.arc ?? null])) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return `${seg.id}|${voiceOn}|${(h >>> 0).toString(36)}|${pl?.source}|${mistakesOn ? 'mk' : ''}${intro3dReady ? 'i3' : ''}`;
  };

  useEffect(() => {
    if (!segments.length || !section) {
      setTimeline(null);
      return;
    }
    let alive = true;
    const ctl = new AbortController();
    setTimeline(null);
    (async () => {
      const list: PreparedSegment[] = [];
      const errors = new Set<string>();
      for (let i = 0; i < segments.length; i++) {
        if (!alive) return;
        setPrepProgress(`${voiceOn ? 'Preparing voices and animation' : 'Preparing animation'} ${i + 1}/${segments.length}`);
        const key = prepKey(segments[i]);
        let p = cacheRef.current.get(key);
        if (!p) {
          p = prepareSegment(segments[i], voiceOn, ctl.signal);
          cacheRef.current.set(key, p);
        }
        try {
          const r = await p;
          list.push(r);
          if (r.voiceError) errors.add(r.voiceError);
        } catch (e) {
          cacheRef.current.delete(key);
          if (!alive) return;
          setMessage(`Could not prepare ${segments[i].label}: ${(e as Error).message}`);
        }
      }
      if (!alive) return;
      const tl = buildClassTimeline(section.title, list);
      timelineRef.current = tl;
      setTimeline(tl);
      playerRef.current?.load(tl);
      setPrepProgress(null);
      if (errors.size) setMessage(`Voice: ${[...errors][0]}`);
    })();
    return () => {
      alive = false;
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, voiceOn]);

  /* ---------------- V51.9.50: questions + progress ---------------- */

  const classKey = book && chapter && section ? progressKey(book.name, chapter.title, section.title) : null;

  // This student's saved progress for the class (re-read when the class or student changes, or after a reset).
  const progress = useMemo<ClassProgress | null>(
    () => (timeline && classKey ? loadProgress(studentId, classKey, `${chapter?.title ?? ''} · ${section?.title ?? ''}`) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeline, classKey, studentId, progressNonce],
  );
  useEffect(() => {
    progressRef.current = progress;
    startedRef.current = false;
  }, [progress]);
  const resumeAt = useMemo(
    () => (progress && timeline && resumeDismissed !== progress ? resumePoint(progress, timeline.reel.durationMs, timeline.steps.length) : null),
    [progress, timeline, resumeDismissed],
  );

  // Questions placed on the timeline (computed from the plans); answered ones are not asked again.
  const placed = useMemo<PlacedQuestion[]>(() => (timeline && questionsOn ? placeQuestions(timeline, plans) : []), [timeline, plans, questionsOn]);
  useEffect(() => {
    playerRef.current?.setQuestions(placed, Object.keys(progress?.answers ?? {}));
  }, [placed, progress]);

  // Class check (lint): broken names, missing audio, stale narration, Malayalam leaks, unplaced questions.
  const lint = useMemo<LintIssue[] | null>(() => {
    if (!timeline) return null;
    const issues: LintIssue[] = [];
    for (const u of units) {
      const pl = plans.get(u.id);
      if (pl) issues.push(...lintPlan(u.id, pl, { validate: false }));
    }
    issues.push(...lintTimeline(timeline, { voice: voiceOn, segments, plans, questions: questionsOn ? placeQuestions(timeline, plans) : undefined }));
    return issues;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline]);

  // Save the position (on every step change, and at most every 4 s while playing).
  useEffect(() => {
    const p = progressRef.current;
    if (!p || !ps || !timeline) return;
    if (!startedRef.current) {
      if (!ps.playing) return;
      startedRef.current = true;
    }
    const stepChanged = p.step !== ps.step || !p.visited.includes(ps.step);
    const now = Date.now();
    if (!stepChanged && now - lastSaveRef.current < 4000) return;
    lastSaveRef.current = now;
    markPosition(p, ps.timeMs, ps.step, timeline.steps.length);
    saveProgress(p);
    if (stepChanged) setProgressVersion((v) => v + 1);
  }, [ps, timeline]);

  function onQuestionAnswer(a: QuestionAnswer) {
    const q = question;
    const p = progressRef.current;
    if (!q || !p) return;
    recordAnswer(p, q, a.correct, { skipped: a.skipped });
    saveProgress(p);
    setProgressVersion((v) => v + 1);
  }

  function onQuestionContinue() {
    const q = question;
    if (!q) return;
    playerRef.current?.answerQuestion(q.id);
  }

  const visited = useMemo(() => {
    void progressVersion; // the record is updated in place; the version re-reads it
    return new Set(progress?.visited ?? []);
  }, [progress, progressVersion]);
  const questionSteps = useMemo(() => {
    void progressVersion;
    const m = new Map<number, boolean | null>();
    for (const q of placed) {
      const a = progress?.answers[q.id];
      m.set(q.step, a ? a.firstCorrect && !a.skipped : null);
    }
    return m;
  }, [placed, progress, progressVersion]);
  const answeredCount = placed.filter((q) => progress?.answers[q.id]).length;
  const rightCount = placed.filter((q) => progress?.answers[q.id]?.firstCorrect && !progress?.answers[q.id]?.skipped).length;

  // Keep the current transcript line in view.
  useEffect(() => {
    const el = transcriptRef.current?.querySelector<HTMLElement>(`[data-step="${ps?.step ?? 0}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [ps?.step]);

  /* ---------------- loading ---------------- */

  async function onFile(file: File) {
    setLoading('Opening the PDF…');
    setMessage(null);
    try {
      const b = await loadBook(file, (p, n) => setLoading(`Reading page ${p} of ${n}…`));
      setLoading('Finding chapters, sections, problems and equations…');
      const s = segmentBook(b.pages, { pageHeight: b.pageHeight });
      setBook(b);
      setStructure(s);
      setChapterIdx(0);
      setSectionIdx(0);
      setPlans(new Map());
      cacheRef.current.clear();
    } catch (e) {
      setMessage(`Could not read the PDF: ${(e as Error).message}`);
    } finally {
      setLoading(null);
    }
  }

  /* ---------------- planning ---------------- */

  /** Plan one unit again (optionally with a teacher's note); the same checks and automatic retries run. */
  async function regenerateUnit(u: BookBlock) {
    if (!chapter || !section || !book) return;
    if (!studentKey.hasValidatedKey() && !openRouter.hasUsable()) {
      setMessage('Add a Gemini (or OpenRouter) key in Settings → Gemini BYOK to regenerate with AI.');
      return;
    }
    const note = typeof window !== 'undefined' ? window.prompt('Anything the AI should change? (optional, e.g. "use smaller numbers")') : null;
    if (note === null) return;
    const i = units.findIndex((x) => x.id === u.id);
    setPlanning(`Regenerating · ${u.kind}`);
    try {
      const r = await regenerateBlock(
        u,
        {
          chapterTitle: chapter.title,
          sectionTitle: section.title,
          bookTitle: book.name,
          before: units.slice(Math.max(0, i - 2), i).map((x) => x.text.slice(0, 300)),
          after: units.slice(i + 1, i + 3).map((x) => x.text.slice(0, 300)),
          pageText: book.pageText?.(u.page),
          pageImage: book.pageImage ? await book.pageImage(u.page).catch(() => undefined) : undefined,
          note: note.trim() || undefined,
        },
        geminiLlm,
      );
      setPlans((prev) => new Map(prev).set(u.id, r.plan));
      setLearnedVersion((v) => v + 1);
      setMessage(r.plan.source === 'ai' ? `Unit regenerated${r.attempts > 1 ? ` (${r.attempts} tries)` : ''}.` : 'The AI plan was rejected again; the offline plan is kept (see warnings).');
    } catch (e) {
      setMessage(`Regeneration stopped: ${(e as Error).message}`);
    } finally {
      setPlanning(null);
    }
  }

  async function planWithAi() {
    if (!chapter || !section || !book) return;
    if (!studentKey.hasValidatedKey() && !openRouter.hasUsable()) {
      setMessage('Add a Gemini (or OpenRouter) key in Settings → Gemini BYOK to plan with AI. Offline plans are used meanwhile.');
      return;
    }
    setPlanning('Starting…');
    try {
      const result = await planSection(units, { chapterTitle: chapter.title, sectionTitle: section.title, bookTitle: book.name }, geminiLlm, {
        onProgress: (p) => setPlanning(`${p.done}/${p.total}${p.message ? ` · ${p.message}` : ''}`),
        pageText: book.pageText,
        pageImage: book.pageImage,
      });
      setPlans((prev) => new Map([...prev, ...result]));
      setLearnedVersion((v) => v + 1);
      const failed = [...result.values()].filter((p) => p.source !== 'ai').length;
      const regenerated = [...result.values()].filter((p) => (p.qa?.attempts ?? 1) > 1).length;
      const open = [...result.values()].filter((p) => p.qa && !p.qa.passed).length;
      const extra = `${regenerated ? ` ${regenerated} unit(s) were regenerated automatically after the quality check.` : ''}${open ? ` ${open} unit(s) still have quality notes (see warnings).` : ''}`;
      setMessage(`${failed ? `${failed} unit(s) kept offline plans (see warnings).` : 'All units planned by AI and checked.'}${extra}`);
    } catch (e) {
      setMessage(`AI planning stopped: ${(e as Error).message}`);
    } finally {
      setPlanning(null);
    }
  }

  /* ---------------- export (MP4 is kept) ---------------- */

  async function exportSection() {
    const tl = timeline;
    if (!section || !tl) return;
    playerRef.current?.pause();
    setExporting(0);
    try {
      const res = await exportMotionReelMp4(tl.reel, {
        format: 'landscape',
        voices: tl.clips,
        teacher: classFace ? { avatar: classFace, track: null } : null,
        onProgress: (p) => {
          setExporting(p);
          playerRef.current?.setExportProgress(p);
        },
      });
      const name = `${section.title.replace(/[^\p{L}\p{N}]+/gu, '-')}-bilingual-class.mp4`;
      download(res.blob, name);
      download(new Blob([toSrt(reelSubtitleCues(tl.reel))], { type: 'application/x-subrip' }), name.replace(/\.mp4$/, '.srt'));
      setMessage(`Saved ${name} (${(res.durationMs / 60000).toFixed(1)} min) and its subtitles. ${checkSummary(res.check)}`.trim());
    } catch (e) {
      setMessage(`Export failed: ${(e as Error).message}`);
    } finally {
      setExporting(null);
      playerRef.current?.setExportProgress(null);
    }
  }

  /* ---------------- V51.9.50: offline class pack (one .html for the phone) ---------------- */

  async function exportOffline() {
    const tl = timeline;
    if (!section || !tl) return;
    playerRef.current?.pause();
    setPacking(0);
    try {
      const res = await exportOfflinePack(tl, placed, { title: section.title, book: book?.name, chapter: chapter?.title, section: section.title }, {
        voices: tl.clips,
        onProgress: (p) => setPacking(p),
      });
      const name = `${section.title.replace(/[^\p{L}\p{N}]+/gu, '-')}-offline-class.html`;
      download(res.blob, name);
      setMessage(`Saved ${name} (${(res.bytes / 1e6).toFixed(1)} MB, ${res.data.questions.length} question(s)). Open it in Chrome on any phone or computer — no internet needed. ${checkSummary(res.check)}`.trim());
    } catch (e) {
      setMessage(`Offline pack failed: ${(e as Error).message}`);
    } finally {
      setPacking(null);
    }
  }

  /* ---------------- render ---------------- */

  const P = playerRef.current;
  const chip = (on: boolean) => `rounded-lg px-3 py-1.5 text-xs font-semibold ${on ? 'bg-violet-600 text-white' : 'bg-white/[0.06] text-white/70 hover:bg-white/10'}`;
  const curSeg = timeline && ps ? timeline.segments[ps.segment] : undefined;
  const otherLang = curSeg && timeline ? timeline.segments.find((s) => s.blockId === curSeg.blockId && s.phase === curSeg.phase && s.lang !== curSeg.lang) : undefined;

  return (
    <div className="min-h-screen bg-[#04101c] text-white">
      {!embedded && <AiGuruTopNav activeLabel="Motion Class" />}
      {!embedded && <TeacherQuizDock />}
      {/* V51.9.181: inside the classroom this is part of the classroom's <main>, so it is a plain block there */}
      <Main className="grid gap-4 p-4 xl:grid-cols-[340px_1fr]">
        {/* ---------- left: book, sections, units ---------- */}
        <aside className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <h1 className="text-lg font-bold">{embedded ? 'Whole textbook' : 'Motion Class'}</h1>
            <p className="mt-1 text-xs text-white/55">
              Load the textbook PDF. Each paragraph or problem is read in English, taught on the whiteboard, read in Malayalam,
              then taught again in Malayalam with the same graphics. Pause, go back a step, or slow the teacher down at any time.
            </p>
            <label className="mt-3 block cursor-pointer rounded-lg bg-white/[0.08] px-3 py-2 text-center text-sm font-semibold hover:bg-white/[0.12]">
              {book ? `📘 ${book.name}` : '📘 Choose textbook PDF'}
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
            {loading && <p className="mt-2 text-xs text-cyan-200">{loading}</p>}
          </div>

          {structure && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <select
                value={chapterIdx}
                onChange={(e) => {
                  setChapterIdx(Number(e.target.value));
                  setSectionIdx(0);
                }}
                className="w-full rounded-lg bg-[#0b1d2e] px-2 py-1.5 text-sm"
              >
                {structure.chapters.map((c, i) => (
                  <option key={c.id} value={i}>
                    {c.number ?? i + 1}. {c.title} (p{c.startPage})
                  </option>
                ))}
              </select>
              <div className="mt-2 flex flex-wrap gap-1">
                {chapter?.sections.map((s, i) => (
                  <button key={s.id} className={chip(i === sectionIdx)} onClick={() => setSectionIdx(i)}>
                    {s.title.slice(0, 32)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {section && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Teaching units</h2>
                <button onClick={planWithAi} disabled={!!planning} className="rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-3 py-1 text-xs font-bold disabled:opacity-50">
                  {planning ? `Planning ${planning}` : '✨ Plan with AI'}
                </button>
              </div>
              <ul className="mt-2 max-h-[40vh] space-y-1 overflow-y-auto pr-1">
                {units.map((u) => {
                  const plan = plans.get(u.id);
                  const sel = selectDna(u, chapter!.title);
                  const active = curSeg?.blockId === u.id;
                  return (
                    <li key={u.id}>
                      <button
                        onClick={() => {
                          setSelectedUnit(selectedUnit === u.id ? null : u.id);
                          const k = timeline?.segments.findIndex((s) => s.blockId === u.id) ?? -1;
                          if (k >= 0) P?.playSegment(k);
                        }}
                        className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${active ? 'bg-violet-600/30 ring-1 ring-violet-400' : 'bg-white/[0.03] hover:bg-white/[0.06]'}`}
                      >
                        <div className="flex flex-wrap items-center gap-1">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] ${KIND_COLOR[u.kind]}`}>{u.kind}</span>
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-200">
                            {plan?.dna.startsWith('learned:') ? `★ ${plan.dna.slice(8)}` : plan?.dna === 'ai-sketch' ? '✎ AI sketch (review)' : DNA_BY_ID.get(plan?.dna ?? '')?.name ?? plan?.dna}
                          </span>
                          {sel.mandatory && <span className="rounded bg-rose-500/15 px-1 text-[10px] text-rose-200">mandatory</span>}
                          <span className="ml-auto text-[10px] text-white/40">{plan?.source}</span>
                        </div>
                        <div className="mt-1 line-clamp-2 text-white/70">{u.text}</div>
                      </button>
                      {selectedUnit === u.id && (
                        <div className="mt-1 space-y-1 rounded-lg bg-black/20 p-2 text-[11px] text-white/60">
                          <div>Selection: {sel.reason}</div>
                          <div>Ranked: {sel.ranked.slice(0, 4).map((r) => `${r.id} ${r.score.toFixed(2)}`).join(' · ') || '—'}</div>
                          {plan?.warnings?.map((w, i) => (
                            <div key={i} className="text-amber-200">⚠ {w}</div>
                          ))}
                          {plan?.qa && <div className={plan.qa.passed ? 'text-emerald-200' : 'text-amber-200'}>Quality check: {plan.qa.passed ? 'passed' : 'notes open'} · {plan.qa.attempts} ask{plan.qa.attempts > 1 ? 's' : ''}</div>}
                          <button
                            type="button"
                            disabled={!!planning}
                            onClick={() => void regenerateUnit(u)}
                            className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-white/80 hover:bg-white/20 disabled:opacity-40"
                          >
                            Regenerate this unit
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* V51.9.180 (UX review): templates and AI sketches are for the teacher — behind "Teacher tools" */}
          <button type="button" onClick={() => toggleTeacherTools()} aria-pressed={teacherTools} className={`rounded-lg border px-3 py-1.5 text-xs ${teacherTools ? 'border-amber-300/50 bg-amber-300/15 text-amber-100' : 'border-white/15 text-white/60 hover:text-white'}`} data-teacher-tools>
            {teacherTools ? 'Hide teacher tools' : 'Teacher tools'}
          </button>
          {teacherTools && <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
            <div className="font-semibold">Learned DNA templates ({learnedDnas().length})</div>
            <p className="mt-1 text-white/50">Templates the AI created for blocks no built-in DNA fitted; reused for similar blocks.</p>
            <ul className="mt-1 space-y-0.5">
              {learnedDnas().map((d) => (
                <li key={d.id} className="text-white/70">
                  ★ {d.name} <span className="text-white/40">({d.segments.join(' → ')})</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <button className={chip(false)} onClick={() => download(new Blob([exportLearned()], { type: 'application/json' }), 'ai-guru-learned-dna.json')}>
                Export
              </button>
              <label className={`${chip(false)} cursor-pointer`}>
                Import
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      importLearned(await f.text());
                      setLearnedVersion((v) => v + 1);
                    }
                  }}
                />
              </label>
            </div>
            {sketchCandidates().length > 0 && (
              <div className="mt-3 border-t border-white/10 pt-2">
                <div className="font-semibold">Free sketches ({sketchCandidates('candidate').length} to review)</div>
                <p className="mt-1 text-white/50">Drawn by the AI where no template fitted. The layout is checked, the maths is not — watch it, then promote it to reuse it for similar blocks.</p>
                <ul className="mt-1 space-y-1">
                  {sketchCandidates().map((c) => (
                    <li key={c.id} className="rounded bg-white/[0.03] p-1.5">
                      <div className="text-white/80">✎ {c.name} <span className="text-white/40">({c.status})</span></div>
                      <div className="line-clamp-2 text-white/45">{c.blockText}</div>
                      <div className="mt-1 flex gap-1">
                        {timeline?.segments.some((s) => s.blockId === c.blockId) && (
                          <button className={chip(false)} onClick={() => P?.playSegment(timeline!.segments.findIndex((s) => s.blockId === c.blockId && s.phase === 'teach'))}>
                            ▶ Watch
                          </button>
                        )}
                        {c.status === 'candidate' && (
                          <>
                            <button
                              className={chip(false)}
                              onClick={() => {
                                const l = promoteSketch(c.id);
                                setLearnedVersion((v) => v + 1);
                                if (l) setMessage(`"${c.name}" is now a template (★ ${l.id}); similar blocks will be planned from it.`);
                              }}
                            >
                              ✓ Promote
                            </button>
                            <button
                              className={chip(false)}
                              onClick={() => {
                                rejectSketch(c.id);
                                setLearnedVersion((v) => v + 1);
                              }}
                            >
                              ✕ Reject
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>}
        </aside>

        {/* ---------- right: interactive class ---------- */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-white/50">Languages</span>
            <button className={chip(langs.en)} onClick={() => setLangs((l) => ({ ...l, en: !l.en || !l.ml }))}>English</button>
            <button className={chip(langs.ml)} onClick={() => setLangs((l) => ({ ...l, ml: !l.ml || !l.en }))}>Malayalam</button>
            <span className="ml-3 text-white/50">Order</span>
            <button className={chip(order === 'per-language')} onClick={() => setOrder('per-language')}>Read EN → Teach EN → Read ML → Teach ML</button>
            <button className={chip(order === 'reads-first')} onClick={() => setOrder('reads-first')}>Both readings first</button>
            <span className="ml-3 text-white/50">Voice</span>
            <button className={chip(voiceOn)} onClick={() => setVoiceOn((v) => !v)}>{voiceOn ? '🔊 On' : '🔇 Off'}</button>
            <button className={chip(includeAsides)} onClick={() => setIncludeAsides((v) => !v)}>Side boxes</button>
            <button className={chip(questionsOn)} onClick={() => setQuestionsOn((v) => !v)} title="The class pauses and asks the student to tap or choose before it shows the answer">
              ❓ Questions in class
            </button>
            {MISTAKES && <button className={chip(mistakesOn)} onClick={() => setMistakesOn((v) => !v)} title="Show the common mistake (in red, struck out) and the right way, where the app can work it out">
              ⚠ Common mistakes
            </button>}
            <button className={chip(intro3dOn)} onClick={() => setIntro3dOn((v) => !v)} title="A 3D title intro before every heading, with the key expression flying in">
              🎬 3D heading intros
            </button>
            {AVATARS && faceAv && (
              <button className={chip(faceOn)} onClick={() => setFaceOn((v) => !v)} title="The teacher's face in the bottom corner, lips moving with the class voice (also in the MP4)">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={faceAv.photo} alt="" className="mr-1 inline h-4 w-4 rounded-full object-cover align-middle" />Teacher’s face
              </button>
            )}
          </div>

          <div className="grid gap-3 2xl:grid-cols-[1fr_300px]">
            <div>
              {/* manim-web's player bar mounts inside this host (bottom overlay). */}
              <div ref={hostRef} className="relative overflow-hidden rounded-2xl bg-white shadow-2xl outline-none" tabIndex={0}>
                <div className="relative">
                  <canvas ref={canvasRef} width={1280} height={720} className="block h-auto w-full" />
                  {question && (
                    <ClassQuestionOverlay
                      key={question.id}
                      question={question}
                      targets={targets}
                      frame={{ width: 1280, height: 720 }}
                      onAnswer={onQuestionAnswer}
                      onContinue={onQuestionContinue}
                    />
                  )}
                </div>
                {(prepProgress || !timeline) && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-[#150b55]">
                    {prepProgress ?? (structure ? 'Choose a section' : 'Load a textbook to begin.')}
                  </div>
                )}
              </div>

              {/* Class controls on top of the player bar. */}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-white/50">Speed</span>
                {[0.5, 0.75, 1, 1.25, 1.5].map((r) => (
                  <button key={r} className={chip(ps?.rate === r)} onClick={() => P?.setRate(r)} disabled={!timeline}>
                    {r === 0.5 ? '0.5× slow' : r === 0.75 ? '0.75×' : `${r}×`}
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-white/15" />
                {/* V51.9.136: the speed controller — time to read and think before the next step */}
                <label className="flex items-center gap-1 text-white/50" title="After each step the board waits this long, then the next step starts by itself">
                  Next step after
                  <select value={(ps?.stepGapMs ?? readStepGap() * 1000) / 1000} onChange={(e) => { const g = Number(e.target.value); P?.setStepGap(g); saveStepGap(g); }} disabled={!timeline} className="rounded-lg border border-white/15 bg-[#0b1017] px-2 py-1 text-xs text-white" aria-label="Time before the next step">
                    {STEP_GAPS.map((g) => <option key={g} value={g}>{g === 0 ? 'no wait' : `${g} s`}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1 text-white/50" title="Cinematic: night sky, glowing working and glass captions">
                  Board
                  <select defaultValue={typeof window === 'undefined' ? 'cinematic' : readBoardLook()} onChange={(e) => { const l = e.target.value as BoardLook; P?.setBoardLook(l); saveBoardLook(l); }} className="rounded-lg border border-white/15 bg-[#0b1017] px-2 py-1 text-xs text-white" aria-label="Board look">
                    <option value="cinematic">🎬 Cinematic</option>
                    <option value="classic">Whiteboard</option>
                  </select>
                </label>
                {/* V51.9.161: camera moves per step (read by the board on every frame) */}
                <label className="flex items-center gap-1 text-white/50" title="One camera move per step. Calm: push-in, pull-out reveal, pan follow, tilt-down steps, split focus. Lively adds crash zoom, whip pan, dutch tilt and rack focus. Auto: calm in class, lively in the MP4.">
                  Camera
                  <select defaultValue={typeof window === 'undefined' ? 'auto' : readMovesSetting()} onChange={(e) => saveMovesSetting(e.target.value as MovesSetting)} className="rounded-lg border border-white/15 bg-[#0b1017] px-2 py-1 text-xs text-white" aria-label="Camera moves" data-camera-moves>
                    {MOVES_SETTINGS.map((m) => <option key={m} value={m}>{m === 'auto' ? 'Auto' : MOVES_NAME[m]}</option>)}
                  </select>
                </label>
                {!!ps?.waitingMs && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 font-semibold text-amber-200">Next step in {Math.ceil(ps.waitingMs / 1000)} s</span>}
                <span className="mx-1 h-4 w-px bg-white/15" />
                <button className={chip(!!ps?.slidesMode)} onClick={() => P?.setSlidesMode(!ps?.slidesMode)} disabled={!timeline} title="S">
                  ⏸ Pause after each step
                </button>
                <button className={chip(false)} onClick={() => P?.replayStep()} disabled={!timeline} title="R">
                  ↺ Replay step
                </button>
                <button className={chip(false)} onClick={() => curSeg && P?.playSegment(curSeg.index)} disabled={!curSeg}>
                  ⏮ Restart this part
                </button>
                <button className={chip(false)} onClick={() => P?.restart()} disabled={!timeline} title="Home">
                  ⏮⏮ Restart class
                </button>
                {otherLang && (
                  <button className={chip(false)} onClick={() => P?.playSegment(otherLang.index)}>
                    🔁 {otherLang.lang === 'ml' ? 'Hear it in Malayalam' : 'Hear it in English'}
                  </button>
                )}
                <span className="ml-auto text-white/50">{ps ? `${fmt(ps.timeMs)} / ${fmt(ps.durationMs)}` : ''}</span>
                <button
                  className="rounded-lg bg-white/[0.08] px-3 py-1.5 font-semibold disabled:opacity-40"
                  disabled={exporting !== null || !timeline}
                  onClick={() => void exportSection()}
                >
                  {exporting !== null ? `MP4 ${Math.round(exporting * 100)}%` : '⬇ Save MP4 + subtitles'}
                </button>
                <button
                  className="rounded-lg bg-white/[0.08] px-3 py-1.5 font-semibold disabled:opacity-40"
                  disabled={packing !== null || exporting !== null || !timeline}
                  onClick={() => void exportOffline()}
                  title="One .html file with the class video, steps, questions and saved progress — works offline on a phone"
                >
                  {packing !== null ? `Offline pack ${Math.round(packing * 100)}%` : '📦 Offline class (one file)'}
                </button>
              </div>
              {timeline && (
                <StepStrip timeline={timeline} current={ps?.step ?? 0} visited={visited} questionSteps={questionSteps} onJump={(i) => P?.goToStep(i)} />
              )}
              {timeline && (resumeAt || placed.length > 0) && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {resumeAt && (
                    <button
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white"
                      onClick={() => {
                        P?.seek(resumeAt.timeMs);
                        void P?.play();
                        setResumeDismissed(progress);
                      }}
                    >
                      ▶ Resume from step {resumeAt.step + 1}
                    </button>
                  )}
                  {placed.length > 0 && (
                    <span className="text-white/55">
                      Questions: {answeredCount}/{placed.length} answered{answeredCount ? ` · ${rightCount} right first time` : ''}
                    </span>
                  )}
                  {progress && (progress.visited.length > 0 || answeredCount > 0) && (
                    <button
                      className="text-white/40 underline hover:text-white/70"
                      onClick={() => {
                        if (!classKey || (typeof window !== 'undefined' && !window.confirm('Clear the saved progress and answers for this class?'))) return;
                        clearProgress(studentId, classKey);
                        setProgressNonce((n) => n + 1);
                      }}
                    >
                      Reset progress
                    </button>
                  )}
                </div>
              )}
              <p className="mt-1 text-[11px] text-white/40">
                Keys: Space play/pause · ←/→ step · Shift+←/→ 1 s · R replay step · [ ] speed · S pause after each step · Home restart · F fullscreen
              </p>

              {timeline && (
                <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                  {timeline.segments.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => P?.playSegment(s.index)}
                      className={`rounded px-2 py-1 ${ps?.segment === s.index ? 'bg-violet-600 text-white' : curSeg?.blockId === s.blockId ? 'bg-white/15 text-white' : 'bg-white/[0.04] text-white/50'}`}
                      title={s.id}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Transcript: every step, click to jump. */}
            <div ref={transcriptRef} className="max-h-[70vh] overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-2 text-xs">
              <div className="mb-1 font-semibold text-white/70">Class transcript</div>
              {timeline?.steps.map((st) => {
                const seg = timeline.segments[st.segment];
                const first = timeline.steps[st.index - 1]?.segment !== st.segment;
                return (
                  <div key={st.index}>
                    {first && <div className="mt-2 text-[10px] uppercase tracking-wide text-cyan-200/70">{seg.label}</div>}
                    <button
                      data-step={st.index}
                      onClick={() => P?.goToStep(st.index)}
                      className={`block w-full rounded px-2 py-1 text-left ${ps?.step === st.index ? 'bg-violet-600/40 text-white' : 'text-white/65 hover:bg-white/[0.06]'}`}
                    >
                      {questionSteps.has(st.index) && <span className="mr-1" title="Question after this step">❓</span>}
                      {st.text}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          {message && <p className="text-sm text-white/70">{message}</p>}
          {lint && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-xs">
              <button className={`font-semibold ${lint.some((i) => i.level === 'error') ? 'text-rose-200' : lint.length ? 'text-amber-200' : 'text-emerald-200'}`} onClick={() => setLintOpen((v) => !v)}>
                {lint.length ? '⚠' : '✓'} {lintSummary(lint)} {lint.length > 0 && (lintOpen ? '▾' : '▸')}
              </button>
              {lintOpen && (
                <ul className="mt-1 space-y-0.5">
                  {lint.map((i, k) => (
                    <li key={k} className={i.level === 'error' ? 'text-rose-200' : 'text-amber-100/80'}>
                      <span className="text-white/40">[{i.code}]</span> {i.where}: {i.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </Main>
    </div>
  );
}
