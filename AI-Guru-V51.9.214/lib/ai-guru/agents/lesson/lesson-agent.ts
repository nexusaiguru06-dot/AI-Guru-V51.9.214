import type { AIGuruAgent, AgentRequest, AgentResult, Lesson, Paragraph } from '../../contracts';
import type { LessonId } from '../../contracts';

export interface LessonGenerationInput { lesson: Lesson; objectives?: string[]; prerequisites?: string[]; }
export type LessonPlanner = (input: LessonGenerationInput) => Promise<Lesson>;

export class LessonAgent implements AIGuruAgent<LessonGenerationInput, Lesson> {
  readonly name = 'lesson' as const;
  constructor(private readonly planner: LessonPlanner = async ({ lesson }) => lesson) {}
  async execute(request: AgentRequest<LessonGenerationInput>): Promise<AgentResult<Lesson>> {
    try {
      const lesson = await this.planner(request.input);
      return { ok: true, agent: this.name, runId: request.context.runId, output: lesson };
    } catch (error) { return { ok: false, agent: this.name, runId: request.context.runId, error: { code: 'LESSON_FAILED', message: error instanceof Error ? error.message : String(error) } }; }
  }
}
