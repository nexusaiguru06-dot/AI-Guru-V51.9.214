import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { MathDomain } from '../math/universal/types';
import type { AIGuruTeachingLesson, TeachingBeat } from '../math/teaching/types';
import type { GuruScene } from './scene-contracts';

export type VideoDNARenderer = 'math-engine' | 'ltx' | 'composition';
export type VideoDNACamera = 'static' | 'focus' | 'cinematic';
export type VideoDNAPacing = 'slow' | 'medium' | 'fast';
export type VideoDNAMotion = 'build' | 'transform' | 'move' | 'remove' | 'highlight' | 'compare' | 'derive' | 'pause';

export interface VideoDNAKeyframeSpec {
  id: string;
  atMs: number;
  state: string;
  purpose?: string;
}

export interface VideoDNAReference {
  id: string;
  source: 'general-visual-dna' | 'general-video-dna' | 'problem-solving-video-dna' | 'existing-lesson';
  score: number;
  branch?: string;
  domain?: string;
  archetype?: string;
  concepts: string[];
  constructionOrder: string[];
  motifs: string[];
  pacing?: VideoDNAPacing;
  camera?: VideoDNACamera;
  visualGrammar?: string;
  sourceAsset?: string;
  matchReasons: string[];
}

export interface VideoDNASelectionInput {
  lesson: Pick<AIGuruTeachingLesson, 'id' | 'title' | 'grade' | 'gradeBand' | 'domain' | 'learningGoal' | 'visualGrammar' | 'runningExample'>;
  segment?: {
    id: string;
    title: string;
    intuition?: string;
    mathematics?: string;
    beats?: TeachingBeat[];
  };
  problemText?: string;
  expression?: string;
  teachingIntent?: string;
  requiredVisuals?: string[];
  preferredReferenceIds?: string[];
  previousDNAId?: string;
}

export interface VideoDNAStyle {
  family: string;
  pacing: VideoDNAPacing;
  camera: VideoDNACamera;
  motionArc: VideoDNAMotion[];
  constructionOrder: string[];
  motifs: string[];
  typography: 'math-engine' | 'minimal' | 'reference-derived';
  background: 'neutral' | 'textbook' | 'cinematic' | 'none';
}

export interface VideoDNARenderPolicy {
  exactMath: { renderer: 'math-engine'; deterministic: true };
  generative: { renderer: 'ltx' | 'none'; enabled: boolean; deterministic: false };
  composition: { renderer: 'composition'; deterministic: true };
}

export interface VideoDNASelection {
  schemaVersion: '2.0';
  selectionId: string;
  lessonId: string;
  domain: MathDomain;
  grade: number;
  gradeBand: AIGuruTeachingLesson['gradeBand'];
  intent: string;
  primary: VideoDNAReference;
  alternatives: VideoDNAReference[];
  style: VideoDNAStyle;
  keyframes: VideoDNAKeyframeSpec[];
  renderPolicy: VideoDNARenderPolicy;
  reasons: string[];
  guardrails: string[];
  retrieval: {
    deterministic: true;
    corpus: string[];
    candidateCount: number;
  };
}

type GeneralEntry = {
  id: string;
  branch?: string;
  domain?: string;
  concepts?: string[];
  selectionTerms?: string[];
  cameraMode?: string[];
  typicalArc?: string[];
  constructionOrder?: string[];
  motifs?: Array<{ pattern?: string }>;
  beatMix?: Record<string, number>;
  pacing?: { runTimeSec?: { median?: number }; waitSec?: { median?: number } };
  archetype?: string;
  tier?: string;
  portable?: boolean;
  duplicateOf?: string;
  characterDriven?: boolean;
  visualGrammar?: string;
  source?: { repo?: string; path?: string };
};

type ProblemEntry = {
  id: string;
  branch?: string;
  concepts?: string[];
  selectionTerms?: string[];
  constructionOrder?: string[];
  visualGrammar?: string;
  sourceVideo?: string;
  pacing?: { durationSeconds?: number };
};

