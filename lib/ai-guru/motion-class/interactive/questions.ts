/**
 * Questions inside the animation (V51.9.50).
 *
 * A question belongs to a teaching template (DNA) and is worked out from the same plan the board is
 * built from, so its answer is computed by the app, never written by the AI. It is attached to one
 * step of the board by that step's caption, and the class pauses at the end of that step:
 *
 *   tap     — the student taps a tile / object on the board itself (positions come from the DNA's
 *             own geometry module, e.g. hl-math for HCF / LCM);
 *   choice  — the student picks one of a few answers (predict the next result before it is shown).
 *
 * Nothing here changes how a class is built or drawn: with no questions placed, the player behaves
 * exactly as before.
 */

import type { Lang } from '../../reels/motion/captions';
import type { MotionReel } from '../../reels/motion/reel';
import { boardMapping, type ReelFormat } from '../../reels/motion/draw';
import type { BalPlan, Bi, BlockPlan, CompositePlan, HlPlan } from '../dna/types';
import { HL_RA, HL_RB, HL_TILE, hlSplit, hlX } from '../dna/hl-math';
import { balFacts, sv } from '../dna/bal-math';

export type QuestionKind = 'tap' | 'choice';

/** A tap target on the board, in the scene's design coordinates (centre + size). */
export interface TapTarget {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  correct: boolean;
  label?: string;
}

export interface ChoiceOption {
  id: string;
  text: Bi;
  correct: boolean;
}

export interface ClassQuestion {
  /** Stable id: block, template and slot (progress and attempts are stored under it). */
  id: string;
  blockId: string;
  dna: string;
  /** Caption of the board step after which the question is asked (matched in the segment's language). */
  after: Bi;
  prompt: Bi;
  kind: QuestionKind;
  options?: ChoiceOption[];
  targets?: TapTarget[];
  /** Shown once the student has answered (or skipped). */
  explain: Bi;
  /** Concept the attempt counts towards (student-intelligence mastery). */
  conceptId: string;
}

/** A question placed on the class timeline. */
export interface PlacedQuestion extends ClassQuestion {
  /** Index of the timeline segment (the Teach pass) it is asked in. */
  segment: number;
  /** Index of the timeline step it follows. */
  step: number;
  /** Class time the board pauses at (end of that step). */
  atMs: number;
  lang: Lang;
}

/** A tap target in frame pixels (e.g. of the 1280×720 board). */
export interface FrameTarget {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  correct: boolean;
  label?: string;
}

export const pickBi = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');

/* ---------------- question makers (one per template) ---------------- */

type Maker<P> = (blockId: string, plan: P, slot: string) => ClassQuestion[];

