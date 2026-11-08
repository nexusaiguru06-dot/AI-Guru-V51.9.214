import visualTemplateRegistry from '../../../data/ai-guru/reference-styles/ai-guru-visual-template-registry.json';
import type { MathDomain } from '../math/universal/types';

export type TeachingStrategy = 'referral_video' | 'step_by_step' | 'specialized_visual' | 'hybrid';

export interface ReferralVideoCandidate {
  id: string;
  file: string;
  originalFilename: string;
  durationSeconds: number;
  subject: string;
  domains: string[];
  suggestedGrades: string;
  concepts: string[];
  teachingPrompt: string;
  qaInstructions: string[];
  qaProfileId: string;
  /** Explicit search vocabulary used to prevent subject-only referral selection. */
  selectionTerms?: string[];
  /** Optional collection/segment metadata for the reference library. */
  assetType?: 'full_reference' | 'reference_segment' | 'interactive_template';
  mediaKind?: 'video' | 'interactive_visual_template';
  templateUrl?: string;
  templateSource?: string;
  templatePath?: string;
  parentReferenceId?: string;
  segmentId?: string;
  sourceStartMs?: number;
  sourceEndMs?: number;
  teachingMethods?: string[];
  /** Written by scripts/ai-guru-reference-analyzer.mjs: machine-readable style spec, keyframes and contact sheet of the reference video. */
  styleSpecFile?: string;
  contactSheet?: string;
  keyframeDir?: string;
  analysis?: { source: string; analyzedAt: string };
}

export interface TeachingStrategyDecision {
  strategy: TeachingStrategy;
  reason: string;
  domain: MathDomain;
  referral?: ReferralVideoCandidate;
  confidence: 'high' | 'medium' | 'low';
  solverRequired: boolean;
  visualEngine: 'referral-video' | 'universal-math' | 'specialized' | 'hybrid';
}

// Interactive Mathlet templates are retained only for non-General-Class strategy
// paths (for example Material Studio practice content). General Class is guarded
// by mode:'general-class' and uses Chapter → Lesson → Beat Video-DNA instead.
const assets = [
  ...(visualTemplateRegistry.assets ?? []),
] as unknown as ReferralVideoCandidate[];
const STOP = new Set(['the','a','an','of','to','for','and','or','is','are','how','what','find','solve','calculate','explain','show','using','with','from','this','that','can','please','me','derive']);

function tokens(text: string) {
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s²³Δπ±]/g, ' ').split(/\s+/).filter(t => t.length > 2 && !STOP.has(t)));
}

function gradeMatches(asset: ReferralVideoCandidate, grade: number) {
  const nums = asset.suggestedGrades.match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return true;
  if (asset.suggestedGrades.includes('-')) {
    const [lo, hi] = nums;
    return grade >= lo && grade <= hi;
  }
  return nums.includes(grade);
}

function conceptMatchCount(question: string, asset: ReferralVideoCandidate) {
  const q = tokens(question);
  const terms = asset.selectionTerms?.length ? asset.selectionTerms : asset.concepts;
  let matches = 0;
  for (const term of terms) {
    const normalized = tokens(term);
    if ([...normalized].some(t => q.has(t))) matches += 1;
  }
  // Structural concept signal for WORKED solutions: three or more equation-like lines
  // (an "=", a lone variable letter and a number) is a multi-step equation-solving lesson even
  // when none of the template's vocabulary appears. A single bare equation ("Solve 7x - 11 = 24")
  // deliberately does NOT qualify - domain/shape alone must never trigger a referral.
  if (asset.concepts?.some(c => /linear equation/i.test(c))) {
    const equationLines = question.split(/\n/).filter(l => /=/.test(l) && /(^|[^a-z])[a-z]([^a-z]|$)/i.test(l) && /\d/.test(l)).length;
    if (equationLines >= 3) matches += 1;
  }
  return matches;
}

function scoreReferral(question: string, domain: MathDomain, grade: number, asset: ReferralVideoCandidate) {
  let score = 0;
  const conceptMatches = conceptMatchCount(question, asset);
  if (asset.domains.includes(domain)) score += 5;
  if (gradeMatches(asset, grade)) score += 3;
  score += Math.min(conceptMatches, 4) * 2;
  if (asset.qaProfileId) score += 1;
  return { score, conceptMatches };
}

export function findBestReferral(question: string, domain: MathDomain, grade: number): ReferralVideoCandidate | undefined {
  return assets
    .map(asset => ({ asset, ...scoreReferral(question, domain, grade, asset) }))
    // Critical safety rule: domain/grade alone can never trigger a referral.
    .filter(x => x.conceptMatches > 0 && x.score >= 7)
    .sort((a, b) => b.score - a.score)[0]?.asset;
}

export function selectTeachingStrategy(input: { question: string; domain: MathDomain; grade: number; hasActualProblem?: boolean; mode?: 'general-class' | 'material-studio' }): TeachingStrategyDecision {
  const question = input.question.trim();
  if (input.mode === 'general-class') {
    return { strategy: 'specialized_visual', reason: 'General Class is DNA-first: textbook/RAG determines what is taught; Chapter → Lesson → Beat Video-DNA determines how the idea is visually constructed. Interactive Mathlet templates are reserved for Material Studio practice content.', domain: input.domain, confidence: 'high', solverRequired: /\b(solve|find|calculate|evaluate|differentiate|integrate|prove|factor|simplify|determine)\b|=/.test(question.toLowerCase()), visualEngine: 'specialized' };
  }
  const lower = question.toLowerCase();
  const hasProblem = input.hasActualProblem ?? /\b(solve|find|calculate|evaluate|differentiate|integrate|prove|factor|simplify|determine)\b|=/.test(lower);
  const referral = findBestReferral(question, input.domain, input.grade);
  const conceptRequest = /\b(what is|explain|understand|concept|why|how does|meaning of|teach me)\b/.test(lower) && !hasProblem;
  const graphOrGeometry = ['geometry','3d_geometry','coordinate_geometry','functions','trigonometry','statistics','probability','number_systems','inequalities','sets','combinatorics'].includes(input.domain);

  if (conceptRequest && referral) {
    return { strategy: 'referral_video', reason: 'An approved concept-matched referral video is available and the request is primarily conceptual.', domain: input.domain, referral, confidence: 'high', solverRequired: false, visualEngine: 'referral-video' };
  }
  if (hasProblem && referral) {
    return { strategy: 'hybrid', reason: 'A relevant approved reference can introduce the concept, while the actual problem still requires a verified solution.', domain: input.domain, referral, confidence: 'high', solverRequired: true, visualEngine: 'hybrid' };
  }
  if (graphOrGeometry && !hasProblem) {
    return { strategy: 'specialized_visual', reason: 'The request is primarily visual/constructive and does not require an exact symbolic solution.', domain: input.domain, confidence: 'medium', solverRequired: false, visualEngine: 'specialized' };
  }
  return { strategy: 'specialized_visual', reason: hasProblem ? 'Classroom mode keeps the general-teaching visual style while explaining and solving the example inside the lesson.' : 'A general-teaching visual explanation is appropriate when no specific template is sufficiently matched.', domain: input.domain, confidence: 'medium', solverRequired: hasProblem, visualEngine: 'specialized' };
}
