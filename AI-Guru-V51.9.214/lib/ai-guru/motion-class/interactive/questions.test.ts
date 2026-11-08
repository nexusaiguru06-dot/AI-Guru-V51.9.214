import { describe, expect, it } from 'vitest';
import { evalItem } from '../../reels/motion';
import { boardMapping } from '../../reels/motion/draw';
import { compileClass } from '../class';
import { prepareSegment } from '../player';
import { buildClassTimeline } from '../interactive-player';
import type { BlockPlan, HlPlan } from '../dna/types';
import type { BookBlock } from '../segment';
import { hlSplit } from '../dna/hl-math';
import { balFacts, sv } from '../dna/bal-math';
import { HL_SAMPLES, HL_SAMPLE_12_18, HL_SAMPLE_COPRIME } from '../samples/hcf-lcm';
import { BAL_SAMPLES, BAL_TWO_STEP_SAMPLE } from '../samples/balance-scale';
import { frameTargets, gradeChoice, gradeTap, hitTarget, pickBi, placeQuestions, questionsForPlan, QUESTION_DNAS } from './questions';
import { emptyProgress, listProgress, loadProgress, markPosition, progressKey, recordAnswer, resumePoint, saveProgress, clearProgress, currentStudentId } from './progress';

const block = (id: string, text: string, kind: BookBlock['kind'] = 'problem'): BookBlock => ({ id, kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const plan = (blockId: string, dna: string, teach: unknown): BlockPlan => ({ blockId, dna, teach, read: { en: 'Read this.', ml: 'ഇത് വായിക്കുക.' }, source: 'offline' }) as unknown as BlockPlan;
const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;

async function timelineFor(blocks: BookBlock[], plans: Map<string, BlockPlan>, languages: Array<'en' | 'ml'> = ['en', 'ml']) {
  const segs = compileClass(blocks, plans, { title: 'T' }, { languages });
  const prepared = await Promise.all(segs.map((s) => prepareSegment(s, false)));
  return buildClassTimeline('T', prepared);
}

describe('questions come from the plan, answers from the app', () => {
  it('HCF/LCM: tap a shared prime — the right tiles are exactly the shared primes', () => {
    for (const p of Object.values(HL_SAMPLES)) {
      const qs = questionsForPlan('b', { dna: 'hcf-lcm', teach: p } as BlockPlan);
      const s = hlSplit(p.a, p.b);
      const tap = qs.find((q) => q.id.endsWith(':shared'))!;
      expect(tap).toBeTruthy();
      if (s.shared.length) {
        expect(tap.kind).toBe('tap');
        expect(tap.targets!.length).toBe(s.fa.length + s.fb.length);
        const easy = [...s.fa, ...s.fb].some((x) => !s.shared.includes(x));
        const cnt = (xs: number[], x: number) => xs.filter((y) => y === x).length;
        for (const t of tap.targets!) {
          const prime = Number(t.label);
          const [mine, other] = t.id.startsWith('a') ? [s.fa, s.fb] : [s.fb, s.fa];
          expect(t.correct, `${p.a},${p.b} ${t.id}`).toBe(easy ? s.shared.includes(prime) : cnt(mine, prime) > cnt(other, prime));
        }
        // never trivial: at least one right and one wrong tile
        expect(tap.targets!.some((t) => t.correct)).toBe(true);
        expect(tap.targets!.some((t) => !t.correct)).toBe(true);
      } else {
        expect(tap.kind).toBe('choice');
        expect(gradeChoice(tap, 'no').correct).toBe(true);
        expect(gradeChoice(tap, 'yes').correct).toBe(false);
      }
    }
  });
  it('HCF/LCM tap question is never trivial and never impossible (every pair up to 120 with a shared prime)', () => {
    for (let a = 2; a <= 120; a++) {
      for (let b = a + 1; b <= 120; b++) {
        if (!hlSplit(a, b).shared.length) continue;
        const q = questionsForPlan('b', { dna: 'hcf-lcm', teach: { ...HL_SAMPLE_12_18, title: undefined, a, b } } as BlockPlan).find((x) => x.kind === 'tap')!;
        expect(q.targets!.some((t) => t.correct), `${a},${b}`).toBe(true);
        expect(q.targets!.some((t) => !t.correct), `${a},${b}`).toBe(true);
      }
    }
  });
  it('HCF/LCM: the LCM options hold the true LCM exactly once, and only it is right', () => {
    for (let a = 2; a <= 60; a += 3) {
      for (let b = a + 1; b <= 120; b += 11) {
        const p: HlPlan = { ...HL_SAMPLE_12_18, title: undefined, a, b };
        const q = questionsForPlan('b', { dna: 'hcf-lcm', teach: p } as BlockPlan).find((x) => x.id.endsWith(':lcm'))!;
        const lcm = hlSplit(a, b).lcm;
        const right = q.options!.filter((o) => o.correct);
        expect(right.length).toBe(1);
        expect(right[0].text.en).toBe(String(lcm));
        expect(new Set(q.options!.map((o) => o.text.en)).size).toBe(q.options!.length);
        expect(q.options!.length).toBeGreaterThanOrEqual(3);
      }
    }
  });
  it('balance scale: "what is x" has the true answer (as written on the board) exactly once', () => {
    for (const p of BAL_SAMPLES) {
      const qs = questionsForPlan('b', { dna: 'balance-scale', teach: p } as BlockPlan);
      if (!p.steps.some((s) => s.op === 'answer')) continue;
      expect(qs.length).toBe(1);
      const f = balFacts(p);
      const right = qs[0].options!.filter((o) => o.correct);
      expect(right.map((o) => o.text.en)).toEqual([sv(f, f.x)]);
      expect(new Set(qs[0].options!.map((o) => o.text.en)).size).toBe(qs[0].options!.length);
    }
  });
  it('every question is bilingual (Malayalam prompt in Malayalam script)', () => {
    const all = [...Object.values(HL_SAMPLES).map((p) => ({ dna: 'hcf-lcm', teach: p })), ...BAL_SAMPLES.map((p) => ({ dna: 'balance-scale', teach: p }))];
    for (const p of all) {
      for (const q of questionsForPlan('b', p as BlockPlan)) {
        expect(q.prompt.ml).toMatch(/[ഀ-ൿ]/);
        expect(q.explain.ml).toMatch(/[ഀ-ൿ]/);
      }
    }
  });
  it('composites (ai-custom / learned) ask the questions of their segments', () => {
    const teach = { segments: [{ dna: 'hcf-lcm', plan: HL_SAMPLE_12_18 }, { dna: 'balance-scale', plan: BAL_TWO_STEP_SAMPLE }] };
    const qs = questionsForPlan('b', { dna: 'ai-custom', teach } as BlockPlan);
    expect(qs.map((q) => q.dna)).toEqual(['hcf-lcm', 'hcf-lcm', 'balance-scale']);
    expect(new Set(qs.map((q) => q.id)).size).toBe(3);
    expect(questionsForPlan('b', { dna: 'learned:x', teach } as unknown as BlockPlan).length).toBe(3);
  });
  it('templates without questions ask nothing (the class is unchanged)', () => {
    expect(questionsForPlan('b', { dna: 'concept-board', teach: { items: [] } } as unknown as BlockPlan)).toEqual([]);
    expect(questionsForPlan('b', undefined)).toEqual([]);
    expect(QUESTION_DNAS.sort()).toEqual(['balance-scale', 'hcf-lcm']);
  });
});

describe('questions are placed on the class timeline', () => {
  it('asked once per unit, in its first Teach pass, at the end of the step they follow', async () => {
    const blocks = [block('h', 'Find the HCF and LCM of 12 and 18.'), block('s', 'Solve 2x + 5 = 25')];
    const plans = new Map([
      ['h', plan('h', 'hcf-lcm', HL_SAMPLE_12_18)],
      ['s', plan('s', 'balance-scale', BAL_TWO_STEP_SAMPLE)],
    ]);
    const tl = await timelineFor(blocks, plans);
    const qs = placeQuestions(tl, plans);
    expect(qs.length).toBe(3);
    for (const q of qs) {
      const seg = tl.segments[q.segment];
      expect(seg.phase).toBe('teach');
      expect(seg.lang).toBe('en');
      expect(seg.blockId).toBe(q.blockId);
      const st = tl.steps[q.step];
      expect(st.segment).toBe(q.segment);
      expect(st.text).toBe(pickBi(q.after, 'en'));
      expect(q.atMs).toBeGreaterThan(st.t0);
      expect(q.atMs).toBeLessThan(st.t1);
    }
    // in time order, ids unique
    expect(qs.map((q) => q.atMs)).toEqual([...qs.map((q) => q.atMs)].sort((a, b) => a - b));
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
  });
  it('"every-teach" also asks in the Malayalam pass, matched by the Malayalam caption', async () => {
    const blocks = [block('h', 'HCF and LCM of 12 and 18')];
    const plans = new Map([['h', plan('h', 'hcf-lcm', HL_SAMPLE_12_18)]]);
    const tl = await timelineFor(blocks, plans);
    const qs = placeQuestions(tl, plans, { mode: 'every-teach' });
    expect(qs.map((q) => q.lang)).toEqual(['en', 'en', 'ml', 'ml']);
    for (const q of qs.filter((x) => x.lang === 'ml')) expect(tl.steps[q.step].text).toBe(pickBi(q.after, 'ml'));
  });
  it('English-only class: questions still placed; a plan whose captions are missing places nothing', async () => {
    const blocks = [block('h', 'HCF and LCM of 36 and 48')];
    const plans = new Map([['h', plan('h', 'hcf-lcm', HL_SAMPLES['36 and 48'])]]);
    const tl = await timelineFor(blocks, plans, ['en']);
    expect(placeQuestions(tl, plans).length).toBe(2);
    const broken = new Map([['h', plan('h', 'hcf-lcm', { ...HL_SAMPLES['36 and 48'], steps: [] })]]);
    expect(placeQuestions(tl, broken)).toEqual([]);
  });
});

describe('tap targets sit exactly on the tiles the board draws', () => {
  it('every target centre is a tile centre on screen at the moment of the question (all samples, 3 formats)', async () => {
    for (const p of Object.values(HL_SAMPLES)) {
      if (!hlSplit(p.a, p.b).shared.length) continue;
      const blocks = [block('h', `HCF of ${p.a} and ${p.b}`)];
      const plans = new Map([['h', plan('h', 'hcf-lcm', p)]]);
      const tl = await timelineFor(blocks, plans, ['en']);
      const q = placeQuestions(tl, plans).find((x) => x.kind === 'tap')!;
      for (const format of ['landscape', 'square', 'vertical'] as const) {
        const targets = frameTargets(q, tl.reel, format, noop);
        expect(targets.length).toBeGreaterThan(3);
        const m = boardMapping(noop, tl.reel, q.atMs, format);
        // Tile polygons at that moment, mapped to the frame.
        let start = 0;
        for (const part of tl.reel.parts) {
          if (part === m.scene) break;
          start += part.durationMs;
        }
        const tiles = m.scene.items
          .filter((it) => it.kind === 'poly' && it.points?.length === 4)
          .map((it) => evalItem(it, q.atMs - start))
          .filter((st) => st.alpha > 0.5 && st.points)
          .map((st) => {
            const cx = st.points!.reduce((s, pt) => s + pt[0], 0) / 4;
            const cy = st.points!.reduce((s, pt) => s + pt[1], 0) / 4;
            return m.toFrame(cx, cy);
          });
        expect(tiles.length).toBeGreaterThanOrEqual(targets.length);
        for (const t of targets) {
          const near = Math.min(...tiles.map(([x, y]) => Math.hypot(x - t.x, y - t.y)));
          expect(near, `${p.a},${p.b} ${format} ${t.id}`).toBeLessThan(1);
          // inside the board
          expect(t.x).toBeGreaterThan(m.board.x);
          expect(t.x).toBeLessThan(m.board.x + m.board.w);
        }
        // tapping a target's centre picks that target; the empty board picks nothing
        for (const t of targets) expect(gradeTap(targets, t.x, t.y)).toEqual({ correct: t.correct, picked: t.id });
        expect(hitTarget(targets, 1, 1)).toBeNull();
      }
    }
  });
});

describe('progress per student and class', () => {
  it('saves position, visited steps and answers; the first answer becomes a StudentAttempt', () => {
    const sid = currentStudentId();
    expect(currentStudentId()).toBe(sid);
    const key = progressKey('SCERT IX', 'Chapter 1', 'Section 1');
    expect(progressKey(' SCERT  IX', 'chapter 1', 'Section 1 ')).toBe(key);
    clearProgress(sid, key);
    const p = loadProgress(sid, key);
    expect(p.visited).toEqual([]);
    markPosition(p, 12345.6, 7, 40);
    markPosition(p, 13000, 8, 40);
    const q = { id: 'h:hcf-lcm:shared', blockId: 'h', conceptId: 'h:hcf-common-primes' };
    const r1 = recordAnswer(p, q, false, { now: new Date('2026-10-13T10:00:00Z') });
    const r2 = recordAnswer(p, q, true);
    expect(r1.attempt).toMatchObject({ studentId: sid, itemId: q.id, paragraphId: 'h', conceptId: q.conceptId, correct: false, score: 0 });
    expect(r2.attempt).toBeNull();
    expect(p.answers[q.id]).toMatchObject({ correct: true, firstCorrect: false, tries: 2 });
    const skip = recordAnswer(p, { id: 'x', blockId: 'h', conceptId: 'c' }, false, { skipped: true });
    expect(skip.attempt).toBeNull();
    saveProgress(p);
    const back = loadProgress(sid, key);
    expect(back.step).toBe(8);
    expect(back.maxStep).toBe(8);
    expect(back.visited).toEqual([7, 8]);
    expect(back.attempts.length).toBe(1);
    expect(listProgress(sid).some((x) => x.key === key)).toBe(true);
    expect(resumePoint(back, 60000, 40)).toEqual({ timeMs: 13000, step: 8 });
    expect(resumePoint(back, 13500, 40)).toBeNull(); // finished
    expect(resumePoint(back, 60000, 5)).toBeNull(); // re-planned, shorter
    expect(resumePoint(emptyProgress(sid, key), 60000, 40)).toBeNull();
    clearProgress(sid, key);
    expect(loadProgress(sid, key).visited).toEqual([]);
  });
});
