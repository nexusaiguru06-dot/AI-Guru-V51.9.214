/**
 * Mandatory teaching-template selection (V51.9.8.2).
 *
 * Why the whiteboard was blank / text-only:
 *  1. Video-DNA was only injected into the Gemini prompt. When Gemini was down, DNA never reached the board.
 *  2. The visual-template-registry was never consulted offline.
 *  3. teacherReadingMode blocked offlineSolverResponse, so equation pages fell back to label text.
 *  4. buildLocalTeacherLesson could pass QA without a worked-solution template.
 *
 * This module is the single gate: pick a template family + Video-DNA grammar + optional style reference,
 * then build a lesson that MUST carry executable board actions (create + recolor / highlight).
 */
import { selectLessonVideoDna, selectChapterVideoDna, type LessonVideoDnaStrategy } from '../rag/video-dna-selector';
import { planTemplateSolution } from '../template-solver';
import { buildSolverLesson } from './offline-template-lesson';
import type { AIGuruTeachingLesson } from './types';
import type { MathDomain } from '../universal/types';
import type { PlannerInput } from './lesson-planner';
import { applyUniversal3B1BGrammar } from './apply-3b1b-all-branches';

export type TemplateFamily =
  | 'worked-solution-linear'
  | 'worked-solution-simultaneous'
  | 'worked-solution-quadratic'
  | 'worked-solution-arithmetic'
  | 'worked-solution-expression'
  | 'worked-solution-surd'
  | 'progressive-construction'
  | 'none';

export interface TemplateSelection {
  family: TemplateFamily;
  problem: string | null;
  dna: LessonVideoDnaStrategy | null;
  primaryDnaId: string | null;
  primaryArchetype: string;
  constructionPattern: string;
  motifs: string[];
  styleReferenceId: string | null;
  reason: string;
  mandatoryBoard: boolean;
}

/** Lightweight concept match against the visual-template-registry selectionTerms. */
const STYLE_CATALOG: Array<{ id: string; terms: string[]; domains: string[]; minGrade: number; maxGrade: number }> = [
  { id: 'mathlet-fundamental-algebra', terms: ['equation', 'solve', 'variable', 'algebra', 'simplify', 'expression', 'linear'], domains: ['algebra'], minGrade: 6, maxGrade: 12 },
  { id: 'mathlet-simultaneous', terms: ['simultaneous', 'pair', 'system', 'two equations', 'elimination'], domains: ['algebra'], minGrade: 7, maxGrade: 12 },
  { id: 'mathlet-area-model', terms: ['area', 'rectangle', 'product'], domains: ['geometry', 'algebra'], minGrade: 5, maxGrade: 10 },
  { id: 'mathlet-number-line', terms: ['number line', 'integer', 'add', 'subtract'], domains: ['arithmetic', 'algebra'], minGrade: 1, maxGrade: 8 },
];

function scoreStyle(question: string, domain: string, grade: number): { id: string; score: number } | null {
  const q = question.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const s of STYLE_CATALOG) {
    if (grade < s.minGrade || grade > s.maxGrade) continue;
    let score = s.domains.includes(domain) ? 3 : 0;
    for (const t of s.terms) if (q.includes(t)) score += 2;
    if (score >= 5 && (!best || score > best.score)) best = { id: s.id, score };
  }
  return best;
}

function familyFromSolution(family: string | undefined): TemplateFamily {
  switch (family) {
    case 'linear': return 'worked-solution-linear';
    case 'simultaneous': return 'worked-solution-simultaneous';
    case 'quadratic': return 'worked-solution-quadratic';
    case 'arithmetic': return 'worked-solution-arithmetic';
    case 'expression': case 'identity': return 'worked-solution-expression';
    case 'surd': return 'worked-solution-surd';
    default: return 'progressive-construction';
  }
}

/**
 * Select the teaching template for this page/problem.
 * Always runs (online or offline). Returns mandatoryBoard=true when a solver template applies.
 */