let generalCache: Record<string, GeneralEntry> | null = null;
let problemCache: Record<string, ProblemEntry> | null = null;

const DOMAIN_ALIASES: Record<string, string[]> = {
  arithmetic: ['arithmetic', 'number', 'calculation', 'addition', 'subtraction', 'multiplication', 'division'],
  number_systems: ['number systems', 'integers', 'number line', 'rational numbers', 'real numbers'],
  fractions: ['fraction', 'fractions', 'numerator', 'denominator', 'equivalent fraction'],
  decimals_percentages: ['decimal', 'percentage', 'percent', 'ratio'],
  ratio_proportion: ['ratio', 'proportion', 'rate', 'scale'],
  algebra: ['algebra', 'equation', 'variable', 'term', 'expression'],
  linear_equations: ['linear equation', 'equation', 'balance', 'both sides', 'solve'],
  inequalities: ['inequality', 'inequalities', 'number line', 'solution set'],
  polynomials: ['polynomial', 'factor', 'factorise', 'quadratic', 'expand'],
  sequences_series: ['sequence', 'series', 'pattern', 'sum'],
  coordinate_geometry: ['coordinate', 'slope', 'line', 'point', 'graph'],
  functions: ['function', 'mapping', 'input', 'output', 'graph'],
  trigonometry: ['trigonometry', 'sine', 'cosine', 'tangent', 'angle', 'triangle'],
  geometry: ['geometry', 'triangle', 'angle', 'circle', 'proof', 'construction'],
  mensuration: ['area', 'volume', 'surface area', 'perimeter', 'mensuration'],
  calculus: ['calculus', 'derivative', 'integral', 'limit', 'slope', 'area under curve'],
  statistics: ['statistics', 'mean', 'median', 'mode', 'data', 'distribution', 'chart'],
  probability: ['probability', 'sample space', 'event', 'chance', 'tree diagram'],
  matrices: ['matrix', 'matrices', 'row', 'column', 'determinant'],
  vectors: ['vector', 'vectors', 'magnitude', 'direction'],
  complex_numbers: ['complex number', 'imaginary', 'real part', 'complex plane'],
  financial_math: ['interest', 'profit', 'loss', 'finance', 'discount', 'compound'],
  '3d_geometry': ['3d', 'solid', 'cube', 'sphere', 'cylinder', 'cone'],
  sets: ['set', 'sets', 'union', 'intersection', 'venn'],
  combinatorics: ['combinatorics', 'permutation', 'combination', 'counting'],
  general: ['math', 'concept', 'explain', 'example'],
};

const VISUAL_HINTS: Record<string, string[]> = {
  graph: ['graph', 'plot', 'curve', 'axis', 'coordinate', 'slope', 'function'],
  geometry: ['triangle', 'circle', 'angle', 'line', 'shape', 'construction', 'proof'],
  transformation: ['transform', 'rewrite', 'simplify', 'equivalent', 'becomes', 'move', 'shift'],
  token: ['digit', 'term', 'number', 'fraction', 'numerator', 'denominator', 'cancel'],
  comparison: ['compare', 'difference', 'greater', 'less', 'before', 'after'],
  highlight: ['highlight', 'focus', 'notice', 'important', 'emphasis'],
};

function tokenize(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0d00-\u0d7f]+/g, ' ')
    .split(/\s+/)
    .filter((x) => x.length >= 2);
}

function tokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

function overlap(query: Set<string>, values: string[]): number {
  const terms = new Set(values.flatMap(tokenize));
  let score = 0;
  for (const token of query) if (terms.has(token)) score += 1;
  return score;
}

function normalizeDomain(domain: MathDomain): string {
  return domain.replace(/_/g, '-').toLowerCase();
}