/** Deterministic order for answer options (same class → same order every time). */
function arrange<T>(xs: T[], seed: number): T[] {
  const out = [...xs];
  let s = (seed * 9301 + 49297) % 233280 || 7;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Up to four distinct numeric options: the answer first, then the distractors that differ from it. */
function numberOptions(answer: number, distractors: number[], fmt: (n: number) => string, seed: number): ChoiceOption[] {
  const vals: number[] = [answer];
  for (const d of [...distractors, answer + 1, answer * 2, answer + 2, Math.max(1, answer - 1)]) {
    if (vals.length >= 4) break;
    if (Number.isFinite(d) && d > 0 && !vals.includes(d)) vals.push(d);
  }
  const opts = vals.map((v, i) => ({ id: `o${i}`, text: { en: fmt(v), ml: fmt(v) }, correct: v === answer }));
  return arrange(opts, seed);
}

const hcfLcm: Maker<HlPlan> = (blockId, plan, slot) => {
  const out: ClassQuestion[] = [];
  const { a, b } = plan;
  if (!Number.isInteger(a) || !Number.isInteger(b) || !Array.isArray(plan.steps)) return out;
  const s = hlSplit(a, b);
  const fact = plan.steps.find((x) => x?.op === 'factorise');
  const hcfStep = plan.steps.find((x) => x?.op === 'hcf');
  const sharedSet = new Set(s.shared);
  const listEn = [...new Set(s.shared)].join(' and ');
  const listMl = [...new Set(s.shared)].join(', ');
  if (fact?.say) {
    if (s.shared.length) {
      // Before the tiles line up. Easy form: "tap a prime both numbers have" — but when every tile is such a
      // prime (12 = 2·2·3, 18 = 2·3·3) any tap would be right, so ask the sharper question instead:
      // "tap a tile with no partner in the other number" (a row has more of that prime than the other row).
      const count = (xs: number[], p: number) => xs.filter((x) => x === p).length;
      const easy = [...s.fa, ...s.fb].some((p) => !sharedSet.has(p));
      const right = (p: number, mine: number[], other: number[]) => (easy ? sharedSet.has(p) : count(mine, p) > count(other, p));
      const targets: TapTarget[] = [];
      s.fa.forEach((p, i) => targets.push({ id: `a${i}`, x: hlX(i), y: HL_RA, w: HL_TILE + 8, h: HL_TILE + 8, correct: right(p, s.fa, s.fb), label: String(p) }));
      s.fb.forEach((p, i) => targets.push({ id: `b${i}`, x: hlX(i), y: HL_RB, w: HL_TILE + 8, h: HL_TILE + 8, correct: right(p, s.fb, s.fa), label: String(p) }));
      const extraA = [...new Set(s.aOnly)];
      const extraB = [...new Set(s.bOnly)];
      const extraEn = [extraA.length ? `${a} has an extra ${extraA.join(' and ')}` : '', extraB.length ? `${b} has an extra ${extraB.join(' and ')}` : ''].filter(Boolean).join('; ');
      const extraMl = [extraA.length ? `${a} ൽ ഒരു ${extraA.join(', ')} അധികം` : '', extraB.length ? `${b} ൽ ഒരു ${extraB.join(', ')} അധികം` : ''].filter(Boolean).join('; ');
      out.push({
        id: `${blockId}:${slot}hcf-lcm:shared`,
        blockId,
        dna: 'hcf-lcm',
        after: fact.say,
        kind: 'tap',
        prompt: easy
          ? { en: `Tap a prime that both ${a} and ${b} have.`, ml: `${a}, ${b} എന്നിവയ്ക്ക് പൊതുവായ ഒരു അഭാജ്യ ഘടകം തൊടുക.` }
          : { en: `Pair each tile with the same prime in the other number. Tap a tile that has no partner.`, ml: `ഓരോ ഓടിനെയും മറ്റേ സംഖ്യയിലെ അതേ അഭാജ്യ സംഖ്യയുമായി ജോടിയാക്കുക. ജോടിയില്ലാത്ത ഒരു ഓട് തൊടുക.` },
        targets,
        explain: easy
          ? {
              en: `Both have ${listEn}. Those tiles will line up, and their product is the HCF, ${s.hcf}.`,
              ml: `രണ്ടിലും ${listMl} ഉണ്ട്. ആ ഓടുകൾ ഒരേ നിരയിൽ വരും; അവയുടെ ഗുണനഫലമാണ് ഉസാഘ, ${s.hcf}.`,
            }
          : {
              en: `${extraEn}. Tiles without a partner go only into the LCM; the pairs (${s.shared.join(' × ')}) make the HCF, ${s.hcf}.`,
              ml: `${extraMl}. ജോടിയില്ലാത്ത ഓടുകൾ ലസാഗുവിൽ മാത്രം; ജോടികൾ (${s.shared.join(' × ')}) ചേർന്നാണ് ഉസാഘ, ${s.hcf}.`,
            },
        conceptId: easy ? `${blockId}:hcf-common-primes` : `${blockId}:hcf-unpaired-primes`,
      });
    } else {
      out.push({
        id: `${blockId}:${slot}hcf-lcm:shared`,
        blockId,
        dna: 'hcf-lcm',
        after: fact.say,
        kind: 'choice',
        prompt: { en: `Do ${a} and ${b} share a prime factor?`, ml: `${a}, ${b} എന്നിവയ്ക്ക് പൊതുവായ അഭാജ്യ ഘടകം ഉണ്ടോ?` },
        options: [
          { id: 'yes', text: { en: 'Yes', ml: 'ഉണ്ട്' }, correct: false },
          { id: 'no', text: { en: 'No', ml: 'ഇല്ല' }, correct: true },
        ],
        explain: { en: `No prime is in both, so the HCF is 1.`, ml: `രണ്ടിലും വരുന്ന അഭാജ്യ ഘടകമില്ല; അതിനാൽ ഉസാഘ 1.` },
        conceptId: `${blockId}:hcf-common-primes`,
      });
    }
  }
  if (hcfStep?.say) {
    // After the HCF, before the LCM is shown: predict it.
    out.push({
      id: `${blockId}:${slot}hcf-lcm:lcm`,
      blockId,
      dna: 'hcf-lcm',
      after: hcfStep.say,
      kind: 'choice',
      prompt: { en: `Every column's tiles multiplied together give the LCM. What will it be?`, ml: `എല്ലാ നിരകളിലെയും ഓടുകളുടെ ഗുണനഫലമാണ് ലസാഗു. അത് എത്രയായിരിക്കും?` },
      options: numberOptions(s.lcm, [a * b, s.hcf, a + b, b], String, a * 31 + b),
      explain: { en: `LCM = ${[...s.shared, ...s.aOnly, ...s.bOnly].join(' × ')} = ${s.lcm}.`, ml: `ലസാഗു = ${[...s.shared, ...s.aOnly, ...s.bOnly].join(' × ')} = ${s.lcm}.` },
      conceptId: `${blockId}:lcm-from-columns`,
    });
  }
  return out;
};

const balance: Maker<BalPlan> = (blockId, plan, slot) => {
  if (!Array.isArray(plan?.steps)) return [];
  const i = plan.steps.findIndex((x) => x?.op === 'answer');
  if (i <= 0 || !plan.steps[i - 1]?.say) return [];
  let f: ReturnType<typeof balFacts>;
  try {
    f = balFacts(plan);
  } catch {
    return [];
  }
  if (!Number.isInteger(f.x)) return [];
  const show = (n: number) => sv(f, n);
  const rhs = plan.c - plan.b;
  return [
    {
      id: `${blockId}:${slot}balance-scale:answer`,
      blockId,
      dna: 'balance-scale',
      after: plan.steps[i - 1].say,
      kind: 'choice',
      prompt: { en: `Before the scale shows it: what is ${f.letter}?`, ml: `ത്രാസ് കാണിക്കുന്നതിന് മുമ്പ്: ${f.letter} എത്ര?` },
      options: numberOptions(f.x, [rhs, plan.c, f.x + 1], show, f.a * 17 + plan.c),
      explain: {
        en: `${f.a > 1 ? `${show(rhs)} shared between ${f.a} tiles is ${show(f.x)}` : `One ${f.letter} balances ${show(f.x)}`}, so ${f.letter} = ${show(f.x)}.`,
        ml: `${f.a > 1 ? `${show(rhs)} നെ ${f.a} ഓടുകൾക്ക് പങ്കിട്ടാൽ ${show(f.x)}` : `ഒരു ${f.letter} ന് ${show(f.x)} ന്റെ ഭാരം`}; അതിനാൽ ${f.letter} = ${show(f.x)}.`,
      },
      conceptId: `${blockId}:solve-one-step-equation`,
    },
  ];
};

const MAKERS: Record<string, Maker<never>> = {
  'hcf-lcm': hcfLcm as Maker<never>,
  'balance-scale': balance as Maker<never>,
};

/** Templates that ask questions inside the animation. */
export const QUESTION_DNAS = Object.keys(MAKERS);

/** Questions for one planned block (composites: every segment that has a maker). */
export function questionsForPlan(blockId: string, plan: Pick<BlockPlan, 'dna' | 'teach'> | undefined): ClassQuestion[] {
  if (!plan?.teach) return [];
  const maker = MAKERS[plan.dna];
  if (maker) return maker(blockId, plan.teach as never, '');
  const c = plan.teach as CompositePlan;
  if ((plan.dna === 'ai-custom' || plan.dna.startsWith('learned:')) && Array.isArray(c.segments)) {
    return c.segments.flatMap((sg, i) => (MAKERS[sg.dna] ? MAKERS[sg.dna](blockId, sg.plan as never, `s${i}:`) : []));
  }
  return [];
}

/* ---------------- placing questions on the timeline ---------------- */

export interface TimelineLike {
  steps: Array<{ index: number; t0: number; t1: number; text: string; segment: number }>;
  segments: Array<{ index: number; blockId: string; phase: string; lang: string }>;
}

export interface PlaceOptions {
  /** 'first-teach' (default): ask once per unit, in its first Teach pass. 'every-teach': in both languages. */
  mode?: 'first-teach' | 'every-teach';
  /** How long before the end of the step the board pauses (ms). */
  leadMs?: number;
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

export function placeQuestions(tl: TimelineLike, plans: Map<string, Pick<BlockPlan, 'dna' | 'teach'>>, o: PlaceOptions = {}): PlacedQuestion[] {
  const out: PlacedQuestion[] = [];
  const asked = new Set<string>();
  const lead = o.leadMs ?? 80;
  for (const seg of tl.segments) {
    if (seg.phase !== 'teach') continue;
    if ((o.mode ?? 'first-teach') === 'first-teach' && asked.has(seg.blockId)) continue;
    const qs = questionsForPlan(seg.blockId, plans.get(seg.blockId));
    if (!qs.length) continue;
    const lang = (seg.lang === 'ml' ? 'ml' : 'en') as Lang;
    const steps = tl.steps.filter((s) => s.segment === seg.index);
    let placedAny = false;
    for (const q of qs) {
      const want = norm(pickBi(q.after, lang));
      const st = steps.find((s) => norm(s.text) === want);
      if (!st) continue;
      out.push({ ...q, id: o.mode === 'every-teach' ? `${q.id}:${lang}` : q.id, segment: seg.index, step: st.index, atMs: Math.max(st.t0 + 200, st.t1 - lead), lang });
      placedAny = true;
    }
    if (placedAny) asked.add(seg.blockId);
  }
  return out.sort((x, y) => x.atMs - y.atMs);
}

/* ---------------- tap targets on screen ---------------- */

/** Tap targets in frame pixels at the moment the question is asked. */
export function frameTargets(q: PlacedQuestion, reel: MotionReel, format: ReelFormat, ctx: CanvasRenderingContext2D): FrameTarget[] {
  if (!q.targets?.length) return [];
  const m = boardMapping(ctx, reel, q.atMs, format);
  return q.targets.map((tg) => {
    const [x, y] = m.toFrame(tg.x, tg.y);
    return { id: tg.id, x, y, w: tg.w * m.scale, h: tg.h * m.scale, correct: tg.correct, label: tg.label };
  });
}

/** The target under a frame point (nearest centre wins when targets overlap), or null. */
export function hitTarget(targets: FrameTarget[], fx: number, fy: number): FrameTarget | null {
  let best: FrameTarget | null = null;
  let bestD = Infinity;
  for (const t of targets) {
    if (Math.abs(fx - t.x) <= t.w / 2 && Math.abs(fy - t.y) <= t.h / 2) {
      const d = (fx - t.x) ** 2 + (fy - t.y) ** 2;
      if (d < bestD) {
        best = t;
        bestD = d;
      }
    }
  }
  return best;
}

export interface Graded {
  correct: boolean;
  /** Which option / target was chosen (null = tapped empty board). */
  picked: string | null;
}

export function gradeChoice(q: ClassQuestion, optionId: string): Graded {
  const o = q.options?.find((x) => x.id === optionId);
  return { correct: !!o?.correct, picked: o ? o.id : null };
}

export function gradeTap(targets: FrameTarget[], fx: number, fy: number): Graded {
  const t = hitTarget(targets, fx, fy);
  return { correct: !!t?.correct, picked: t ? t.id : null };
}
