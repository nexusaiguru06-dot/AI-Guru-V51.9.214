'use client';

/**
 * V51.9.119 — the strip under the reel: one block per part (opener, each story shot or lesson, ending, closing
 * cards), as long as it lasts. Tap a block to jump there. Drag an added item's chip onto a block to show it only
 * there, or onto "Whole reel". In a story, drag a shot onto another to change their order.
 */
import { useState } from 'react';
import type { MotionReel } from '@/lib/ai-guru/reels/motion';
import type { DesignItem } from '@/lib/ai-guru/reels/design/layer';
import { ItemThumb } from './Panels';
import type { DesignApi } from './useDesign';

const CHIP = 'application/x-aiguru-chip';
const SHOT = 'application/x-aiguru-shot';

const GROUP_NAME: Record<string, string> = { opener: 'Opener', ending: 'Ending', 'end-card': 'End card', 'qr-card': 'QR card', reveal: 'Reveal', 'way-2': 'Second way', 'duet-ask': 'Question', story: 'Shot' };

/** A short name for each part ("Shot 2", "Lesson", "Ending" …). */
export function partLabels(reel: MotionReel | null): string[] {
  if (!reel) return [];
  let shot = 0, lesson = 0;
  return reel.parts.map((p) => {
    if (p.group === 'story' || p.group === 'explainer') return `Shot ${++shot}`;
    if (p.group?.startsWith('class:') && p.pill) return p.pill.charAt(0) + p.pill.slice(1).toLowerCase(); // a class part: Read, Teach, Mistake …
    const g = p.group ? GROUP_NAME[p.group] : undefined;
    if (g) return g;
    lesson++;
    return reel.parts.filter((q) => !q.group || !GROUP_NAME[q.group]).length > 1 ? `Lesson ${lesson}` : 'Lesson';
  });
}

export function ShotStrip({ reel, time, seek, api, onReorderShots }: { reel: MotionReel; time: number; seek: (t: number) => void; api: DesignApi; onReorderShots?: (from: number, to: number) => void }) {
  const labels = partLabels(reel);
  const starts: number[] = [];
  reel.parts.reduce((s, p) => { starts.push(s); return s + p.durationMs; }, 0);
  const total = reel.durationMs || 1;
  const [over, setOver] = useState<number | 'all' | null>(null);
  const { design, updateItem, setSel, sel } = api;
  const storyIndex = (i: number) => (reel.parts[i].group === 'story' ? reel.parts.slice(0, i).filter((p) => p.group === 'story').length : -1);

  const chip = (it: DesignItem) => (
    <button key={it.id} draggable onDragStart={(e) => { e.dataTransfer.setData(CHIP, it.id); e.dataTransfer.effectAllowed = 'move'; }}
      onClick={() => setSel({ type: 'item', id: it.id })} title="Drag onto a part to show it only there"
      className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white/90 ${sel?.type === 'item' && sel.id === it.id ? 'border-cyan-300 ring-2 ring-cyan-300' : 'border-white/30'}`}>
      <ItemThumb item={it} size={24} />
    </button>
  );
  const dropOn = (target: number | 'all') => ({
    onDragOver: (e: React.DragEvent) => { const ty = Array.from(e.dataTransfer.types); if (ty.includes(CHIP) || (typeof target === 'number' && ty.includes(SHOT) && storyIndex(target) >= 0)) { e.preventDefault(); setOver(target); } },
    onDragLeave: () => setOver((o) => (o === target ? null : o)),
    onDrop: (e: React.DragEvent) => {
      setOver(null);
      const id = e.dataTransfer.getData(CHIP);
      if (id) { e.preventDefault(); updateItem(id, { part: target === 'all' ? null : target }); return; }
      const from = e.dataTransfer.getData(SHOT);
      if (from !== '' && typeof target === 'number' && onReorderShots) { const to = storyIndex(target); if (to >= 0 && Number(from) !== to) { e.preventDefault(); onReorderShots(Number(from), to); } }
    },
  });

  return (
    <div className="w-full space-y-1.5" data-shot-strip>
      <div className="relative flex h-12 w-full overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
        {reel.parts.map((p, i) => {
          const si = storyIndex(i);
          return (
            <button key={i} {...dropOn(i)} onClick={() => seek(starts[i] + 30)}
              draggable={si >= 0 && !!onReorderShots} onDragStart={(e) => { if (si >= 0) { e.dataTransfer.setData(SHOT, String(si)); e.dataTransfer.effectAllowed = 'move'; } }}
              style={{ width: `${(p.durationMs / total) * 100}%` }} title={`${labels[i]} · ${(p.durationMs / 1000).toFixed(1)} s${si >= 0 ? ' · drag to change the order' : ''}`}
              className={`relative min-w-[18px] border-r border-white/10 px-1 text-left text-[10px] leading-tight ${over === i ? 'bg-cyan-400/30' : time >= starts[i] && time < starts[i] + p.durationMs ? 'bg-violet-500/30' : 'hover:bg-white/10'} ${si >= 0 ? 'cursor-grab' : ''}`}>
              <span className="block truncate font-semibold text-white/80">{labels[i]}</span>
              <span className="block truncate text-white/40">{(p.durationMs / 1000).toFixed(1)}s</span>
            </button>
          );
        })}
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-cyan-300" style={{ left: `${Math.min(100, (time / total) * 100)}%` }} />
      </div>
      {design.items.length > 0 && (
        <div className="space-y-1">
          <div {...dropOn('all')} className={`flex min-h-9 items-center gap-1 rounded-md border border-dashed px-1.5 py-1 ${over === 'all' ? 'border-cyan-300 bg-cyan-400/10' : 'border-white/15'}`}>
            <span className="mr-1 shrink-0 text-[10px] text-white/45">Whole reel</span>
            {design.items.filter((i) => i.part === null).map(chip)}
          </div>
          <div className="flex w-full">
            {reel.parts.map((p, i) => (
              <div key={i} {...dropOn(i)} style={{ width: `${(p.durationMs / total) * 100}%` }} className={`flex min-h-9 min-w-[18px] flex-wrap content-start gap-0.5 border-r border-dashed border-white/10 p-0.5 ${over === i ? 'bg-cyan-400/10' : ''}`}>
                {design.items.filter((it) => it.part === i).map(chip)}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-white/40">Drag a chip onto a part to show it only there, or onto “Whole reel”.</p>
        </div>
      )}
    </div>
  );
}
