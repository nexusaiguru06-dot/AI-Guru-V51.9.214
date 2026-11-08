import { describe, expect, it } from 'vitest';
import { MathEngineAdapter, validateMathEngineRender } from '../math-engine-adapter';
import { buildFinalVideoManifest } from '../final-video-manifest';
import type { GuruLesson, GuruScene } from '../scene-contracts';

const scene: GuruScene = {
  schemaVersion: '1.0', id: 'scene:e:1', lessonId: 'lesson:e', segmentId: 's1', beatId: 'b1',
  title: 'Linear equation', domain: 'algebra', grade: 8, gradeBand: '6-8', language: 'malayalam',
  durationMs: 4000, teachingGoal: 'Solve x + 2 = 5',
  objects: [{ id: 'eq1', kind: 'equation', source: 'math-engine', semanticRef: 'verify:eq1', deterministic: true }],
  actions: [{ type: 'create', objectId: 'eq1' }], cameras: [], keyframes: [],
  timelineCues: [{ id: 't1', atMs: 0, durationMs: 4000, text: 'സമവാക്യം', targetObjectIds: ['eq1'], beatId: 'b1' }],
  audioCues: [
    { id: 'w1', atMs: 300, durationMs: 250, language: 'malayalam', text: 'x', word: 'x', tokenIndex: 0, targetObjectIds: ['eq1'] },
    { id: 'w2', atMs: 800, durationMs: 300, language: 'malayalam', text: 'equals', word: 'തുല്യം', tokenIndex: 1, targetObjectIds: ['eq1'] },
  ],
  generative: { enabled: false, purpose: 'cinematic', conditions: [], durationMs: 4000, forbiddenOutputs: ['equations','graphs','geometry-truth','verified-labels','mathematical-transformations'] },
  layers: [{ id: 'math', source: 'math-engine', objectIds: ['eq1'], startMs: 0, endMs: 4000, zIndex: 20 }],
  rendererPolicy: { math: { renderer: 'math-engine', deterministic: true }, generative: { renderer: 'none', enabled: false, deterministic: false }, composition: { renderer: 'composition', deterministic: true } },
  verificationRefs: ['verify:eq1'],
  metadata: { videoDNAPrimaryId: 'dna:algebra' },
};

const lesson: GuruLesson = { schemaVersion: '1.0', id: 'lesson:e', title: 'Linear equation', grade: 8, gradeBand: '6-8', domain: 'algebra', language: 'malayalam', scenes: [scene], totalDurationMs: 4000 };

const mathResult = {
  sceneId: scene.id,
  durationMs: 4000,
  assets: [{ id: 'math:eq1', uri: 'file:///math-eq1.mp4', type: 'video' as const, semanticObjectIds: ['eq1'], verificationRefs: ['verify:eq1'], renderer: 'math-engine' as const, deterministic: true as const }],
  verificationRefs: ['verify:eq1'],
};

describe('Sprint E', () => {
  it('rejects a math asset that is not tied to a verified scene object', () => {
    expect(() => validateMathEngineRender(scene, { ...mathResult, assets: [{ ...mathResult.assets[0], semanticObjectIds: ['unknown'] }] })).toThrow('unknown math object');
  });

  it('adapts a deterministic Math Engine result', async () => {
    const adapter = new MathEngineAdapter({ render: async () => mathResult });
    const result = await adapter.renderScene(scene);
    expect(result.assets[0].renderer).toBe('math-engine');
    expect(result.assets[0].deterministic).toBe(true);
  });

  it('builds a global manifest with lesson-relative word cues and verification ledger', () => {
    const manifest = buildFinalVideoManifest({
      lesson,
      mathResults: { [scene.id]: mathResult },
      compositionRequestId: 'hf:e', width: 1920, height: 1080, fps: 30, outputContainer: 'mp4',
      audioAssets: [{ id: 'audio:e', uri: 'file:///voice.wav', sceneId: scene.id, durationMs: 4000 }],
    });
    expect(manifest.totalDurationMs).toBe(4000);
    expect(manifest.scenes[0].cues.find(c => c.id === 'w2')?.atMs).toBe(800);
    expect(manifest.verificationLedger[0].mathAssetIds).toEqual(['math:eq1']);
    expect(manifest.safety.mathTruthOwner).toBe('math-engine');
    expect(manifest.composition.authority).toBe('hyperframes');
  });
});
