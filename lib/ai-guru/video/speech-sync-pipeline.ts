import type { GuruLesson, GuruScene } from './scene-contracts';
import type { SpeechSynthesisResult, SpeechTimingEngine, AudioTimingOptions } from './audio-timing-adapter';
import { applySpeechTimings } from './audio-timing-adapter';

export interface SceneSpeechResult {
  sceneId: string;
  speech: SpeechSynthesisResult;
  scene: GuruScene;
}

export interface SpeechSyncPipelineOptions extends AudioTimingOptions {
  outputUriPrefix?: string;
}

/**
 * Sprint-F speech stage. It makes narration timing a first-class input to the
 * final video manifest rather than estimating word positions from duration.
 */
export class AIGuruSpeechSyncPipeline {
  constructor(private readonly engine: SpeechTimingEngine) {}

  async synthesizeScene(scene: GuruScene, options: SpeechSyncPipelineOptions = {}): Promise<SceneSpeechResult> {
    const text = scene.audioCues
      .filter((cue) => !cue.word && cue.tokenIndex === undefined)
      .map((cue) => cue.text)
      .filter(Boolean)
      .join(' ')
      .trim();
    if (!text) throw new Error(`Scene ${scene.id} has no narration text`);
    const speech = await this.engine.synthesize({
      text,
      language: scene.language,
      sceneId: scene.id,
      outputUri: options.outputUriPrefix ? `${options.outputUriPrefix}/${scene.id}.wav` : undefined,
    });
    return { sceneId: scene.id, speech, scene: applySpeechTimings(scene, speech, options) };
  }

  async synthesizeLesson(lesson: GuruLesson, options: SpeechSyncPipelineOptions = {}): Promise<{
    lesson: GuruLesson;
    scenes: SceneSpeechResult[];
  }> {
    const scenes: SceneSpeechResult[] = [];
    for (const scene of lesson.scenes) scenes.push(await this.synthesizeScene(scene, options));
    return {
      lesson: {
        ...lesson,
        scenes: scenes.map((item) => item.scene),
        totalDurationMs: scenes.reduce((sum, item) => sum + item.scene.durationMs, 0),
      },
      scenes,
    };
  }
}