function inferPacing(entry: GeneralEntry | ProblemEntry, lessonGrade: number): VideoDNAPacing {
  const pacing = 'pacing' in entry ? entry.pacing : undefined;
  const median = pacing && 'runTimeSec' in pacing ? pacing.runTimeSec?.median : undefined;
  if (typeof median === 'number') {
    if (median <= 0.75) return 'fast';
    if (median >= 2.5) return 'slow';
  }
  if (lessonGrade <= 5) return 'slow';
  return 'medium';
}

function inferCamera(entry: GeneralEntry): VideoDNACamera {
  const mode = (entry.cameraMode ?? []).join(' ').toLowerCase();
  if (mode.includes('zoom') || mode.includes('graph') || mode.includes('focus')) return 'focus';
  if (mode.includes('cinematic') || mode.includes('3d')) return 'cinematic';
  return 'static';
}

function motionArc(entry: GeneralEntry | ProblemEntry): VideoDNAMotion[] {
  const raw = 'typicalArc' in entry ? entry.typicalArc ?? [] : [];
  const normalized = raw
    .map((x) => x.toLowerCase())
    .filter((x): x is VideoDNAMotion => ['build', 'transform', 'move', 'remove'].includes(x)) as VideoDNAMotion[];
  const construction = entry.constructionOrder ?? [];
  if (construction.some((x) => /highlight|emphasis|focus/i.test(x))) normalized.push('highlight');
  if (!normalized.length) normalized.push('build', 'transform');
  return [...new Set(normalized)];
}

function styleFamily(entry: GeneralEntry | ProblemEntry): string {
  if ('archetype' in entry && entry.archetype) return entry.archetype;
  if ('branch' in entry && entry.branch) return `${entry.branch}-teaching`;
  return 'general-step-by-step';
}

async function loadGeneral(): Promise<Record<string, GeneralEntry>> {
  if (generalCache) return generalCache;
  try {
    const raw = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'ai-guru', 'video-dna', 'general', '3b1b-video-dna.json'), 'utf8'));
    generalCache = raw?.entries ?? {};
  } catch {
    generalCache = {};
  }
  return generalCache ?? {};
}

async function loadProblem(): Promise<Record<string, ProblemEntry>> {
  if (problemCache) return problemCache;
  try {
    const raw = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'ai-guru', 'video-dna', 'problem-solving-video-dna.json'), 'utf8'));
    problemCache = raw?.entries ?? {};
  } catch {
    problemCache = {};
  }
  return problemCache ?? {};
}

function buildQuery(input: VideoDNASelectionInput): { text: string; tokens: Set<string> } {
  const beatText = input.segment?.beats?.map((beat) => `${beat.visualIntent} ${beat.narration} ${(beat.targetObjects ?? []).join(' ')}`).join(' ') ?? '';
  const text = [
    input.lesson.title,
    input.lesson.learningGoal,
    input.lesson.visualGrammar?.archetype,
    input.lesson.visualGrammar?.constructionPattern,
    ...(input.lesson.visualGrammar?.motifs ?? []),
    input.segment?.title,
    input.segment?.intuition,
    input.segment?.mathematics,
    input.problemText,
    input.expression,
    input.teachingIntent,
    ...(input.requiredVisuals ?? []),
    beatText,
    ...(DOMAIN_ALIASES[input.lesson.domain] ?? []),
  ].filter(Boolean).join(' ');
  return { text, tokens: tokenSet(text) };
}

