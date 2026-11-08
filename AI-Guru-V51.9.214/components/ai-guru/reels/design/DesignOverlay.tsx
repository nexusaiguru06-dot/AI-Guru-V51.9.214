'use client';

/**
 * V51.9.119 — the handles over the reel preview (react-konva, MIT). The reel itself is drawn by AI Guru's engine
 * underneath; this layer only finds what was clicked and moves, resizes and turns it:
 *   - the title card, board, caption and footer (move and resize; colours on the right),
 *   - every added item on screen now (move, resize, rotate).
 * A dashed outline shows what can be picked; the picked one has handles.
 */
import { useEffect, useRef, useState } from 'react';
import { Layer, Rect, Stage, Transformer } from 'react-konva';
import type Konva from 'konva';
import { PART_NAME, type DesignItem, type PartId } from '@/lib/ai-guru/reels/design/layer';
import { itemSize } from '@/lib/ai-guru/reels/design/draw-design';
import type { DesignApi, Selection } from './useDesign';

interface Box { x: number; y: number; w: number; h: number }

/** V51.9.121: where the menu opens (screen px), on what, and the spot on the reel (frame fractions). */
export interface MenuAt { x: number; y: number; target: Selection; at: { cx: number; cy: number } }
const LONG_PRESS_MS = 550;

