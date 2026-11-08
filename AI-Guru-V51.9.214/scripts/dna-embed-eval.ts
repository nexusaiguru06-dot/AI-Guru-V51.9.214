/**
 * Compare DNA selectors on the English + Malayalam paragraph set.
 *
 *   npx tsx scripts/dna-embed-eval.ts
 *   OLLAMA_MODEL=embeddinggemma-2 OLLAMA_URL=http://localhost:11434 OLLAMA_DIMS=768 npx tsx scripts/dna-embed-eval.ts
 *
 * Always runs: keyword rules, rules + hashed character n-grams (the no-install fallback).
 * Runs when Ollama answers: rules + EmbeddingGemma, with a sweep of the similarity threshold so
 * you can pick `minCos` for your model and dimension. `--show` lists every wrong answer.
 */

import { evalHybrid, evalRules, formatReport, type EvalReport } from '../lib/ai-guru/motion-class/eval/run-eval';
import { hashEmbedder, ollamaEmbedder } from '../lib/ai-guru/motion-class/dna/semantic';

const show = process.argv.includes('--show');
const wrong = (r: EvalReport) => {
  if (!show) return;
  for (const row of r.rows.filter((x) => !x.ok)) console.log(`   ✗ [${row.item.lang}] expected ${row.item.expect}, got ${row.got}: ${row.item.text.slice(0, 70)}`);
};

async function main() {
  const rules = evalRules();
  console.log(formatReport(rules));
  wrong(rules);
  for (const minCos of [0.2, 0.3, 0.4]) {
    const r = await evalHybrid(hashEmbedder(512), { minCos });
    console.log(formatReport(r));
    if (minCos === 0.3) wrong(r);
  }
  const url = process.env.OLLAMA_URL ?? 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL ?? 'embeddinggemma-2';
  const dims = Number(process.env.OLLAMA_DIMS ?? 768);
  const gemma = ollamaEmbedder({ baseUrl: url, model, dims });
  try {
    for (const minCos of [0.3, 0.4, 0.45, 0.5, 0.55, 0.6]) {
      const r = await evalHybrid(gemma, { minCos });
      console.log(formatReport(r));
      if (minCos === 0.45) wrong(r);
    }
  } catch (e) {
    console.log(`\nEmbeddingGemma not run: ${(e as Error).message}\nStart Ollama and pull the model (check the exact tag with "ollama list"), then run again.`);
  }
}
void main();
