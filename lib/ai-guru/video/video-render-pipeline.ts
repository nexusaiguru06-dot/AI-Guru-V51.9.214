import type { GuruLesson, GuruScene } from './scene-contracts';
import type { VideoDNASelection } from './video-dna-v2';
import type { GenerativeVideoEngine, GenerativeVideoOptions } from './generative-video';
import type { CompositionAsset, CompositionEngine, CompositionJobResult, CompositionRenderOptions } from './composition-engine';
import type { LTXJobResult } from './ltx/LTXRequest';
import type { MathEngineRenderOptions, MathEngineRenderResult, MathEngineRenderer } from './math-engine-adapter';
import { mathRenderAssetsToCompositionAssets, validateMathEngineRender } from './math-engine-adapter';
import { buildFinalVideoManifest, type AIGuruFinalVideoManifest } from './final-video-manifest';
import { AIGuruSpeechSyncPipeline, type SpeechSyncPipelineOptions } from './speech-sync-pipeline';

export interface VideoRenderSceneOptions {
  generation?: GenerativeVideoOptions;
  composition?: CompositionRenderOptions;
  math?: MathEngineRenderOptions;
  assets?: CompositionAsset[];
  audioAssets?: Array<{ id: string; uri: string; sceneId?: string; durationMs?: number; metadata?: Record<string, string | number | boolean> }>;
  speech?: SpeechSyncPipelineOptions;
}

export interface VideoRenderSceneResult {
  math?: MathEngineRenderResult;
  generative?: LTXJobResult;
  composition: CompositionJobResult;
  manifest: AIGuruFinalVideoManifest;
}

export interface VideoRenderLessonResult {
  math: Array<{ sceneId: string; result: MathEngineRenderResult }>;
  generative: Array<{ sceneId: string; result: LTXJobResult }>;
  composition: CompositionJobResult;
  manifest: AIGuruFinalVideoManifest;
}

/**
 * Sprint-E end-to-end pipeline:
 * Video-DNA → deterministic Math Engine → optional LTX visual asset →
 * synchronized manifest → HyperFrames final composition.
 *
 * The Math Engine is validated before its assets enter composition. HyperFrames
 * remains the timing/composition authority; LTX never owns mathematical truth.
 */
export class AIGuruVideoRenderPipeline {
  constructor(
    private readonly composition: CompositionEngine,
    private readonly generative?: GenerativeVideoEngine,
    private readonly mathEngine?: MathEngineRenderer,
    private readonly speechSync?: AIGuruSpeechSyncPipeline,
  ) {}

  async renderScene(
    scene: GuruScene,
    selection?: VideoDNASelection,
    options: VideoRenderSceneOptions = {},
  ): Promise<VideoRenderSceneResult> {
    const prepared = this.speechSync && options.speech ? await this.speechSync.synthesizeScene(scene, options.speech) : undefined;
    scene = prepared?.scene ?? scene;
    const assets = [...(options.assets ?? [])];
    if (prepared) assets.push({ id: `speech:${scene.id}`, uri: prepared.speech.assetUri, type: 'audio', durationMs: prepared.speech.durationMs, metadata: { renderer: 'audio', provider: prepared.speech.provider } });
    let math: MathEngineRenderResult | undefined;
    let generative: LTXJobResult | undefined;

    if (this.mathEngine && scene.objects.some((object) => object.source === 'math-engine')) {
      math = validateMathEngineRender(scene, await this.mathEngine.renderScene(scene, options.math));
      assets.push(...mathRenderAssetsToCompositionAssets(math));
    }

    if (scene.generative.enabled) {
      if (!this.generative) throw new Error('Generative video is enabled but no generative video engine is configured');
      generative = await this.generative.generate(scene, selection, options.generation);
      if (generative.assetUri) {
        assets.push({
          id: `ltx:${generative.jobId}`,
          uri: generative.assetUri,
          type: 'video',
          durationMs: scene.durationMs,
          metadata: { renderer: 'ltx', jobId: generative.jobId },
        });
      }
    }

    const composition = await this.composition.renderScene(scene, assets, options.composition);
    const manifest = buildFinalVideoManifest({
      lesson: singleSceneLesson(scene),
      mathResults: math ? { [scene.id]: math } : undefined,
      ltxResults: generative ? [{ sceneId: scene.id, result: generative }] : undefined,
      audioAssets: [
        ...(options.audioAssets ?? []),
        ...(prepared ? [{ id: `speech:${scene.id}`, uri: prepared.speech.assetUri, sceneId: scene.id, durationMs: prepared.speech.durationMs, metadata: { provider: prepared.speech.provider } }] : []),
      ],
      compositionRequestId: options.composition?.requestId ?? composition.jobId,
      width: options.composition?.width ?? 1920,
      height: options.composition?.height ?? 1080,
      fps: options.composition?.fps ?? 30,
      outputContainer: options.composition?.container ?? 'mp4',
      outputUri: composition.assetUri ?? options.composition?.outputUri,
    });
    return { math, generative, composition, manifest };
  }

