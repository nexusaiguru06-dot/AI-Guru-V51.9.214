/**
 * V51.9.139 — the class keeps what it taught. Every part that has played (lecture or problem, in every section of
 * this visit) stays in a list, and each part keeps its PAGES: the board just before it was cleared for the next
 * page (the graph page, each working sheet, the check …). The class page shows them above the live board, so the
 * student scrolls up to see earlier pages and earlier parts — and can still download them or send them to the Reel
 * Studio. Nothing is deleted while the page is open.
 *
 * The list lives in memory for this visit (the classroom remounts the board for every section, so it is kept here,
 * outside the component).
 */
import { sceneStateAt, type MotionReel } from '../reels/motion';
import type { ClassTimeline } from './interactive-player';
import type { ClassClip } from '../reels/class-clip';

/* ---------------- pages of a part ---------------- */

/** How many text items must disappear between two steps to call it a new page. */
const LOST_FOR_NEW_PAGE = 3;
const MAX_PAGES = 16;

/**
 * The times (reel ms) at which the board is "full" just before a page change: the end of every step after which
 * several written things disappear, the end of every scene, and the end of the part. Generic: works for every DNA.
 */
export function pageTimes(reel: MotionReel): number[] {
  const out: number[] = [];
  let offset = 0;
  for (const scene of reel.parts) {
    const caps = scene.captions;
    const visibleAt = (t: number) => new Set(sceneStateAt(scene, t).filter((s) => s.kind === 'text' && s.alpha > 0.5 && s.text.trim()).map((s) => s.id));
    let prev: Set<string> | null = null;
    let prevT = -1;
    caps.forEach((c, i) => {
      const t = Math.max(c.t0, c.t1 - 80);
      const vis = visibleAt(t);
      if (prev && prevT >= 0) {
        let lost = 0;
        for (const id of prev) if (!vis.has(id)) lost++;
        if (lost >= LOST_FOR_NEW_PAGE) out.push(offset + prevT);
      }
      prev = vis;
      prevT = t;
      if (i === caps.length - 1) out.push(offset + t);
    });
    if (!caps.length && scene.durationMs > 0) out.push(offset + scene.durationMs - 80);
    offset += scene.durationMs;
  }
  const uniq = [...new Set(out.map((t) => Math.round(t)))].sort((a, b) => a - b);
  if (uniq.length <= MAX_PAGES) return uniq;
  // keep the last page and an even spread of the rest
  const step = (uniq.length - 1) / (MAX_PAGES - 1);
  return Array.from({ length: MAX_PAGES }, (_, i) => uniq[Math.round(i * step)]);
}

/* ---------------- the list of parts taught in this visit ---------------- */

export interface HistoryEntry {
  /** Section + run: unique for this visit. */
  key: string;
  /** The section (board instance) the part belongs to. */
  section: string;
  heading: string;
  chapter: string;
  kind: 'lecture' | 'problem';
  nth: number;
  /** The run's index in its section (to replay it while that section is on screen). */
  runIdx: number;
  tl: ClassTimeline;
  clip?: ClassClip;
  pages: number[];
  addedAt: number;
}

const MAX_ENTRIES = 60;
let entries: HistoryEntry[] = [];
const listeners = new Set<() => void>();

export function addHistory(e: Omit<HistoryEntry, 'pages' | 'addedAt'> & { pages?: number[] }): void {
  if (entries.some((x) => x.key === e.key)) return;
  let pages = e.pages;
  if (!pages) {
    try { pages = pageTimes(e.tl.reel); } catch { pages = [Math.max(0, e.tl.reel.durationMs - 80)]; }
  }
  entries = [...entries, { ...e, pages, addedAt: Date.now() }].slice(-MAX_ENTRIES);
  listeners.forEach((f) => f());
}
export const getHistory = (): HistoryEntry[] => entries;
export function subscribeHistory(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}
/** V51.9.146: the student deletes one part from the history. */
export function removeHistory(key: string): void {
  const before = entries.length;
  entries = entries.filter((e) => e.key !== key);
  if (entries.length !== before) listeners.forEach((f) => f());
}
/** Deletes every part (the student's "Delete all"; also used by tests). Keeps the part named in `keep` (the one playing). */
export function clearHistory(keep?: string): void {
  entries = keep ? entries.filter((e) => e.key === keep) : [];
  listeners.forEach((f) => f());
}
