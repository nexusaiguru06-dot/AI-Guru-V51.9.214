'use client';

/**
 * V51.9.119 — the Reel designer's panels: "Add" (drag a tile onto the reel, or tap it) and "Selected" (colours,
 * size, font, words, when it shows, how it arrives).
 */
import { useEffect, useRef, useState } from 'react';
import { CAST_KINDS, KIND_NAME, PROP_NAME, PROPS } from '@/lib/ai-guru/reels/motion/recipes/story';
import { CARD_FONTS, FONT_NAME } from '@/lib/ai-guru/reels/motion/look';
import { loadFontKind } from '@/lib/ai-guru/reels/motion/fonts';
import { ENTRANCE_NAME, ENTRANCES, newItem, PART_NAME, STICKERS, SWATCHES, type DesignItem, type ItemKind, type PartId, type ShapeKind } from '@/lib/ai-guru/reels/design/layer';
import { drawDesignItems } from '@/lib/ai-guru/reels/design/draw-design';
import type { DesignApi } from './useDesign';

export const DRAG_TYPE = 'application/x-aiguru-design';
const tile = 'flex h-14 w-14 cursor-grab items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] hover:border-cyan-300/60 hover:bg-white/10 active:cursor-grabbing';
const btn = 'rounded-lg border border-white/15 px-2.5 py-1 text-xs hover:bg-white/10 disabled:opacity-40';
const SHAPES: ShapeKind[] = ['round', 'rect', 'circle', 'arrow', 'star', 'heart'];

/** A small picture of an item (drawn by the same code as the reel). */
export function ItemThumb({ item, size = 44 }: { item: DesignItem; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = 2;
    c.width = size * dpr; c.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    // fit: the item drawn in a "frame" `size` wide
    const it = { ...item, cx: 0.5, cy: 0.5, rot: 0, entrance: 'none' as const, part: null, size: item.kind === 'text' ? 0.2 * Math.min(1, 7 / Math.max(1, (item.text ?? '').length)) : 0.8 };
    drawDesignItems(ctx, { parts: {}, items: [it] }, size, size, 0, 1e6, 1e6);
  }, [item, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}

/** Shrinks a photo to a small JPEG (kept with the design on this device). */
async function smallPhoto(f: File): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const im = new Image(); im.src = url; await im.decode();
    const s = Math.min(1, 640 / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
    c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

export function AddPanel({ onAdd, partHere }: { onAdd: (it: DesignItem) => void; partHere: number }) {
  const [onlyHere, setOnlyHere] = useState(false);
  const [tab, setTab] = useState<'text' | 'stickers' | 'shapes' | 'people' | 'things'>('text');
  const file = useRef<HTMLInputElement>(null);
  const make = (kind: ItemKind, o: Partial<DesignItem>) => newItem(kind, { ...o, part: onlyHere ? partHere : null });
  const drag = (kind: ItemKind, o: Partial<DesignItem>) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ kind, o: { ...o, part: onlyHere ? partHere : null } })); e.dataTransfer.effectAllowed = 'copy'; },
    onClick: () => onAdd(make(kind, o)),
  });
  const TEXTS: Array<[string, Partial<DesignItem>]> = [
    ['Heading', { text: 'Big idea!', size: 0.075, bold: true, bg: '#facc15', color: '#111827', font: 'bubbly' }],
    ['Label', { text: 'Remember this', size: 0.05, bold: true, bg: '#111827', color: '#ffffff', font: 'rounded' }],
    ['Plain', { text: 'Your words', size: 0.055, bold: false, bg: '', color: '#111827', font: 'hand' }],
    ['Malayalam', { text: 'ഓർക്കുക!', size: 0.06, bold: true, bg: '#22c55e', color: '#ffffff', font: 'rounded' }],
  ];
  const tabs: Array<[typeof tab, string]> = [['text', 'Text'], ['stickers', 'Stickers'], ['shapes', 'Shapes'], ['people', 'Characters'], ['things', 'Things']];
  return (
    <div className="space-y-2" data-add-panel>
      <div className="flex flex-wrap gap-1">{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`rounded-md px-2 py-1 text-[11px] font-semibold ${tab === k ? 'bg-cyan-400 text-[#04121f]' : 'bg-white/[0.06] text-white/70'}`}>{l}</button>)}</div>
      <p className="text-[10px] text-white/45">Drag onto the reel, or tap.</p>
      <div className="flex max-h-72 flex-wrap gap-1.5 overflow-y-auto">
        {tab === 'text' && TEXTS.map(([label, o]) => <div key={label} title={label} className={`${tile} w-auto bg-white/85 px-1 hover:bg-white`} {...drag('text', o)}><ItemThumb item={newItem('text', o)} size={52} /></div>)}
        {tab === 'stickers' && STICKERS.map((e) => <div key={e} className={tile} title="Sticker" {...drag('sticker', { emoji: e })}><span className="text-2xl">{e}</span></div>)}
        {tab === 'shapes' && SHAPES.map((s) => <div key={s} className={tile} title={s} {...drag('shape', { shape: s, color: s === 'heart' ? '#ef4444' : s === 'star' ? '#facc15' : '#3b82f6' })}><ItemThumb item={newItem('shape', { shape: s, color: s === 'heart' ? '#ef4444' : s === 'star' ? '#facc15' : '#3b82f6' })} /></div>)}
        {tab === 'people' && CAST_KINDS.map((c) => <div key={c} className={tile} title={KIND_NAME[c]} {...drag('character', { cast: c, id: undefined })}><ItemThumb item={newItem('character', { cast: c, id: `thumb-${c}` })} /></div>)}
        {tab === 'things' && <>
          {PROPS.map((p) => <div key={p} className={tile} title={PROP_NAME[p]} {...drag('prop', { prop: p })}><ItemThumb item={newItem('prop', { prop: p })} /></div>)}
          <button className={`${tile} text-[10px] text-white/70`} onClick={() => file.current?.click()} title="A photo from this device">📷<br />Photo</button>
          <input ref={file} type="file" accept="image/*" className="hidden" aria-label="Photo for the reel" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onAdd(make('photo', { src: await smallPhoto(f), color: '#ffffff' })); }} />
        </>}
      </div>
      <label className="flex items-center gap-1.5 text-[11px] text-white/60"><input type="checkbox" checked={onlyHere} onChange={(e) => setOnlyHere(e.target.checked)} />Only in this part (part {partHere + 1})</label>
    </div>
  );
}

