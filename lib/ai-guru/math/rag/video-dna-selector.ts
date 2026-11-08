import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { MathRagHit } from './types';

type VideoDnaEntry = any;

type SelectionInput = {
  chapterTitle?: string;
  chapterSummary?: string;
  chapterTopics?: string[];
  question?: string;
  learningGoal?: string;
  domain?: string;
  grade?: number;
  visualOperations?: string[];
  teachingGoal?: string;
};

export interface VideoDnaSelection {
  id: string;
  archetype: string;
  score: number;
  fit: {
    concept: number;
    lexical: number;
    domain: number;
    visual: number;
    pedagogy: number;
    grade: number;
    quality: number;
  };
  reasons: string[];
  entry: VideoDnaEntry;
  hit: MathRagHit;
}

export interface ChapterVideoDnaStrategy {
  query: string;
  archetypes: string[];
  dnaIds: string[];
  selections: VideoDnaSelection[];
  constructionPatterns: string[];
  motifs: string[];
  pacing: 'slow' | 'medium' | 'fast';
  camera: 'static' | 'focus' | 'cinematic';
  beatMix: { build?: number; transform?: number; move?: number; remove?: number };
  qaRules: string[];
}

export interface LessonVideoDnaStrategy {
  query: string;
  chapterArchetypes: string[];
  selections: VideoDnaSelection[];
  beatOptions: VideoDnaSelection[];
  primary: VideoDnaSelection | null;
  beatMix: { build?: number; transform?: number; move?: number; remove?: number };
  qaRules: string[];
}

let entryCache: Record<string, VideoDnaEntry> | null = null;
let indexCache: any | null = null;

const ROOT = path.join(process.cwd(), 'data', 'ai-guru', 'video-dna', 'general');

async function loadEntries(): Promise<Record<string, VideoDnaEntry>> {
  if (entryCache) return entryCache;
  try {
    const raw = JSON.parse(await readFile(path.join(ROOT, '3b1b-video-dna.json'), 'utf8'));
    entryCache = raw?.entries ?? {};
  } catch {
    entryCache = {};
  }
  return entryCache!;
}

async function loadIndex() {
  if (indexCache) return indexCache;
  try {
    indexCache = JSON.parse(await readFile(path.join(ROOT, 'retrieval', 'concept-index.json'), 'utf8'));
  } catch {
    indexCache = {};
  }
  return indexCache!;
}

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'show', 'find', 'using', 'into', 'then', 'what', 'how', 'why', 'class', 'grade', 'math', 'mathematics']);

const DOMAIN_FAMILIES: Record<string, string[]> = {
  graphing: ['functions', 'coordinate-geometry', 'calculus', 'algebra-basics'],
  geometry: ['geometry', 'trigonometry', 'measurement'],
  algebra: ['algebra-basics', 'linear-algebra', 'equations'],
  arithmetic: ['arithmetic-general', 'number-theory'],
  calculus: ['calculus', 'differential-equations'],
  probability: ['probability-statistics', 'combinatorics-puzzles'],
  statistics: ['probability-statistics', 'data'],
};

const ALIASES: Record<string, string[]> = {
  triangle: ['triangles', 'geometry', 'area', 'similarity', 'congruence'],
  triangles: ['triangle', 'geometry', 'area', 'similarity', 'congruence'],
  fraction: ['fractions', 'ratio', 'division', 'number-line'],
  fractions: ['fraction', 'ratio', 'division', 'number-line'],
  equation: ['equations', 'algebra', 'solve', 'transform'],
  equations: ['equation', 'algebra', 'solve', 'transform'],
  quadratic: ['quadratic-equations', 'equations', 'roots', 'algebra'],
  graph: ['graphing', 'functions', 'coordinate', 'plot'],
  graphs: ['graphing', 'functions', 'coordinate', 'plot'],
  derivative: ['calculus', 'tangent', 'slope', 'limits'],
  integral: ['calculus', 'area', 'accumulation', 'riemann-sum'],
  probability: ['probability-statistics', 'sample-space', 'combinations'],
  statistics: ['probability-statistics', 'data', 'distribution', 'graph'],
  proof: ['geometry', 'proof', 'construction', 'correspondence'],
  construct: ['construction', 'geometry', 'draw'],
  derive: ['derivation', 'formula', 'transform'],
  simplify: ['algebra-basics', 'transform', 'equation'],
  compare: ['comparison', 'difference', 'transform'],
  area: ['geometry', 'area-model', 'decomposition', 'rearrange', 'formula'],
  perimeter: ['geometry', 'measurement', 'shape'],
  decomposition: ['decomposition', 'area-model', 'geometry', 'rearrange'],
  rearrangement: ['decomposition', 'area-model', 'geometry', 'rearrange'],
  plot: ['graphing', 'functions', 'coordinate', 'curve'],
  angle: ['geometry', 'trigonometry'],
  sine: ['trigonometry', 'unit-circle'],
  cosine: ['trigonometry', 'unit-circle'],
  tangent: ['calculus', 'slope', 'geometry'],
  numberline: ['number-line', 'arithmetic-general'],
};

