/**
 * Patch helper: apply universal 3B1B grammar to any lesson, regardless of domain.
 *
 * Drop-in replacement logic for applyTemplateSelectionGrammar in template-selector.ts
 * and the visualGrammar merge in lesson-planner.ts.
 */

import type { MathDomain } from '../universal/types';
import { getUniversal3B1BGrammar, shouldForce3B1BBoard } from '../universal/three-b1b-universal-policy';

/** Minimal lesson shape we need to stamp. */
export interface LessonVisualGrammarTarget {
  domain?: string | null;
  visualGrammar?: Record<string, unknown> | null;
  expression?: string | null;
}

export interface TemplateSelectionLike {
  mandatoryBoard?: boolean;
  primaryArchetype?: string | null;
  constructionPattern?: string | null;
  motifs?: string[] | null;
  dna?: { selections?: { id?: string }[]; qaRules?: string[] } | null;
  problem?: string | null;
}

/**
 * Always stamp 3b1b-classroom grammar for every domain.
 * mandatoryBoard still controls whether a deterministic solver template is used,
 * but it no longer gates the cinematic teaching style.
 */
export function applyUniversal3B1BGrammar<T extends LessonVisualGrammarTarget>(
  lesson: T,
  selection?: TemplateSelectionLike | null,
  domainOverride?: MathDomain,
): T {
  const domain = (domainOverride
    || (lesson.domain as MathDomain)
    || 'general') as MathDomain;

  const grammar = getUniversal3B1BGrammar(domain);
  const dnaIds = selection?.dna?.selections?.map((s) => s.id).filter(Boolean).slice(0, 8) as string[] ?? [];
  const selectionMotifs = (selection?.motifs ?? []).filter(Boolean) as string[];

  lesson.visualGrammar = {
    ...(lesson.visualGrammar || {}),
    archetype: grammar.archetype,
    dnaIds: dnaIds.length ? dnaIds : ((lesson.visualGrammar as any)?.dnaIds ?? []),
    constructionPattern: grammar.constructionPattern,
    motifs: [...new Set([...grammar.motifs, ...selectionMotifs])].slice(0, 16),
    pacing: grammar.pacing,
    camera: grammar.camera,
    qaRules: selection?.dna?.qaRules?.length
      ? selection.dna.qaRules
      : grammar.qaRules,
    // Domain-specific guidance for the compiler / manim-web adapter
    preferredObjects: grammar.preferredObjects,
    recipe: grammar.recipe,
    principle: grammar.principle,
    forceFullBoard: shouldForce3B1BBoard(domain),
  };

  if (selection?.problem && !lesson.expression) {
    lesson.expression = selection.problem;
  }

  return lesson;
}
