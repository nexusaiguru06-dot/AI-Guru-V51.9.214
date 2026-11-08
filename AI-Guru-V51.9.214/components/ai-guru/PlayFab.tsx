'use client';

/**
 * V51.9.171 — the class's main Play button, floating: big and easy to find as soon as the page opens, beside the
 * camera / mic pane. It shows what it will do next — Start class, Pause, Continue — and the student can drag it
 * (by the dotted grip, or by holding the button) to any part of the screen; the place is kept on this device.
 * Keyboard: Tab to it and press Enter / Space; Alt + arrow keys move it.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type ClassState = 'STOPPED' | 'PLAYING' | 'PAUSED' | 'ERROR' | 'COMPLETED';
const POS_KEY = 'ai-guru-play-fab-pos';
type Pos = { left: number; top: number };

const clamp = (p: Pos, w: number, h: number): Pos => ({
  left: Math.max(8, Math.min(p.left, window.innerWidth - w - 8)),
  top: Math.max(72, Math.min(p.top, window.innerHeight - h - 8)),
});

/** Beside the camera / mic pane (to its left on a wide screen, above it on a phone); bottom-right if it is not there. */
function besideDock(w: number, h: number): Pos {
  const dock = document.querySelector('.hardware-dock-center') as HTMLElement | null;
  const r = dock?.getBoundingClientRect();
  if (r && r.width > 0) {
    // the pane's visible bar is its lowest child; line the button up with it
    const parts = [...(dock!.children as HTMLCollectionOf<HTMLElement>)].map((c) => c.getBoundingClientRect()).filter((b) => b.width > 0 && b.height > 0);
    const bar = [...parts].sort((a, b) => b.bottom - a.bottom)[0] ?? r;
    if (bar.left - w - 18 > 8) return clamp({ left: bar.left - w - 18, top: bar.top + bar.height / 2 - h / 2 }, w, h);
    // V51.9.180 (UX review): on a phone, sit above the WHOLE pane — its notes ("Set up your free Gemini key…") included — not on top of them
    const top = Math.min(bar.top, ...parts.map((b) => b.top));
    return clamp({ left: bar.left + bar.width / 2 - w / 2, top: top - h - 12 }, w, h);
  }
  return clamp({ left: window.innerWidth - w - 28, top: window.innerHeight - h - 120 }, w, h);
}