const VISUAL_CUES: Record<string, string[]> = {
  build: ['draw', 'construct', 'build', 'introduce', 'show', 'unit-squares'],
  transform: ['transform', 'simplify', 'rewrite', 'substitute', 'expand', 'factor', 'morph'],
  move: ['move', 'slide', 'approach', 'shift', 'rotate'],
  highlight: ['highlight', 'focus', 'mark', 'emphasize', 'correspond'],
  graph: ['graph', 'plot', 'curve', 'axis', 'coordinate'],
  proof: ['prove', 'proof', 'correspond', 'theorem', 'construction'],
  compare: ['compare', 'difference', 'versus', 'same', 'change'],
  derive: ['derive', 'derivation', 'formula', 'why', 'from-first-principles'],
};

const PEDAGOGY_CUES: Record<string, string[]> = {
  intuition: ['intuition', 'why', 'idea', 'meaning', 'understand'],
  derivation: ['derive', 'from-first-principles', 'formula', 'reason'],
  proof: ['prove', 'proof', 'theorem', 'justify'],
  procedure: ['solve', 'calculate', 'steps', 'algorithm', 'method'],
  visual: ['visualize', 'diagram', 'graph', 'geometry', 'see'],
  comparison: ['compare', 'difference', 'before-after', 'change'],
};

