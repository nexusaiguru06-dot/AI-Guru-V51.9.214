import { describe, expect, it } from 'vitest';
import { estimateSpeechMs } from '../reels/motion/speech';
import { compileClass, segmentReel } from './class';
import { applyReview, buildManifest, estimatedClipMs, planFingerprint, reviewNotes, reviewSummary, stableJson, staleItems, type ManifestInput } from './review';
import { reviewHtml } from './review-html';
import type { BlockPlan, ChainPlan } from './dna/types';
import type { BookBlock } from './segment';

const B = (en: string) => ({ en, ml: `മല ${en}` });
const blk = (id: string): BookBlock => ({ id, kind: 'math', page: 1, chapterId: 'c', sectionId: 's', lines: [{ text: 'x + 2 = 5', math: true } as BookBlock['lines'][number]], text: 'x + 2 = 5' });
const chain = (cap: string): ChainPlan => ({ lines: [{ tokens: ['x', '+', '2', '=', '5'], caption: B('Start here. This is a longer sentence so the voice takes a while to say it.') }, { tokens: ['x', '=', '3'], caption: B(cap) }] });
const plan = (id: string, cap = 'So x is three.'): BlockPlan => ({ blockId: id, dna: 'equation-chain', read: B('x + 2 = 5'), teach: chain(cap), source: 'ai' });

function setup(cap?: string) {
  const blocks = [blk('b1'), blk('b2')];
  const plans = new Map<string, BlockPlan>([['b1', plan('b1', cap)], ['b2', plan('b2')]]);
  const segs = compileClass(blocks, plans, { title: 'T' }, { languages: ['en'] });
  const inputs: ManifestInput[] = segs.map((s) => ({ segment: s, durationMs: 5000, file: `videos/${s.id}.mp4`, timing: 'estimate' }));
  return { plans, segs, manifest: buildManifest('T', inputs, plans, new Date('2026-01-01T00:00:00Z')) };
}

describe('plan fingerprint', () => {
  it('is stable under key order and ignores who planned it', () => {
    const a = plan('b1');
    const b = { ...plan('b1'), source: 'offline' as const, warnings: ['x'] };
    expect(planFingerprint(a)).toBe(planFingerprint(b));
    expect(stableJson({ b: 1, a: [2, { d: 1, c: undefined }] })).toBe('{"a":[2,{"d":1}],"b":1}');
  });
  it('changes when the words, the picture or the arc change', () => {
    const f = planFingerprint(plan('b1'));
    expect(planFingerprint(plan('b1', 'So x is 3.'))).not.toBe(f);
    expect(planFingerprint({ ...plan('b1'), arc: { summary: B('Done.') } })).not.toBe(f);
    expect(planFingerprint({ ...plan('b1'), dna: 'mental-math' })).not.toBe(f);
  });
});

describe('review manifest', () => {
  it('has one pending item per segment, with the plan fingerprint', () => {
    const { manifest, segs } = setup();
    expect(manifest.items).toHaveLength(segs.length);
    expect(manifest.items.every((i) => i.status === 'pending' && i.fingerprint.length === 16)).toBe(true);
    expect(reviewSummary(manifest).ready).toBe(false);
  });
  it('applies decisions, demands a comment for "needs changes", and ignores unknown segments', () => {
    const { manifest } = setup();
    const [a, b, c] = manifest.items;
    const r = applyReview(manifest, [
      { segmentId: a.segmentId, status: 'approved' },
      { segmentId: b.segmentId, status: 'changes' },
      { segmentId: c.segmentId, status: 'changes', comment: '  Slow down at step 2.  ' },
      { segmentId: 'nope', status: 'approved' },
      { segmentId: manifest.items[3].segmentId, status: 'maybe' as never },
    ], 'Teacher', new Date('2026-01-02T00:00:00Z'));
    expect(r.manifest.items[0]).toMatchObject({ status: 'approved', reviewer: 'Teacher', decidedAt: '2026-01-02T00:00:00.000Z' });
    expect(r.manifest.items[1].status).toBe('pending');
    expect(r.manifest.items[2]).toMatchObject({ status: 'changes', comment: 'Slow down at step 2.' });
    expect(r.rejected.join(' ')).toMatch(/say what needs to change/);
    expect(r.rejected.join(' ')).toMatch(/not in this class/);
    expect(r.rejected.join(' ')).toMatch(/unknown status/);
    expect(reviewNotes(r.manifest)).toHaveLength(1);
    expect(manifest.items[0].status).toBe('pending'); // the input is untouched
  });
  it('"pending" withdraws a decision', () => {
    const { manifest } = setup();
    const ok = applyReview(manifest, [{ segmentId: manifest.items[0].segmentId, status: 'approved' }], 'T').manifest;
    const back = applyReview(ok, [{ segmentId: manifest.items[0].segmentId, status: 'pending' }]).manifest;
    expect(back.items[0]).not.toHaveProperty('reviewer');
    expect(back.items[0].status).toBe('pending');
  });
  it('is ready only when every video is approved and none is stale', () => {
    const { manifest, plans } = setup();
    const all = applyReview(manifest, manifest.items.map((i) => ({ segmentId: i.segmentId, status: 'approved' as const })), 'T').manifest;
    expect(reviewSummary(all, plans)).toMatchObject({ approved: manifest.items.length, ready: true, stale: 0 });
    const edited = new Map(plans);
    edited.set('b1', plan('b1', 'So x is 3!'));
    const s = reviewSummary(all, edited);
    expect(s.ready).toBe(false);
    expect(s.stale).toBe(manifest.items.filter((i) => i.blockId === 'b1').length);
    expect(staleItems(all, edited).every((i) => i.blockId === 'b1')).toBe(true);
    const gone = new Map(plans);
    gone.delete('b2');
    expect(staleItems(all, gone).some((i) => i.blockId === 'b2')).toBe(true);
    expect(reviewSummary({ ...all, items: [] }).ready).toBe(false);
  });
});

