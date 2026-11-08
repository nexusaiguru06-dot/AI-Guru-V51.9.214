'use client';

/**
 * V51.9.119 — the Reel designer around the preview: Add panel and the selected item's settings on the left, the reel
 * with handles in the middle, the strip of parts underneath. Undo / redo; keys: Delete, arrows (nudge), Ctrl+Z,
 * Ctrl+Y / Ctrl+Shift+Z, Ctrl+D (copy), Esc.
 */
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MotionReel, ReelFormat } from '@/lib/ai-guru/reels/motion';
import { designPartRects } from '@/lib/ai-guru/reels/motion/draw';
import { newItem, type DesignItem, type ItemKind } from '@/lib/ai-guru/reels/design/layer';
import { AddPanel, DRAG_TYPE, PropsPanel } from './Panels';
import { partLabels, ShotStrip } from './ShotStrip';
import type { DesignApi } from './useDesign';
import { ContextMenu } from './ContextMenu';
import type { MenuAt } from './DesignOverlay';

const DesignOverlay = dynamic(() => import('./DesignOverlay'), { ssr: false });
const btn = 'rounded-lg border border-white/15 px-2.5 py-1 text-xs hover:bg-white/10 disabled:opacity-40';

export function ReelDesigner({ api, on, setOn, reel, time, seek, format, footer, cssW, cssH, onReorderShots, children, below, cardParts = true }: {
  api: DesignApi; on: boolean; setOn: (v: boolean) => void; reel: MotionReel | null; time: number; seek: (t: number) => void;
  format: ReelFormat; footer: boolean; cssW: number; cssH: number; onReorderShots?: (from: number, to: number) => void;
  children: React.ReactNode; below?: React.ReactNode;
  /** V51.9.124: false for an explainer (it has no title card, board or caption card to move). */
  cardParts?: boolean;
}) {
  const { dw, dh, rects } = useMemo(() => designPartRects(format, footer), [format, footer]);
  const textRef = useRef<HTMLTextAreaElement>(null);
  // V51.9.121: the right-click / long-press / ⋯ menu
  const [menu, setMenu] = useState<MenuAt | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const editText = () => setTimeout(() => { textRef.current?.focus(); textRef.current?.select(); }, 60);
  const partIndex = useMemo(() => {
    if (!reel) return 0;
    let s = 0;
    for (let i = 0; i < reel.parts.length; i++) { if (time < s + reel.parts[i].durationMs) return i; s += reel.parts[i].durationMs; }
    return Math.max(0, reel.parts.length - 1);
  }, [reel, time]);
  const labels = useMemo(() => partLabels(reel), [reel]);
  const { sel, setSel, selectedItem, removeItem, undo, redo, addItem, apply, canUndo, canRedo } = api;

  // keyboard: only while the designer is on and no box is being typed in
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (e.key === 'Escape') { setSel(null); return; }
      if (!selectedItem) return;
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); addItem({ ...selectedItem, id: newItem(selectedItem.kind).id, cx: selectedItem.cx + 0.04, cy: selectedItem.cy + 0.03 }); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeItem(selectedItem.id); return; }
      const step = e.shiftKey ? 0.02 : 0.004;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d) { e.preventDefault(); const id = selectedItem.id; apply((L) => ({ ...L, items: L.items.map((i) => (i.id === id ? { ...i, cx: i.cx + d[0], cy: i.cy + d[1] * (dw / dh) } : i)) }), 'nudge'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [on, selectedItem, undo, redo, setSel, addItem, removeItem, apply, dw, dh]);

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    e.preventDefault();
    try {
      const { kind, o } = JSON.parse(raw) as { kind: ItemKind; o: Partial<DesignItem> };
      const r = e.currentTarget.getBoundingClientRect();
      addItem(newItem(kind, { ...o, cx: (e.clientX - r.left) / r.width, cy: (e.clientY - r.top) / r.height }));
    } catch { /* not ours */ }
  };

  return (
    <div className="flex w-full flex-col gap-3" data-reel-designer>
      <div className="flex flex-col-reverse items-start gap-3 sm:flex-row">
        <aside className="w-full space-y-3 sm:w-[200px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <button className={`${btn} ${on ? 'border-cyan-300 bg-cyan-400/20 text-cyan-100' : ''}`} onClick={() => { setOn(!on); setSel(null); }} aria-pressed={on}>✋ {on ? 'Designing' : 'Design'}</button>
            <button className={btn} onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">↶</button>
            <button className={btn} onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" aria-label="Redo">↷</button>
          </div>
          {on && <>
            {sel && <div className="rounded-xl border border-cyan-300/30 bg-cyan-400/[0.05] p-2.5"><PropsPanel api={api} partLabels={labels} textRef={textRef} /></div>}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5"><AddPanel onAdd={addItem} partHere={partIndex} /></div>
            {!sel && <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5"><PropsPanel api={api} partLabels={labels} textRef={textRef} /></div>}
            {api.saveProblem && <p className="text-[11px] text-amber-300">This design is too big to keep on this device (large photos?). It still works until you leave the page.</p>}
          </>}
        </aside>
        <div className="flex flex-col items-center gap-2">
          <div data-drop-zone className="relative" style={{ width: cssW, height: cssH }} onDragOver={(e) => { if (on && Array.from(e.dataTransfer.types).includes(DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }} onDrop={onDrop}>
            {children}
            {on && reel && <div className="absolute inset-0"><DesignOverlay api={api} width={cssW} height={cssH} dw={dw} dh={dh} rects={cardParts ? rects : {}} partIndex={partIndex} onMenu={setMenu} /></div>}
          </div>
          {below}
        </div>
      </div>
      {on && menu && <ContextMenu api={api} menu={menu} onClose={closeMenu} onEditText={editText} />}
      {on && reel && <p className="-mt-1 text-center text-[11px] text-white/45">Tip: right-click (or long-press on a phone) anything on the reel — or an empty spot — for colours, sizes, shapes and headings.</p>}
      {on && reel && <ShotStrip reel={reel} time={time} seek={seek} api={api} onReorderShots={onReorderShots} />}
    </div>
  );
}
