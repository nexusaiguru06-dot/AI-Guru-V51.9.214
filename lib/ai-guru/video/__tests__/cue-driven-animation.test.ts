import { strict as assert } from 'node:assert';
import { compileCueDrivenAnimation } from '../cue-driven-animation';
import type { GuruScene } from '../scene-contracts';

const scene: GuruScene = {
  schemaVersion: '1.0', id: 's1', lessonId: 'l1', segmentId: 'seg1', beatId: 'b1',
  title: 'Triangle', domain: 'geometry' as GuruScene['domain'], grade: 7, gradeBand: '6-8', language: 'english',
  durationMs: 3000, teachingGoal: 'Identify the base',
  objects: [
    { id: 'triangle', kind: 'geometry', source: 'math-engine', deterministic: true },
    { id: 'base', kind: 'line', source: 'math-engine', content: 'base', deterministic: true },
  ],
  actions: [
    { type: 'create', objectId: 'triangle' },
    { type: 'highlight', objectId: 'base' },
  ],
  cameras: [], keyframes: [],
  timelineCues: [],
  audioCues: [
    { id: 'w1', atMs: 0, durationMs: 100, language: 'english', text: 'the', word: 'the' },
    { id: 'w2', atMs: 0, durationMs: 120, language: 'english', text: 'base', word: 'base' },
  ],
  generative: { enabled: false, purpose: 'reference-animation', conditions: [], durationMs: 3000, forbiddenOutputs: ['equations', 'graphs', 'geometry-truth', 'verified-labels', 'mathematical-transformations'] },
  layers: [],
  rendererPolicy: { math: { renderer: 'math-engine', deterministic: true }, generative: { renderer: 'none', enabled: false, deterministic: false }, composition: { renderer: 'composition', deterministic: true } },
  verificationRefs: ['v1'],
};

const plan = compileCueDrivenAnimation(scene);
assert.equal(plan.generatedFromSpeech, true);
assert.equal(plan.actions.length, 1);
assert.equal(plan.actions[0].action.type, 'highlight');
assert.equal(plan.actions[0].atMs, 0);
assert.equal(plan.actions[0].word, 'base');
assert.deepEqual(plan.actions[0].targetObjectIds, ['base']);
console.log('Cue-driven animation test: PASS');