function scoreEntry(entry: GeneralEntry | ProblemEntry, input: VideoDNASelectionInput, query: Set<string>, family: VideoDNAReference['source']): { score: number; reasons: string[] } {
  const domain = normalizeDomain(input.lesson.domain);
  const entryDomain = String('domain' in entry ? entry.domain ?? '' : '').toLowerCase().replace(/_/g, '-');
  const branch = String(entry.branch ?? '').toLowerCase().replace(/_/g, '-');
  const terms = [
    ...(entry.concepts ?? []),
    ...(entry.selectionTerms ?? []),
    entryDomain,
    branch,
    'archetype' in entry ? entry.archetype : '',
  ].filter(Boolean) as string[];

  let score = overlap(query, terms) * 2;
  const reasons: string[] = [];

  const domainAliases = DOMAIN_ALIASES[input.lesson.domain] ?? [];
  const domainOverlap = overlap(new Set(domainAliases.flatMap(tokenize)), terms);
  if (domainOverlap) {
    score += Math.min(12, domainOverlap * 2.5);
    reasons.push(`domain overlap=${domainOverlap}`);
  }

  if (branch === domain || branch.includes(domain) || domain.includes(branch)) {
    score += 9;
    reasons.push('branch/domain match');
  } else if (branch && domain !== 'general') {
    score -= 10;
    reasons.push('branch/domain mismatch penalty');
  }

  for (const [kind, hints] of Object.entries(VISUAL_HINTS)) {
    if (hints.some((hint) => query.has(hint)) && overlap(query, hints) > 0) {
      if (terms.some((term) => hints.some((hint) => term.toLowerCase().includes(hint)))) {
        score += 3;
        reasons.push(`visual affordance=${kind}`);
      }
    }
  }

  if (input.preferredReferenceIds?.includes(entry.id)) {
    score += 30;
    reasons.push('explicitly preferred reference');
  }

  if (input.previousDNAId === entry.id) {
    score += 5;
    reasons.push('continuity with previous DNA');
  }

  if (family === 'problem-solving-video-dna') {
    score += 1.5;
    reasons.push('problem-solving corpus');
  } else if (family === 'general-video-dna') {
    score += 1;
    reasons.push('general video-DNA corpus');
  }

  if ('portable' in entry && entry.portable === false) score -= 100;
  if ('characterDriven' in entry && entry.characterDriven) score -= 20;
  if ('tier' in entry && entry.tier === 'style-only') score -= 100;
  if ('duplicateOf' in entry && entry.duplicateOf) score -= 50;

  return { score, reasons };
}

function toReference(entry: GeneralEntry | ProblemEntry, score: number, reasons: string[], source: VideoDNAReference['source'], grade: number): VideoDNAReference {
  const motifs = ('motifs' in entry ? (entry.motifs ?? []).map((x) => x.pattern ?? '').filter(Boolean) : []);
  return {
    id: entry.id,
    source,
    score: Number(score.toFixed(3)),
    branch: entry.branch,
    domain: 'domain' in entry ? entry.domain : entry.branch,
    archetype: 'archetype' in entry ? entry.archetype : undefined,
    concepts: entry.concepts ?? [],
    constructionOrder: entry.constructionOrder ?? [],
    motifs,
    pacing: inferPacing(entry, grade),
    camera: 'cameraMode' in entry ? inferCamera(entry) : 'focus',
    visualGrammar: entry.visualGrammar,
    // The general corpus stores repository source paths, not runtime media assets.
    // Only the dedicated local reference-video corpus is an actual asset source.
    sourceAsset: 'sourceVideo' in entry ? entry.sourceVideo : undefined,
    matchReasons: reasons,
  };
}

function fallbackReference(input: VideoDNASelectionInput): VideoDNAReference {
  const domain = input.lesson.domain;
  return {
    id: `builtin:${domain}`,
    source: 'existing-lesson',
    score: 0,
    branch: domain,
    domain,
    archetype: 'deterministic-step-by-step',
    concepts: DOMAIN_ALIASES[domain] ?? ['math'],
    constructionOrder: ['establish context', 'introduce verified mathematical objects', 'transform progressively', 'highlight insight', 'pause before conclusion'],
    motifs: ['build->transform', 'highlight->pause'],
    pacing: input.lesson.grade <= 5 ? 'slow' : 'medium',
    camera: 'focus',
    visualGrammar: 'Use original AI Guru visual actions with deterministic mathematics and progressive explanation.',
    matchReasons: ['safe deterministic fallback; no suitable corpus match'],
  };
}

