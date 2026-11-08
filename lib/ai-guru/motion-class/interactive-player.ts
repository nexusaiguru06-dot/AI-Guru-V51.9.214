'use client';

/**
 * Interactive class player.
 *
 * The whole section is ONE timeline (all Read/Teach segments joined), drawn live
 * by the motion engine on a canvas. Controls come from manim-web's own player
 * (PlayerUI bar + PlayerController keyboard), driven through their callback
 * interfaces, so the class behaves like a manim-web Player:
 *
 *   Space / K  play · pause        ← / →  previous / next step
 *   Shift+← →  −1 s / +1 s         Home / End  restart / end
 *   S          slides mode = pause after every step (student-paced)
 *   F          fullscreen          speed menu 0.25×–2×
 *   R          replay this step    [ / ]  slower / faster
 *
 * V51.9.136 — the speed controller: "Next step after N s" (1–10 s). Each step ends, its picture and caption stay, and
 * the next step starts after the chosen time by itself (play skips the wait, pause stops it). It works on the
 * prepared class at once: nothing is made again.
 *
 * Master clock = an <audio> element playing the mixed voice + music track with
 * preservesPitch, so slow teaching keeps a natural voice (no chipmunk / drone),
 * and picture and voice can never drift: every frame is drawn at audio time.
 */

import type { PreparedAvatar } from '../reels/motion/avatar-draw';
import { reelMouthTrack, type MouthTrack } from '../reels/motion/lipsync';
import { drawReelFrame, encodeWav, mixReelAudio, type MotionReel, type ReelFormat, type VoiceClips } from '../reels/motion';
import { lookById, type ReelLook } from '../reels/motion/look';
import type { PreparedSegment } from './player';
import { joinSegments } from './player';
import type { PlacedQuestion } from './interactive/questions';

export interface StepMark {
  index: number;
  t0: number;
  t1: number;
  text: string;
  segment: number;
}

export interface SegmentMark {
  index: number;
  id: string;
  blockId: string;
  label: string;
  lang: string;
  phase: string;
  t0: number;
  t1: number;
}

export interface ClassTimeline {
  reel: MotionReel;
  clips: VoiceClips;
  audio: Blob;
  steps: StepMark[];
  segments: SegmentMark[];
}

export interface PlayerState {
  timeMs: number;
  durationMs: number;
  playing: boolean;
  finished: boolean;
  rate: number;
  step: number;
  segment: number;
  slidesMode: boolean;
  /** Id of the question the board is paused on (V51.9.50), or null. */
  question: string | null;
  /** V51.9.136: the wait chosen between steps (ms, 0 = none), and how long is left of the wait now (ms, 0 = not waiting). */
  stepGapMs: number;
  waitingMs: number;
}

/** V51.9.136: the speed controller's choices (seconds) and where the choice is kept on this device. */
export const STEP_GAPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const STEP_GAP_KEY = 'aiGuruStepGapSec';
export const STEP_GAP_DEFAULT = 2;

/** V51.9.137: the board's look in the class — 'cinematic' (night sky, glowing working, glass captions) or 'classic' (whiteboard). */
export type BoardLook = 'cinematic' | 'classic';
export const BOARD_LOOK_KEY = 'aiGuruBoardLook';
export function readBoardLook(): BoardLook {
  try { return localStorage.getItem(BOARD_LOOK_KEY) === 'classic' ? 'classic' : 'cinematic'; } catch { return 'cinematic'; }
}
export function saveBoardLook(l: BoardLook): void {
  try { localStorage.setItem(BOARD_LOOK_KEY, l); } catch { /* private window: not remembered */ }
}
export function readStepGap(): number {
  try {
    const v = localStorage.getItem(STEP_GAP_KEY);
    const n = v === null ? STEP_GAP_DEFAULT : Number(v);
    return STEP_GAPS.includes(n) ? n : STEP_GAP_DEFAULT;
  } catch {
    return STEP_GAP_DEFAULT;
  }
}
export function saveStepGap(sec: number): void {
  try { localStorage.setItem(STEP_GAP_KEY, String(sec)); } catch { /* private window: not remembered */ }
}

