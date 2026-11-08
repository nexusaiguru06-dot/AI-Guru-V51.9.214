/** V51.9.110 — each step's caption written small beside the line it wrote (interactive class, problem board). */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, GlobalFonts, type Canvas } from '@napi-rs/canvas';
import { BRANCH_EXAMPLES, buildReel, drawReelFrame } from './index';
import { setMeasurer } from './metrics';
import { FONT } from './grammar';
import { stepButtonsOf, stepNoteItems } from './draw';

const OUT = process.env.STEP_NOTES_PNG; // set to save pictures for a look
beforeAll(() => {
  const dir = path.join(process.cwd(), 'public', 'fonts', 'reel');
  GlobalFonts.registerFromPath(path.join(dir, 'NotoSerif_400Regular.ttf'), 'AIGuruSerif');
  GlobalFonts.registerFromPath(path.join(dir, 'NotoSansMalayalam_400Regular.ttf'), 'AIGuruMalayalam');
  const m = createCanvas(10, 10).getContext('2d');
  setMeasurer((text, px, weight = '400') => { m.font = `${weight} ${px}px ${FONT.math}`; return m.measureText(text).width; });
});

describe('step notes', () => {
  const ex = BRANCH_EXAMPLES.find((e) => e.id === 'linear-equation') ?? BRANCH_EXAMPLES[0];
  it('finds, for the steps that write a line, the items of that line', () => {
    const reel = buildReel({ kind: 'branch', id: ex.id });
    const scene = reel.parts[reel.parts.length - 1];
    const groups = stepNoteItems(scene);
    expect(groups.length).toBe(scene.captions.length);
    expect(groups.filter((g) => g.length).length).toBeGreaterThan(1);
    expect(stepNoteItems(scene)).toBe(groups); // cached
  });
  it('draws the notes only when asked, on the right of the lines', () => {
    const reel = buildReel({ kind: 'branch', id: ex.id });
    const at = reel.durationMs - 300;
    const shot = (notes: boolean, buttons = false) => {
      const c = createCanvas(1280, 720);
      drawReelFrame(c.getContext('2d') as unknown as CanvasRenderingContext2D, reel, at, { format: 'landscape', stepNotes: notes, stepButtons: buttons, stepPaused: true });
      if (OUT) fs.writeFileSync(`${OUT}-${buttons ? 'buttons' : notes ? 'on' : 'off'}.png`, c.toBuffer('image/png'));
      return c;
    };
    const on = shot(true), off = shot(false);
    const px = (c: Canvas) => c.getContext('2d').getImageData(0, 0, 1280, 720).data;
    const a = px(on), b = px(off);
    let diffLeft = 0, diffRight = 0;
    for (let y = 0; y < 720; y++) for (let x = 0; x < 1280; x++) { const i = (y * 1280 + x) * 4; if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) { if (x < 640) diffLeft++; else diffRight++; } }
    expect(diffRight).toBeGreaterThan(200); // the notes are on the right side
    expect(diffRight).toBeGreaterThan(diffLeft * 3);
  });
  it('V51.9.111: small # ✓ ^ ⟲ buttons after each line, in a row, with the times they jump to', () => {
    const reel = buildReel({ kind: 'branch', id: ex.id });
    const c = createCanvas(1280, 720);
    drawReelFrame(c.getContext('2d') as unknown as CanvasRenderingContext2D, reel, reel.durationMs - 300, { format: 'landscape', stepNotes: true, stepButtons: true, stepPaused: true });
    if (OUT) fs.writeFileSync(`${OUT}-buttons.png`, c.toBuffer('image/png'));
    const b = stepButtonsOf(c);
    expect(b.length % 4).toBe(0);
    expect(b.length / 4).toBeGreaterThanOrEqual(3); // several lines carry buttons
    const rows = new Map<number, typeof b>();
    for (const x of b) rows.set(Math.round(x.y), [...(rows.get(Math.round(x.y)) ?? []), x]);
    for (const r of rows.values()) {
      expect(r.map((x) => x.action)).toEqual(['pause', 'go', 'up', 'restart']); // horizontal, in this order
      expect(r[1].x).toBeGreaterThan(r[0].x + r[0].w - 1);
      expect(r[0].w).toBeLessThan(40); // small
      expect(r[0].x).toBeGreaterThan(560); // right of the working
    }
    expect(b.filter((x) => x.current).length).toBe(4); // one row is the step now
    expect(b.every((x) => x.prevMs <= x.stepMs)).toBe(true);
    // without the option nothing is recorded
    const c2 = createCanvas(1280, 720);
    drawReelFrame(c2.getContext('2d') as unknown as CanvasRenderingContext2D, reel, reel.durationMs - 300, { format: 'landscape', stepNotes: true });
    expect(stepButtonsOf(c2)).toEqual([]);
  });
});