function buildKeyframes(input: VideoDNASelectionInput, primary: VideoDNAReference): VideoDNAKeyframeSpec[] {
  const beats = input.segment?.beats ?? [];
  if (!beats.length) {
    return [
      { id: 'dna:start', atMs: 0, state: 'context', purpose: 'establish the mathematical context' },
      { id: 'dna:build', atMs: 1000, state: 'build', purpose: primary.constructionOrder[0] ?? 'introduce the object' },
      { id: 'dna:insight', atMs: 2500, state: 'insight', purpose: 'highlight the teaching insight' },
    ];
  }
  const duration = beats.reduce((sum, beat) => sum + (beat.durationMs ?? 2500), 0);
  let cursor = 0;
  return beats.slice(0, 8).map((beat, index) => {
    const atMs = cursor;
    cursor += beat.durationMs ?? Math.max(500, Math.floor(duration / beats.length));
    return {
      id: `dna:beat:${beat.id}`,
      atMs,
      state: beat.visualIntent ?? 'beat',
      purpose: primary.constructionOrder[index] ?? primary.motifs[index % Math.max(1, primary.motifs.length)] ?? 'advance the explanation',
    };
  });
}

function buildStyle(input: VideoDNASelectionInput, primary: VideoDNAReference, generativeEnabled: boolean): VideoDNAStyle {
  const requestedPacing = input.lesson.visualGrammar?.pacing;
  const requestedCamera = input.lesson.visualGrammar?.camera;
  return {
    family: primary.archetype ?? primary.branch ?? 'general-step-by-step',
    pacing: requestedPacing ?? primary.pacing ?? 'medium',
    camera: requestedCamera ?? primary.camera ?? 'focus',
    motionArc: [
      ...primary.constructionOrder.some((x) => /build|establish|introduce|draw/i.test(x)) ? ['build' as const] : [],
      ...primary.constructionOrder.some((x) => /transform|rewrite|morph/i.test(x)) ? ['transform' as const] : [],
      ...primary.constructionOrder.some((x) => /move|track|shift/i.test(x)) ? ['move' as const] : [],
      ...primary.constructionOrder.some((x) => /highlight|focus|emphasis/i.test(x)) ? ['highlight' as const] : [],
      ...primary.constructionOrder.some((x) => /remove|erase|fade/i.test(x)) ? ['remove' as const] : [],
      ...(primary.motifs.length ? [] : ['pause' as const]),
    ].filter((value, index, arr) => arr.indexOf(value) === index),
    constructionOrder: primary.constructionOrder.slice(0, 8),
    motifs: primary.motifs.slice(0, 6),
    typography: 'math-engine',
    background: generativeEnabled ? 'cinematic' : 'neutral',
  };
}

/**
 * Deterministic Video-DNA v2 selector.
 * It chooses a visual grammar; it never creates mathematical content.
 */
