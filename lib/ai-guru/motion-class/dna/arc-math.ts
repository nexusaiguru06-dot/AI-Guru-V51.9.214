/**
 * Rules for the lesson arc (V51.9.46): what a planner may ask for around a unit's picture, and the
 * arcs the app adds by itself (the hook for mental maths).
 */

import { MISTAKES } from '../../features';
import { mathProblem } from '../../reels/motion/typeset';
import type { BalPlan, Bi, BlockPlan, ChainPlan, HlPlan, LessonArc } from './types';
import { ARC_WORDS } from './arc-builders';
import { locateParts, MAX_PARTS } from '../../reels/motion/decompose';
import { hlSplit } from './hl-math';
import { balFacts, sv } from './bal-math';
import { wordingProblems } from '../plan/wording';

const ML = /[ഀ-ൿ]/;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function checkBi(b: unknown, path: string, max: number, needMl: boolean, errors: string[]) {
  const x = b as Bi | undefined;
  if (!x || typeof x.en !== 'string' || !x.en.trim()) return void errors.push(`${path}.en is missing.`);
  if (words(x.en) > max) errors.push(`${path}.en is ${words(x.en)} words; use at most ${max}.`);
  errors.push(...wordingProblems(x.en, typeof x.ml === 'string' ? x.ml : undefined, path));
  if (needMl) {
    if (typeof x.ml !== 'string' || !x.ml.trim()) errors.push(`${path}.ml (Malayalam) is missing.`);
    else {
      if (/[A-Za-z]{4,}/.test(x.en) && !ML.test(x.ml)) errors.push(`${path}.ml must be written in Malayalam script, not English.`);
      if (words(x.ml) > max * 2) errors.push(`${path}.ml is ${words(x.ml)} words; shorten it.`);
    }
  }
}

/** Problems with a lesson arc, as sentences the planner can act on. An absent arc is fine. */
export function arcProblems(arc: unknown, path = 'arc', needMl = true): string[] {
  const errors: string[] = [];
  if (arc === undefined || arc === null) return errors;
  if (typeof arc !== 'object' || Array.isArray(arc)) return [`${path} must be an object with some of hook, why, formal, check, summary, mistake.`];
  const a = arc as LessonArc;
  const known = ['hook', 'why', 'formal', 'check', 'summary', 'mistake'];
  for (const k of Object.keys(a)) if (!known.includes(k)) errors.push(`${path}.${k} is not one of ${known.join(', ')}.`);
  if (!known.some((k) => (a as Record<string, unknown>)[k] !== undefined)) errors.push(`${path} is empty; leave it out or give at least one of ${known.join(', ')}.`);
  if (a.hook !== undefined) checkBi(a.hook, `${path}.hook`, ARC_WORDS.hook, needMl, errors);
  if (a.why !== undefined) {
    if (!a.why || typeof a.why !== 'object') errors.push(`${path}.why must be {"question":{en,ml},"answer":{en,ml}}.`);
    else {
      checkBi(a.why.question, `${path}.why.question`, ARC_WORDS.whyQuestion, needMl, errors);
      checkBi(a.why.answer, `${path}.why.answer`, ARC_WORDS.whyAnswer, needMl, errors);
    }
  }
  for (const k of ['formal', 'check'] as const) {
    const v = a[k];
    if (v === undefined) continue;
    if (!v || typeof v !== 'object') errors.push(`${path}.${k} must be {"tex":"…","say":{en,ml}}.`);
    else {
      const bad = mathProblem(v.tex);
      if (bad) errors.push(`${path}.${k}.tex: ${bad}.`);
      checkBi(v.say, `${path}.${k}.say`, 40, needMl, errors);
    }
  }
  // V51.9.51: the formula read term by term.
  const parts = a.formal && typeof a.formal === 'object' ? a.formal.parts : undefined;
  if (parts !== undefined) {
    if (!Array.isArray(parts) || !parts.length || parts.length > MAX_PARTS) errors.push(`${path}.formal.parts must list 1–${MAX_PARTS} parts of the formula.`);
    else if (!mathProblem(a.formal!.tex)) {
      parts.forEach((p, i) => {
        if (!p || typeof p.match !== 'string' || !p.match.trim()) return void errors.push(`${path}.formal.parts[${i}].match must be a piece of the formula.`);
        checkBi(p.label, `${path}.formal.parts[${i}].label`, ARC_WORDS.partLabel, needMl, errors);
        if (p.say !== undefined) checkBi(p.say, `${path}.formal.parts[${i}].say`, 30, needMl, errors);
      });
      if (parts.every((p) => typeof p?.match === 'string' && p.match.trim())) {
        const loc = locateParts(a.formal!.tex, parts);
        if ('error' in loc) errors.push(`${path}.formal.parts: ${loc.error}.`);
      }
    }
  }
  // V51.9.51: the common mistake.
  if (a.mistake !== undefined) {
    const mk = a.mistake;
    if (!mk || typeof mk !== 'object') errors.push(`${path}.mistake must be {"wrong":{"tex","say"},"why":{en,ml},"right":{"tex","say"}}.`);
    else {
      for (const k of ['wrong', 'right'] as const) {
        const v = mk[k];
        if (!v || typeof v !== 'object') {
          errors.push(`${path}.mistake.${k} must be {"tex":"…","say":{en,ml}}.`);
          continue;
        }
        const bad = mathProblem(v.tex);
        if (bad) errors.push(`${path}.mistake.${k}.tex: ${bad}.`);
        checkBi(v.say, `${path}.mistake.${k}.say`, ARC_WORDS.mistake, needMl, errors);
      }
      checkBi(mk.why, `${path}.mistake.why`, ARC_WORDS.mistake, needMl, errors);
      if (mk.wrong?.tex && mk.right?.tex && mk.wrong.tex.replace(/\s+/g, '') === mk.right.tex.replace(/\s+/g, '')) errors.push(`${path}.mistake: the wrong line and the right line are the same.`);
      if (mk.at !== undefined && mk.at !== 'before' && mk.at !== 'after') errors.push(`${path}.mistake.at must be "before" or "after".`);
    }
  }
  if (a.summary !== undefined) checkBi(a.summary, `${path}.summary`, ARC_WORDS.summary, needMl, errors);
  return errors;
}

