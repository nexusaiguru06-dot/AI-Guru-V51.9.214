/**
 * Render a compiled class to one MP4 per segment plus a review page a teacher can open (V51.9.46).
 *
 *   npx tsx scripts/ai-guru-render-review.ts --plans class.json --out review/ [--format vertical|landscape|square]
 *        [--theme light|dark] [--langs en,ml] [--fps 24]
 *   npx tsx scripts/ai-guru-render-review.ts --apply review/review.json --out review/ [--plans class.json]
 *
 * class.json = { "title": "...", "blocks": [BookBlock…], "plans": [BlockPlan…] }.
 * Needs ffmpeg on the PATH and @napi-rs/canvas (npm i -D @napi-rs/canvas). Timing: the videos use the
 * estimated speaking time of every sentence, since no voice is synthesised here; the app's player
 * measures the real clips. Malayalam text needs a Malayalam font installed on this machine.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { FONT } from '../lib/ai-guru/reels/motion/grammar';
import { setMeasurer } from '../lib/ai-guru/reels/motion/metrics';
import { drawReelFrame, FORMAT_SIZE, type ReelFormat } from '../lib/ai-guru/reels/motion/draw';
import { estimateSpeechMs } from '../lib/ai-guru/reels/motion/speech';
import { compileClass, segmentReel } from '../lib/ai-guru/motion-class/class';
import { applyReview, buildManifest, estimatedClipMs, reviewNotes, reviewSummary, staleItems, type ManifestInput, type ReviewManifest } from '../lib/ai-guru/motion-class/review';
import { reviewHtml } from '../lib/ai-guru/motion-class/review-html';
import type { BlockPlan } from '../lib/ai-guru/motion-class/dna/types';
import type { BookBlock } from '../lib/ai-guru/motion-class/segment';

function args() {
  const a: Record<string, string> = {};
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) if (v[i].startsWith('--')) a[v[i].slice(2)] = v[i + 1] && !v[i + 1].startsWith('--') ? v[++i] : '1';
  return a;
}

function loadClass(file: string): { title: string; blocks: BookBlock[]; plans: Map<string, BlockPlan> } {
  const j = JSON.parse(fs.readFileSync(file, 'utf8')) as { title?: string; blocks: BookBlock[]; plans: BlockPlan[] };
  return { title: j.title ?? 'Class', blocks: j.blocks, plans: new Map(j.plans.map((p) => [p.blockId, p])) };
}

async function render() {
  const a = args();
  if (!a.plans || !a.out) throw new Error('usage: --plans class.json --out review/ (see the header of this file)');
  const canvasMod = await import('@napi-rs/canvas').catch(() => {
    throw new Error('Install the canvas package first: npm i -D @napi-rs/canvas');
  });
  if (spawnSync('ffmpeg', ['-version']).status !== 0) throw new Error('ffmpeg was not found on the PATH.');
  const { createCanvas } = canvasMod;
  const c0 = createCanvas(10, 10).getContext('2d');
  setMeasurer((text, px, weight = '400') => {
    c0.font = `${weight} ${px}px ${FONT.math}`;
    return c0.measureText(text).width;
  });
  const format = (a.format ?? 'vertical') as ReelFormat;
  const theme = (a.theme ?? 'light') as 'light' | 'dark';
  const fps = Number(a.fps ?? 24);
  const langs = (a.langs ?? 'en,ml').split(',') as Array<'en' | 'ml'>;
  const { title, blocks, plans } = loadClass(a.plans);
  const segs = compileClass(blocks, plans, { title }, { languages: langs });
  fs.mkdirSync(path.join(a.out, 'videos'), { recursive: true });
  const sz = FORMAT_SIZE[format];
  const inputs: ManifestInput[] = [];
  for (const seg of segs) {
    const reel = segmentReel(seg, estimatedClipMs(seg.lang, estimateSpeechMs));
    const name = `${seg.id.replace(/[^a-z0-9]+/gi, '_')}.mp4`;
    const tmp = fs.mkdtempSync(path.join(a.out, 'frames-'));
    const durationMs = reel.durationMs;
    const frames = Math.ceil((durationMs / 1000) * fps);
    const cv = createCanvas(sz.width, sz.height);
    for (let i = 0; i < frames; i++) {
      drawReelFrame(cv.getContext('2d') as never, reel, (i / fps) * 1000, { format, theme, stepLabel: reel.parts[0]?.pill ?? 'STEP' } as never);
      fs.writeFileSync(path.join(tmp, `f${String(i).padStart(6, '0')}.jpg`), cv.toBuffer('image/jpeg', 90));
    }
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(tmp, 'f%06d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(a.out, 'videos', name)]);
    fs.rmSync(tmp, { recursive: true, force: true });
    if (r.status !== 0) throw new Error(`ffmpeg failed for ${seg.id}: ${r.stderr}`);
    inputs.push({ segment: seg, durationMs, file: `videos/${name}`, timing: 'estimate' });
    console.log(`rendered ${seg.label} (${seg.dna}) ${Math.round(durationMs / 1000)}s`);
  }
  const manifest = buildManifest(title, inputs, plans);
  fs.writeFileSync(path.join(a.out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(a.out, 'review.html'), reviewHtml(manifest));
  console.log(`\n${manifest.items.length} videos. Open ${path.join(a.out, 'review.html')} in a browser.`);
}

function apply() {
  const a = args();
  const file = path.join(a.out ?? '.', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as ReviewManifest;
  const rv = JSON.parse(fs.readFileSync(a.apply, 'utf8')) as { reviewer?: string; decisions: Array<{ segmentId: string; status: 'pending' | 'approved' | 'changes'; comment?: string }> };
  const { manifest: next, rejected } = applyReview(manifest, rv.decisions, rv.reviewer);
  fs.writeFileSync(file, JSON.stringify(next, null, 2));
  fs.writeFileSync(path.join(a.out ?? '.', 'review.html'), reviewHtml(next));
  const plans = a.plans ? loadClass(a.plans).plans : undefined;
  const s = reviewSummary(next, plans);
  console.log(`approved ${s.approved}/${s.total}, need changes ${s.changes}, to watch ${s.pending}${plans ? `, stale ${s.stale}` : ''}`);
  if (plans) for (const it of staleItems(next, plans)) console.log(`STALE (plan changed since it was reviewed): ${it.label} — ${it.segmentId}`);
  for (const r of rejected) console.log(`not applied: ${r}`);
  for (const n of reviewNotes(next)) console.log(`CHANGE: ${n}`);
  console.log(s.ready ? 'READY: every video is approved.' : 'Not ready yet.');
  process.exitCode = s.ready ? 0 : 1;
}

if (process.argv.includes('--apply')) apply();
else render().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(2);
});
