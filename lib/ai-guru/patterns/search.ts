import { PATTERNS } from './catalog';
import type { PatternHit, VisualPattern } from './types';

/**
 * Pattern search: BM25 over name / concepts / keywords / summary, with a small maths synonym table.
 * Deterministic, offline, instant. (A vector index can be added later behind the same function.)
 */
const STOP = new Set('a an and are as at be by for from has have how i in is it its of on or that the this to was we were what when where which with you your do does did not can will using use given find show then than so if into out up down all any each both'.split(' '));

const SYNONYMS: Record<string, string[]> = {
  pythagoras: ['hypotenuse', 'right', 'triangle'], hypotenuse: ['pythagoras'], sine: ['trigonometric', 'triangle'], cosine: ['trigonometric', 'triangle'], tangent: ['trigonometric'],
  inequality: ['number', 'line', 'solution'], inequalities: ['number', 'line', 'solution'], integer: ['number', 'line'], negative: ['number', 'line'],
  slope: ['graph', 'line', 'coordinate'], gradient: ['slope', 'graph'], intercept: ['graph', 'coordinate'], parabola: ['quadratic', 'graph'], quadratic: ['graph', 'parabola'], plot: ['graph', 'coordinate'],
  equation: ['balance', 'both', 'sides'], solve: ['balance', 'equation'], expand: ['area', 'model', 'brackets'], bracket: ['area', 'model'], factorise: ['area', 'model'], factorize: ['area', 'model'], identity: ['area', 'model'],
  fraction: ['bar', 'numerator', 'denominator'], numerator: ['fraction'], denominator: ['fraction'], equivalent: ['fraction'],
  union: ['venn', 'set'], intersection: ['venn', 'set'], set: ['venn'], sets: ['venn', 'set'],
  angle: ['triangle', 'parallel', 'transversal'], parallel: ['transversal'], transversal: ['parallel'], corresponding: ['parallel', 'transversal'], alternate: ['parallel', 'transversal'],
  radius: ['circle'], diameter: ['circle'], circumference: ['circle'], chord: ['circle'], circle: ['radius', 'diameter'],
  construct: ['auxiliary', 'line'], perpendicular: ['auxiliary', 'line'], diagonal: ['auxiliary', 'line'],
  data: ['bar', 'chart'], frequency: ['bar', 'chart'], mean: ['bar', 'chart'], survey: ['bar', 'chart'],
  add: ['jumps', 'number', 'line'], subtract: ['jumps', 'number', 'line'], addition: ['jumps'], subtraction: ['jumps'],
  highlight: ['callout'], notice: ['callout'], emphasise: ['callout'], emphasize: ['callout'],
};

export function tokenize(text: string): string[] {
  const raw = String(text || '').toLowerCase().replace(/[\u00b2]/g, '2').replace(/[^a-z0-9\u0d00-\u0d7f]+/g, ' ').split(' ').filter(Boolean);
  const out: string[] = [];
  for (let t of raw) {
    if (STOP.has(t) || t.length < 2) continue;
    if (t.length > 4 && t.endsWith('ies')) t = t.slice(0, -3) + 'y';
    else if (t.length > 4 && /(sses|xes|ches|shes)$/.test(t)) t = t.slice(0, -2);
    else if (t.length > 3 && t.endsWith('s') && !/(ss|us|is|as)$/.test(t)) t = t.slice(0, -1);
    else if (t.length > 5 && t.endsWith('ing')) t = t.slice(0, -3);
    if (t.length > 3 && t.endsWith('e')) t = t.slice(0, -1); // line/lines/move/moving all meet at one form
    out.push(t);
  }
  return out;
}

interface Doc { pattern: VisualPattern; tf: Map<string, number>; len: number }
let INDEX: { docs: Doc[]; df: Map<string, number>; avg: number } | null = null;

/** Two-word phrases ("both side", "number line") so exact phrases outrank single shared words. */
function bigrams(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i + 1 < tokens.length; i++) out.push(`${tokens[i]}_${tokens[i + 1]}`);
  return out;
}
function docTokens(p: VisualPattern): string[] {
  const rep = (s: string | string[], n: number) => { const t = tokenize(Array.isArray(s) ? s.join(' ') : s); return Array.from({ length: n }, () => t).flat(); };
  // Phrases are kept whole (a keyword like "subtract from both sides" is one phrase) so their bigrams are real phrases.
  const phrases = [p.name, ...p.concepts, ...p.keywords];
  const grams = phrases.flatMap((ph) => bigrams(tokenize(ph)));
  return [...rep(p.name, 3), ...rep(p.concepts, 3), ...rep(p.keywords, 3), ...rep(p.domains, 2), ...rep(p.summary, 1), ...rep(p.whenToUse, 1), ...rep(p.id.replace(/-/g, ' '), 3), ...grams, ...grams];
}
function index() {
  if (INDEX) return INDEX;
  const docs: Doc[] = PATTERNS.map((pattern) => {
    const toks = docTokens(pattern), tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { pattern, tf, len: toks.length };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  INDEX = { docs, df, avg: docs.reduce((s, d) => s + d.len, 0) / Math.max(1, docs.length) };
  return INDEX;
}

export interface SearchOptions { k?: number; domain?: string; minScore?: number }

export function searchPatterns(query: string, opts: SearchOptions = {}): PatternHit[] {
  const { docs, df, avg } = index();
  const base = tokenize(query);
  const weights = new Map<string, number>();
  for (const t of base) weights.set(t, Math.max(weights.get(t) ?? 0, 1));
  for (const g of bigrams(base)) weights.set(g, 1.5);
  for (const t of base) for (const s of SYNONYMS[t] ?? []) { const st = tokenize(s)[0] ?? s; weights.set(st, Math.max(weights.get(st) ?? 0, 0.5)); }
  const baseSet = new Set(base);
  const N = docs.length, k1 = 1.2, b = 0.75;
  const hits: PatternHit[] = [];
  for (const d of docs) {
    let score = 0; const matched: string[] = []; const direct: string[] = [];
    for (const [term, w] of weights) {
      const f = d.tf.get(term); if (!f) continue;
      const n = df.get(term) ?? 0, idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += w * idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / avg)));
      matched.push(term);
      if (baseSet.has(term)) direct.push(term);
    }
    if (opts.domain && d.pattern.domains.includes(opts.domain.toLowerCase())) score *= 1.25;
    if (score > (opts.minScore ?? 0)) hits.push({ pattern: d.pattern, score: Number(score.toFixed(3)), matched, direct });
  }
  return hits.sort((a, b2) => b2.score - a.score).slice(0, opts.k ?? 3);
}