function tokens(value: string): Set<string> {
  return new Set((value.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(t => t.length >= 3 && !STOP.has(t)));
}

function expandedTokens(input: SelectionInput): Set<string> {
  const raw = [input.chapterTitle, input.chapterSummary, ...(input.chapterTopics ?? []), input.question, input.learningGoal, input.domain, input.teachingGoal, ...(input.visualOperations ?? [])].filter(Boolean).join(' ');
  const out = tokens(raw);
  for (const t of [...out]) for (const alias of ALIASES[t] ?? []) out.add(alias);
  return out;
}

function normalizedDomain(domain?: string): string {
  return String(domain ?? '').toLowerCase().replace(/[_\s]+/g, '-');
}

function gradeFit(entry: VideoDnaEntry, grade?: number): number {
  if (!grade) return 0.7;
  const archetype = String(entry.archetype ?? '').toLowerCase();
  const has3d = Number(entry.mobjectMix?.solid3d ?? 0) > 0.12 || /3d|solid|surface/.test(archetype);
  if (has3d && grade <= 10) return 0.42;
  if (grade <= 5) return /general|number|arithmetic|area|geometry/.test(archetype) ? 1 : 0.55;
  if (grade <= 8) return /general|geometry|algebra|number|transform|area|graph/.test(archetype) ? 1 : 0.7;
  if (grade <= 10) return /geometry|algebra|calculus|graph|transform|proof|deriv/.test(archetype) ? 1 : 0.78;
  return /calculus|algebra|geometry|graph|probability|proof|transform|deriv/.test(archetype) ? 1 : 0.82;
}

function quality(entry: VideoDnaEntry): number {
  const tier = String(entry.tier ?? 'B');
  const tierScore = tier === 'S' ? 1 : tier === 'A' ? 0.9 : tier === 'B' ? 0.72 : 0.35;
  const richness = Math.min(1, Number(entry.richness ?? 0) / 70);
  const portability = entry.portable ? 1 : 0;
  return 0.55 * tierScore + 0.25 * richness + 0.2 * portability;
}

function entryText(entry: VideoDnaEntry): string {
  return [entry.branch, entry.domain, entry.archetype, ...(entry.concepts ?? []), ...(entry.selectionTerms ?? []), ...(entry.typicalArc ?? []), ...(entry.constructionOrder ?? [])].filter(Boolean).join(' ');
}

function scoreVisual(entry: VideoDnaEntry, input: SelectionInput, q: Set<string>): number {
  const hay = tokens(entryText(entry));
  const requested = new Set<string>(input.visualOperations ?? []);
  const cueMatches = Object.entries(VISUAL_CUES).filter(([operation, words]) => words.some(w => q.has(w))).map(([operation]) => operation);
  for (const op of cueMatches) requested.add(op);
  if (!requested.size) return 0.65;
  let matched = 0;
  for (const op of requested) {
    const words = VISUAL_CUES[op] ?? [op];
    if (words.some(w => hay.has(w) || q.has(w))) matched++;
    if ((entry.animationVocabulary ?? []).some((x: any) => words.some(w => String(x?.[0] ?? '').toLowerCase().includes(w)))) matched += 0.5;
  }
  return Math.min(1, matched / requested.size);
}

function scorePedagogy(entry: VideoDnaEntry, input: SelectionInput, q: Set<string>): number {
  const requested = new Set<string>();
  for (const [goal, words] of Object.entries(PEDAGOGY_CUES)) if (words.some(w => q.has(w))) requested.add(goal);
  const arc = new Set((entry.typicalArc ?? []).map((x: any) => String(x).toLowerCase()));
  const construction = String((entry.constructionOrder ?? []).join(' ')).toLowerCase();
  if (!requested.size) return 0.65;
  let score = 0;
  for (const goal of requested) {
    if (goal === 'derivation' && (arc.has('transform') || construction.includes('formula'))) score++;
    else if (goal === 'proof' && (String(entry.archetype).includes('proof') || construction.includes('proof'))) score++;
    else if (goal === 'procedure' && (arc.has('build') || arc.has('transform'))) score++;
    else if (goal === 'visual' && Number(entry.mobjectMix?.shape ?? 0) + Number(entry.mobjectMix?.coordinate ?? 0) > 0.15) score++;
    else if (goal === 'comparison' && (arc.has('transform') || arc.has('move'))) score++;
    else if (goal === 'intuition' && (arc.has('build') || arc.has('move'))) score++;
  }
  return score / requested.size;
}

function scoreEntry(entry: VideoDnaEntry, input: SelectionInput, q: Set<string>): VideoDnaSelection | null {
  if (!entry?.portable || entry?.duplicateOf || entry?.tier === 'style-only' || entry?.characterDriven) return null;
  const hay = tokens(entryText(entry));
  let lexicalHits = 0;
  for (const t of q) if (hay.has(t)) lexicalHits++;
  const lexical = Math.min(1, lexicalHits / Math.max(4, Math.min(12, q.size)));
  const domain = normalizedDomain(input.domain);
  const entryDomain = normalizedDomain(entry.domain);
  const entryBranch = normalizedDomain(entry.branch);
  const family = DOMAIN_FAMILIES[domain] ?? [];
  const domainScore = domain && (entryDomain === domain || entryBranch === domain)
    ? 1
    : family.some(d => entryDomain === d || entryBranch === d || entryDomain.includes(d) || entryBranch.includes(d))
      ? (domain === 'graphing' ? 0.86 : 0.7)
      : (domain && (entryDomain.includes(domain) || domain.includes(entryDomain)) ? 0.7 : 0.3);
  const conceptTerms = new Set<string>();
  for (const c of [...(entry.concepts ?? []), ...(entry.selectionTerms ?? []), entry.archetype, entry.branch, entry.domain]) {
    for (const t of tokens(String(c))) conceptTerms.add(t);
  }
  let conceptHits = 0;
  for (const t of q) if (conceptTerms.has(t)) conceptHits++;
  const concept = Math.min(1, conceptHits / Math.max(4, Math.min(12, q.size)));
  const visual = scoreVisual(entry, input, q);
  const pedagogy = scorePedagogy(entry, input, q);
  const grade = gradeFit(entry, input.grade);
  const qualityScore = quality(entry);
  const graphIntent = ['graph', 'plot', 'curve', 'axis', 'coordinate'].some(t => q.has(t));
  const areaIntent = ['area', 'decomposition', 'rearrange', 'area-model'].some(t => q.has(t));
  const solid3d = Number(entry.mobjectMix?.solid3d ?? 0) > 0.12 || /3d|solid|surface/.test(String(entry.archetype));
  let intentBoost = 0;
  if (areaIntent && solid3d) intentBoost -= 0.16;
  if (graphIntent && /function-graph|graph-build/.test(String(entry.archetype))) intentBoost += 0.18;
  else if (graphIntent && /live-parameter|numeric-array/.test(String(entry.archetype))) intentBoost += 0.08;
  if (areaIntent && /area-model|construction|2d-explainer/.test(String(entry.archetype))) intentBoost += 0.12;
  const score = 0.34 * concept + 0.13 * lexical + 0.17 * domainScore + 0.12 * visual + 0.09 * pedagogy + 0.06 * grade + 0.09 * qualityScore + intentBoost;
  const reasons = [
    `concept=${concept.toFixed(2)}`,
    `lexical=${lexical.toFixed(2)}`,
    `domain=${domainScore.toFixed(2)}`,
    `visual=${visual.toFixed(2)}`,
    `pedagogy=${pedagogy.toFixed(2)}`,
    `grade=${grade.toFixed(2)}`,
    `quality=${qualityScore.toFixed(2)}`,
  ];
  return { id: String(entry.id), archetype: String(entry.archetype ?? 'progressive-construction'), score, fit: { concept, lexical, domain: domainScore, visual, pedagogy, grade, quality: qualityScore }, reasons, entry, hit: toHit(entry, score, reasons) };
}

function toHit(entry: VideoDnaEntry, score: number, reasons: string[]): MathRagHit {
  const construction = (entry.constructionOrder ?? []).slice(0, 5);
  const motifs = (entry.motifs ?? []).slice(0, 4).map((m: any) => m.pattern).filter(Boolean);
  const qa = (entry.qa ?? []).slice(0, 5);
  const beatMix = entry.beatMix ?? {};
  const pacing = entry.pacing?.runTimeSec?.median;
  const wait = entry.pacing?.waitSec?.median;
  const grammar = String(entry.visualGrammar ?? '').replace(/\bManim(?:\s+CE)?\b/gi, 'AI Guru visual renderer').replace(/\bmanimgl\b/gi, 'legacy animation API');
  const text = [
    'GENERAL CLASS VIDEO-DNA — visual grammar only; do not copy source scenes, wording, equations, branding or artwork.',
    `ID: ${entry.id}`,
    `Archetype: ${entry.archetype}; tier: ${entry.tier}; branch: ${entry.branch}; domain: ${entry.domain}`,
    `Concepts: ${(entry.concepts ?? []).slice(0, 10).join(', ')}`,
    `Visual grammar: ${grammar}`,
    `Construction order: ${construction.join(' -> ')}`,
    `Typical arc: ${(entry.typicalArc ?? []).join(' -> ')}`,
    `Motifs: ${motifs.join(' | ') || 'none'}`,
    `Beat mix: build=${beatMix.build ?? 0}, transform=${beatMix.transform ?? 0}, move=${beatMix.move ?? 0}, remove=${beatMix.remove ?? 0}`,
    `Pacing: animation≈${pacing ?? 'n/a'}s, pause≈${wait ?? 'n/a'}s`,
    `QA: ${qa.join(' | ')}`,
    'Renderer adaptation: convert these ideas to AI Guru shape/line/arrow/graph/highlight/transform/token actions; never emit executable source code.',
  ].join('\n');
  return {
    id: `video-dna:${entry.id}`,
    source: '3b1b_videos',
    file_path: `data/ai-guru/video-dna/general/3b1b-video-dna.json#${entry.id}`,
    text,
    topics: [...(entry.concepts ?? []), entry.branch, entry.domain, entry.archetype].filter(Boolean),
    priority: entry.tier === 'S' ? 3 : entry.tier === 'A' ? 2 : 1,
    score,
    matchReasons: reasons,
  };
}

async function candidateEntries(q: Set<string>): Promise<VideoDnaEntry[]> {
  const entries = await loadEntries();
  const index = await loadIndex();
  const ids = new Set<string>();
  for (const t of q) for (const id of index?.byTerm?.[t] ?? []) ids.add(id);
  for (const t of q) for (const id of index?.byDomain?.[t] ?? []) ids.add(id);
  for (const t of q) for (const id of index?.byBranch?.[t] ?? []) ids.add(id);
  for (const t of q) for (const id of index?.byArchetype?.[t] ?? []) ids.add(id);
  const seeded = [...ids].map(id => entries[id]).filter(Boolean);
  // Keep a broad fallback pool so a new term not present in the static index can still match.
  if (seeded.length < 18) return Object.values(entries);
  return seeded;
}

function diversify(scored: VideoDnaSelection[], limit: number, preferredArchetypes: string[] = []): VideoDnaSelection[] {
  const preferred = new Set(preferredArchetypes);
  const out: VideoDnaSelection[] = [];
  const seenArchetypes = new Set<string>();
  const sorted = [...scored].sort((a, b) => {
    const ap = preferred.has(a.archetype) ? 0.035 : 0;
    const bp = preferred.has(b.archetype) ? 0.035 : 0;
    return (b.score + bp) - (a.score + ap);
  });
  for (const item of sorted) {
    if (out.length >= limit) break;
    if (seenArchetypes.has(item.archetype)) continue;
    seenArchetypes.add(item.archetype);
    out.push(item);
  }
  return out;
}

function mergeBeatMix(selections: VideoDnaSelection[]) {
  const keys = ['build', 'transform', 'move', 'remove'] as const;
  const sums: Record<string, number> = { build: 0, transform: 0, move: 0, remove: 0 };
  let weight = 0;
  for (const selection of selections) {
    const mix = selection.entry.beatMix ?? {};
    const available = keys.reduce((n, k) => n + Number(mix[k] ?? 0), 0);
    if (available <= 0) continue;
    for (const k of keys) sums[k] += Number(mix[k] ?? 0);
    weight += 1;
  }
  if (!weight) return {};
  const total = keys.reduce((n, k) => n + sums[k], 0) || 1;
  return Object.fromEntries(keys.map(k => [k, Number((sums[k] / total).toFixed(3))]));
}

export async function rankVideoDna(input: SelectionInput, candidateLimit = 12): Promise<VideoDnaSelection[]> {
  const q = expandedTokens(input);
  if (!q.size) return [];
  const entries = await candidateEntries(q);
  return entries.map(entry => scoreEntry(entry, input, q)).filter(Boolean).sort((a, b) => (b as VideoDnaSelection).score - (a as VideoDnaSelection).score).slice(0, Math.max(1, candidateLimit)) as VideoDnaSelection[];
}

export async function selectChapterVideoDna(input: SelectionInput, maxArchetypes = 5): Promise<ChapterVideoDnaStrategy> {
  const query = [input.chapterTitle, input.chapterSummary, ...(input.chapterTopics ?? []), input.domain, input.learningGoal].filter(Boolean).join(' ');
  const ranked = await rankVideoDna({ ...input, question: query, teachingGoal: input.teachingGoal ?? 'intuition visual derivation' }, 18);
  const selections = diversify(ranked, Math.max(3, Math.min(maxArchetypes, 6)));
  const constructionPatterns = [...new Set(selections.flatMap(s => (s.entry.typicalArc ?? []).map((x: any) => String(x))))].slice(0, 5);
  const motifs = [...new Set(selections.flatMap(s => (s.entry.motifs ?? []).map((m: any) => String(m.pattern ?? ''))).filter(Boolean))].slice(0, 8);
  const medianPacing = selections.length ? selections.reduce((n, s) => n + Number(s.entry.pacing?.runTimeSec?.median ?? 1), 0) / selections.length : 1;
  const beatMix = mergeBeatMix(selections);
  const qaRules = [...new Set(selections.flatMap(s => Array.isArray(s.entry.qa) ? s.entry.qa.map((x: any) => String(x)) : []))].slice(0, 10);
  return {
    query,
    archetypes: selections.map(s => s.archetype),
    dnaIds: selections.map(s => s.id),
    selections,
    constructionPatterns,
    motifs,
    pacing: medianPacing > 1.6 ? 'slow' : medianPacing < 0.7 ? 'fast' : 'medium',
    camera: selections.some(s => String(s.entry.cameraMode?.[0] ?? '').includes('graph')) ? 'focus' : 'static',
    beatMix,
    qaRules,
  };
}

export async function selectLessonVideoDna(input: SelectionInput, chapter?: ChapterVideoDnaStrategy): Promise<LessonVideoDnaStrategy> {
  const query = [input.domain, input.chapterTitle, input.question, input.learningGoal, input.teachingGoal, ...(input.visualOperations ?? [])].filter(Boolean).join(' ');
  const ranked = await rankVideoDna({ ...input, question: query }, 18);
  const chapterArchetypes = chapter?.archetypes ?? [];
  const selections = diversify(ranked, 3, chapterArchetypes);
  const beatOptions = [...ranked].sort((a, b) => b.score - a.score).slice(0, 8);
  const beatMix = mergeBeatMix([...(chapter?.selections ?? []), ...selections]);
  const qaRules = [...new Set([...(chapter?.qaRules ?? []), ...selections.flatMap(s => Array.isArray(s.entry.qa) ? s.entry.qa.map((x: any) => String(x)) : [])])].slice(0, 12);
  return { query, chapterArchetypes, selections, beatOptions, primary: selections[0] ?? null, beatMix, qaRules };
}
