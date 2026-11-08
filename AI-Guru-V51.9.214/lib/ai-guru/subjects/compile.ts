/**
 * Class compiler for lessons that mix subjects. Blocks without a subject plan go through the maths
 * compiler (compileClass) exactly as before; a block with a subject plan becomes its own read + teach
 * segments built by the agent's template. With no subject plans the result is identical to compileClass.
 */

import { compileClass, type ClassSegment, type CompileOptions } from '../motion-class/class';
import { buildReadingScene } from '../motion-class/reading';
import type { BookBlock } from '../motion-class/segment';
import type { BlockPlan } from '../motion-class/dna/types';
import type { Lang } from '../reels/motion/captions';
import { agentById } from './index';
import type { SubjectPlan } from './types';

const LANG_NAME: Record<Lang, string> = { en: 'English', ml: 'മലയാളം' };

export function compileMixed(blocks: BookBlock[], plans: Map<string, BlockPlan>, subject: Map<string, SubjectPlan>, ctx: { title: string }, o: CompileOptions = {}): ClassSegment[] {
  if (!subject.size) return compileClass(blocks, plans, ctx, o);
  const langs = o.languages ?? ['en', 'ml'];
  const out: ClassSegment[] = [];
  let group: BookBlock[] = [];
  const flush = () => {
    if (group.length) out.push(...compileClass(group, plans, ctx, o));
    group = [];
  };
  for (const b of blocks) {
    const sp = subject.get(b.id);
    const tpl = sp && agentById(sp.agent)?.templates.find((t) => t.id === sp.template);
    if (!sp || !tpl) {
      group.push(b);
      continue;
    }
    flush();
    for (const lang of langs) {
      const text = lang === 'ml' ? sp.read.ml : sp.read.en;
      if (o.read !== false && text) {
        out.push({ id: `${b.id}:read:${lang}`, blockId: b.id, phase: 'read', lang, dna: 'concept-board', label: `Read · ${LANG_NAME[lang]}`, title: ctx.title, build: () => [buildReadingScene(text, lang, ctx.title)] });
      }
      out.push({ id: `${b.id}:teach:${lang}`, blockId: b.id, phase: 'teach', lang, dna: 'concept-board', label: `Teach · ${LANG_NAME[lang]} · ${sp.agent}`, title: ctx.title, build: () => tpl.build(sp.teach, lang, ctx.title) });
    }
  }
  flush();
  return out;
}