const PLAY_RATE = 24000;
export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

/** Prepared segments → one interactive timeline with step and segment marks. */
export function buildClassTimeline(title: string, prepared: PreparedSegment[]): ClassTimeline {
  const { reel, clips } = joinSegments(title, prepared);
  const segments: SegmentMark[] = [];
  const steps: StepMark[] = [];
  let start = 0;
  prepared.forEach((p, si) => {
    const seg = p.segment;
    segments.push({ index: si, id: seg.id, blockId: seg.blockId, label: seg.label, lang: seg.lang, phase: seg.phase, t0: start, t1: start + p.reel.durationMs });
    let partStart = start;
    for (const part of p.reel.parts) {
      for (const c of part.captions) steps.push({ index: steps.length, t0: partStart + c.t0, t1: partStart + c.t1, text: c.text, segment: si });
      partStart += part.durationMs;
    }
    start += p.reel.durationMs;
  });
  const samples = mixReelAudio(reel, clips, { rate: PLAY_RATE });
  const audio = new Blob([encodeWav(samples, PLAY_RATE)], { type: 'audio/wav' });
  return { reel, clips, audio, steps, segments };
}

// Minimal shapes of manim-web's PlayerUI / PlayerController we use.
interface UiLike {
  updateTime(currentTime: number, duration: number): void;
  setPlaying(playing: boolean, finished?: boolean): void;
  setSlidesMode(enabled: boolean): void;
  setSegments(timeline: unknown): void;
  setExportProgress(progress: number | null): void;
  dispose(): void;
}
interface ControllerLike {
  dispose(): void;
}

export interface ClassPlayerOptions {
  format?: ReelFormat;
  stepLabel?: string;
  onUpdate?: (s: PlayerState) => void;
  onExport?: (format: string) => void;
  /** A question inside the animation is due (the board has paused), or null when it closed. V51.9.50. */
  onQuestion?: (q: PlacedQuestion | null) => void;
  /** V51.9.110: write each step's caption small, beside the line it wrote (the problem board). */
  stepNotes?: boolean;
}

export class ClassPlayer {
  private tl: ClassTimeline | null = null;
  /** V51.9.100: the teacher's face in the corner of the regular class (never on the doubt-clearing boards). */
  private face: PreparedAvatar | null = null;
  private mouth: MouthTrack | null = null;
  private audio: HTMLAudioElement;
  private url: string | null = null;
  private ui: UiLike | null = null;
  private controller: ControllerLike | null = null;
  private raf = 0;
  private rate = 1;
  private slides = false;
  /** Step that slides mode stops at the end of (-1 = none). */
  private armed = -1;
  private lastToggle = 0;
  /* V51.9.136: the wait between steps */
  private gapMs = 0;
  /** Step whose end starts a wait (-1 = none). */
  private gapStep = -1;
  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  private waitUntil = 0;
  /** V51.9.137: the board look (null = classic whiteboard). */
  private look: ReelLook | null = null;
  /* V51.9.50: questions inside the animation (none = the player behaves exactly as before). */
  private questions: PlacedQuestion[] = [];
  private answered = new Set<string>();
  private pending: PlacedQuestion | null = null;
  private lastT = 0;
  private ctx: CanvasRenderingContext2D;
  private onKey: (e: KeyboardEvent) => void;