describe('voice-measured timing', () => {
  const spoken = (cap: string) => {
    const { segs } = setup(cap);
    const seg = segs.find((s) => s.phase === 'teach')!;
    return { seg, clips: [] as string[] };
  };
  it('a step lasts at least as long as its voice clip, and the next step waits for it', () => {
    const { seg } = spoken('So x is three.');
    const slow = segmentReel(seg, () => 9000);
    const fast = segmentReel(seg, () => 300);
    const none = segmentReel(seg);
    const total = (r: ReturnType<typeof segmentReel>) => r.parts.reduce((a, p) => a + p.durationMs, 0);
    expect(total(slow)).toBeGreaterThan(total(fast));
    expect(total(slow)).toBeGreaterThan(total(none));
    const cap = slow.parts[0].captions;
    for (const c of cap) if (c.voiceMs) expect(c.t1 - c.t0).toBeGreaterThanOrEqual(c.voiceMs);
    for (let i = 1; i < cap.length; i++) if (cap[i - 1].voiceMs && cap[i - 1].voiceT0 !== undefined) expect(cap[i].t0).toBeGreaterThanOrEqual(cap[i - 1].voiceT0! + cap[i - 1].voiceMs!);
  });
  it('estimated clip lengths grow with the sentence and are slower in Malayalam', () => {
    const en = estimatedClipMs('en', (t, l) => estimateSpeechMs(t, l));
    const ml = estimatedClipMs('ml', (t, l) => estimateSpeechMs(t, l));
    expect(en('Short.')!).toBeLessThan(en('A much longer sentence that takes real time to say aloud.')!);
    expect(ml('abcdefghij abcdefghij')!).toBeGreaterThan(en('abcdefghij abcdefghij')!);
    expect(en('   ')).toBeUndefined();
  });
  it('estimated timing makes long sentences last longer than the fixed minimum', () => {
    const { seg } = spoken('A very long closing sentence, which has many words, so that the voice needs plenty of time to read it all aloud to the class.');
    const est = segmentReel(seg, estimatedClipMs('en', (t, l) => estimateSpeechMs(t, l)));
    const fixed = segmentReel(seg);
    expect(est.parts.reduce((a, p) => a + p.durationMs, 0)).toBeGreaterThan(fixed.parts.reduce((a, p) => a + p.durationMs, 0));
  });
});

describe('review page', () => {
  it('is self-contained, lists every video and cannot be broken out of by plan text', () => {
    const { manifest } = setup();
    const evil = { ...manifest, title: '</script><script>alert(1)</script>' };
    const html = reviewHtml(evil);
    expect(html).not.toMatch(/<\/script><script>alert/);
    expect(html).toContain('Download review.json');
    for (const i of manifest.items) expect(html).toContain(i.file);
    expect(html).not.toMatch(/https?:\/\//);
  });
});
