import { ids, type Lesson, type AgentResult, type AgentRunId } from '../../contracts';
import { CurriculumAgent, type CurriculumInput } from '../curriculum/curriculum-agent';
import { RAGBookAgent, type SourceParagraphInput } from '../rag-book/rag-book-agent';
import { LessonAgent } from '../lesson/lesson-agent';
import { runContentQA } from '../../qa/content/content-qa';
import { runLessonQA } from '../../qa/lesson/lesson-qa';
import { executeAIGuruAgent } from '../../runtime/execute-agent';

export interface TeachingPipelineDependencies { curriculum?: CurriculumAgent; rag?: RAGBookAgent; lesson?: LessonAgent; maxAttempts?: number; }
export interface TeachingPipelineResult { runId: AgentRunId; lesson: Lesson; contentQA: ReturnType<typeof runContentQA>; lessonQA: ReturnType<typeof runLessonQA>; status: 'passed'|'blocked'; }

export class TeachingController {
  private readonly curriculum: CurriculumAgent;
  private readonly rag: RAGBookAgent;
  private readonly lesson: LessonAgent;
  constructor(deps: TeachingPipelineDependencies = {}) { this.curriculum = deps.curriculum ?? new CurriculumAgent(); this.rag = deps.rag ?? new RAGBookAgent(); this.lesson = deps.lesson ?? new LessonAgent(); }

  async buildLesson(lesson: Lesson): Promise<TeachingPipelineResult> {
    const runId = ids.agentRun(`teaching-${lesson.id}-${Date.now()}`);
    const curriculum = await executeAIGuruAgent(this.curriculum, { agent: 'curriculum', context: { runId, lessonId: lesson.id }, input: { courseId: lesson.courseId, bookId: lesson.bookId, chapterId: lesson.chapterId, lessonId: lesson.id, title: lesson.title } });
    if (!curriculum.ok) throw new Error(curriculum.error?.message ?? 'Curriculum agent failed');

    const rag = await executeAIGuruAgent(this.rag, { agent: 'rag-book', context: { runId, lessonId: lesson.id }, input: { lessonId: lesson.id, paragraphs: lesson.paragraphs } as SourceParagraphInput });
    if (!rag.ok || !rag.output) throw new Error(rag.error?.message ?? 'RAG/book agent failed');
    const sourcedLesson = { ...lesson, paragraphs: rag.output.paragraphs };
    const contentQA = runContentQA(sourcedLesson);
    if (contentQA.status !== 'passed') return { runId, lesson: sourcedLesson, contentQA, lessonQA: { ...runLessonQA(sourcedLesson), status: 'blocked', failures: [] }, status: 'blocked' };

    const planned = await executeAIGuruAgent(this.lesson, { agent: 'lesson', context: { runId, lessonId: lesson.id }, input: { lesson: sourcedLesson, objectives: curriculum.output?.learningObjectives, prerequisites: curriculum.output?.prerequisites } });
    if (!planned.ok || !planned.output) throw new Error(planned.error?.message ?? 'Lesson agent failed');
    const lessonQA = runLessonQA(planned.output);
    return { runId, lesson: planned.output, contentQA, lessonQA, status: lessonQA.status === 'passed' ? 'passed' : 'blocked' };
  }
}
