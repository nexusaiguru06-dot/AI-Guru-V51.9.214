/**
 * The orchestrator: every subject agent looks at each block in parallel and says how sure it is that the
 * block is its subject; the most confident agent above the threshold plans it. An agent that fails is
 * isolated (its block simply goes back to the maths engine); one agent never affects another.
 */

import type { BookBlock } from '../motion-class/segment';
import { parseJson, isBi } from './kit';
import { AGENTS } from './index';
import type { AgentEvent, Llm, SubjectAgent, SubjectContext, SubjectPlan } from './types';

export const CLAIM_THRESHOLD = 0.5;

async function planWith(agent: SubjectAgent, b: BookBlock, ctx: SubjectContext, llm: Llm | null, log: (e: AgentEvent) => void): Promise<SubjectPlan | null> {
  const ev = (stage: AgentEvent['stage'], ok: boolean, note: string) => log({ agent: agent.id, blockId: b.id, stage, ok, note });
  const check = (template: string, teach: unknown): string[] => {
    const t = agent.templates.find((x) => x.id === template);
    if (!t) return [`unknown template "${template}"`];
    try {
      return t.validate(teach);
    } catch (e) {
      return [`validator crashed: ${(e as Error).message}`];
    }
  };
  if (llm) {
    let problems = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const user = `Chapter: ${ctx.chapterTitle}\nSection: ${ctx.sectionTitle}\nBlock (${b.kind}):\n${b.text}${problems ? `\n\nYour previous plan was rejected:\n${problems}\nFix these and reply with the corrected JSON.` : ''}`;
        const r = parseJson(await llm(agent.system, user)) as { template?: string | null; teach?: unknown; read?: { en?: string; ml?: string } };
        if (!r.template) {
          ev('plan', false, 'the agent declined the block');
          break;
        }
        const errs = check(r.template, r.teach);
        if (errs.length) {
          problems = errs.map((x) => `- ${x}`).join('\n');
          ev('validate', false, errs.join('; '));
          continue;
        }
        const read = isBi(r.read) || (r.read && typeof r.read.en === 'string') ? { en: r.read!.en || b.text, ml: r.read!.ml || '' } : { en: b.text, ml: '' };
        ev('plan', true, `AI plan, template ${r.template}`);
        return { agent: agent.id, template: r.template, read, teach: r.teach, source: 'ai' };
      } catch (e) {
        ev('plan', false, (e as Error).message);
        break;
      }
    }
  }
  const t = agent.fromText(b, ctx);
  if (t) {
    const errs = check(t.template, t.teach);
    if (!errs.length) {
      ev('fallback', true, `read from the text, template ${t.template}`);
      return { agent: agent.id, template: t.template, read: { en: b.text, ml: '' }, teach: t.teach, source: 'text' };
    }
    ev('fallback', false, errs.join('; '));
  }
  return null;
}

export async function planSubjects(
  blocks: BookBlock[],
  ctx: SubjectContext,
  opts: { llm?: Llm | null; onEvent?: (e: AgentEvent) => void; concurrency?: number; threshold?: number; agents?: SubjectAgent[] } = {},
): Promise<Map<string, SubjectPlan>> {
  const agents = opts.agents ?? AGENTS;
  const log = opts.onEvent ?? (() => undefined);
  const th = opts.threshold ?? CLAIM_THRESHOLD;
  const out = new Map<string, SubjectPlan>();
  const jobs: Array<{ b: BookBlock; agent: SubjectAgent }> = [];
  for (const b of blocks) {
    if (b.kind === 'math' || b.kind === 'heading') continue; // equations are the maths engine's
    const claims = agents.map((a) => {
      try {
        return { a, s: a.claim(b, ctx) };
      } catch {
        return { a, s: 0 };
      }
    });
    claims.sort((x, y) => y.s - x.s);
    const best = claims[0];
    if (best && best.s >= th) {
      log({ agent: best.a.id, blockId: b.id, stage: 'claim', ok: true, note: `claimed with ${best.s.toFixed(2)}` });
      jobs.push({ b, agent: best.a });
    }
  }
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const j = jobs[next++];
      try {
        const p = await planWith(j.agent, j.b, ctx, opts.llm ?? null, log);
        if (p) out.set(j.b.id, p);
        else log({ agent: j.agent.id, blockId: j.b.id, stage: 'skip', ok: false, note: 'nothing drawable; the maths engine keeps this block' });
      } catch (e) {
        log({ agent: j.agent.id, blockId: j.b.id, stage: 'skip', ok: false, note: (e as Error).message });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 3, jobs.length) }, worker));
  return out;
}
