/**
 * Semantic DNA selection (EmbeddingGemma-ready).
 *
 * The rule-based selector (registry.ts) reads English keywords. A Malayalam paragraph, or an
 * English one that avoids the usual words, can slip through to a text-only concept board. This
 * module compares the paragraph with the DNA cards (cards.ts) by embedding similarity and, when
 * the rules are not already sure, lets the closest picture DNA win.
 *
 * Rules stay in charge whenever they are sure (score ≥ 0.8) and for headings, bridges and
 * anything the embedder fails on: no embedder, no network, a timeout → the answer is exactly
 * what selectDna() gives.
 *
 * Embedders: `ollamaEmbedder` (EmbeddingGemma through a local Ollama), `hashEmbedder`
 * (deterministic character n-grams: a test double and a no-install fallback, not a language
 * model). Any object with `embed()` works.
 */

import type { BookBlock, BlockKind } from '../segment';
import { DNA_CARDS } from './cards';
import { selectDna } from './registry';
import type { DnaId, DnaSelection } from './types';

export type EmbedKind = 'query' | 'document';

export interface TextEmbedder {
  /** Identifies the model and settings; part of the cache key. */
  name: string;
  /** Unit-length vectors, one per text. */
  embed(texts: string[], kind: EmbedKind): Promise<number[][]>;
}

/* ---------------- vector helpers ---------------- */

export function normalise(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}
/** Matryoshka truncation: keep the first `dims` numbers, then renormalise. */
export const truncateTo = (v: number[], dims: number): number[] => normalise(v.length > dims ? v.slice(0, dims) : v);
export function cosine(a: number[], b: number[]): number {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) d += a[i] * b[i];
  return d; // vectors are unit length
}

/* ---------------- embedders ---------------- */

export interface OllamaOptions {
  baseUrl?: string;
  /** Verify the exact tag with `ollama list`; blog posts disagree (embeddinggemma-2, embeddinggemma2, size tags). */
  model?: string;
  /** 768 (native), 512, 256 or 128 (Matryoshka). */
  dims?: number;
  /** Task prefixes recommended for EmbeddingGemma; override if the model card says otherwise. */
  queryPrefix?: string;
  documentPrefix?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export function ollamaEmbedder(o: OllamaOptions = {}): TextEmbedder {
  const base = (o.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '');
  const model = o.model ?? 'embeddinggemma-2';
  const dims = o.dims ?? 768;
  const qp = o.queryPrefix ?? 'task: search result | query: ';
  const dp = o.documentPrefix ?? 'title: none | text: ';
  const f = o.fetchImpl ?? fetch;
  return {
    name: `ollama:${model}:${dims}`,
    async embed(texts, kind) {
      const prefix = kind === 'query' ? qp : dp;
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), o.timeoutMs ?? 20000);
      try {
        const r = await f(`${base}/api/embed`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ model, input: texts.map((t) => prefix + t), truncate: true }),
          signal: ctl.signal,
        });
        if (!r.ok) throw new Error(`Ollama embed failed (${r.status})`);
        const j = (await r.json()) as { embeddings?: number[][] };
        if (!j.embeddings || j.embeddings.length !== texts.length) throw new Error('Ollama embed returned the wrong number of vectors');
        return j.embeddings.map((v) => truncateTo(v, dims));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** FNV-1a hash of a string. */
function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Hashed character 2–4-grams (Unicode-aware, so Malayalam works at the letter level). Same text
 * → same vector, similar wording → similar vector. No meaning beyond shared letters.
 */
export function hashEmbedder(dims = 512): TextEmbedder {
  return {
    name: `hash:${dims}`,
    async embed(texts) {
      return texts.map((t) => {
        const v = new Array<number>(dims).fill(0);
        const s = ` ${t.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim()} `;
        for (let n = 2; n <= 4; n++) {
          for (let i = 0; i + n <= s.length; i++) {
            const h = fnv(s.slice(i, i + n));
            v[h % dims] += (h & 0x80000000) === 0 ? 1 : -1;
          }
        }
        return normalise(v);
      });
    },
  };
}

/* ---------------- the card index ---------------- */

export interface DnaIndex {
  embedder: string;
  cards: Array<{ id: DnaId; lang: 'en' | 'ml'; text: string; vec: number[] }>;
}

const CACHE_KEY = 'ai-guru-dna-embed-v1';

function cardHash(): string {
  let h = 0;
  for (const c of DNA_CARDS) h = (h + fnv(c.id + c.en.join('|') + c.ml.join('|'))) >>> 0;
  return String(h);
}

/** Embeds every card sentence once. Cached in localStorage per embedder + card text. */
export async function buildDnaIndex(embedder: TextEmbedder, o: { cache?: boolean } = {}): Promise<DnaIndex> {
  const key = `${embedder.name}|${cardHash()}`;
  if (o.cache !== false) {
    try {
      if (typeof localStorage !== 'undefined') {
        const hit = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as { key: string; index: DnaIndex } | null;
        if (hit?.key === key) return hit.index;
      }
    } catch {
      /* ignore */
    }
  }
  const items = DNA_CARDS.flatMap((c) => [...c.en.map((text) => ({ id: c.id, lang: 'en' as const, text })), ...c.ml.map((text) => ({ id: c.id, lang: 'ml' as const, text }))]);
  const vecs = await embedder.embed(items.map((i) => i.text), 'document');
  const index: DnaIndex = { embedder: embedder.name, cards: items.map((it, i) => ({ ...it, vec: vecs[i] })) };
  if (o.cache !== false) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(CACHE_KEY, JSON.stringify({ key, index }));
    } catch {
      /* too big or blocked: rebuilt next session */
    }
  }
  return index;
}

