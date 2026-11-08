import type { AIGuruAgent, AgentRequest, AgentResult } from '../../contracts';
import type { CourseId, BookId, ChapterId, LessonId } from '../../contracts';

export interface CurriculumInput {
  courseId: CourseId;
  bookId: BookId;
  chapterId: ChapterId;
  lessonId: LessonId;
  title: string;
  metadata?: Record<string, unknown>;
}

export interface CurriculumContext {
  courseId: CourseId;
  bookId: BookId;
  chapterId: ChapterId;
  lessonId: LessonId;
  title: string;
  learningObjectives: string[];
  prerequisites: string[];
}

export type CurriculumResolver = (input: CurriculumInput) => Promise<CurriculumContext>;

export class CurriculumAgent implements AIGuruAgent<CurriculumInput, CurriculumContext> {
  readonly name = 'curriculum' as const;
  constructor(private readonly resolver: CurriculumResolver = async (input) => ({
    courseId: input.courseId, bookId: input.bookId, chapterId: input.chapterId,
    lessonId: input.lessonId, title: input.title, learningObjectives: [], prerequisites: [],
  })) {}

  async execute(request: AgentRequest<CurriculumInput>): Promise<AgentResult<CurriculumContext>> {
    try { return { ok: true, agent: this.name, runId: request.context.runId, output: await this.resolver(request.input) }; }
    catch (error) { return { ok: false, agent: this.name, runId: request.context.runId, error: { code: 'CURRICULUM_FAILED', message: error instanceof Error ? error.message : String(error) } }; }
  }
}
