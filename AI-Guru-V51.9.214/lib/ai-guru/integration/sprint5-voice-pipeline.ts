import { ids, type Lesson } from '../contracts';
import { VoiceAgent, type VoiceProvider } from '../agents/voice';
import { runClassroomQA } from '../qa/classroom';
import { synchronizeLessonWords } from '../sync';
import { executeAIGuruAgent } from '../runtime/execute-agent';

export interface Sprint5Options { paragraphId?: string; synthesize?: boolean; providers?: Partial<Record<'english'|'malayalam', VoiceProvider>>; wordBoundaries?: Record<string, { language: 'english'|'malayalam'; word: string; startMs: number; endMs?: number }[]>; }
export async function runVoiceSyncClassroomPipeline(lesson: Lesson, options: Sprint5Options = {}) {
  const voiceAgent = new VoiceAgent();
  const voice = await executeAIGuruAgent(voiceAgent, { agent: 'voice', context: { runId: ids.agentRun(`voice-${lesson.id}-${Date.now()}`), lessonId: lesson.id, paragraphId: options.paragraphId }, input: { lesson, paragraphId: options.paragraphId, synthesize: options.synthesize, providers: options.providers } });
  if (!voice.ok || !voice.output) throw new Error(voice.error?.message ?? 'Voice Agent failed');
  const synced = synchronizeLessonWords(voice.output.lesson, options.wordBoundaries ?? {});
  const classroomQA = runClassroomQA(synced.lesson);
  return { lesson: synced.lesson, voice, sync: synced, classroomQA, status: classroomQA.status === 'failed' ? 'blocked' as const : 'passed' as const };
}
