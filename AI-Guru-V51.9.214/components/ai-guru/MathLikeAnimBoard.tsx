'use client';

import { renderTemplateRow } from './template-row-dom';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { VisualAction } from '@/lib/ai-guru/lesson/types';
import { actionSvg } from '@/lib/ai-guru/visual/action-svg';

export type StepControlAction = 'pause' | 'continue' | 'repeat' | 'up' | 'down';
export interface StepControlEvent { action: StepControlAction; sectionKey: string; rowId: string }
export interface SectionOptions {
  /** e.g. "Answer 2" */
  label?: string;
  /** Short heading of the answer. */
  heading?: string;
  /** The question / problem extracted from the PDF, shown in full at the very start of the answer. */
  problem?: string;
  /** Repeat: wipe only this answer's block and draw it again in place. */
  replace?: boolean;
}

export interface MathLikeAnimBoardHandle {
  /** Clears the WHOLE board. Only for an explicit "clear board" or when a new book is loaded - never between answers. */
  reset(): void;
  reveal(action: VisualAction): Promise<void>;
  /** Starts (or re-enters) one answer's block. Earlier answers stay above it and remain scrollable. */
  beginSection(key: string, opts?: SectionOptions): void;
  /** Move one step up/down from the given step and scroll to it. */
  moveStep(sectionKey: string, rowId: string, dir: 'up' | 'down'): void;
  scrollToLatest(): void;
}

type CoreModule = {
  default: () => Promise<unknown>;
  VectorObjectBuilder: any;
};
type RendererModule = {
  SVGScene: new (width: number, height: number) => {
    svg: SVGSVGElement;
    objects: Array<{ free?: () => void }>;
    play(
      animations: Map<string, (old: unknown, t: number) => unknown>,
      duration: number,
      easing: (t: number) => number,
    ): Promise<void>;
    render(): Promise<void>;
  };
};