  async renderLesson(
    lesson: GuruLesson,
    selections: Record<string, VideoDNASelection> = {},
    options: VideoRenderSceneOptions = {},
  ): Promise<VideoRenderLessonResult> {
    const speechResults = this.speechSync && options.speech ? await this.speechSync.synthesizeLesson(lesson, options.speech) : undefined;
    lesson = speechResults?.lesson ?? lesson;
    const assets = [...(options.assets ?? [])];
    for (const speech of speechResults?.scenes ?? []) assets.push({ id: `speech:${speech.sceneId}`, uri: speech.speech.assetUri, type: 'audio', durationMs: speech.speech.durationMs, metadata: { renderer: 'audio', provider: speech.speech.provider } });
    const math: Array<{ sceneId: string; result: MathEngineRenderResult }> = [];
    const generative: Array<{ sceneId: string; result: LTXJobResult }> = [];

    for (const scene of lesson.scenes) {
      if (this.mathEngine && scene.objects.some((object) => object.source === 'math-engine')) {
        const result = validateMathEngineRender(scene, await this.mathEngine.renderScene(scene, options.math));
        math.push({ sceneId: scene.id, result });
        assets.push(...mathRenderAssetsToCompositionAssets(result));
      }

      if (scene.generative.enabled) {
        if (!this.generative) throw new Error('Generative video is enabled but no generative video engine is configured');
        const result = await this.generative.generate(scene, selections[scene.id], options.generation);
        generative.push({ sceneId: scene.id, result });
        if (result.assetUri) {
          assets.push({
            id: `ltx:${result.jobId}`,
            uri: result.assetUri,
            type: 'video',
            durationMs: scene.durationMs,
            metadata: { renderer: 'ltx', jobId: result.jobId, sceneId: scene.id },
          });
        }
      }
    }

    const composition = await this.composition.renderLesson(lesson, assets, options.composition);
    const manifest = buildFinalVideoManifest({
      lesson,
      mathResults: Object.fromEntries(math.map((item) => [item.sceneId, item.result])),
      ltxResults: generative,
      audioAssets: [
        ...(options.audioAssets ?? []),
        ...(speechResults?.scenes.map((item) => ({ id: `speech:${item.sceneId}`, uri: item.speech.assetUri, sceneId: item.sceneId, durationMs: item.speech.durationMs, metadata: { provider: item.speech.provider } })) ?? []),
      ],
      compositionRequestId: options.composition?.requestId ?? composition.jobId,
      width: options.composition?.width ?? 1920,
      height: options.composition?.height ?? 1080,
      fps: options.composition?.fps ?? 30,
      outputContainer: options.composition?.container ?? 'mp4',
      outputUri: composition.assetUri ?? options.composition?.outputUri,
    });
    return { math, generative, composition, manifest };
  }
}

function singleSceneLesson(scene: GuruScene): GuruLesson {
  return {
    schemaVersion: '1.0',
    id: scene.lessonId,
    title: scene.title,
    grade: scene.grade,
    gradeBand: scene.gradeBand,
    domain: scene.domain,
    language: scene.language,
    scenes: [scene],
    totalDurationMs: scene.durationMs,
  };
}