  constructor(
    private host: HTMLElement,
    private canvas: HTMLCanvasElement,
    private opts: ClassPlayerOptions = {},
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.audio = new Audio();
    this.audio.preload = 'auto';
    // Keep the teacher's voice natural when slowed down or sped up.
    const a = this.audio as HTMLAudioElement & { mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean };
    a.preservesPitch = true;
    a.mozPreservesPitch = true;
    a.webkitPreservesPitch = true;
    this.audio.addEventListener('ended', () => this.finish());
    this.onKey = (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'r' || e.key === 'R') this.replayStep();
      else if (e.key === '[') this.setRate(SPEEDS[Math.max(0, SPEEDS.indexOf(this.rate) - 1)] ?? 0.75);
      else if (e.key === ']') this.setRate(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(this.rate) + 1)] ?? 1.25);
      else return;
      e.preventDefault();
    };
    host.addEventListener('keydown', this.onKey);
  }

  /** Mounts manim-web's player bar and keyboard controller on the host element. */
  async attachControls(): Promise<void> {
    const mw = await import('manim-web');
    const cb = {
      onPlayPause: () => this.toggle(),
      onSeek: (sec: number) => this.seek(sec * 1000),
      onPrev: () => this.prevStep(),
      onNext: () => this.nextStep(),
      onSpeedChange: (r: number) => this.setRate(r),
      onFullscreen: () => this.fullscreen(),
      onExport: (format: string) => this.opts.onExport?.(format),
      onSlidesToggle: (enabled?: boolean) => this.setSlidesMode(typeof enabled === 'boolean' ? enabled : !this.slides),
    };
    const before = new Set(Array.from(this.host.children));
    this.ui = new mw.PlayerUI(this.host, cb, { autoHideMs: 0 }) as unknown as UiLike;
    // The bar is an overlay; keep it below the board so it never covers the captions.
    const bar = Array.from(this.host.children).find((c) => !before.has(c)) as HTMLElement | undefined;
    if (bar) {
      // V51.9.181 (UX review): manim-web labels its controls only with tooltips; screen readers need real names
      for (const el of Array.from(bar.querySelectorAll<HTMLElement>('select[title],button[title],input[title]'))) if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', el.title);
      const h = Math.max(48, bar.getBoundingClientRect().height || 0);
      this.host.style.paddingBottom = `${h}px`;
      this.host.style.background = '#111';
    }
    this.controller = new mw.PlayerController(this.host, {
      ...cb,
      onSlidesToggle: () => cb.onSlidesToggle(),
      getCurrentTime: () => this.time / 1000,
      getDuration: () => this.duration / 1000,
    }) as unknown as ControllerLike;
    this.ui.setSlidesMode(this.slides);
    if (this.tl) this.refreshUi();
  }

  /** V51.9.100: show (or with null, hide) the teacher's face; the lips follow this class's own voice track. */
  setTeacherFace(face: PreparedAvatar | null): void {
    this.face = face;
    this.mouth = face && this.tl ? reelMouthTrack(this.tl.reel, this.tl.clips, 30) : null;
    this.draw(this.time);
  }

  load(tl: ClassTimeline): void {
    this.pause();
    this.mouth = this.face ? reelMouthTrack(tl.reel, tl.clips, 30) : null;
    if (this.url) URL.revokeObjectURL(this.url);
    this.tl = tl;
    this.url = URL.createObjectURL(tl.audio);
    this.audio.src = this.url;
    this.audio.playbackRate = this.rate;
    this.audio.currentTime = 0;
    this.armed = -1;
    this.pending = null;
    this.lastT = 0;
    this.refreshUi();
    this.draw(0);
  }

  /* ---------------- questions inside the animation (V51.9.50) ---------------- */

  /** Questions to pause for; ids in `done` were already answered (e.g. restored progress). */
  setQuestions(list: PlacedQuestion[], done: Iterable<string> = []): void {
    this.questions = [...list].sort((a, b) => a.atMs - b.atMs);
    this.answered = new Set(done);
    if (this.pending && !this.questions.some((q) => q.id === this.pending!.id)) this.closeQuestion();
  }

  get pendingQuestion(): PlacedQuestion | null {
    return this.pending;
  }

  /** The student answered (or skipped) the open question: mark it and carry on teaching. */
  answerQuestion(id: string, resume = true): void {
    this.answered.add(id);
    if (this.pending?.id !== id) return;
    const at = this.pending.atMs;
    this.closeQuestion();
    if (this.slides && this.tl) {
      // Slides mode: the answer ends this step; continuing plays the next one.
      const s = this.tl.steps[this.stepAt(at)];
      if (s) this.seek(Math.max(at, s.t1 - 15));
    }
    if (resume) void this.play();
  }

  private closeQuestion() {
    if (!this.pending) return;
    this.pending = null;
    this.opts.onQuestion?.(null);
    this.emit();
  }

  /** The first unanswered question crossed while playing from `from` to `to`. */
  private dueQuestion(from: number, to: number): PlacedQuestion | null {
    if (!this.questions.length || to <= from || to - from > 1500) return null;
    for (const q of this.questions) if (q.atMs > from && q.atMs <= to && !this.answered.has(q.id)) return q;
    return null;
  }

  /** Jump to a step of the class and play it (step strip, transcript). */
  goToStep(index: number): void {
    const s = this.tl?.steps[index];
    if (!s) return;
    this.seek(s.t0);
    void this.play();
  }

  /* ---------------- state ---------------- */

  get time(): number {
    return Math.min(this.duration, this.audio.currentTime * 1000);
  }
  get duration(): number {
    return this.tl?.reel.durationMs ?? 0;
  }
  get playing(): boolean {
    // waiting between steps counts as playing: the class goes on by itself
    return !this.audio.paused || this.gapTimer !== null;
  }
  get waiting(): boolean {
    return this.gapTimer !== null;
  }

  stepAt(t: number): number {
    const steps = this.tl?.steps ?? [];
    for (let i = steps.length - 1; i >= 0; i--) if (t >= steps[i].t0 - 1) return i;
    return 0;
  }

  segmentAt(t: number): number {
    const segs = this.tl?.segments ?? [];
    for (let i = segs.length - 1; i >= 0; i--) if (t >= segs[i].t0) return i;
    return 0;
  }

  state(): PlayerState {
    const t = this.time;
    return {
      timeMs: t,
      durationMs: this.duration,
      playing: this.playing,
      finished: t >= this.duration - 30 && this.duration > 0,
      rate: this.rate,
      step: this.stepAt(t),
      segment: this.segmentAt(t),
      slidesMode: this.slides,
      question: this.pending?.id ?? null,
      stepGapMs: this.gapMs,
      waitingMs: this.gapTimer ? Math.max(0, this.waitUntil - performance.now()) : 0,
    };
  }

  /* ---------------- controls ---------------- */

  async play(): Promise<void> {
    if (!this.tl) return;
    // A question is open: the class waits for the answer (keys and clicks on the board do not skip it).
    if (this.pending) return;
    this.stopWait(); // play during a wait: go on at once
    if (this.time >= this.duration - 30) this.audio.currentTime = 0;
    if (this.gapMs > 0) {
      // the wait comes at the end of this step (or of the next, when this one has just ended)
      const i = this.stepAt(this.time);
      const s = this.tl.steps[i];
      this.gapStep = s && this.time >= s.t1 - 40 ? i + 1 : i;
    }
    if (this.slides) {
      // Paused at the end of a step: continuing plays the next one.
      const i = this.stepAt(this.time);
      const s = this.tl.steps[i];
      this.armed = s && this.time >= s.t1 - 40 ? Math.min(this.tl.steps.length - 1, i + 1) : i;
    }
    this.lastT = this.time;
    try {
      await this.audio.play();
    } catch {
      /* the browser needs a user gesture first: the next click will start it */
    }
    this.loop();
    this.emit();
  }

  pause(): void {
    this.stopWait();
    this.audio.pause();
    cancelAnimationFrame(this.raf);
    this.draw(this.time); // V51.9.111: the step's # shows "paused"
    this.emit();
  }

  toggle(): void {
    // manim-web's bar and keyboard controller both listen for clicks on the
    // player; one click must toggle once, not twice.
    const now = performance.now();
    if (now - this.lastToggle < 120) return;
    this.lastToggle = now;
    if (this.playing) this.pause();
    else void this.play();
  }

  seek(ms: number): void {
    this.stopWait();
    const t = Math.max(0, Math.min(this.duration, ms));
    this.gapStep = this.gapMs > 0 ? this.stepAt(t) : -1;
    this.audio.currentTime = t / 1000;
    if (this.slides) this.armed = this.stepAt(t);
    this.lastT = t;
    // Moving away from an open question closes it (it is asked again when the class reaches it).
    if (this.pending && Math.abs(t - this.pending.atMs) > 1) this.closeQuestion();
    this.draw(t);
    this.emit();
  }

  setRate(r: number): void {
    this.rate = Math.max(0.25, Math.min(2, r));
    this.audio.playbackRate = this.rate;
    // Keep manim-web's speed menu in step with keyboard / button changes.
    const sel = this.host.querySelector<HTMLSelectElement>('select[title="Playback speed"]');
    if (sel && Number(sel.value) !== this.rate && [...sel.options].some((o) => Number(o.value) === this.rate)) sel.value = String(this.rate);
    this.emit();
  }

  /** V51.9.137 — the board's look: cinematic or the classic whiteboard. */
  setBoardLook(l: BoardLook): void {
    this.look = l === 'cinematic' ? lookById('cinematic') : null;
    this.draw(this.time);
  }

  /** V51.9.136 — wait this long (seconds, 0–10; 0 = no wait) after every step before the next one starts. */
  setStepGap(sec: number): void {
    this.gapMs = Math.max(0, Math.min(10, Number(sec) || 0)) * 1000;
    if (!this.gapMs) {
      this.gapStep = -1;
      if (this.gapTimer) { this.stopWait(); void this.play(); }
    } else if (this.gapStep < 0) {
      this.gapStep = this.stepAt(this.time);
    }
    this.emit();
  }

  private stopWait(): void {
    if (this.gapTimer) clearTimeout(this.gapTimer);
    this.gapTimer = null;
    this.waitUntil = 0;
  }

  setSlidesMode(on: boolean): void {
    this.slides = on;
    this.armed = on ? this.stepAt(this.time) : -1;
    this.ui?.setSlidesMode(on);
    this.emit();
  }

  /** Next step; in slides mode it also plays that step. */
  nextStep(): void {
    const steps = this.tl?.steps ?? [];
    const i = this.stepAt(this.time);
    const next = steps[Math.min(steps.length - 1, i + 1)];
    if (!next) return;
    this.seek(next.t0);
    if (this.slides) void this.play();
  }

  /** Back to the start of this step, or to the previous step when already at its start. */
  prevStep(): void {
    const steps = this.tl?.steps ?? [];
    const i = this.stepAt(this.time);
    const cur = steps[i];
    const target = cur && this.time - cur.t0 > 1200 ? cur : steps[Math.max(0, i - 1)];
    if (target) this.seek(target.t0);
    if (this.slides) void this.play();
  }

  replayStep(): void {
    const s = this.tl?.steps[this.stepAt(this.time)];
    if (!s) return;
    this.seek(s.t0);
    void this.play();
  }

  restart(): void {
    this.seek(0);
    void this.play();
  }

  /** Jump to a segment (e.g. the same unit taught in the other language). */
  playSegment(index: number): void {
    const s = this.tl?.segments[index];
    if (!s) return;
    this.seek(s.t0);
    void this.play();
  }

  fullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void this.host.requestFullscreen?.();
  }

  setExportProgress(p: number | null): void {
    this.ui?.setExportProgress(p);
  }

  dispose(): void {
    this.stopWait();
    this.pause();
    this.host.removeEventListener('keydown', this.onKey);
    this.ui?.dispose();
    this.controller?.dispose();
    if (this.url) URL.revokeObjectURL(this.url);
  }

  /* ---------------- internals ---------------- */

  private loop() {
    cancelAnimationFrame(this.raf);
    const tick = () => {
      if (!this.tl) return;
      let t = this.time;
      // A question inside the animation: stop where it is asked and wait for the student.
      const q = this.dueQuestion(this.lastT, t);
      this.lastT = t;
      if (q) {
        this.audio.pause();
        this.audio.currentTime = q.atMs / 1000;
        this.lastT = q.atMs;
        this.pending = q;
        this.draw(q.atMs);
        this.emit();
        this.opts.onQuestion?.(q);
        return;
      }
      // Slides mode: stop at the end of the armed step and wait for the student.
      if (this.slides && this.armed >= 0) {
        const s = this.tl.steps[this.armed];
        if (s && t >= s.t1 - 15) {
          this.audio.pause();
          this.audio.currentTime = Math.max(s.t0, s.t1 - 15) / 1000;
          t = this.time;
          this.armed = Math.min(this.tl.steps.length - 1, this.armed + 1);
          this.draw(t);
          this.emit();
          return;
        }
      }
      // V51.9.136: the speed controller: the step has ended; keep it on the board for the chosen time, then go on
      if (!this.slides && this.gapMs > 0 && this.gapStep >= 0 && this.gapStep < this.tl.steps.length - 1) {
        const s = this.tl.steps[this.gapStep];
        if (s && t >= s.t1 - 15) {
          this.audio.pause();
          this.audio.currentTime = Math.max(s.t0, s.t1 - 15) / 1000;
          this.gapStep += 1;
          this.waitUntil = performance.now() + this.gapMs;
          this.gapTimer = setTimeout(() => {
            this.gapTimer = null;
            this.waitUntil = 0;
            const keep = this.gapStep;
            void this.audio.play().catch(() => undefined);
            this.gapStep = keep;
            this.lastT = this.time;
            this.loop();
            this.emit();
          }, this.gapMs);
          this.draw(this.time);
          this.emit();
          // a small countdown on the bar while waiting
          const count = () => { if (!this.gapTimer) return; this.emit(); setTimeout(count, 250); };
          setTimeout(count, 250);
          return;
        }
      }
      this.draw(t);
      this.emit();
      if (!this.audio.paused) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private finish() {
    cancelAnimationFrame(this.raf);
    this.draw(this.duration);
    this.emit();
  }

  private draw(t: number) {
    if (!this.tl) return;
    drawReelFrame(this.ctx, this.tl.reel, t, { format: this.opts.format ?? 'landscape', stepLabel: this.opts.stepLabel, teacher: this.face ? { avatar: this.face, track: this.mouth } : null, stepNotes: this.opts.stepNotes, stepButtons: this.opts.stepNotes, stepPaused: this.audio.paused && !this.gapTimer, look: this.look });
  }

  private refreshUi() {
    if (!this.ui || !this.tl) return;
    const tl = this.tl;
    // Markers on the bar at every segment boundary (Read EN / Teach EN / …).
    this.ui.setSegments({
      getSlides: () => tl.segments.map((s) => ({ index: s.index, startTime: s.t0 / 1000, endTime: s.t1 / 1000 })),
      getDuration: () => tl.reel.durationMs / 1000,
    });
    this.ui.updateTime(0, tl.reel.durationMs / 1000);
    this.ui.setPlaying(false);
  }

  private emit() {
    const s = this.state();
    this.ui?.updateTime(s.timeMs / 1000, s.durationMs / 1000);
    this.ui?.setPlaying(s.playing, s.finished && !s.playing);
    this.opts.onUpdate?.(s);
  }
}
