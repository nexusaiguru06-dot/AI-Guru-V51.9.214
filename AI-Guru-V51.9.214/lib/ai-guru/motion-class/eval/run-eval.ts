/**
 * Compares DNA selectors on EVAL_SET: the keyword rules alone, and rules + meaning with any
 * embedder. Used by scripts/dna-embed-eval.ts and the tests.
 */

import type { BookBlock } from '../segment';
import { selectDna } from '../dna/registry';
import { buildDnaIndex, hybridSelections, type SemanticOptions, type TextEmbedder } from '../dna/semantic';
import { EVAL_SET, type EvalItem } from './dna-eval-set';

export const evalBlock = (it: EvalItem, i: number): BookBlock => ({
  id: `e${i}`,
  kind: 'prose',
  page: 1,
  chapterId: 'c',
  sectionId: 's',
  lines: [{ text: it.text, math: false } as BookBlock['lines'][number]],
  text: it.text,
});

export interface EvalRow {
  item: EvalItem;
  got: string;
  ok: boolean;
}
export interface EvalReport {
  selector: string;
  rows: EvalRow[];
  accuracy: { all: number; en: number; ml: number; hard: number };
  /** Concept-board paragraphs sent to a picture DNA (the cost of over-eager retrieval). */
  falsePictures: number;
}

const pct = (rows: EvalRow[]) => (rows.length ? +(rows.filter((r) => r.ok).length / rows.length).toFixed(3) : 0);

function report(selector: string, rows: EvalRow[]): EvalReport {
  return {
    selector,
    rows,
    accuracy: { all: pct(rows), en: pct(rows.filter((r) => r.item.lang === 'en')), ml: pct(rows.filter((r) => r.item.lang === 'ml')), hard: pct(rows.filter((r) => r.item.hard)) },
    falsePictures: rows.filter((r) => r.item.expect === 'concept-board' && r.got !== 'concept-board').length,
  };
}

/** What the unit would be taught with if the planner had to use the first choice (needsAi → concept-board, as offline). */
const effective = (dna: string, needsAi: boolean) => (needsAi || dna === 'ai-custom' ? 'concept-board' : dna);

export function evalRules(items = EVAL_SET): EvalReport {
  return report('rules', items.map((it, i) => {
    const s = selectDna(evalBlock(it, i), 'Chapter');
    const got = effective(s.dna, s.needsAi);
    return { item: it, got, ok: got === it.expect };
  }));
}

export async function evalHybrid(embedder: TextEmbedder, opt: SemanticOptions = {}, items = EVAL_SET): Promise<EvalReport> {
  const index = await buildDnaIndex(embedder, { cache: false });
  const blocks = items.map(evalBlock);
  const sel = await hybridSelections(blocks, 'Chapter', index, embedder, opt);
  return report(`rules+${embedder.name}${opt.minCos !== undefined ? ` (minCos ${opt.minCos})` : ''}`, items.map((it, i) => {
    const s = sel.get(blocks[i].id)!;
    const got = effective(s.dna, s.needsAi);
    return { item: it, got, ok: got === it.expect };
  }));
}

export const formatReport = (r: EvalReport) =>
  `${r.selector.padEnd(46)} all ${(r.accuracy.all * 100).toFixed(0).padStart(3)}%  EN ${(r.accuracy.en * 100).toFixed(0).padStart(3)}%  ML ${(r.accuracy.ml * 100).toFixed(0).padStart(3)}%  hard ${(r.accuracy.hard * 100).toFixed(0).padStart(3)}%  text→picture mistakes ${r.falsePictures}`;
