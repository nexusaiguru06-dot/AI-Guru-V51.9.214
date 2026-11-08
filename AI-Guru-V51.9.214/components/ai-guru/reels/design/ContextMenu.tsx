'use client';

/**
 * V51.9.121 — the Canva-like menu on the reel: right-click (mouse), long-press (finger) or the ⋯ button.
 *   On an added thing: edit text, colour, bigger / smaller, shape, front / back, copy, delete, add a heading here.
 *   On the title / caption / board / footer: card colour, text colour, bigger / smaller, card shape, hide, as it was.
 *   On an empty spot: add a heading, text, sticker or shape right there; the background colour.
 */
import { useEffect, useRef } from 'react';
import { CARD_SHAPE_NAME, CARD_SHAPES, newItem, PART_NAME, STICKERS, SWATCHES, type DesignItem, type ShapeKind } from '@/lib/ai-guru/reels/design/layer';
import { KIND_NAME, PROP_NAME } from '@/lib/ai-guru/reels/motion/recipes/story';
import type { DesignApi } from './useDesign';
import type { MenuAt } from './DesignOverlay';

const SHAPES: Array<[ShapeKind, string]> = [['round', '▢'], ['rect', '■'], ['circle', '●'], ['arrow', '➜'], ['star', '★'], ['heart', '♥']];
export const HEADING: Partial<DesignItem> = { text: 'Big idea!', size: 0.075, bold: true, bg: '#facc15', color: '#111827', font: 'bubbly', entrance: 'pop' };
const TEXT: Partial<DesignItem> = { text: 'Your words', size: 0.055, bold: false, bg: '', color: '#111827', font: 'hand', entrance: 'fade' };

