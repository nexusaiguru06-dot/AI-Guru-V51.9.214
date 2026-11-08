/**
 * V51.9.58 — the chapter introduction plan, made from the chapter's own sections (no AI needed):
 * the topics are the sections' headings, each topic's small example is the first equation (or pair of equations)
 * in that section that a scale can show, and the background formulas are the equations found in the text.
 * The Malayalam wording is a draft for a teacher to check; names without a Malayalam form stay as printed.
 */

import type { BookBlock } from '../segment';
import type { Bi, BlockPlan, ChapterIntroPlan, IntroExample, IntroTopic } from '../dna/types';
import { findBalEquations } from '../dna/bal-math';
import { findPairEquations } from '../dna/pair-math';
import { CI_FORMULA_RE, CI_MAX_FORMULAS, CI_MAX_TOPICS, CI_MIN_TOPICS, introProblems, pairFacts, solveFacts } from '../dna/ci-math';

export interface IntroSection {
  heading?: string;
  text: string;
}

const ML = /[ഀ-ൿ]/;

const clean = (s: string): string =>
  s
    .replace(/^[\s\d.)(\-–:]+(?=[A-Za-zഀ-ൿ])/, '')
    .replace(/[\s:.\-–]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

const bi = (en: string, ml: string): Bi => ({ en, ml });
const name = (s: string): Bi => bi(s, s);

function exampleFor(text: string, used: Set<string>): { ex: IntroExample; line: string; answer: string } | null {
  for (const e of findBalEquations(text)) {
    if (e.d !== undefined) continue;
    const f = solveFacts(e);
    if (f && !used.has(f.first)) return { ex: { kind: 'solve', a: e.a, b: e.b, c: e.c, letter: e.letter }, line: f.first, answer: f.answer };
  }
  for (const p of findPairEquations(text)) {
    const f = pairFacts(p.e1, p.e2);
    if (f && !used.has(f.l1)) return { ex: { kind: 'pair', e1: p.e1, e2: p.e2 }, line: `${f.l1}, ${f.l2}`, answer: f.answer };
  }
  return null;
}

function formulasIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/[0-9a-zA-Z()+\-−×÷ ²³.]{1,14}=[0-9a-zA-Z()+\-−×÷ ²³.]{1,14}/g)) {
    const f = m[0].replace(/\s+/g, ' ').trim();
    if (f.length >= 5 && f.length <= 24 && /[a-z]/.test(f) && CI_FORMULA_RE.test(f) && !out.includes(f)) out.push(f);
  }
  return out;
}

/** The intro plan for a chapter, or null when its sections give fewer than two topics. */
export function chapterIntroPlan(chapterTitle: string, sections: IntroSection[]): ChapterIntroPlan | null {
  const title = clean(chapterTitle);
  if (!title) return null;
  // One topic per section heading (first appearance), at most six.
  const seen = new Set<string>();
  const picked: Array<{ head: string; text: string }> = [];
  for (const s of sections) {
    const h = clean(s.heading ?? '');
    if (!h || h.length > 40 || seen.has(h.toLowerCase()) || h.toLowerCase() === title.toLowerCase()) continue;
    seen.add(h.toLowerCase());
    picked.push({ head: h, text: s.text });
    if (picked.length === CI_MAX_TOPICS) break;
  }
  if (picked.length < CI_MIN_TOPICS) return null;

  const used = new Set<string>();
  const topics: IntroTopic[] = picked.map((p, i) => {
    const found = exampleFor(p.text, used);
    if (found) used.add(found.line.split(',')[0]);
    const en = found ? `${p.head}. For example, ${found.line}. We find ${found.answer}.` : `${i + 1}. ${p.head}.`;
    const ml = found ? `${p.head}. ഒരു ഉദാഹരണം നോക്കാം: ${found.line}. ഉത്തരം ${found.answer}.` : `${i + 1}. ${p.head}.`;
    return { name: name(p.head), say: bi(en, ml), ...(found ? { example: found.ex } : {}) };
  });

  const found = sections.flatMap((s) => formulasIn(s.text));
  const formulas = [...new Set([...topics.flatMap((t) => (t.example ? [exampleLine(t.example)] : [])), ...found])].slice(0, CI_MAX_FORMULAS);

  const list = picked.map((p) => p.head).join(', ');
  const plan: ChapterIntroPlan = {
    title: ML.test(title) ? bi(title, title) : name(title),
    formulas,
    topics,
    welcome: bi(`Welcome to the chapter ${title}. Let us see what we are going to learn.`, `${title} എന്ന അധ്യായത്തിലേക്ക് സ്വാഗതം. ഈ അധ്യായത്തിൽ നമ്മൾ എന്തൊക്കെ പഠിക്കും എന്ന് നോക്കാം.`),
    closing: bi(`That is our plan for ${title}: ${list}. Let us begin.`, `${title} ൽ നമ്മൾ പഠിക്കാൻ പോകുന്നത്: ${list}. നമുക്ക് തുടങ്ങാം.`),
  };
  return introProblems(plan).length ? null : plan;
}

function exampleLine(ex: IntroExample): string {
  if (ex.kind === 'solve') return solveFacts(ex)?.first ?? '';
  return pairFacts(ex.e1, ex.e2)?.l1 ?? '';
}

/** The block and plan that put the intro in front of a section's own blocks (kind heading: no reading scene). */
export function introBlock(plan: ChapterIntroPlan): { block: BookBlock; plan: BlockPlan } {
  const block: BookBlock = { id: 'chapter-intro', kind: 'heading', page: 0, chapterId: '', sectionId: '', lines: [], text: plan.title.en };
  return { block, plan: { blockId: block.id, dna: 'chapter-intro', read: { en: plan.title.en, ml: plan.title.ml }, teach: plan, source: 'offline' } };
}
