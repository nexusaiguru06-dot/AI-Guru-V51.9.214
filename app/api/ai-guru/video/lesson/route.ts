import { NextResponse } from 'next/server';
import { detectMathDomain } from '@/lib/ai-guru/math/universal';
import { generateTeachingLesson } from '@/lib/ai-guru/math/teaching';
import { evaluateTeachingLesson } from '@/lib/ai-guru/math/teaching/quality';
import {
  compileGuruLessonWithVideoDNA,
  AIGuruSpeechSyncPipeline,
  createAIGuruTTSManagerFromEnv,
  validateVideoProduction,
} from '@/lib/ai-guru/video';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = String(body?.question ?? body?.expression ?? '').trim();
    const grade = Number(body?.grade ?? 12);
    if (!question) return NextResponse.json({ ok: false, error: 'question is required' }, { status: 400 });
    if (!Number.isInteger(grade) || grade < 1 || grade > 12) return NextResponse.json({ ok: false, error: 'grade must be 1-12' }, { status: 400 });

    const language: 'english' | 'malayalam' = body?.language === 'malayalam' ? 'malayalam' : 'english';
    const domain = detectMathDomain(question);
    const byokKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : undefined;
    const baseInput = {
      question,
      grade,
      domain,
      language,
      expression: typeof body?.expression === 'string' ? body.expression : undefined,
      learningGoal: typeof body?.learningGoal === 'string' ? body.learningGoal : undefined,
      byokKey,
      chapterTitle: typeof body?.chapterTitle === 'string' ? body.chapterTitle : undefined,
      chapterSummary: typeof body?.chapterSummary === 'string' ? body.chapterSummary : undefined,
      chapterTopics: Array.isArray(body?.chapterTopics) ? body.chapterTopics.map(String).slice(0, 20) : undefined,
      textbookContext: typeof body?.textbookContext === 'string' ? body.textbookContext.slice(0, 12000) : undefined,
    };

    const lesson = await generateTeachingLesson(baseInput);
    const quality = await evaluateTeachingLesson(lesson);
    lesson.quality = quality;
    lesson.segments.forEach((segment) => {
      segment.mathematics.verified = quality.checks['math-correctness'] === true;
    });

    if (!quality.passed) {
      return NextResponse.json({
        ok: false,
        source: 'ai-guru-3b1b-video',
        error: 'Teaching lesson did not pass authoritative QA.',
        lesson,
        quality,
      }, { status: 422 });
    }

    let videoLesson = await compileGuruLessonWithVideoDNA(lesson, language);
    let speech: Array<{ sceneId: string; provider: string; durationMs: number; wordCount: number; assetUri?: string }> = [];

    if (body?.synthesizeAudio === true) {
      const manager = createAIGuruTTSManagerFromEnv();
      const pipeline = new AIGuruSpeechSyncPipeline(manager);
      const synced = await pipeline.synthesizeLesson(videoLesson, {
        strictWordCoverage: false,
        maxDurationDriftMs: Number(body?.maxDurationDriftMs ?? 15000),
      });
      videoLesson = synced.lesson;
      speech = synced.scenes.map((item) => ({
        sceneId: item.sceneId,
        provider: item.speech.provider,
        durationMs: item.speech.durationMs,
        wordCount: item.speech.wordTimings.length,
        ...(body?.includeAudio === true ? { assetUri: item.speech.assetUri } : {}),
      }));
    }

    const productionQA = validateVideoProduction(videoLesson, {}, {}, {
      strict: true,
      requireSpeechCoverage: body?.synthesizeAudio === true,
      requireMathVerification: true,
    });

    return NextResponse.json({
      ok: productionQA.passed,
      source: 'ai-guru-3b1b-video-dna-multi-tts',
      lesson,
      videoLesson,
      quality,
      productionQA,
      speech,
      capabilities: {
        mathAuthority: 'existing-ai-guru-verifier',
        visualRenderer: 'existing-browser-math-engine',
        videoDNA: true,
        multiTTS: true,
        ltxAdapter: true,
        hyperframesAdapter: true,
      },
    }, { status: productionQA.passed ? 200 : 422 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
