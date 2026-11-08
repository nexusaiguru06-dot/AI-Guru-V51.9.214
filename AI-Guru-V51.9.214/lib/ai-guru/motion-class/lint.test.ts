import { describe, expect, it } from 'vitest';
import { compileClass, segmentReel } from './class';
import { buildClassTimeline } from './interactive-player';
import type { PreparedSegment } from './player';
import { voiceScript, type VoiceClips } from '../reels/motion';
import type { BlockPlan } from './dna/types';
import type { BookBlock } from './segment';
import { HL_SAMPLE_12_18 } from './samples/hcf-lcm';
import { placeQuestions } from './interactive/questions';
import { lintLearned, lintPlan, lintSummary, lintTimeline } from './lint';

const block = (id: string, text: string): BookBlock => ({ id, kind: 'problem', page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const plan = (teach: unknown, dna = 'hcf-lcm'): BlockPlan => ({ blockId: 'h', dna, teach, read: { en: 'Find them.', ml: 'കണ്ടെത്തുക.' }, source: 'ai' }) as unknown as BlockPlan;
const RATE = 48000;
const clip = (ms: number) => new Float32Array(Math.round((ms / 1000) * RATE));

/** A class prepared "with voice": every line gets a clip of `ms`, except those in `skip`. */
function prepared(p: BlockPlan, o: { ms?: number; skip?: (say: string, i: number) => boolean; builtMs?: number } = {}) {
  const segs = compileClass([block('h', 'HCF and LCM of 12 and 18')], new Map([['h', p]]), { title: 'T' }, { read: false });
  const list: PreparedSegment[] = segs.map((seg) => {
    const script = voiceScript(segmentReel(seg));
    const clips: VoiceClips = new Map();
    script.forEach((s, i) => {
      if (!o.skip?.(s, i)) clips.set(s, clip(o.ms ?? 1500));
    });
    const reel = segmentReel(seg, (t) => (clips.has(t) ? (o.builtMs ?? o.ms ?? 1500) : undefined));
    return { segment: seg, reel, clips };
  });
  return { segs, tl: buildClassTimeline('T', list) };
}

describe('class lint on a prepared class', () => {
  it('a clean class has no issues', () => {
    const p = plan(HL_SAMPLE_12_18);
    const { segs, tl } = prepared(p);
    const plans = new Map([['h', p]]);
    const issues = lintTimeline(tl, { voice: true, segments: segs, plans, questions: placeQuestions(tl, plans) });
    expect(issues).toEqual([]);
    expect(lintSummary(issues)).toMatch(/no problems/);
  });
  it('missing audio: steps that should speak but have no clip', () => {
    const { tl } = prepared(plan(HL_SAMPLE_12_18), { skip: (_s, i) => i === 2 || i === 3 });
    const miss = lintTimeline(tl, { voice: true }).filter((i) => i.code === 'missing-audio');
    expect(miss.length).toBe(2); // one in each language pass
    expect(miss[0].message).toMatch(/2 step\(s\) have no voice clip/);
    // voice switched off: silence is expected, not a problem
    expect(lintTimeline(tl, { voice: false }).filter((i) => i.code === 'missing-audio')).toEqual([]);
  });
  it('stale narration: timing built for a different recording', () => {
    const { tl } = prepared(plan(HL_SAMPLE_12_18), { ms: 1500, builtMs: 2600 });
    const stale = lintTimeline(tl, { voice: true }).filter((i) => i.code === 'stale-narration');
    expect(stale.length).toBe(2);
    expect(stale[0].level).toBe('error');
  });
  it('stale narration: the plan changed after the class was prepared (same-length edits included)', () => {
    const p = plan(HL_SAMPLE_12_18);
    const { tl } = prepared(p);
    const edited = JSON.parse(JSON.stringify(HL_SAMPLE_12_18));
    edited.steps[1].say.en = edited.steps[1].say.en.replace(/^./, 'X'); // same length, different words
    const segs = compileClass([block('h', 'x')], new Map([['h', plan(edited)]]), { title: 'T' }, { read: false });
    const stale = lintTimeline(tl, { segments: segs }).filter((i) => i.code === 'stale-narration');
    expect(stale.length).toBe(1);
    expect(stale[0].message).toMatch(/Captions differ from the current plan/);
  });
  it('Malayalam pass: English left in, or the English caption unchanged', () => {
    const leaky = JSON.parse(JSON.stringify(HL_SAMPLE_12_18));
    leaky.steps[0].say.ml = leaky.steps[0].say.en; // untranslated
    leaky.steps[2].say.ml = 'Slide the shared tiles together now'; // English text in the ML pass
    const { tl } = prepared(plan(leaky));
    const codes = lintTimeline(tl).map((i) => i.code);
    expect(codes).toContain('ml-untranslated');
    expect(codes).toContain('ml-leak');
  });
  it('a question whose step caption is gone is reported, not silently dropped', () => {
    const p = plan(HL_SAMPLE_12_18);
    const { tl } = prepared(p);
    const plans = new Map([['h', p]]);
    const issues = lintTimeline(tl, { plans, questions: [] });
    expect(issues.filter((i) => i.code === 'question-unplaced').length).toBe(2);
  });
});

describe('class lint on plans and templates', () => {
  it('broken names', () => {
    expect(lintPlan('u', plan({}, 'no-such-dna'))[0].code).toBe('broken-name');
    expect(lintPlan('u', plan({}, 'learned:missing'))[0].message).toMatch(/not in this browser's library/);
    const comp = lintPlan('u', plan({ segments: [{ dna: 'nope', plan: {} }] }, 'ai-custom'), { validate: false });
    expect(comp.map((i) => i.code)).toEqual(['broken-name']);
    expect(lintLearned({ id: 'x', name: 'x', description: '', kinds: ['prose'], keywords: [], segments: ['nope' as never], example: { segments: [] }, createdAt: '' })[0].code).toBe('broken-name');
  });
  it('a valid plan is clean; an invalid one reports the validator\'s reasons', () => {
    expect(lintPlan('h', plan(HL_SAMPLE_12_18))).toEqual([]);
    const bad = lintPlan('h', plan({ ...HL_SAMPLE_12_18, a: 18, b: 12 }));
    expect(bad[0].code).toBe('invalid-plan');
    expect(bad[0].message).toMatch(/smaller/);
  });
});