export default function DesignOverlay({ api, width, height, dw, dh, rects, partIndex, onMenu }: {
  api: DesignApi; width: number; height: number; dw: number; dh: number; rects: Partial<Record<PartId, Box>>; partIndex: number;
  /** V51.9.121: right-click, long-press or ⋯ — open the menu. */
  onMenu?: (m: MenuAt) => void;
}) {
  const k = width / dw;
  const tr = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Rect>());
  const [hover, setHover] = useState<string | null>(null);
  const { design, sel, setSel, live, settle } = api;
  const selKey = sel ? `${sel.type}:${sel.id}` : null;
  const items = design.items.filter((i) => i.part === null || i.part === partIndex);
  const selItem = sel?.type === 'item' ? design.items.find((i) => i.id === sel.id) : undefined;

  useEffect(() => {
    const n = selKey ? nodes.current.get(selKey) : undefined;
    tr.current?.nodes(n ? [n] : []);
    tr.current?.getLayer()?.batchDraw();
  });

  // V51.9.121: the menu — right-click (mouse), long-press (finger), or the ⋯ button on what is selected
  const press = useRef<{ t: number; x: number; y: number } | null>(null);
  const targetOf = (key: string | null): Selection => (!key ? null : key.startsWith('item:') ? { type: 'item', id: key.slice(5) } : { type: 'part', id: key.slice(5) as PartId });
  const keyAt = (st: Konva.Stage) => { const pos = st.getPointerPosition(); const hit = pos ? st.getIntersection(pos) : null; const id = hit?.id(); return id && (id.startsWith('item:') || id.startsWith('part:')) ? id : null; };
  const openMenu = (st: Konva.Stage, clientX: number, clientY: number) => {
    const key = keyAt(st);
    const target = targetOf(key);
    setSel(target);
    const pos = st.getPointerPosition() ?? { x: 0, y: 0 };
    onMenu?.({ x: clientX, y: clientY, target, at: { cx: pos.x / width, cy: pos.y / height } });
  };
  const cancelPress = () => { if (press.current) { clearTimeout(press.current.t); press.current = null; } };
  const ref = (key: string) => (n: Konva.Rect | null) => { if (n) nodes.current.set(key, n); else nodes.current.delete(key); };
  const outline = (key: string) => (selKey === key ? 'transparent' : hover === key ? 'rgba(34,211,238,.95)' : 'rgba(148,163,184,.35)');

  const partBox = (id: PartId, r: Box) => {
    const o = design.parts[id] ?? {};
    const s = o.scale ?? 1;
    const key = `part:${id}`;
    return (
      <Rect key={key} id={key} ref={ref(key)} name={PART_NAME[id]}
        x={(r.x + r.w / 2 + (o.dx ?? 0) * dw) * k} y={(r.y + r.h / 2 + (o.dy ?? 0) * dh) * k}
        width={r.w * k} height={r.h * k} offsetX={(r.w * k) / 2} offsetY={(r.h * k) / 2} scaleX={s} scaleY={s}
        fill="rgba(0,0,0,0.001)" stroke={o.hidden ? 'rgba(244,63,94,.7)' : outline(key)} strokeWidth={1} dash={[6, 4]} strokeScaleEnabled={false}
        draggable
        onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover((h) => (h === key ? null : h))}
        onMouseDown={() => setSel({ type: 'part', id })} onTap={() => setSel({ type: 'part', id })}
        onDragMove={(e) => { const n = e.target; live((d) => ({ ...d, parts: { ...d.parts, [id]: { ...d.parts[id], dx: (n.x() / k - (r.x + r.w / 2)) / dw, dy: (n.y() / k - (r.y + r.h / 2)) / dh } } })); }}
        onDragEnd={settle}
        onTransform={(e) => { const n = e.target; live((d) => ({ ...d, parts: { ...d.parts, [id]: { ...d.parts[id], scale: Math.max(0.3, Math.min(2.5, n.scaleX())), dx: (n.x() / k - (r.x + r.w / 2)) / dw, dy: (n.y() / k - (r.y + r.h / 2)) / dh } } })); }}
        onTransformEnd={settle}
      />
    );
  };

  const itemBox = (it: DesignItem) => {
    const { w, h } = itemSize(it, dw);
    const key = `item:${it.id}`;
    return (
      <Rect key={key} id={key} ref={ref(key)}
        x={it.cx * dw * k} y={it.cy * dh * k} width={Math.max(8, w * k)} height={Math.max(8, h * k)} offsetX={Math.max(8, w * k) / 2} offsetY={Math.max(8, h * k) / 2} rotation={it.rot}
        fill="rgba(0,0,0,0.001)" stroke={outline(key)} strokeWidth={1} dash={[4, 3]}
        draggable
        onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover((h0) => (h0 === key ? null : h0))}
        onMouseDown={() => setSel({ type: 'item', id: it.id })} onTap={() => setSel({ type: 'item', id: it.id })}
        onDragMove={(e) => { const n = e.target; live((d) => ({ ...d, items: d.items.map((i) => (i.id === it.id ? { ...i, cx: n.x() / k / dw, cy: n.y() / k / dh } : i)) })); }}
        onDragEnd={settle}
        onTransform={(e) => {
          const n = e.target;
          const s = n.scaleX();
          n.scaleX(1); n.scaleY(1);
          live((d) => ({ ...d, items: d.items.map((i) => (i.id === it.id ? { ...i, size: Math.max(0.01, Math.min(2, i.size * s)), rot: Math.round(n.rotation()), cx: n.x() / k / dw, cy: n.y() / k / dh } : i)) }));
        }}
        onTransformEnd={settle}
      />
    );
  };

  return (
    <>
    <Stage width={width} height={height} className="absolute inset-0" style={{ touchAction: 'none' }}
      onMouseDown={(e) => { if (e.evt.button === 0 && e.target === e.target.getStage()) setSel(null); }} onTap={(e) => { if (e.target === e.target.getStage()) setSel(null); }}
      onContextMenu={(e) => { e.evt.preventDefault(); const st = e.target.getStage(); if (st) openMenu(st, e.evt.clientX, e.evt.clientY); }}
      onTouchStart={(e) => {
        cancelPress();
        const st = e.target.getStage(); const tch = e.evt.touches[0];
        if (!st || !tch || e.evt.touches.length > 1) return;
        const x = tch.clientX, y = tch.clientY;
        press.current = { x, y, t: window.setTimeout(() => { press.current = null; openMenu(st, x, y); }, LONG_PRESS_MS) };
      }}
      onTouchMove={(e) => { const tch = e.evt.touches[0]; if (press.current && tch && Math.hypot(tch.clientX - press.current.x, tch.clientY - press.current.y) > 10) cancelPress(); }}
      onTouchEnd={cancelPress}>
      <Layer>
        {(['board', 'title', 'caption', 'footer'] as PartId[]).filter((id) => rects[id]).map((id) => partBox(id, rects[id]!))}
        {items.map(itemBox)}
        <Transformer ref={tr} keepRatio rotateEnabled={sel?.type === 'item'} rotationSnaps={[0, 90, 180, 270]} flipEnabled={false}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          anchorSize={12} anchorCornerRadius={6} anchorStroke="#22d3ee" anchorFill="#ffffff" borderStroke="#22d3ee" borderStrokeWidth={2}
          rotateAnchorOffset={22}
          boundBoxFunc={(oldB, newB) => (newB.width < 12 || newB.height < 12 ? oldB : newB)}
          key={selItem ? `${selItem.id}` : selKey ?? 'none'} />
      </Layer>
    </Stage>
    {sel && onMenu && (() => {
      // the ⋯ button at the top-right of what is selected
      let x = 0, y = 0;
      if (sel.type === 'item' && selItem) { const { w, h } = itemSize(selItem, dw); x = selItem.cx * dw * k + (w * k) / 2; y = selItem.cy * dh * k - (h * k) / 2; }
      else if (sel.type === 'part' && rects[sel.id]) { const r = rects[sel.id]!; const o = design.parts[sel.id] ?? {}; const s = o.scale ?? 1; x = (r.x + r.w / 2 + (o.dx ?? 0) * dw) * k + (r.w * k * s) / 2; y = (r.y + r.h / 2 + (o.dy ?? 0) * dh) * k - (r.h * k * s) / 2; }
      else return null;
      x += 20; y -= 20; // clear of the corner handle
      x = Math.max(14, Math.min(width - 14, x)); y = Math.max(14, Math.min(height - 14, y));
      return (
        <button type="button" aria-label="More for this" title="More (or right-click / long-press)" data-more-button
          onClick={(e) => { const b = (e.currentTarget as HTMLElement).getBoundingClientRect(); onMenu({ x: b.left, y: b.bottom + 4, target: sel, at: { cx: x / width, cy: y / height } }); }}
          className="absolute z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white bg-cyan-500 text-sm font-black text-white shadow-lg"
          style={{ left: x, top: y }}>⋯</button>
      );
    })()}
    </>
  );
}
