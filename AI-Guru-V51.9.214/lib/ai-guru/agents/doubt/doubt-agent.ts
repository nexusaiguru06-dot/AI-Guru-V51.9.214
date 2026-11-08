import type { AgentRequest, AgentResult, AIGuruAgent, Lesson } from '../../contracts';
export interface DoubtAnswer { answer: string; paragraphId?: string; sourceText?: string; suggestedAction: 'review'|'replay_visual'|'retry'|'continue'; }
export class DoubtAgent implements AIGuruAgent<{ lesson: Lesson; paragraphId: string; question: string }, DoubtAnswer> {
  readonly name = 'doubt' as const;
  async execute(request: AgentRequest<{ lesson: Lesson; paragraphId: string; question: string }>): Promise<AgentResult<DoubtAnswer>> {
    const p = request.input.lesson.paragraphs.find(x => x.id === request.input.paragraphId);
    if (!p) return { ok: false, agent: this.name, runId: request.context.runId, error: { code: 'PARAGRAPH_NOT_FOUND', message: 'Paragraph was not found' } };
    const answer = `For this paragraph, focus on: ${p.explanation[request.context.language ?? 'english'] || p.explanation.english}. The textbook source is: ${p.source.text}`;
    return { ok: true, agent: this.name, runId: request.context.runId, output: { answer, paragraphId: p.id, sourceText: p.source.text, suggestedAction: p.visualSteps.length ? 'replay_visual' : 'review' } };
  }
}
