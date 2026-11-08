/** Shared claim scoring for the subject agents: weighted keyword evidence from the block's own words. */

import type { BookBlock } from '../motion-class/segment';
import type { SubjectContext } from './types';

export function score(b: BookBlock, ctx: SubjectContext, words: Array<[RegExp, number]>, hint: string): number {
  if (b.kind === 'heading' || b.kind === 'aside') return 0;
  const text = `${b.text}`;
  let s = 0;
  for (const [re, w] of words) if (re.test(text)) s += w;
  const h = `${ctx.subjectHint ?? ''} ${ctx.chapterTitle}`.toLowerCase();
  if (h.includes(hint)) s += 0.2;
  return Math.min(1, s);
}