export async function selectTeachingTemplate(input: {
  question: string;
  grade: number;
  domain: MathDomain;
  chapterTitle?: string;
  chapterSummary?: string;
  chapterTopics?: string[];
  learningGoal?: string;
  sourceText?: string;
}): Promise<TemplateSelection> {
  const source = `${input.question}\n${input.sourceText || ''}`.trim();
  // Prefer explicit equations / word-problem patterns, then raw question.
  let problem: string | null = null;
  try {
    // dynamic import path avoided — callers pass derived problem when available
    problem = input.question.includes('=') ? input.question : null;
  } catch { /* */ }

  // Try solver recognition on several candidates
  const candidates = [
    problem,
    source.match(/[a-zA-Z0-9().+\-−×*/^²³√\s]{1,80}=\s*[a-zA-Z0-9().+\-−×*/^²³√\s]{1,40}/)?.[0],
  ].filter(Boolean) as string[];

  // Word-problem shortcuts (beads / table-chair) — keep in sync with lesson-planner patterns
  const beadsTotal = /there are\s+(\d+)\s+beads.*?(?:black and white|black,?\s*white)/i.exec(source);
  const beadsMore = /(\d+)\s+more\s+black\s+(?:than|then)\s+white/i.exec(source);
  if (beadsTotal && beadsMore) candidates.unshift(`b + w = ${beadsTotal[1]} and b = w + ${beadsMore[1]}`);
  const table1 = /price of (?:a\s+)?table and (?:a\s+)?chair is\s+(\d+(?:\.\d+)?)/i.exec(source);
  const table2 = /price of (?:a\s+)?table and (?:four|4)\s+chairs?\s+is\s+(\d+(?:\.\d+)?)/i.exec(source);
  if (table1 && table2) candidates.unshift(`t + c = ${table1[1]} and t + 4c = ${table2[1]}`);

  let solution = null as ReturnType<typeof planTemplateSolution>;
  let chosenProblem: string | null = null;
  for (const c of [...new Set(candidates)]) {
    const s = planTemplateSolution(c);
    if (s && s.rows.length >= 2) { solution = s; chosenProblem = c; break; }
  }

  // Video-DNA hierarchical selection (grammar only — never executes Manim)
  let dna: LessonVideoDnaStrategy | null = null;
  try {
    const chapter = (input.chapterTitle || input.chapterSummary || (input.chapterTopics?.length ?? 0))
      ? await selectChapterVideoDna({
          chapterTitle: input.chapterTitle,
          chapterSummary: input.chapterSummary,
          chapterTopics: input.chapterTopics,
          domain: input.domain,
          learningGoal: input.learningGoal,
          grade: input.grade,
        })
      : undefined;
    dna = await selectLessonVideoDna({
      chapterTitle: input.chapterTitle,
      chapterSummary: input.chapterSummary,
      chapterTopics: input.chapterTopics,
      question: input.question,
      learningGoal: input.learningGoal,
      domain: input.domain,
      grade: input.grade,
    }, chapter);
  } catch {
    dna = null;
  }

  const style = scoreStyle(source, String(input.domain), input.grade);
  const primary = dna?.selections?.[0];

  if (solution && chosenProblem) {
    return {
      family: familyFromSolution(solution.family),
      problem: chosenProblem,
      dna,
      primaryDnaId: primary?.id ?? null,
      primaryArchetype: primary?.archetype || 'worked-solution',
      constructionPattern: (primary?.entry?.constructionOrder?.[0] as string | undefined) || 'build-recolor-build',
      motifs: [...((primary?.entry?.motifs ?? []).map((m: { pattern?: string }) => m.pattern).filter(Boolean) as string[]), 'one-colour-per-step', 'variable-colour-binding', 'focus-arc'].slice(0, 8),
      styleReferenceId: style?.id ?? null,
      reason: `Mandatory worked-solution template (${solution.family}) + Video-DNA ${primary?.id ?? 'default'}`,
      mandatoryBoard: true,
    };
  }

  return {
    family: 'progressive-construction',
    problem: null,
    dna,
    primaryDnaId: primary?.id ?? null,
    primaryArchetype: primary?.archetype || 'progressive-construction',
    constructionPattern: (primary?.entry?.constructionOrder?.[0] as string | undefined) || 'build-transform-build',
    motifs: ((primary?.entry?.motifs ?? []).map((m: { pattern?: string }) => m.pattern).filter(Boolean) as string[]).slice(0, 6).length ? ((primary?.entry?.motifs ?? []).map((m: { pattern?: string }) => m.pattern).filter(Boolean) as string[]).slice(0, 6) : ['teacher-reading'],
    styleReferenceId: style?.id ?? null,
    reason: 'No deterministic equation template; Video-DNA progressive construction only',
    mandatoryBoard: false,
  };
}

/** Apply selection grammar onto an existing lesson (offline or online). */
export function applyTemplateSelectionGrammar(lesson: AIGuruTeachingLesson, selection: TemplateSelection): AIGuruTeachingLesson {
  // Universal 3B1B for ALL math branches — mandatoryBoard no longer gates cinematic style.
  return applyUniversal3B1BGrammar(lesson as unknown as Parameters<typeof applyUniversal3B1BGrammar>[0], selection) as unknown as AIGuruTeachingLesson;
}

/**
 * Build the mandatory board lesson when a solver template is available.
 * Returns null only when mandatoryBoard is false.
 */
export function buildMandatoryTemplateLesson(
  input: PlannerInput,
  selection: TemplateSelection,
): AIGuruTeachingLesson | null {
  if (!selection.mandatoryBoard || !selection.problem) return null;
  const solver = buildSolverLesson({
    question: selection.problem,
    grade: input.grade,
    domain: input.domain,
    language: input.language,
    chapterTitle: input.chapterTitle,
  });
  if (!solver) return null;
  return applyTemplateSelectionGrammar(solver, selection);
}