/** The arc the app adds when the plan has none: mental maths gets the mascot wondering about the sum. */
export function defaultArc(plan: Pick<BlockPlan, 'dna' | 'teach'>): LessonArc | undefined {
  if (plan.dna !== 'mental-math') return undefined;
  const lines = (plan.teach as ChainPlan | null)?.lines;
  const toks = lines?.[0]?.tokens;
  if (!toks?.length) return undefined;
  const at = toks.indexOf('=');
  const expr = (at > 0 ? toks.slice(0, at) : toks).join(' ');
  if (!expr || expr.length > 40) return undefined;
  return { hook: { en: `Can you work out ${expr} in your head?`, ml: `${expr} മനസ്സിൽ കണക്കുകൂട്ടാമോ?` } };
}

/**
 * V51.9.51: a common mistake the app can state and refute by itself (numbers computed, never written by the AI).
 *   hcf-lcm (when the numbers share a prime): "LCM = a × b" — too big, the shared primes are counted twice.
 *   balance-scale (when a term moves across): moving it without changing its sign.
 */
export function autoMistake(plan: Pick<BlockPlan, 'dna' | 'teach'>): LessonArc['mistake'] | undefined {
  if (plan.dna === 'hcf-lcm') {
    const p = plan.teach as HlPlan | null;
    if (!p || !Number.isInteger(p.a) || !Number.isInteger(p.b)) return undefined;
    const s = hlSplit(p.a, p.b);
    if (s.hcf === 1) return undefined; // co-prime: a × b IS the LCM, nothing to correct
    const ab = p.a * p.b;
    return {
      at: 'after',
      wrong: {
        tex: `\\text{LCM} = ${p.a} \\times ${p.b} = ${ab}`,
        say: { en: `You might think the LCM is just ${p.a} times ${p.b}, which is ${ab}.`, ml: `ലസാഗു ${p.a} × ${p.b} = ${ab} ആണെന്ന് തോന്നിയേക്കാം.` },
      },
      why: {
        en: `${ab} is a common multiple, but not the lowest: the shared primes are counted twice.`,
        ml: `${ab} ഒരു പൊതുഗുണിതമാണ്, പക്ഷേ ഏറ്റവും ചെറുതല്ല: പൊതു അഭാജ്യങ്ങൾ രണ്ടുതവണ എണ്ണി.`,
      },
      right: {
        tex: `\\text{LCM} = ${ab} \\div ${s.hcf} = ${s.lcm}`,
        say: { en: `Divide by the HCF, ${s.hcf}, once: the LCM is ${s.lcm}.`, ml: `ഉസാഘ ${s.hcf} കൊണ്ട് ഒരിക്കൽ ഹരിക്കുക: ലസാഗു ${s.lcm}.` },
      },
    };
  }
  if (plan.dna === 'balance-scale') {
    const p = plan.teach as BalPlan | null;
    if (!p || !Number.isInteger(p.a) || !Number.isInteger(p.b) || !Number.isInteger(p.c) || p.b === 0 || (p.d ?? 0) > 0) return undefined;
    if (!Array.isArray(p.steps) || !p.steps.some((s) => s?.op === 'move')) return undefined;
    let f;
    try {
      f = balFacts(p);
    } catch {
      return undefined;
    }
    const L = p.a === 1 ? f.letter : `${p.a}${f.letter}`;
    const B = sv(f, Math.abs(p.b));
    const C = sv(f, p.c);
    const wrongOp = p.b > 0 ? '+' : '-';
    const rightOp = p.b > 0 ? '-' : '+';
    const lhs = `${L} ${p.b > 0 ? '+' : '-'} ${B} = ${C}`;
    return {
      at: 'before',
      wrong: {
        tex: `${lhs} \\Rightarrow ${L} = ${C} ${wrongOp} ${B}`,
        say: { en: `A common slip: moving ${B} across but keeping its sign.`, ml: `ഒരു പതിവ് തെറ്റ്: ${B} മറുവശത്തേക്ക് മാറ്റുമ്പോൾ ചിഹ്നം മാറ്റാതിരിക്കുക.` },
      },
      why: {
        en: `${p.b > 0 ? `Taking ${B} off one pan means taking ${B} off the other pan too.` : `Adding ${B} to one pan means adding ${B} to the other pan too.`}`,
        ml: `${p.b > 0 ? `ഒരു തട്ടിൽനിന്ന് ${B} എടുത്താൽ മറ്റേ തട്ടിൽനിന്നും ${B} എടുക്കണം.` : `ഒരു തട്ടിൽ ${B} ചേർത്താൽ മറ്റേ തട്ടിലും ${B} ചേർക്കണം.`}`,
      },
      right: {
        tex: `${lhs} \\Rightarrow ${L} = ${C} ${rightOp} ${B}`,
        say: { en: `So the sign changes: ${L} equals ${C} ${rightOp === '-' ? 'minus' : 'plus'} ${B}.`, ml: `അതിനാൽ ചിഹ്നം മാറും: ${L} = ${C} ${rightOp === '-' ? '−' : '+'} ${B}.` },
      },
    };
  }
  return undefined;
}