export function ContextMenu({ api, menu, onClose, onEditText }: { api: DesignApi; menu: MenuAt; onClose: () => void; onEditText: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const { design, apply, addItem, removeItem, updateItem } = api;
  const t = menu.target;
  const it = t?.type === 'item' ? design.items.find((i) => i.id === t.id) : undefined;

  useEffect(() => {
    const away = (e: Event) => { if (box.current && !box.current.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', key);
    window.addEventListener('scroll', onClose, true);
    return () => { window.removeEventListener('pointerdown', away, true); window.removeEventListener('keydown', key); window.removeEventListener('scroll', onClose, true); };
  }, [onClose]);

  // stay inside the window
  const W = 236;
  const left = Math.max(8, Math.min((typeof window !== 'undefined' ? window.innerWidth : 1000) - W - 8, menu.x));
  const top = Math.max(8, Math.min((typeof window !== 'undefined' ? window.innerHeight : 800) - 380, menu.y));
  const done = (f: () => void) => () => { f(); onClose(); };
  const addHere = (kind: DesignItem['kind'], o: Partial<DesignItem>) => done(() => addItem(newItem(kind, { ...o, cx: menu.at.cx, cy: menu.at.cy })));
  const row = 'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-white/10';
  const swatches = (pick: (c: string) => void, none?: () => void) => (
    <div className="flex flex-wrap gap-1 px-2.5 pb-1.5">
      {none && <button onClick={done(none)} className="h-5 w-5 rounded-full border border-white/30 text-[9px]" title="None">∅</button>}
      {SWATCHES.map((c) => <button key={c} onClick={done(() => pick(c))} aria-label={`Colour ${c}`} className="h-5 w-5 rounded-full border border-white/30" style={{ background: c }} />)}
    </div>
  );
  const label = (s: string) => <p className="px-2.5 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">{s}</p>;

  let body: React.ReactNode;
  if (it) {
    const scale = (f: number) => done(() => updateItem(it.id, { size: Math.max(0.01, Math.min(2, it.size * f)) }));
    const order = (front: boolean) => done(() => apply((d) => { const rest = d.items.filter((x) => x.id !== it.id); return { ...d, items: front ? [...rest, it] : [it, ...rest] }; }));
    body = <>
      <p className="px-2.5 py-1 text-xs font-bold text-white/70">{it.kind === 'text' ? `“${(it.text ?? '').slice(0, 24)}”` : it.kind === 'character' ? KIND_NAME[it.cast ?? 'girl'] : it.kind === 'prop' ? PROP_NAME[it.prop ?? 'book'] : it.kind === 'sticker' ? `Sticker ${it.emoji}` : it.kind === 'shape' ? 'Shape' : 'Photo'}</p>
      {it.kind === 'text' && <button className={row} onClick={done(onEditText)}>✏️ Edit text</button>}
      {(it.kind === 'text' || it.kind === 'shape' || it.kind === 'photo') && <>{label(it.kind === 'text' ? 'Text colour' : it.kind === 'photo' ? 'Border' : 'Colour')}{swatches((c) => updateItem(it.id, { color: c }))}</>}
      {it.kind === 'text' && <>{label('Behind the words')}{swatches((c) => updateItem(it.id, { bg: c }), () => updateItem(it.id, { bg: '' }))}</>}
      {it.kind === 'shape' && <>{label('Shape')}<div className="flex gap-1 px-2.5 pb-1.5">{SHAPES.map(([k, g]) => <button key={k} onClick={done(() => updateItem(it.id, { shape: k }))} className={`h-7 w-7 rounded-md text-base ${it.shape === k ? 'bg-cyan-500/40' : 'bg-white/10'}`} title={k}>{g}</button>)}</div></>}
      <div className="grid grid-cols-2 gap-1 px-1 py-1">
        <button className={row} onClick={scale(1.18)}>➕ Bigger</button>
        <button className={row} onClick={scale(1 / 1.18)}>➖ Smaller</button>
        <button className={row} onClick={order(true)}>⬆ To front</button>
        <button className={row} onClick={order(false)}>⬇ To back</button>
        <button className={row} onClick={done(() => addItem({ ...it, id: newItem(it.kind).id, cx: it.cx + 0.04, cy: it.cy + 0.03 }))}>⧉ Copy</button>
        <button className={`${row} text-rose-300`} onClick={done(() => removeItem(it.id))}>🗑 Delete</button>
      </div>
      <button className={row} onClick={addHere('text', { ...HEADING, cy: Math.min(0.95, it.cy + 0.08) })}>🔤 Add a heading below</button>
    </>;
  } else if (t?.type === 'part') {
    const id = t.id;
    const o = design.parts[id] ?? {};
    const set = (patch: Partial<typeof o>) => apply((d) => ({ ...d, parts: { ...d.parts, [id]: { ...d.parts[id], ...patch } } }));
    const card = id === 'title' || id === 'caption';
    body = <>
      <p className="px-2.5 py-1 text-xs font-bold text-white/70">{PART_NAME[id]}</p>
      {card && <>{label('Card colour')}{swatches((c) => set({ fill: c }), () => set({ fill: undefined }))}</>}
      {id !== 'board' && <>{label('Text colour')}{swatches((c) => set({ text: c }), () => set({ text: undefined }))}</>}
      {id === 'board' && <>{label('Background')}{swatches((c) => apply((d) => ({ ...d, parts: { ...d.parts, background: { ...d.parts.background, fill: c } } })), () => apply((d) => ({ ...d, parts: { ...d.parts, background: { ...d.parts.background, fill: undefined } } })))}</>}
      {card && <>{label('Card shape')}<div className="flex flex-wrap gap-1 px-2.5 pb-1.5">{CARD_SHAPES.map((sh) => <button key={sh} onClick={done(() => set({ shape: sh }))} className={`rounded-md px-2 py-0.5 text-xs ${(o.shape ?? '') === sh ? 'bg-cyan-500/40' : 'bg-white/10'}`}>{CARD_SHAPE_NAME[sh]}</button>)}</div></>}
      <div className="grid grid-cols-2 gap-1 px-1 py-1">
        <button className={row} onClick={done(() => set({ scale: Math.min(2.5, (o.scale ?? 1) * 1.1) }))}>➕ Bigger</button>
        <button className={row} onClick={done(() => set({ scale: Math.max(0.3, (o.scale ?? 1) / 1.1) }))}>➖ Smaller</button>
        <button className={row} onClick={done(() => set({ hidden: !o.hidden }))}>{o.hidden ? '👁 Show' : '🙈 Hide'}</button>
        <button className={row} onClick={done(() => apply((d) => { const parts = { ...d.parts }; delete parts[id]; return { ...d, parts }; }))}>↺ As it was</button>
      </div>
      <button className={row} onClick={addHere('text', HEADING)}>🔤 Add a heading here</button>
      <button className={row} onClick={addHere('text', TEXT)}>✍ Add text here</button>
      {id === 'board' && <>
        {label('Add a sticker here')}
        <div className="flex flex-wrap gap-0.5 px-2 pb-1.5">{STICKERS.slice(0, 10).map((e) => <button key={e} onClick={addHere('sticker', { emoji: e })} className="rounded px-0.5 text-lg hover:bg-white/10">{e}</button>)}</div>
        {label('Add a shape here')}
        <div className="flex gap-1 px-2.5 pb-1.5">{SHAPES.map(([k, g]) => <button key={k} onClick={addHere('shape', { shape: k, color: k === 'heart' ? '#ef4444' : k === 'star' ? '#facc15' : '#3b82f6' })} className="h-7 w-7 rounded-md bg-white/10 text-base" title={k}>{g}</button>)}</div>
      </>}
    </>;
  } else {
    body = <>
      <button className={row} onClick={addHere('text', HEADING)}>🔤 Add a heading here</button>
      <button className={row} onClick={addHere('text', TEXT)}>✍ Add text here</button>
      {label('Add a sticker here')}
      <div className="flex flex-wrap gap-0.5 px-2 pb-1.5">{STICKERS.slice(0, 10).map((e) => <button key={e} onClick={addHere('sticker', { emoji: e })} className="rounded px-0.5 text-lg hover:bg-white/10">{e}</button>)}</div>
      {label('Add a shape here')}
      <div className="flex gap-1 px-2.5 pb-1.5">{SHAPES.map(([k, g]) => <button key={k} onClick={addHere('shape', { shape: k, color: k === 'heart' ? '#ef4444' : k === 'star' ? '#facc15' : '#3b82f6' })} className="h-7 w-7 rounded-md bg-white/10 text-base" title={k}>{g}</button>)}</div>
      {label('Background')}
      {swatches((c) => apply((d) => ({ ...d, parts: { ...d.parts, background: { ...d.parts.background, fill: c } } })), () => apply((d) => ({ ...d, parts: { ...d.parts, background: { ...d.parts.background, fill: undefined } } })))}
    </>;
  }
  return (
    <div ref={box} role="menu" data-context-menu onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[10030] max-h-[80vh] overflow-y-auto rounded-xl border border-white/15 bg-[#0f1b2e]/98 py-1 text-white shadow-2xl backdrop-blur"
      style={{ left, top, width: W }}>
      {body}
    </div>
  );
}
