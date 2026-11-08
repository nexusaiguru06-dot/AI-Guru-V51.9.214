import { describe, expect, it } from 'vitest';
import type { LTXJobResult, LTXRequest } from '../ltx/LTXRequest';
import { LTX2Adapter } from '../ltx/LTX2Adapter';
import { buildLTXRequest } from '../ltx/LTX2AdapterRequest';
import type { LTXClient } from '../ltx/LTXClient';
import { compileGuruScene } from '../compiler';

function scene() {
  return compileGuruScene({
    lessonId: 'triangle-area',
    lessonTitle: 'Area of a Triangle',
    grade: 8,
    gradeBand: '6-8',
    domain: 'geometry',
    language: 'english',
    teachingGoal: 'Connect base and height to area.',
    segmentId: 's1',
    segmentTitle: 'Build the triangle',
    beatId: 'b1',
    narration: 'Identify the base and height.',
    durationMs: 3000,
    targetObjects: ['triangle', 'base', 'height'],
    mathObjectIds: ['triangle', 'base', 'height'],
    references: [{ id: 'ref-1', uri: '/references/triangle.mp4', type: 'video' }],
  });
}

class FakeClient implements LTXClient {
  requests: LTXRequest[] = [];
  private result: LTXJobResult = { status: 'queued', jobId: 'job-1' };

  submit(request: LTXRequest) { this.requests.push(request); return Promise.resolve(this.result); }
  retake(request: any) { this.requests.push(request); return Promise.resolve(this.result); }
  extend(request: any) { this.requests.push(request); return Promise.resolve(this.result); }
}

describe('Sprint-C LTX-2 adapter', () => {
  it('creates an LTX request while keeping math renderer deterministic', () => {
    const request = buildLTXRequest(scene(), undefined);
    expect(request.operation).toBe('generate');
    expect(request.forbiddenOutputs).toContain('equations');
    expect(request.conditions.some((x) => x.type === 'reference-video')).toBe(true);
    expect(request.prompt).toContain('deterministic math engine');
  });

  it('submits generate, retake and extend through the isolated client boundary', async () => {
    const client = new FakeClient();
    const adapter = new LTX2Adapter(client);
    const current = scene();

    await adapter.generate(current);
    await adapter.retake({
      scene: current,
      sourceVideo: { id: 'generated', uri: '/out/scene.mp4', type: 'video' },
      startMs: 500,
      endMs: 1500,
    });
    await adapter.extend({
      scene: current,
      sourceVideo: { id: 'generated', uri: '/out/scene.mp4', type: 'video' },
      direction: 'after',
      extensionMs: 1000,
    });

    expect(client.requests.map((x) => x.operation)).toEqual(['generate', 'retake', 'extend']);
  });

  it('rejects an invalid retake range', async () => {
    const adapter = new LTX2Adapter(new FakeClient());
    await expect(adapter.retake({
      scene: scene(),
      sourceVideo: { id: 'generated', uri: '/out/scene.mp4', type: 'video' },
      startMs: 2000,
      endMs: 1000,
    })).rejects.toThrow(/Invalid LTX retake range/);
  });
});
