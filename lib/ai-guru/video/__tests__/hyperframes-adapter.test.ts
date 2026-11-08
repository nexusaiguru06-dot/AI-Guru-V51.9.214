import { describe, expect, it } from 'vitest';
import type { CompositionSceneRequest, CompositionJobResult } from '../composition-engine';
import { HyperFramesAdapter } from '../hyperframes/HyperFramesAdapter';
import { buildHyperFramesLessonRequest, buildHyperFramesSceneRequest } from '../hyperframes/HyperFramesRequest';
import type { GuruLesson, GuruScene } from '../scene-contracts';

const scene: GuruScene = {
  schemaVersion: '1.0', id: 'scene:test:1', lessonId: 'lesson:test', segmentId: 's1', beatId: 'b1',
  title: 'Triangle', domain: 'geometry', grade: 7, gradeBand: '6-8', language: 'malayalam',
  durationMs: 4000, teachingGoal: 'Explain the base',
  objects: [{ id: 'triangle', kind: 'geometry', source: 'math-engine', deterministic: true }],
  actions: [{ type: 'highlight', objectId: 'triangle' }],
  cameras: [{ id: 'cam', atMs: 1000, durationMs: 700, from: { scale: 1 }, to: { scale: 1.3 }, reason: 'focus base' }],
  keyframes: [{ id: 'kf', atMs: 0, state: 'start', objectIds: ['triangle'], narrationCueId: 'a1' }],
  timelineCues: [{ id: 't1', atMs: 0, durationMs: 4000, text: 'ഇത് അടിഭാഗമാണ്', language: 'malayalam', targetObjectIds: ['triangle'], beatId: 'b1' }],
  audioCues: [{ id: 'a1', atMs: 500, durationMs: 400, language: 'malayalam', text: 'അടി', word: 'അടി', tokenIndex: 1, targetObjectIds: ['triangle'] }],
  generative: { enabled: true, purpose: 'cinematic', conditions: [], durationMs: 4000, forbiddenOutputs: ['equations','graphs','geometry-truth','verified-labels','mathematical-transformations'] },
  layers: [
    { id: 'textbook', source: 'textbook', assetIds: ['page1'], startMs: 0, endMs: 4000, zIndex: 0 },
    { id: 'ltx', source: 'ltx', assetIds: ['clip'], startMs: 0, endMs: 4000, zIndex: 10, opacity: .8 },
    { id: 'math', source: 'math-engine', objectIds: ['triangle'], startMs: 0, endMs: 4000, zIndex: 20 },
    { id: 'audio', source: 'audio', startMs: 0, endMs: 4000, zIndex: 40 },
  ],
  rendererPolicy: { math: { renderer: 'math-engine', deterministic: true }, generative: { renderer: 'ltx', enabled: true, deterministic: false }, composition: { renderer: 'composition', deterministic: true } },
  verificationRefs: ['verify:triangle'],
};

const lesson: GuruLesson = { schemaVersion: '1.0', id: 'lesson:test', title: 'Triangle', grade: 7, gradeBand: '6-8', domain: 'geometry', language: 'malayalam', scenes: [scene, { ...scene, id: 'scene:test:2', beatId: 'b2', durationMs: 3000 }], totalDurationMs: 7000 };

it('builds deterministic scene composition with math above LTX and word cues', () => {
  const request = buildHyperFramesSceneRequest(scene, [
    { id: 'page1', uri: 'file:///page1.png', type: 'image' },
    { id: 'clip', uri: 'file:///clip.mp4', type: 'video' },
  ]);
  expect(request.deterministic).toBe(true);
  expect(request.tracks.find(t => t.id === 'math')?.zIndex).toBeGreaterThan(request.tracks.find(t => t.id === 'ltx')?.zIndex ?? -1);
  expect(request.cues.some(c => c.kind === 'word' && c.tokenIndex === 1)).toBe(true);
  expect(request.camera[0].to?.scale).toBe(1.3);
});

it('offsets lesson scenes without changing their authored durations', () => {
  const request = buildHyperFramesLessonRequest(lesson);
  expect(request.durationMs).toBe(7000);
  expect(request.tracks.some(t => t.startMs === 4000)).toBe(true);
  expect(request.sceneIds).toEqual(['scene:test:1', 'scene:test:2']);
});

it('adapter delegates a renderer-neutral request to the HyperFrames bridge', async () => {
  const calls: CompositionSceneRequest[] = [];
  const client = { submit: async (request: CompositionSceneRequest): Promise<CompositionJobResult> => { calls.push(request); return { status: 'queued', jobId: 'hf-1' }; } };
  const adapter = new HyperFramesAdapter(client);
  const result = await adapter.renderLesson(lesson);
  expect(result.jobId).toBe('hf-1');
  expect(calls[0].operation).toBe('render-lesson');
});