export async function selectVideoDNA(input: VideoDNASelectionInput): Promise<VideoDNASelection> {
  const { text, tokens } = buildQuery(input);
  const [general, problem] = await Promise.all([loadGeneral(), loadProblem()]);
  const candidates: Array<{ reference: VideoDNAReference; score: number }> = [];

  for (const entry of Object.values(general)) {
    if (!entry.portable || entry.duplicateOf || entry.characterDriven || entry.tier === 'style-only') continue;
    const scored = scoreEntry(entry, input, tokens, 'general-video-dna');
    if (scored.score > 0) candidates.push({ reference: toReference(entry, scored.score, scored.reasons, 'general-video-dna', input.lesson.grade), score: scored.score });
  }

  for (const entry of Object.values(problem)) {
    const scored = scoreEntry(entry, input, tokens, 'problem-solving-video-dna');
    if (scored.score > 0) candidates.push({ reference: toReference(entry, scored.score, scored.reasons, 'problem-solving-video-dna', input.lesson.grade), score: scored.score });
  }

  candidates.sort((a, b) => b.score - a.score || a.reference.id.localeCompare(b.reference.id));
  const unique: VideoDNAReference[] = [];
  const seenFamilies = new Set<string>();
  for (const candidate of candidates) {
    const family = candidate.reference.archetype ?? candidate.reference.branch ?? candidate.reference.id;
    if (seenFamilies.has(family)) continue;
    seenFamilies.add(family);
    unique.push(candidate.reference);
    if (unique.length >= 4) break;
  }

  const primary = unique[0] ?? fallbackReference(input);
  const alternatives = unique.slice(1, 4);
  const generativeEnabled = input.requiredVisuals?.some((v) => /cinematic|teacher|background|metaphor|reference|scene/i.test(v))
    || /cinematic|metaphor|reference|background/i.test(text);

  const selection: VideoDNASelection = {
    schemaVersion: '2.0',
    selectionId: `vdna:${input.lesson.id}:${input.segment?.id ?? 'lesson'}:${primary.id}`,
    lessonId: input.lesson.id,
    domain: input.lesson.domain,
    grade: input.lesson.grade,
    gradeBand: input.lesson.gradeBand,
    intent: input.teachingIntent ?? input.lesson.learningGoal,
    primary,
    alternatives,
    style: buildStyle(input, primary, generativeEnabled),
    keyframes: buildKeyframes(input, primary),
    renderPolicy: {
      exactMath: { renderer: 'math-engine', deterministic: true },
      generative: { renderer: generativeEnabled ? 'ltx' : 'none', enabled: generativeEnabled, deterministic: false },
      composition: { renderer: 'composition', deterministic: true },
    },
    reasons: [
      `primary=${primary.id}`,
      ...primary.matchReasons.slice(0, 4),
      alternatives.length ? `alternatives=${alternatives.map((x) => x.id).join(', ')}` : 'no strong alternatives',
    ],
    guardrails: [
      'Use DNA as visual grammar only; never copy source narration, equations, branding or artwork.',
      'All equations, graphs, geometry truth and verified labels remain deterministic math-engine outputs.',
      'LTX-2 may generate cinematic/reference visuals but may not become the mathematical source of truth.',
      'HyperFrames remains the composition and exact timing authority.',
    ],
    retrieval: {
      deterministic: true,
      corpus: ['data/ai-guru/video-dna/general/3b1b-video-dna.json', 'data/ai-guru/video-dna/problem-solving-video-dna.json'],
      candidateCount: candidates.length,
    },
  };

  return selection;
}

/** Attach a selected DNA to a Sprint-A scene without coupling the selector to a renderer. */
export function applyVideoDNA(scene: GuruScene, selection: VideoDNASelection): GuruScene {
  return {
    ...scene,
    generative: {
      ...scene.generative,
      enabled: selection.renderPolicy.generative.enabled,
      purpose: selection.renderPolicy.generative.enabled ? 'reference-animation' : scene.generative.purpose,
      durationMs: scene.durationMs,
      conditions: [
        ...scene.generative.conditions,
        ...selection.primary.sourceAsset
          ? [{ type: selection.primary.sourceAsset.match(/\.(mp4|webm|mov)$/i) ? 'reference-video' as const : 'reference-image' as const, asset: {
              id: `vdna:${selection.primary.id}`,
              uri: selection.primary.sourceAsset,
              type: selection.primary.sourceAsset.match(/\.(mp4|webm|mov)$/i) ? 'video' as const : 'image' as const,
              source: 'asset' as const,
            }, strength: 0.7 }]
          : [],
      ],
    },
    metadata: {
      ...(scene.metadata ?? {}),
      videoDNASelectionId: selection.selectionId,
      videoDNAPrimaryId: selection.primary.id,
      videoDNAStyle: selection.style.family,
      videoDNAPacing: selection.style.pacing,
      videoDNACamera: selection.style.camera,
    },
  };
}
