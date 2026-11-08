// V51.9.139 — the class keeps its pages and its parts.
import { describe, expect, it } from 'vitest';
import { evalItem, makeReel } from '../reels/motion';
import { buildDnaScenes } from './dna/builders';
import { addHistory, clearHistory, getHistory, pageTimes } from './class-history';
import { LIN_FULL_SAMPLE } from './samples/linear-system';
import type { ClassTimeline } from './interactive-player';

const reel = makeReel('T', buildDnaScenes('linear-system', LIN_FULL_SAMPLE, 'en', 'T'));
const textsAt = (t: number) => reel.parts[0].items.filter((i) => i.kind === 'text' && /^wk/.test(i.id)).map((i) => evalItem(i, t)).filter((s) => s.alpha > 0.5).map((s) => s.text).join(' ');

describe('pages of a part', () => {
  const pages = pageTimes(reel);
  it('finds a page before every clearing: the graph, each working sheet, the check, the end', () => {
    expect(pages.length).toBeGreaterThanOrEqual(4);
    expect(pages.length).toBeLessThanOrEqual(16);
    expect([...pages].sort((a, b) => a - b)).toEqual(pages);
    expect(pages[pages.length - 1]).toBeGreaterThan(reel.durationMs - 2000);
  });
  it('each working sheet is caught full, before it is cleared', () => {
    const all = pages.map(textsAt).join(' | ');
    expect(all).toContain('7x = 14'); // the elimination sheet
    expect(all).toContain('y = 3'); // the substitution sheet
    expect(all).toMatch(/6 \+ 6 = 12/); // the check
  });
});

describe('the class history', () => {
  const tl = { reel, clips: new Map(), audio: new Blob(), steps: [], segments: [] } as unknown as ClassTimeline;
  it('keeps every part once, in order, with its pages', () => {
    clearHistory();
    addHistory({ key: 's1#0', section: 's1', heading: 'A', chapter: 'C', kind: 'lecture', nth: 1, runIdx: 0, tl });
    addHistory({ key: 's1#1', section: 's1', heading: 'A', chapter: 'C', kind: 'problem', nth: 1, runIdx: 1, tl });
    addHistory({ key: 's1#1', section: 's1', heading: 'A', chapter: 'C', kind: 'problem', nth: 1, runIdx: 1, tl });
    addHistory({ key: 's2#0', section: 's2', heading: 'B', chapter: 'C', kind: 'problem', nth: 1, runIdx: 0, tl });
    expect(getHistory().map((h) => h.key)).toEqual(['s1#0', 's1#1', 's2#0']);
    expect(getHistory()[1].pages.length).toBeGreaterThanOrEqual(4);
  });
});

describe('deleting parts from the class history (V51.9.146)', () => {
  it('removes one part, or all but the part playing', async () => {
    const { addHistory, getHistory, removeHistory, clearHistory } = await import('./class-history');
    clearHistory();
    const tl = { reel: { parts: [], durationMs: 1000 } } as never;
    for (const k of ['a#0', 'a#1', 'b#0']) addHistory({ key: k, section: k[0], heading: '', chapter: '', kind: 'problem', nth: 1, runIdx: 0, tl, pages: [500] });
    removeHistory('a#1');
    expect(getHistory().map((e) => e.key)).toEqual(['a#0', 'b#0']);
    clearHistory('b#0');
    expect(getHistory().map((e) => e.key)).toEqual(['b#0']);
    clearHistory();
    expect(getHistory()).toEqual([]);
  });
});
