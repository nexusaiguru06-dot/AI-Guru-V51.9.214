import type { AIGuruAgent, AgentRequest, AgentResult, Lesson, Paragraph, SourceReference } from '../../contracts';
import type { LessonId } from '../../contracts';

export interface SourceParagraphInput { lessonId: LessonId; paragraphs: Array<Pick<Paragraph, 'id'|'index'|'source'|'heading'>>; }
export interface RAGBookOutput { lessonId: LessonId; paragraphs: Paragraph[]; sourceCount: number; }
export type SourceResolver = (input: SourceParagraphInput) => Promise<Paragraph[]>;

export class RAGBookAgent implements AIGuruAgent<SourceParagraphInput, RAGBookOutput> {
  readonly name = 'rag-book' as const;
  constructor(private readonly resolver?: SourceResolver) {}

  async execute(request: AgentRequest<SourceParagraphInput>): Promise<AgentResult<RAGBookOutput>> {
    try {
      const paragraphs = this.resolver ? await this.resolver(request.input) : request.input.paragraphs.map((p) => ({
        ...p,
        source: p.source as SourceReference,
        teachingIntent: '',
        explanation: { english: '', malayalam: '' },
        visualSteps: [], audioCues: [], checkpoints: [], problems: [], state: 'idle' as const,
        qa: { content: 'pending' as const, lesson: 'pending' as const, visual: 'pending' as const, classroom: 'pending' as const },
      }));
      return { ok: true, agent: this.name, runId: request.context.runId, output: { lessonId: request.input.lessonId, paragraphs, sourceCount: paragraphs.length } };
    } catch (error) { return { ok: false, agent: this.name, runId: request.context.runId, error: { code: 'RAG_BOOK_FAILED', message: error instanceof Error ? error.message : String(error) } }; }
  }
}