export function PlayFab({ state, busy, lessonTitle, onStart, onPause, onContinue }: {
  state: ClassState;
  busy?: boolean;
  lessonTitle?: string;
  onStart: () => void;
  onPause: () => void;
  onContinue: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);
  const movedRef = useRef(false);

  const size = () => { const r = ref.current?.getBoundingClientRect(); return { w: r?.width || 220, h: r?.height || 64 }; };

  // first place: the one the student chose, else beside the camera / mic pane (it may draw a moment later)
  useLayoutEffect(() => {
    const { w, h } = size();
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null') as Pos | null;
      if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) { setPos(clamp(saved, w, h)); return; }
    } catch { /* none saved */ }
    setPos(besideDock(w, h));
    const t = window.setTimeout(() => { if (!localStorage.getItem(POS_KEY)) setPos(besideDock(size().w, size().h)); }, 900);
    return () => window.clearTimeout(t);
  }, []);
  // stay on screen when the window changes size
  useEffect(() => {
    const fit = () => setPos((p) => (p ? clamp(p, size().w, size().h) : p));
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const save = (p: Pos) => { try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* private mode */ } };
  // the drag follows the pointer anywhere on the page (window listeners), so a fast drag never loses the button;
  // a press that moves less than 6 px is a click
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !pos) return;
    const d = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: pos.left, oy: pos.top, moved: false };
    drag.current = d;
    movedRef.current = false;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== d.id) return;
      const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 6) return;
      d.moved = true;
      ev.preventDefault();
      const { w, h } = size();
      setPos(clamp({ left: d.ox + dx, top: d.oy + dy }, w, h));
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== d.id) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      drag.current = null;
      if (d.moved) { movedRef.current = true; setPos((p) => { if (p) save(p); return p; }); window.setTimeout(() => { movedRef.current = false; }, 0); }
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!e.altKey || !pos) return;
    const step = e.shiftKey ? 48 : 16;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    const p = clamp({ left: pos.left + d[0], top: pos.top + d[1] }, size().w, size().h);
    setPos(p); save(p);
  };
  const reset = useCallback(() => { try { localStorage.removeItem(POS_KEY); } catch { /* */ } setPos(besideDock(size().w, size().h)); }, []);

  const playing = state === 'PLAYING';
  const paused = state === 'PAUSED';
  const label = busy && !playing && !paused ? 'Getting ready…' : playing ? 'Pause' : paused ? 'Continue' : state === 'COMPLETED' ? 'Play again' : 'Start class';
  const hint = playing ? 'The class is on' : paused ? 'Paused — carry on' : lessonTitle ? lessonTitle : 'Teach this page';
  const act = () => { if (movedRef.current) { movedRef.current = false; return; } if (playing) onPause(); else if (paused) onContinue(); else onStart(); };

  return (
    <div ref={ref} className="ag-playfab fixed z-[1001] select-none" style={pos ? { left: pos.left, top: pos.top } : { right: 28, bottom: 120, visibility: 'hidden' }}
      onPointerDown={onDown}>
      <div className={`flex items-center gap-1 rounded-full p-1.5 pr-2 shadow-[0_18px_44px_rgba(0,0,0,.35)] ${playing ? 'ag-playfab-on' : ''}`} style={{ background: 'var(--ag-panel, #0F1830)', border: '1px solid var(--ag-line, rgba(160,175,210,.18))', touchAction: 'none' }}>
        <span aria-hidden="true" title="Drag to move" className="flex h-12 w-5 cursor-grab items-center justify-center text-[color:var(--ag-muted,#A5B0CB)] active:cursor-grabbing">
          <svg width="10" height="18" viewBox="0 0 10 18" fill="currentColor"><circle cx="2.5" cy="3" r="1.5" /><circle cx="7.5" cy="3" r="1.5" /><circle cx="2.5" cy="9" r="1.5" /><circle cx="7.5" cy="9" r="1.5" /><circle cx="2.5" cy="15" r="1.5" /><circle cx="7.5" cy="15" r="1.5" /></svg>
        </span>
        <button type="button" onClick={act} onKeyDown={onKey} disabled={!!busy && !playing && !paused} data-ai-guru-play-fab
          aria-label={`${label}. Drag to move; Alt and the arrow keys move it too.`}
          className="group relative flex min-h-[52px] items-center gap-3 rounded-full py-1.5 pl-1.5 pr-5 text-left text-[#1A1203] transition hover:brightness-105 active:scale-[.98] disabled:cursor-wait disabled:opacity-80"
          style={{ background: playing ? 'linear-gradient(135deg,#FFD27A,#F5B83D)' : 'linear-gradient(135deg,#FFC94D,#F5A524 55%,#F08C1A)', boxShadow: '0 10px 30px rgba(245,165,36,.38), inset 0 1px 0 rgba(255,255,255,.45)' }}>
          {!playing && !paused && !busy && <span aria-hidden="true" className="ag-playfab-pulse absolute inset-0 rounded-full" />}
          <span aria-hidden="true" className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1A1203] text-[#FFC94D] shadow-[inset_0_1px_0_rgba(255,255,255,.12)]">
            {busy && !playing && !paused
              ? <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 3a9 9 0 1 0 9 9" /></svg>
              : playing
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 3 }}><path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l11.6-7.2a1 1 0 0 0 0-1.72L8.5 3.94A1 1 0 0 0 7 4.8z" /></svg>}
          </span>
          <span className="relative flex min-w-0 flex-col leading-tight">
            <span className="text-[17px] font-extrabold" style={{ fontFamily: 'var(--ag-font-head, sans-serif)' }}>{label}</span>
            <span className="max-w-[170px] truncate text-[11px] font-semibold text-[#1A1203]/80">{hint}</span>
          </span>
        </button>
        {pos && localStorageHas() && (
          <button type="button" onClick={reset} title="Put the button back beside the camera / mic" aria-label="Put the Play button back in its place"
            className="ml-0.5 flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--ag-muted,#A5B0CB)] hover:bg-[color:var(--ag-tile,rgba(255,255,255,.06))]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}

const localStorageHas = () => { try { return !!localStorage.getItem(POS_KEY); } catch { return false; } };

export default PlayFab;