function cssEscape(value: unknown): string {
  const str = String(value ?? '');
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(str) : str.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function esc(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const MathLikeAnimBoard = forwardRef<MathLikeAnimBoardHandle, { items: VisualAction[]; active?: string; onControl?: (e: StepControlEvent) => void }>(function MathLikeAnimBoard({ items, onControl }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<InstanceType<RendererModule['SVGScene']> | null>(null);
  const coreRef = useRef<CoreModule | null>(null);
  const [status, setStatus] = useState('Getting the whiteboard ready…');
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const readyWaitersRef = useRef<Array<() => void>>([]);
  const itemsRef = useRef<VisualAction[]>(items);
  itemsRef.current = items;
  // Set once the WASM attempt has truly finished (success, real failure, or
  // timeout) so a late-resolving import() from an already-abandoned attempt
  // can never silently overwrite the fallback state chosen below.
  const settledRef = useRef(false);
  const statusElRef = useRef<HTMLDivElement | null>(null);
  const fallbackHostRef = useRef<HTMLDivElement | null>(null);
  const fallbackActiveRef = useRef(false);
  /** Sequential Y cursor so write actions stack top→bottom instead of overlapping. */
  const textCursorYRef = useRef(48);
  const onControlRef = useRef(onControl);
  onControlRef.current = onControl;
  /** Every answer lives in its own block; nothing is deleted to make room for the next one. */
  const blocksRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const currentKeyRef = useRef('');
  const awayFromBottomRef = useRef(false);
  const lastAutoScrollRef = useRef(0);
  const scrollHostRef = useRef<HTMLElement | null>(null);
  const [showJump, setShowJump] = useState(false);

  /** The scrollable column: every answer is a block inside it. */
  const prepareHost = (host: HTMLElement) => {
    if (host.style.display !== 'flex') {
      host.style.display = 'flex';
      host.style.flexDirection = 'column';
      host.style.alignItems = 'stretch';
      host.style.justifyContent = 'flex-start';
      host.style.overflowY = 'scroll';
      host.style.paddingTop = '36px'; // clear status pill
      host.style.paddingBottom = '16px';
      host.style.paddingLeft = '8px';
      host.style.paddingRight = '8px';
      host.style.scrollbarWidth = 'thin';
      host.style.scrollbarColor = 'rgba(34,211,238,0.55) rgba(0,0,0,0.25)';
    }
    if (scrollHostRef.current !== host) {
      scrollHostRef.current = host;
      host.addEventListener('scroll', () => {
        // Ignore the scroll events produced by our own smooth auto-scroll.
        if (Date.now() - lastAutoScrollRef.current < 900) return;
        const away = host.scrollHeight - host.scrollTop - host.clientHeight > 120;
        awayFromBottomRef.current = away;
        setShowJump(away);
      }, { passive: true });
    }
  };

  /** Where new rows go: the current answer's block, else the host itself. */
  const containerFor = (host: HTMLElement): HTMLElement => {
    const block = blocksRef.current.get(currentKeyRef.current);
    return block && host.contains(block) ? block : host;
  };

  /** Convert the current answer block into a true full-board cinematic canvas.
   * Worked-solution template rows must occupy the whole 1000x700 whiteboard; the
   * old implementation used a scrollable text column, which made the lesson look
   * like prose in a corner instead of a visual mathematics class.
   */
  const activateCinematicTemplateBoard = (block: HTMLElement) => {
    if (block.dataset.cinematicTemplate === '1') return;
    block.dataset.cinematicTemplate = '1';
    block.style.position = 'relative';
    block.style.display = 'block';
    block.style.width = '100%';
    block.style.maxWidth = 'none';
    block.style.aspectRatio = '1000 / 700';
    block.style.minHeight = '0';
    block.style.marginBottom = '22px';
    block.style.overflow = 'hidden';
    block.style.border = '1px solid rgba(103,232,249,.10)';
    block.style.borderRadius = '18px';
    block.style.background = 'radial-gradient(circle at 50% 42%, rgba(20,45,65,.28), rgba(4,10,17,.96) 72%)';
    block.style.boxSizing = 'border-box';
    const header = block.querySelector('[data-section-header]') as HTMLElement | null;
    if (header) {
      header.style.position = 'absolute';
      header.style.left = '28px';
      header.style.right = '28px';
      header.style.top = '18px';
      header.style.zIndex = '8';
      header.style.padding = '0';
      header.style.pointerEvents = 'none';
      const problem = header.querySelector('[data-problem]') as HTMLElement | null;
      if (problem) {
        problem.style.display = 'none';
      }
    }
  };

  const cinematicRowPosition = (block: HTMLElement) => {
    // Reflow ALL rows after every new step so the complete derivation remains
    // balanced across the board instead of leaving the first row at the top and
    // later rows clustered at the bottom.
    const rows = Array.from(block.querySelectorAll('[data-tpl-row]')) as HTMLElement[];
    const total = Math.max(rows.length, 1);
    const usableTop = 105;
    const usableBottom = 625;
    rows.forEach((row, index) => {
      const lane = total <= 1 ? 0.5 : index / Math.max(1, total - 1);
      const y = total <= 1 ? 360 : usableTop + (usableBottom - usableTop) * lane;
      row.style.position = 'absolute';
      row.style.left = '5%';
      row.style.right = '5%';
      row.style.top = `${(y / 700) * 100}%`;
      row.style.width = '90%';
      row.style.padding = '0 1.5%';
      row.style.boxSizing = 'border-box';
      row.style.zIndex = String(20 + index);
    });
  };

  /**
   * The picture of this answer: one board-shaped (1000x700) figure inside the answer's block. Shapes, lines and
   * diagram labels are layered in it, so the step rows (captions + icons) flow around it instead of under it.
   */
  const figureFor = (host: HTMLElement): HTMLElement => {
    const block = containerFor(host);
    let fig = Array.from(block.children).find((c) => (c as HTMLElement).dataset?.figure === '1') as HTMLElement | undefined;
    if (!fig) {
      fig = document.createElement('div');
      fig.dataset.figure = '1';
      fig.style.cssText = 'position:relative;width:100%;max-width:640px;aspect-ratio:1000/700;margin:6px auto 14px;flex:none;border:0;border-radius:14px;background:transparent';
      block.appendChild(fig);
    }
    return fig;
  };

  /** Follow the teaching as it grows - unless the student scrolled up to review earlier steps. */
  const followLatest = (el: HTMLElement) => {
    if (awayFromBottomRef.current) { setShowJump(true); return; }
    lastAutoScrollRef.current = Date.now();
    try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch { /* ignore */ }
  };

  const flashRow = (el: HTMLElement) => {
    const prev = el.style.outline;
    el.style.outline = '2px dashed #fbbf24';
    el.style.outlineOffset = '3px';
    window.setTimeout(() => { el.style.outline = prev; }, 900);
  };

  const setStatusText = (text: string) => {
    setStatus(text);
    // The status pill is created imperatively (see below) precisely so it
    // survives hostRef.current.replaceChildren(scene.svg) — but nothing was
    // ever writing new text into that DOM node after creation. setStatus()
    // alone updates unused React state; the pill itself was permanently
    // stuck on its first "…loading" text regardless of what actually
    // happened afterwards (success, failure, or hang), which is exactly why
    // "MathLikeAnim-rs loading…" never changed on screen.
    if (statusElRef.current) statusElRef.current.textContent = text;
  };
  /** V51.9.180 (UX review): the pill says what the student needs to know; the engine detail goes to the console. */
  const friendlyStatus = (detail: string, simple = false) => {
    console.info(`[whiteboard] ${detail}`);
    setStatusText(simple ? 'Whiteboard ready (simple drawing)' : 'Whiteboard ready');
  };

  /** Activates the no-WASM rendering path: a plain stacked-SVG DOM host.
   *  Used whenever the WASM engine fails, times out, or was never reached
   *  (host unmounted mid-load). Teaching must never be blocked entirely by
   *  a third-party WASM renderer failing to load in a given environment. */
  const activateFallback = (reason: string) => {
    if (fallbackActiveRef.current || !hostRef.current) return;
    fallbackActiveRef.current = true;
    // The scrollable answer column already exists: never replace it (that would delete the teaching history).
    if (fallbackHostRef.current) { settledRef.current = true; return; }
    const host = document.createElement('div');
    host.className = 'relative h-full w-full';
    hostRef.current.replaceChildren(host);
    fallbackHostRef.current = host;
    const statusEl = document.createElement('div');
    statusEl.className = 'absolute left-3 top-3 z-20 rounded-full border border-amber-300/25 bg-black/70 px-3 py-1 text-[11px] text-amber-200';
    hostRef.current.appendChild(statusEl);
    statusElRef.current = statusEl;
    friendlyStatus(reason, true);
  };

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      // A stuck import()/wasm-instantiate never rejects on its own — without
      // this, a bad build or a blocked asset request leaves the board (and
      // therefore ALL narration, since speakText() for a section only runs
      // AFTER that section's board reveal() resolves) hanging forever with
      // no error and no visible reason, exactly as reported.
      if (settledRef.current) return;
      settledRef.current = true;
      console.error('MathLikeAnim-rs did not finish loading within 8s — falling back to inline rendering.');
      activateFallback('MathLikeAnim-rs timed out · using fallback renderer');
      readyRef.current = true; // "ready" now means "reveal() may proceed", not "WASM is ready"
      setReady(true);
      readyWaitersRef.current.splice(0).forEach(resolve => resolve());
    }, 8000);
    (async () => {
      try {
        try {
          // Prefer self-hosted / Google Chilanka for Malayalam glyphs on the board
          await Promise.race([
            document.fonts.load('400 40px Chilanka', '\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02'),
            new Promise<void>((r) => setTimeout(r, 2500)),
          ]);
        } catch { /* system fallback remains available */ }

        const [core, renderer] = await Promise.all([
          import('@mathlikeanim-rs/mathlikeanim-rs') as unknown as Promise<CoreModule>,
          import('@mathlikeanim-rs/renderer') as unknown as Promise<RendererModule>,
        ]);
        await core.default();
        if (cancelled || settledRef.current || !hostRef.current) return;
        // The scrollable teaching column was already created: do not replace it with the empty WASM scene.
        if (fallbackHostRef.current) { settledRef.current = true; window.clearTimeout(timeout); readyRef.current = true; setReady(true); readyWaitersRef.current.splice(0).forEach(resolve => resolve()); return; }
        const scene = new renderer.SVGScene(1000, 700);
        scene.svg.classList.add('h-full', 'w-full');
        scene.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        // The classroom currently uses the DOM renderer for every teaching action
        // because it supports persistent scrolling and reliable Malayalam text.
        // Keep the WASM scene available for diagnostics, but never let its fixed
        // 1000x700 layer sit underneath the scrollable DOM layer and create a
        // second, visually overlapping board.
        scene.svg.style.display = 'none';
        hostRef.current.replaceChildren(scene.svg);
        // Keep the status overlay outside the SVG so it is not removed by replaceChildren.
        const statusEl = document.createElement('div');
        statusEl.className = 'absolute left-3 top-3 z-20 rounded-full border border-cyan-300/20 bg-black/70 px-3 py-1 text-[11px] text-cyan-100';
        hostRef.current.appendChild(statusEl);
        statusElRef.current = statusEl;
        coreRef.current = core;
        sceneRef.current = scene;
        await scene.render();
        if (cancelled || settledRef.current) return;
        settledRef.current = true;
        window.clearTimeout(timeout);
        friendlyStatus('MathLikeAnim-rs WASM ready');
        readyRef.current = true;
        setReady(true);
        readyWaitersRef.current.splice(0).forEach(resolve => resolve());
      } catch (error) {
        console.error(error);
        if (cancelled || settledRef.current) return;
        settledRef.current = true;
        window.clearTimeout(timeout);
        activateFallback('MathLikeAnim-rs unavailable · using fallback renderer');
        readyRef.current = true;
        setReady(true);
        readyWaitersRef.current.splice(0).forEach(resolve => resolve());
      }
    })();
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, []);

  /** Fallback reveal: stacks plain absolutely-positioned SVGs (each one is
   *  already a full 1000x700 board-sized document from actionSvg(), same as
   *  what would be fed to the WASM VectorObjectBuilder) with a CSS fade/scale
   *  transition standing in for the WASM engine's become_partial() morph.
   *  Less visually elaborate, but it actually draws something and — this is
   *  the part that matters — actually resolves, so the narration that
   *  follows each reveal() in the teaching loop is never blocked. */
  const fallbackReveal = async (action: VisualAction) => {
    // Never silently no-op: ensure a drawable host exists first.
    if (!fallbackHostRef.current) {
      ensureTextOverlayHost();
    }
    const host = fallbackHostRef.current;
    if (!host) {
      console.warn('[MathLikeAnimBoard] no host for reveal', action?.type);
      return;
    }
    const duration = action.type === 'pause' ? (action as any).durationMs : ((action as any).durationMs ?? 900);
    if (action.type === 'pause') { await new Promise<void>(resolve => window.setTimeout(resolve, duration)); return; }
    if (action.type === 'erase') {
      const node = host.querySelector(`[data-action-id="${cssEscape((action as any).targetId)}"]`);
      node?.remove();
      return;
    }

    // Highlight the line being worked on: a dashed amber outline around the TARGET
    // block (the board is a flowing derivation column, so a ring at fixed x/y would
    // float over the wrong place). Falls back to a positioned ring only when there
    // is no target block (pre-authored coordinate-based highlights).
    if ((action as any).type === 'token-move') {
      const a = action as Extract<VisualAction, { type: 'token-move' }>;
      const token = document.createElement('span');
      token.dataset.actionId = a.id;
      token.dataset.tokenMotion = '1';
      token.textContent = a.token;
      token.style.position = 'absolute';
      token.style.left = `${Math.max(0, (a.fromX / 1000) * 100)}%`;
      token.style.top = `${Math.max(0, (a.fromY / 700) * 100)}%`;
      token.style.transform = 'translate(-50%, -50%)';
      token.style.fontFamily = "'Noto Sans','Segoe UI',system-ui,sans-serif";
      token.style.fontSize = `${Math.max(14, a.fontSize ?? 32)}px`;
      token.style.fontWeight = '700';
      token.style.lineHeight = '1';
      token.style.color = '#e6faff';
      token.style.pointerEvents = 'none';
      token.style.zIndex = '40';
      token.style.opacity = '1';
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.appendChild(token);
      const durationMs = Math.max(120, a.durationMs ?? 700);
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      token.style.transition = `left ${durationMs}ms cubic-bezier(.22,.61,.36,1), top ${durationMs}ms cubic-bezier(.22,.61,.36,1), opacity ${Math.min(240, Math.round(durationMs * .35))}ms ease-out`;
      token.style.left = `${Math.max(0, (a.toX / 1000) * 100)}%`;
      token.style.top = `${Math.max(0, (a.toY / 700) * 100)}%`;
      if (a.fadeOut !== false) {
        window.setTimeout(() => { token.style.opacity = '0'; }, Math.max(0, durationMs - Math.min(220, Math.round(durationMs * .3))));
      }
      await new Promise<void>(resolve => window.setTimeout(resolve, durationMs + (a.fadeOut === false ? 0 : 180)));
      token.remove();
      return;
    }

    if (action.type === 'highlight') {
      const targetNode = (action as any).targetId
        ? (host.querySelector(`[data-action-id="${cssEscape((action as any).targetId)}"]`) as HTMLElement | null)
        : null;
      if (targetNode) {
        const prevOutline = targetNode.style.outline;
        targetNode.style.outline = '2px dashed #fbbf24';
        targetNode.style.outlineOffset = '2px';
        targetNode.style.borderRadius = '10px';
        try { targetNode.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch { /* ignore */ }
        await new Promise<void>((r) => window.setTimeout(r, Math.min(duration, 600)));
        targetNode.style.outline = prevOutline;
        return;
      }
      const hx = (action as any).x, hy = (action as any).y;
      if (hx == null || hy == null) return;
      const hw = (action as any).width ?? 920;
      const hh = (action as any).height ?? 56;
      const hid = String((action as any).id || `hl-${Date.now()}`);
      host.querySelectorAll(`[data-action-id="${cssEscape(hid)}"]`).forEach((n) => n.remove());
      const ring = document.createElement('div');
      ring.dataset.actionId = hid;
      ring.className = 'pointer-events-none absolute transition-opacity duration-300';
      ring.style.left = `${Math.max(0, (hx / 1000) * 100)}%`;
      ring.style.top = `${Math.max(0, (hy / 700) * 100)}%`;
      ring.style.width = `${Math.min(100, (hw / 1000) * 100)}%`;
      ring.style.height = `${Math.max(8, (hh / 700) * 100)}%`;
      ring.style.border = '3px dashed #fbbf24';
      ring.style.borderRadius = '14px';
      ring.style.opacity = '0';
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.appendChild(ring);
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      ring.style.opacity = '1';
      await new Promise<void>((r) => window.setTimeout(r, Math.min(duration, 400)));
      return;
    }

    const targetAction = action.type === 'transform' ? itemsRef.current.find(v => v.id === (action as any).toId) : action;
    if (!targetAction) return;
    const id = String(action.type === 'transform' ? (action as any).toId : (targetAction as any).id ?? '');
    const isTextAct = targetAction.type === 'write' || targetAction.type === 'latex';
    const tplSpec = (targetAction as any).tpl as import('@/lib/ai-guru/math/template-types').TemplateRowSpec | undefined;
    if (isTextAct && tplSpec) {
      // Worked-solution template row: use the COMPLETE whiteboard as a cinematic
      // canvas. The previous implementation stacked rows in a scrollable text
      // column, which made the teacher explanation look like the lesson itself.
      const block = containerFor(host);
      activateCinematicTemplateBoard(block);
      let row = id ? (host.querySelector(`[data-action-id="${cssEscape(id)}"]`) as HTMLDivElement | null) : null;
      const isUpdateRow = Boolean(row);
      if (!row) {
        row = document.createElement('div');
        row.dataset.actionId = id;
        row.dataset.role = 'tpl';
        row.className = 'transition-all ease-out';
        row.style.opacity = '0';
        row.style.transform = 'translateY(12px) scale(.985)';
      }
      row.style.transitionDuration = `${Math.min(duration, 500)}ms`;
      renderTemplateRow(document, row, tplSpec, { sectionKey: currentKeyRef.current, rowId: id });
      prepareHost(host);
      if (!isUpdateRow) {
        block.appendChild(row);
      }
      const rowIndex = Array.from(block.querySelectorAll('[data-tpl-row]')).indexOf(row);
      cinematicRowPosition(block);
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      row.style.opacity = '1';
      row.style.transform = 'translateY(0) scale(1)';
      // Do not scroll a cinematic board. The entire mathematics canvas stays visible.
      await new Promise<void>(resolve => window.setTimeout(resolve, Math.min(duration, 520)));
      return;
    }
    // Diagram labels (placement 'absolute') are drawn INSIDE the figure at their x,y, like lines and shapes.
    const isFigureLabel = isTextAct && (targetAction as any).placement === 'absolute';
    if (isTextAct && !isFigureLabel) {
      const fontSize = Math.min(42, Math.max(16, Number((targetAction as any).fontSize ?? 28)));
      const raw = String((targetAction as any).content || (targetAction as any).latex || '');
      const readable = raw
        .replace(/\\begin\{[^}]*\}/g, '')
        .replace(/\\end\{[^}]*\}/g, '')
        .replace(/\\cdot/g, '·').replace(/\\times/g, '×').replace(/\\pm/g, '±')
        .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
        .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
        .replace(/\\left/g, '').replace(/\\right/g, '')
        .replace(/\\,/g, ' ').replace(/\\;/g, ' ').replace(/\\!/g, '')
        .replace(/\\text\{([^}]*)\}/g, '$1')
        .replace(/\\mathrm\{([^}]*)\}/g, '$1')
        .replace(/[{}]/g, '')
        .replace(/\\[a-zA-Z]+/g, '')
        .replace(/\\/g, '')
        .replace(/[ \t]+/g, ' ')
        .trim();
      if (!readable) return;

      const role = String((targetAction as any).role || 'work');
      // In-place update when the same equation id is rewritten (transform beat)
      let wrapper = id ? (host.querySelector(`[data-action-id="${cssEscape(id)}"]`) as HTMLDivElement | null) : null;
      const isUpdate = Boolean(wrapper);
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.dataset.actionId = id;
        wrapper.className = 'relative w-full px-4 transition-all ease-out';
        wrapper.style.marginBottom = '12px';
        wrapper.style.opacity = '0';
        wrapper.style.transform = 'translateY(6px)';
      }
      wrapper.style.transitionDuration = `${Math.min(duration, 500)}ms`;
      wrapper.dataset.role = role;

      // Role-based colours matching linear-equation reference video
      let color = '#e6faff';
      let underline = 'none';
      let weight = '600';
      const italic = (targetAction as any).fontStyle === 'italic';
      if (role === 'highlight' || role === 'mark') {
        color = '#f472b6'; // pink pulse
        underline = 'underline solid #f472b6 3px';
      } else if (role === 'result' || role === 'answer') {
        color = '#4ade80'; // green final
        weight = '700';
      } else if (role === 'caption') {
        color = '#94a3b8';
        weight = '400';
      } else if (role === 'problem') {
        color = '#cbd5e1';
        weight = '600';
      } else if (role === 'op') {
        color = '#fbbf24'; // operation tag between two lines
        weight = '500';
      } else {
        color = italic ? '#a5f3fc' : '#67e8f9'; // cyan work zone (paler for italic source text)
      }

      let pre = wrapper.querySelector('[data-eq-text]') as HTMLDivElement | null;
      if (!pre) {
        pre = document.createElement('div');
        pre.dataset.eqText = '1';
        wrapper.appendChild(pre);
      }
      pre.style.fontFamily = 'Chilanka, Noto Sans Malayalam, Nirmala UI, Noto Sans, ui-monospace, monospace';
      pre.style.fontSize = `${role === 'op' ? Math.min(fontSize, 16) : fontSize}px`;
      if (role === 'op') { pre.style.fontStyle = 'italic'; pre.style.paddingLeft = '28px'; wrapper.style.marginBottom = '4px'; wrapper.style.marginTop = '-4px'; }
      pre.style.lineHeight = '1.35';
      pre.style.color = color;
      pre.style.fontWeight = weight;
      pre.style.textDecoration = underline;
      if (role !== 'op') pre.style.fontStyle = italic ? 'italic' : 'normal';
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.wordBreak = 'break-word';
      pre.style.letterSpacing = '0.02em';
      pre.textContent = readable;

      // Ensure host is a vertical flex column so blocks stack tightly
      prepareHost(host);
      const container = containerFor(host);
      if (!isUpdate) {
        // Keep the whole derivation readable in order: dim earlier lines of THIS answer when a new one arrives.
        if (role === 'work' || role === 'highlight' || role === 'result') {
          container.querySelectorAll('[data-role="work"],[data-role="highlight"],[data-role="result"]').forEach((n) => { (n as HTMLElement).style.opacity = '0.55'; });
        }
        container.appendChild(wrapper);
      } else if (role === 'work' || role === 'highlight' || role === 'result') {
        wrapper.style.opacity = '1';
      }
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      wrapper.style.opacity = '1';
      wrapper.style.transform = 'translateY(0)';
      followLatest(wrapper);
      await new Promise<void>(resolve => window.setTimeout(resolve, Math.min(duration, 450)));
      return;
    }

    // Non-text shapes / lines — SVG overlay inside THIS answer's figure.
    // A figure is created only when a real spatial visual is requested; an empty
    // figure must never appear as a fake square/placeholder on an otherwise
    // text/derivation lesson.
    const wrapper = document.createElement('div');
    wrapper.dataset.actionId = id;
    wrapper.className = 'absolute inset-0 transition-all ease-out pointer-events-none';
    wrapper.style.transitionDuration = `${Math.min(duration, 900)}ms`;
    wrapper.innerHTML = actionSvg(targetAction);
    const svg = wrapper.querySelector('svg');
    if (svg) {
      svg.classList.add('h-full', 'w-full');
      svg.style.width = '100%';
      svg.style.height = '100%';
    }
    prepareHost(host);
    const shapeContainer = figureFor(host);
    wrapper.style.opacity = '0';
    shapeContainer.appendChild(wrapper);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    wrapper.style.opacity = '1';
    wrapper.style.transform = 'scale(1)';
    followLatest(wrapper);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    // Figure actions may be fitted to the narration (timing contract): allow up to 2.5 s each.
    await new Promise<void>(resolve => window.setTimeout(resolve, Math.min(duration, 2500)));
  };

  /** DOM overlay for reliable text drawing even when WASM is "ready". */
  const ensureTextOverlayHost = () => {
    if (!hostRef.current) return;
    let overlay = hostRef.current.querySelector('[data-text-overlay="1"]') as HTMLDivElement | null;
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.dataset.textOverlay = '1';
      overlay.className = 'absolute inset-0 z-10 overflow-y-scroll';
      overlay.style.display = 'flex';
      overlay.style.flexDirection = 'column';
      overlay.style.alignItems = 'stretch';
      overlay.style.justifyContent = 'flex-start';
      overlay.style.padding = '40px 10px 24px 12px'; // top pad clears WASM status pill
      overlay.style.pointerEvents = 'auto'; // allow vertical scroll with mouse/wheel
      overlay.style.scrollbarWidth = 'thin';
      overlay.style.scrollbarColor = 'rgba(34,211,238,0.55) rgba(0,0,0,0.25)';
      hostRef.current.style.position = hostRef.current.style.position || 'relative';
      hostRef.current.appendChild(overlay);
    }
    fallbackHostRef.current = overlay;
  };

  const jumpLatest = () => {
    const host = fallbackHostRef.current;
    if (!host) return;
    awayFromBottomRef.current = false;
    lastAutoScrollRef.current = Date.now();
    setShowJump(false);
    host.scrollTo({ top: host.scrollHeight, behavior: 'smooth' });
  };

  const activateOverlayIfNeeded = () => {
    if (!fallbackActiveRef.current) ensureTextOverlayHost();
  };

  // Clicks on the # / tick / R / ^ icons of any step (delegated: rows are plain DOM created imperatively).
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const fire = (e: Event, forceDown = false) => {
      const btn = (e.target as HTMLElement | null)?.closest?.('[data-step-ctl]') as HTMLElement | null;
      if (!btn) return;
      e.preventDefault();
      let action = btn.dataset.stepCtl as StepControlAction;
      if (action === 'up' && (forceDown || (e as MouseEvent).shiftKey)) action = 'down';
      onControlRef.current?.({ action, sectionKey: btn.dataset.sectionKey || '', rowId: btn.dataset.rowId || '' });
    };
    const onClick = (e: Event) => fire(e);
    const onCtx = (e: Event) => { if ((e.target as HTMLElement | null)?.closest?.('[data-step-ctl="up"]')) fire(e, true); };
    el.addEventListener('click', onClick);
    el.addEventListener('contextmenu', onCtx);
    return () => { el.removeEventListener('click', onClick); el.removeEventListener('contextmenu', onCtx); };
  }, []);

  useImperativeHandle(ref, () => ({
    beginSection(key, opts) {
      if (!fallbackHostRef.current) { activateOverlayIfNeeded(); }
      const host = fallbackHostRef.current;
      if (!host) return;
      prepareHost(host);
      currentKeyRef.current = key;
      let block = blocksRef.current.get(key) ?? null;
      if (block && !host.contains(block)) block = null;
      if (block && opts?.replace) { block.replaceChildren(); block.style.aspectRatio = ''; }
      const fresh = !block || Boolean(opts?.replace);
      if (!block) {
        block = document.createElement('div');
        block.dataset.sectionBlock = key;
        block.style.position = 'relative';
        block.style.flex = 'none';
        block.style.width = '100%';
        block.style.marginBottom = '26px';
        if (host.querySelector('[data-section-block]')) {
          block.style.borderTop = '2px solid rgba(103,232,249,.25)';
          block.style.paddingTop = '16px';
        }
        host.appendChild(block);
        blocksRef.current.set(key, block);
      }
      if (fresh) {
        const head = document.createElement('div');
        head.dataset.sectionHeader = '1';
        head.style.padding = '0 16px 10px';
        const tag = document.createElement('div');
        tag.style.cssText = 'font:700 11px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#67e8f9;margin-bottom:6px';
        tag.textContent = [opts?.label, opts?.heading].filter(Boolean).join(' · ') || 'Answer';
        head.append(tag);
        if (opts?.problem) {
          const q = document.createElement('div');
          q.dataset.problem = '1';
          q.style.cssText = "border:1px solid rgba(203,213,225,.28);background:rgba(148,163,184,.10);border-radius:12px;padding:10px 14px;color:#e2e8f0;font:600 16px/1.5 Chilanka,'Noto Sans Malayalam','Nirmala UI','Noto Sans',system-ui,sans-serif;white-space:pre-wrap;word-break:break-word";
          const ql = document.createElement('div');
          ql.style.cssText = 'font:700 10px/1 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px';
          ql.textContent = 'Question';
          const qt = document.createElement('div');
          qt.textContent = opts.problem;
          q.append(ql, qt);
          head.append(q);
        }
        block.prepend(head);
      }
      if (!opts?.replace) awayFromBottomRef.current = false;
      followLatest(block);
    },
    moveStep(sectionKey, rowId, dir) {
      const host = fallbackHostRef.current;
      if (!host) return;
      const rows = Array.from(host.querySelectorAll('[data-tpl-row]')) as HTMLElement[];
      const at = rows.findIndex(r => r.dataset.rowId === rowId && (r.dataset.sectionKey ?? '') === sectionKey);
      if (at < 0) return;
      const target = rows[at + (dir === 'up' ? -1 : 1)];
      lastAutoScrollRef.current = Date.now();
      awayFromBottomRef.current = true;
      if (!target) {
        // Above the first step of the very first answer: go to the very top; below the last: back to the latest.
        if (dir === 'up') host.scrollTo({ top: 0, behavior: 'smooth' }); else { awayFromBottomRef.current = false; setShowJump(false); host.scrollTo({ top: host.scrollHeight, behavior: 'smooth' }); }
        return;
      }
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      flashRow(target);
      setShowJump(true);
    },
    scrollToLatest: jumpLatest,
    reset() {
      // Explicit clear only: DOM text overlay, every answer block, and the vertical cursor
      textCursorYRef.current = 48;
      blocksRef.current.clear();
      currentKeyRef.current = '';
      awayFromBottomRef.current = false;
      setShowJump(false);
      if (fallbackHostRef.current) fallbackHostRef.current.replaceChildren();
      if (fallbackActiveRef.current) return;
      const scene = sceneRef.current;
      if (!scene) return;
      scene.objects.forEach((object) => object.free?.());
      scene.objects = [];
      void scene.render();
    },
    async reveal(action) {
      // Never hang teaching: wait at most 3s for WASM, then fall back.
      if (!readyRef.current) {
        await Promise.race([
          new Promise<void>(resolve => { readyWaitersRef.current.push(resolve); }),
          new Promise<void>(resolve => window.setTimeout(resolve, 3000)),
        ]);
        if (!readyRef.current) {
          activateFallback('reveal timeout — using DOM renderer');
        }
      }
      // Text must always appear. Prefer the DOM fallback for write/latex —
      // WASM VectorObjectBuilder.from_svg often drops tspans / long paragraphs
      // and leaves a blank board while still reporting "WASM ready".
      // Text + highlight always use the DOM path. WASM VectorObjectBuilder
      // often drops tspans and leaves a blank board while still reporting
      // "WASM ready". Highlight rings must also be DOM so they are visible.
      // (compare via a plain string so TS does not narrow `action` away below —
      //  the WASM branch further down still has to type-check for other actions)
      const actionType: string = action.type;
      // Everything is drawn in the scrollable DOM column now: WASM objects live in one fixed scene that cannot
      // scroll, so keeping them would force the previous answer to be deleted before the next one starts.
      const isDomPreferred = true;
      if (fallbackActiveRef.current || isDomPreferred) {
        if (!fallbackActiveRef.current) {
          ensureTextOverlayHost();
        }
        await fallbackReveal(action);
        return;
      }
      const scene = sceneRef.current;
      const core = coreRef.current;
      if (!scene || !core) {
        activateFallback('scene missing');
        await fallbackReveal(action);
        return;
      }
      const duration = action.type === 'pause' ? action.durationMs : (action.durationMs ?? (action.type === 'move' || action.type === 'transform' || action.type === 'erase' ? 1100 : 1250));

      if (action.type === 'erase') {
        const index = scene.objects.findIndex((o: any) => typeof o.name === 'function' && o.name() === action.targetId);
        if (index >= 0) { scene.objects[index]?.free?.(); scene.objects.splice(index, 1); }
        await scene.render();
        return;
      }
      if (action.type === 'pause') { await new Promise<void>(resolve => window.setTimeout(resolve, duration)); return; }
      if (action.type === 'transform') {
        // Cumulative derivation: keep the source line and animate the derived
        // target line as a new persistent object. This makes the relationship
        // visible instead of treating a transform as a no-op.
        const target = itemsRef.current.find(v => v.id === action.toId);
        if (target) {
          const object = core.VectorObjectBuilder.from_svg(actionSvg(target)).set_name(action.toId).build();
          scene.objects.push(object as never);
          const animations = new Map<string, (old: unknown, t: number) => unknown>();
          animations.set(action.toId, (old, t) => {
            const builder = new core.VectorObjectBuilder(old);
            try { return builder.become_partial(0, t).set_name(action.toId).build(); }
            catch { return builder.scale(0.96 + 0.04 * t, 0.96 + 0.04 * t).set_name(action.toId).build(); }
          });
          await scene.play(animations, duration, (t) => t);
          return;
        }
        if (action.retainFrom === false) {
          const oldIndex = scene.objects.findIndex((o: any) => typeof o.name === 'function' && o.name() === action.fromId);
          if (oldIndex >= 0) { scene.objects[oldIndex]?.free?.(); scene.objects.splice(oldIndex, 1); await scene.render(); }
        }
        return;
      }

      const object = core.VectorObjectBuilder.from_svg(actionSvg(action)).set_name(action.id).build();
      scene.objects.push(object as never);
      const animations = new Map<string, (old: unknown, t: number) => unknown>();
      animations.set(action.id, (old, t) => {
        const builder = new core.VectorObjectBuilder(old);
        try { return builder.become_partial(0, t).set_name(action.id).build(); }
        catch { return builder.scale(0.94 + 0.06 * t, 0.94 + 0.06 * t).set_name(action.id).build(); }
      });
      await scene.play(animations, duration, (t) => t);
    },
  }), [ready]);

  return <div className="relative h-full w-full">
    <div data-ai-guru-visual-board data-renderer="mathlikeanim-rs" data-ready={ready ? 'true' : 'false'} data-font="Chilanka" className="relative h-full w-full overflow-hidden bg-[#0b1017]" ref={hostRef} />
    {showJump && <button type="button" data-ai-guru-jump-latest onClick={jumpLatest} className="absolute bottom-16 left-1/2 z-30 -translate-x-1/2 rounded-full border border-cyan-300/40 bg-[#0b1e2e]/95 px-3 py-1.5 text-[11px] font-semibold text-cyan-200 shadow-lg hover:bg-cyan-500/20">↓ Back to latest step</button>}
  </div>;
});

export default MathLikeAnimBoard;