export interface ArcOptions {
  /** V51.9.51: add the app's own common-mistake scene where the plan has none (default off). */
  mistakes?: boolean;
}

/** The arc to use for a plan in a language: the plan's own, or the default; Malayalam only when every field has Malayalam. */
export function arcFor(plan: BlockPlan, lang: 'en' | 'ml', o: ArcOptions = {}): LessonArc | undefined {
  let arc = plan.arc ?? defaultArc(plan);
  // V51.9.123: no common-mistake scene at all while MISTAKES is off (the AI's own one is dropped too)
  if (!MISTAKES && arc?.mistake) { const { mistake: _drop, ...rest } = arc; void _drop; arc = rest; }
  if (MISTAKES && o.mistakes && !arc?.mistake) {
    const mk = autoMistake(plan);
    if (mk) arc = { ...(arc ?? {}), mistake: mk };
  }
  if (!arc) return undefined;
  if (lang === 'ml' && hasEnWithoutMl(arc)) return undefined;
  return arc;
}

function hasEnWithoutMl(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false;
  if (Array.isArray(x)) return x.some(hasEnWithoutMl);
  const o = x as Record<string, unknown>;
  if (typeof o.en === 'string' && o.en.trim() && !(typeof o.ml === 'string' && o.ml.trim())) return true;
  return Object.entries(o).some(([k, v]) => k !== 'en' && hasEnWithoutMl(v));
}
