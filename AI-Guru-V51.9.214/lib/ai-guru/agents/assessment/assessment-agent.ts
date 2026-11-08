import { ids, type AgentRequest, type AgentResult, type AIGuruAgent, type Lesson, type Paragraph, type Problem } from '../../contracts';

export interface AssessmentItem { id: string; paragraphId: string; type: 'checkpoint'|'problem'; prompt: string; expected?: string; difficulty?: 'easy'|'medium'|'hard'; }
export interface AssessmentResult { lessonId: string; items: AssessmentItem[]; }
export interface AssessmentResponse { itemId: string; answer: string; }
export interface AssessmentEvaluation { itemId: string; correct: boolean; score: number; feedback: string; conceptId: string; }

function normalize(s: string) { return s.toLowerCase().trim().replace(/\\text\{([^}]*)\}/g, '$1').replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)').replace(/[^a-z0-9.+\-*/=(). ]/g, '').replace(/\s+/g, ' '); }
function conceptId(p: Paragraph, problem?: Problem) { return `${p.id}:${problem?.id ?? 'checkpoint'}`; }

export class AssessmentAgent implements AIGuruAgent<{ lesson: Lesson; paragraphId?: string }, AssessmentResult> {
  readonly name = 'assessment' as const;
  async execute(request: AgentRequest<{ lesson: Lesson; paragraphId?: string }>): Promise<AgentResult<AssessmentResult>> {
    const ps = request.input.lesson.paragraphs.filter(p => !request.input.paragraphId || p.id === request.input.paragraphId);
    const items: AssessmentItem[] = [];
    for (const p of ps) {
      for (const c of p.checkpoints) items.push({ id: c.id, paragraphId: p.id, type: 'checkpoint', prompt: c.prompt, expected: c.expected, difficulty: c.difficulty });
      for (const problem of p.problems) items.push({ id: problem.id, paragraphId: p.id, type: 'problem', prompt: problem.sourceText, expected: problem.solution?.finalAnswer, difficulty: problem.difficulty });
    }
    return { ok: true, agent: this.name, runId: request.context.runId, output: { lessonId: request.input.lesson.id, items } };
  }

  evaluate(request: AgentRequest<{ lesson: Lesson; response: AssessmentResponse }>): AgentResult<AssessmentEvaluation> {
    const { lesson, response } = request.input;
    const paragraph = lesson.paragraphs.find(p => p.checkpoints.some(c => c.id === response.itemId) || p.problems.some(x => x.id === response.itemId));
    if (!paragraph) return { ok: false, agent: this.name, runId: request.context.runId, error: { code: 'ITEM_NOT_FOUND', message: 'Assessment item was not found' } };
    const checkpoint = paragraph.checkpoints.find(c => c.id === response.itemId);
    const problem = paragraph.problems.find(x => x.id === response.itemId);
    const expected = checkpoint?.expected ?? problem?.solution?.finalAnswer;
    const correct = !!expected && normalize(expected) === normalize(response.answer);
    return { ok: true, agent: this.name, runId: request.context.runId, output: { itemId: response.itemId, correct, score: correct ? 1 : 0, feedback: correct ? 'Correct. Good work.' : expected ? `Not quite. Recheck the step and try again.` : 'Response recorded; this item has no deterministic answer key.', conceptId: conceptId(paragraph, problem) } };
  }
}
