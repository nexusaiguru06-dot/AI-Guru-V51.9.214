import { strict as assert } from 'node:assert';
import { validateVideoProduction, assertVideoProductionReady } from '../production-qa';
import { repairVideoTimeline } from '../qa-repair';
import type { GuruLesson } from '../scene-contracts';

function lesson(): GuruLesson {
  const scene = {
    schemaVersion: '1.0' as const, id: 's1', lessonId: 'l1', segmentId: 'seg', title: 'Triangle', domain: 'geometry' as const,
    grade: 8, gradeBand: '6-8' as const, language: 'en' as const, durationMs: 2000, teachingGoal: 'base',
    objects: [{ id: 'base', type: 'line', source: 'math-engine' as const, deterministic: true, content: 'base' }],
    actions: [{ type: 'highlight' as const, objectId: 'base' }], cameras: [], keyframes: [], timelineCues: [],
    audioCues: [{ id: 'w1', atMs: 1000, durationMs: 300, language: 'en' as const, text: 'base', word: 'base', targetObjectIds: ['base'] }],
    generative: { enabled: true, purpose: 'background' as const, conditions: [], durationMs: 2000, forbiddenOutputs: ['equations','graphs','geometry-truth','verified-labels','mathematical-transformations'] },
    layers: [{ id: 'ltx', source: 'ltx' as const, startMs: 0, endMs: 2000, zIndex: 10 }, { id: 'math', source: 'math-engine' as const, startMs: 0, endMs: 2000, zIndex: 20 }],
    rendererPolicy: { math: { renderer: 'math-engine' as const, deterministic: true }, generative: { renderer: 'ltx' as const, enabled: true, deterministic: false }, composition: { renderer: 'composition' as const, deterministic: true } },
    verificationRefs: ['v1'],
  };
  return { schemaVersion: '1.0', id: 'l1', title: 'Triangle', grade: 8, gradeBand: '6-8', domain: 'geometry', language: 'en', scenes: [scene], totalDurationMs: 2000 };
}

const report = validateVideoProduction(lesson());
assert.equal(report.passed, true);
assert.doesNotThrow(() => assertVideoProductionReady(report));
const broken = lesson();
broken.scenes[0].audioCues[0].atMs = 5000;
const repaired = repairVideoTimeline(broken);
assert.equal(repaired.lesson.scenes[0].audioCues[0].atMs, 2000);
console.log('Sprint H runtime smoke: PASS');