/* ---------------- selection ---------------- */

export interface SemanticOptions {
  /** Least cosine similarity for the closest DNA to count. Calibrate per embedder with the eval harness. */
  minCos?: number;
  /** How many standard deviations above the other DNAs the closest must stand. */
  minZ?: number;
  /** Least gap to the second-closest DNA. */
  margin?: number;
  /** Rules at or above this score are never overridden. */
  ruleSure?: number;
}

export const DEFAULT_SEMANTIC: Required<SemanticOptions> = { minCos: 0.45, minZ: 1.5, margin: 0.03, ruleSure: 0.8 };

/** Block kinds the semantic selector may redirect; headings, bridges and equation runs are the rules' business. */
const REDIRECTABLE: BlockKind[] = ['prose', 'aside', 'problem', 'exercise', 'result'];

const queryText = (b: BookBlock) => b.text.replace(/\s+/g, ' ').trim().slice(0, 700);

interface Candidate {
  id: DnaId;
  cos: number;
}

export function rankByMeaning(vec: number[], index: DnaIndex): Candidate[] {
  const best = new Map<DnaId, number>();
  for (const c of index.cards) best.set(c.id, Math.max(best.get(c.id) ?? -1, cosine(vec, c.vec)));
  return [...best.entries()].map(([id, cos]) => ({ id, cos })).sort((a, b) => b.cos - a.cos);
}

/** Pure decision, given the query vector: used by the batch selector, the harness and the tests. */
export function decide(block: BookBlock, rules: DnaSelection, vec: number[], index: DnaIndex, opt: SemanticOptions = {}): DnaSelection {
  const o = { ...DEFAULT_SEMANTIC, ...opt };
  if (!REDIRECTABLE.includes(block.kind)) return rules;
  const ranked = rankByMeaning(vec, index);
  if (ranked.length < 2) return rules;
  const mean = ranked.reduce((a, r) => a + r.cos, 0) / ranked.length;
  const sd = Math.sqrt(ranked.reduce((a, r) => a + (r.cos - mean) ** 2, 0) / ranked.length) || 1;
  const [top, second] = ranked;
  const z = (top.cos - mean) / sd;
  const passes = top.cos >= o.minCos && z >= o.minZ && top.cos - second.cos >= o.margin;
  const semantic = { dna: top.id, cos: +top.cos.toFixed(3), z: +z.toFixed(2), used: false };
  const ruleSure = rules.score >= o.ruleSure && rules.dna !== 'concept-board' && !rules.needsAi;
  if (!passes || ruleSure || rules.dna === top.id) return { ...rules, semantic };
  return {
    dna: top.id,
    score: +(0.6 + 0.3 * Math.min(1, Math.max(0, top.cos))).toFixed(3),
    mandatory: rules.mandatory,
    needsAi: false,
    ranked: [{ id: top.id, score: +top.cos.toFixed(3) }, ...rules.ranked],
    reason: `meaning: ${top.id} (similarity ${top.cos.toFixed(2)}, ${z.toFixed(1)}σ above the others); rules said ${rules.dna} (${rules.score.toFixed(2)})`,
    semantic: { ...semantic, used: true },
  };
}

/**
 * Selection for many blocks with one embedding call. Never throws: any embedder failure gives
 * the rule-based selection for every block.
 */
export async function hybridSelections(blocks: BookBlock[], chapterTitle: string, index: DnaIndex | null, embedder: TextEmbedder | null, opt: SemanticOptions = {}): Promise<Map<string, DnaSelection>> {
  const out = new Map<string, DnaSelection>();
  const rules = blocks.map((b) => selectDna(b, chapterTitle));
  blocks.forEach((b, i) => out.set(b.id, rules[i]));
  if (!index || !embedder) return out;
  const need = blocks.map((b, i) => ({ b, i })).filter(({ b, i }) => REDIRECTABLE.includes(b.kind) && !(rules[i].score >= (opt.ruleSure ?? DEFAULT_SEMANTIC.ruleSure) && rules[i].dna !== 'concept-board' && !rules[i].needsAi));
  if (!need.length) return out;
  try {
    const vecs = await embedder.embed(need.map(({ b }) => queryText(b)), 'query');
    need.forEach(({ b, i }, k) => out.set(b.id, decide(b, rules[i], vecs[k], index, opt)));
  } catch {
    /* rules stand */
  }
  return out;
}

export async function selectDnaHybrid(block: BookBlock, chapterTitle: string, index: DnaIndex | null, embedder: TextEmbedder | null, opt: SemanticOptions = {}): Promise<DnaSelection> {
  return (await hybridSelections([block], chapterTitle, index, embedder, opt)).get(block.id)!;
}
