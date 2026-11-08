import { PATTERNS } from './catalog';
import { searchPatterns } from './search';
import type { VisualPattern } from './types';

/**
 * Text the LLM sees about patterns. Unlike a blind character cut, every pattern is written as a whole
 * (use-when, parameters, one example) and whole patterns are dropped when the budget runs out.
 */
export function describePattern(p: VisualPattern, o: { example?: boolean } = {}): string {
  const params = p.params.map((x) => `${x.name} (${x.type}${x.default !== undefined ? `, default ${JSON.stringify(x.default)}` : ''}): ${x.description}`).join('\n  ');
  const example = o.example === false ? '' : `\nExample params: ${JSON.stringify(p.example)}`;
  return `PATTERN "${p.id}" \u2014 ${p.name}\nUse when: ${p.whenToUse}\nParams:\n  ${params}${example}`;
}

/** All pattern ids with one line each: lets the model see what exists before it searches. */
export function libraryIndex(): string {
  return PATTERNS.map((p) => `- ${p.id}: ${p.name}. ${p.summary}`).join('\n');
}

/** Context for prompts that write visuals for a whole chapter/section. */
export function patternPromptContext(text: string, o: { k?: number; domain?: string; maxChars?: number } = {}): string {
  const hits = searchPatterns(text, { k: o.k ?? 5, domain: o.domain });
  if (!hits.length) return '';
  const budget = o.maxChars ?? 5000;
  let out = 'REUSABLE VISUAL PATTERNS (AI Guru library). When a step needs a picture of this kind, copy the STRUCTURE (labels as write actions with placement "absolute", anchor and color; lines/shapes on the 1000x700 board) and use the REAL numbers and letters of the textbook problem. Never copy the example numbers.\n';
  for (const h of hits) {
    const piece = `\n${describePattern(h.pattern, { example: true })}\n`;
    if (out.length + piece.length > budget) break;
    out += piece;
  }
  return out;
}
