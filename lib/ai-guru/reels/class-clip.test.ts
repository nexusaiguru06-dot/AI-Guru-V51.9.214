// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { passageBlocks } from '../motion-class/passage';
import { offlinePlan } from '../motion-class/plan/offline';
import { splitRuns } from '../motion-class/board-kind';
import type { BlockPlan } from '../motion-class/dna/types';
import { buildReel, voiceScript } from './motion/index';
import { buildClipScenes, cleanClip, clipCaptions, clipSegments, keptSegments, makeClip } from './class-clip';

const passage = 'There are 100 beads, black and white; 10 more black than white. Taking the number of black beads as x, the number of white is x − 10. So x + (x − 10) = 100. Solve 2x − 10 = 100.';

function clipFromClass() {
  const blocks = passageBlocks(passage, 'Mental math and algebra', 'test');
  const plans = new Map<string, BlockPlan>(blocks.map((b) => [b.id, offlinePlan(b, 'Equations', 'Mental math and algebra')]));
  const runs = splitRuns(blocks, plans);
  const r = runs[runs.length - 1];
  return makeClip({ title: 'Mental math and algebra', chapter: 'Equations', kind: r.kind, nth: 1, blocks: r.blocks, plans, subject: new Map(), languages: ['en', 'ml'] });
}

describe('class part → Reel Studio (V51.9.120)', () => {
  it('a clip keeps only its own blocks and plans, survives a file round trip', () => {
    const c = clipFromClass();
    expect(Object.keys(c.plans).every((id) => c.blocks.some((b) => b.id === id))).toBe(true);
    const back = cleanClip(JSON.stringify(c));
    expect(back.blocks).toEqual(c.blocks);
    expect(() => cleanClip('{"hello":1}')).toThrow(/not an AI Guru class file/);
  });
  it('builds the same maths again, in one language, parts can be left out', () => {
    const c = clipFromClass();
    const all = clipSegments(c);
    expect(all.length).toBeGreaterThan(1);
    const en = keptSegments(c, all);
    expect(en.every((s) => s.lang === 'en')).toBe(true);
    const reel = buildReel({ kind: 'scenes', title: c.title, build: () => buildClipScenes(c) });
    expect(reel.parts.length).toBeGreaterThan(0);
    const fewer = buildReel({ kind: 'scenes', title: c.title, build: () => buildClipScenes({ ...c, keep: [en[en.length - 1].id] }) });
    expect(fewer.durationMs).toBeLessThan(reel.durationMs);
  });
  it('changed words are said and timed; the board is unchanged', () => {
    const c = clipFromClass();
    const caps = clipCaptions(c);
    expect(caps.length).toBeGreaterThan(2);
    const target = caps[1];
    const mine = 'Now we keep both sides balanced, like a see-saw, and see what x must be.';
    const base = buildReel({ kind: 'scenes', title: c.title, build: () => buildClipScenes(c) });
    const edited = buildReel({ kind: 'scenes', title: c.title, build: () => buildClipScenes({ ...c, words: { [target]: mine } }) }, { voiceMs: (s) => (s.includes('see-saw') ? 9000 : 1500) });
    const script = voiceScript(edited);
    expect(script.some((s) => s.includes('see-saw'))).toBe(true);
    expect(script.some((s) => s === target)).toBe(false);
    // the board's written items are the same
    const texts = (r: typeof base) => r.parts.flatMap((p) => p.items.filter((i) => i.kind === 'text').map((i) => i.text));
    expect(texts(edited)).toEqual(texts(base));
    // the long new line got its own (long) voice time
    const cap = edited.parts.flatMap((p) => p.captions).find((x) => x.text === mine)!;
    expect(cap.voiceMs).toBe(9000);
  });
});