function Swatches({ value, onPick, none }: { value?: string; onPick: (c: string) => void; none?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {none && <button onClick={() => onPick('')} title="None" className={`h-6 w-6 rounded-full border text-[10px] ${!value ? 'border-cyan-300' : 'border-white/20'}`}>∅</button>}
      {SWATCHES.map((c) => <button key={c} onClick={() => onPick(c)} title={c} aria-label={`Colour ${c}`} className={`h-6 w-6 rounded-full border-2 ${value?.toLowerCase() === c ? 'border-cyan-300' : 'border-white/20'}`} style={{ background: c }} />)}
      <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border-2 border-white/20" title="Any colour" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}>
        <input type="color" value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Any colour" />
      </label>
    </div>
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-2"><span className="w-20 shrink-0 text-[11px] text-white/50">{label}</span><div className="min-w-0 flex-1">{children}</div></div>
);

export function PropsPanel({ api, partLabels, textRef }: { api: DesignApi; partLabels: string[]; textRef: React.RefObject<HTMLTextAreaElement | null> }) {
  const { sel, selectedItem: it, updateItem, removeItem, apply, design, addItem } = api;
  const [sure, setSure] = useState(false);
  if (!sel) {
    return (
      <div className="space-y-2 text-xs text-white/55" data-props-panel>
        <p>Tap anything on the reel — the title, the board, the caption, the footer or what you added — to move it, resize it or change its colour.</p>
        <Row label="Background"><Swatches value={design.parts.background?.fill} none onPick={(c) => apply((d) => ({ ...d, parts: { ...d.parts, background: { ...d.parts.background, fill: c || undefined } } }), 'bg')} /></Row>
        <button className={btn} onClick={() => { if (!sure) { setSure(true); setTimeout(() => setSure(false), 3000); return; } setSure(false); apply({ parts: {}, items: [] }); }}>{sure ? 'Sure? Tap again to clear' : '↺ Clear my design'}</button>
      </div>
    );
  }
  if (sel.type === 'part') {
    const id: PartId = sel.id;
    const o = design.parts[id] ?? {};
    const set = (patch: Partial<typeof o>, key?: string) => apply((d) => ({ ...d, parts: { ...d.parts, [id]: { ...d.parts[id], ...patch } } }), key);
    return (
      <div className="space-y-2" data-props-panel>
        <p className="text-sm font-bold">{PART_NAME[id]}</p>
        {id !== 'board' && <Row label={id === 'footer' ? 'Text' : 'Card colour'}>{id === 'footer' ? <Swatches value={o.text} onPick={(c) => set({ text: c }, 'text')} /> : <Swatches value={o.fill} none onPick={(c) => set({ fill: c || undefined }, 'fill')} />}</Row>}
        {id !== 'board' && id !== 'footer' && <Row label="Text colour"><Swatches value={o.text} none onPick={(c) => set({ text: c || undefined }, 'text')} /></Row>}
        {id === 'board' && <Row label="Background"><Swatches value={design.parts.background?.fill} none onPick={(c) => apply((d) => ({ ...d, parts: { ...d.parts, background: { ...d.parts.background, fill: c || undefined } } }), 'bg')} /></Row>}
        <Row label="Size"><input type="range" min={0.5} max={1.6} step={0.01} value={o.scale ?? 1} onChange={(e) => set({ scale: Number(e.target.value) }, 'scale')} className="w-full" aria-label="Size" /></Row>
        <div className="flex flex-wrap gap-1.5">
          <button className={btn} onClick={() => set({ hidden: !o.hidden })}>{o.hidden ? '👁 Show it' : '🙈 Hide it'}</button>
          <button className={btn} onClick={() => apply((d) => { const parts = { ...d.parts }; delete parts[id]; return { ...d, parts }; })}>↺ As it was</button>
        </div>
      </div>
    );
  }
  if (!it) return null;
  const up = (patch: Partial<DesignItem>, key?: string) => updateItem(it.id, patch, key);
  const move = (dir: 1 | -1) => apply((d) => { const i = d.items.findIndex((x) => x.id === it.id); const j = i + dir; if (i < 0 || j < 0 || j >= d.items.length) return d; const items = [...d.items]; [items[i], items[j]] = [items[j], items[i]]; return { ...d, items }; });
  return (
    <div className="space-y-2" data-props-panel>
      <p className="text-sm font-bold">{it.kind === 'text' ? 'Text' : it.kind === 'sticker' ? 'Sticker' : it.kind === 'shape' ? 'Shape' : it.kind === 'character' ? KIND_NAME[it.cast ?? 'girl'] : it.kind === 'prop' ? PROP_NAME[it.prop ?? 'book'] : 'Photo'}</p>
      {it.kind === 'text' && <>
        <textarea ref={textRef} value={it.text ?? ''} onChange={(e) => up({ text: e.target.value }, 'words')} rows={2} className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm outline-none focus:border-violet-400" aria-label="Words" />
        <Row label="Font">
          <div className="flex gap-1.5">
            <select value={it.font ?? 'rounded'} onChange={(e) => { const f = e.target.value as (typeof CARD_FONTS)[number]; void loadFontKind(f).then(() => up({ font: f })); }} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b1626] px-2 py-1 text-xs" aria-label="Font">
              {CARD_FONTS.map((f) => <option key={f} value={f}>{FONT_NAME[f]}</option>)}
            </select>
            <button className={`${btn} ${it.bold ? 'border-cyan-300 bg-cyan-400/20' : ''}`} onClick={() => up({ bold: !it.bold })} aria-pressed={!!it.bold}><b>B</b></button>
          </div>
        </Row>
        <Row label="Text colour"><Swatches value={it.color} onPick={(c) => up({ color: c }, 'color')} /></Row>
        <Row label="Behind it"><Swatches value={it.bg} none onPick={(c) => up({ bg: c }, 'bg')} /></Row>
      </>}
      {(it.kind === 'shape' || it.kind === 'photo') && <Row label={it.kind === 'photo' ? 'Border' : 'Colour'}><Swatches value={it.color} onPick={(c) => up({ color: c }, 'color')} /></Row>}
      {it.kind === 'shape' && <Row label="Shape"><div className="flex flex-wrap gap-1">{SHAPES.map((s) => <button key={s} className={`${btn} ${it.shape === s ? 'border-cyan-300' : ''}`} onClick={() => up({ shape: s })}>{s}</button>)}</div></Row>}
      {it.kind === 'sticker' && <div className="flex flex-wrap gap-1">{STICKERS.map((e) => <button key={e} onClick={() => up({ emoji: e })} className={`rounded-md px-1 text-lg ${it.emoji === e ? 'bg-cyan-400/30' : ''}`}>{e}</button>)}</div>}
      {it.kind === 'character' && <Row label="Who"><select value={it.cast} onChange={(e) => up({ cast: e.target.value as DesignItem['cast'] })} className="w-full rounded-lg border border-white/10 bg-[#0b1626] px-2 py-1 text-xs" aria-label="Character">{CAST_KINDS.map((c) => <option key={c} value={c}>{KIND_NAME[c]}</option>)}</select></Row>}
      {it.kind === 'prop' && <Row label="Thing"><select value={it.prop} onChange={(e) => up({ prop: e.target.value as DesignItem['prop'] })} className="w-full rounded-lg border border-white/10 bg-[#0b1626] px-2 py-1 text-xs" aria-label="Thing">{PROPS.map((p) => <option key={p} value={p}>{PROP_NAME[p]}</option>)}</select></Row>}
      {it.kind === 'photo' && <label className="flex items-center gap-1.5 text-xs text-white/70"><input type="checkbox" checked={!!it.round} onChange={(e) => up({ round: e.target.checked })} />Round</label>}
      <Row label="Size"><input type="range" min={0.02} max={it.kind === 'text' ? 0.2 : 1} step={0.005} value={it.size} onChange={(e) => up({ size: Number(e.target.value) }, 'size')} className="w-full" aria-label="Size" /></Row>
      <Row label="Turn"><input type="range" min={-180} max={180} step={1} value={it.rot} onChange={(e) => up({ rot: Number(e.target.value) }, 'rot')} className="w-full" aria-label="Turn" /></Row>
      <Row label="See-through"><input type="range" min={0.1} max={1} step={0.05} value={it.opacity} onChange={(e) => up({ opacity: Number(e.target.value) }, 'opacity')} className="w-full" aria-label="Opacity" /></Row>
      <Row label="Shows">
        <select value={it.part === null ? 'all' : String(it.part)} onChange={(e) => up({ part: e.target.value === 'all' ? null : Number(e.target.value) })} className="w-full rounded-lg border border-white/10 bg-[#0b1626] px-2 py-1 text-xs" aria-label="When it shows">
          <option value="all">The whole reel</option>
          {partLabels.map((l, i) => <option key={i} value={i}>Only in {l}</option>)}
        </select>
      </Row>
      <Row label="Arrives"><select value={it.entrance} onChange={(e) => up({ entrance: e.target.value as DesignItem['entrance'] })} className="w-full rounded-lg border border-white/10 bg-[#0b1626] px-2 py-1 text-xs" aria-label="Animation">{ENTRANCES.map((x) => <option key={x} value={x}>{ENTRANCE_NAME[x]}</option>)}</select></Row>
      <div className="flex flex-wrap gap-1.5">
        <button className={btn} onClick={() => move(1)} title="In front of the others">⬆ Front</button>
        <button className={btn} onClick={() => move(-1)} title="Behind the others">⬇ Back</button>
        <button className={btn} onClick={() => addItem({ ...it, id: newItem(it.kind).id, cx: it.cx + 0.04, cy: it.cy + 0.03 })} title="Ctrl+D">⧉ Copy</button>
        <button className={`${btn} border-rose-400/40 text-rose-200`} onClick={() => removeItem(it.id)} title="Delete key">🗑 Delete</button>
      </div>
    </div>
  );
}
