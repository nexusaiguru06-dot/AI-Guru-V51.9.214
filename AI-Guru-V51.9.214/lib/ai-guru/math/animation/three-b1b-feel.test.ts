import { describe, expect, it } from 'vitest';
import { evalExpr, derivative, isValidExpr } from './expr';
import { lerpColor, normalizeBindings, resolveColor } from './colors';
import { colorizeLatex } from './latex-color';
import { createRuntimeSnapshot, sceneDurationMs } from './runtime';
import { compileAIGuruTeachingLesson } from './compiler';
import { SCENE_TEMPLATES, applySceneTemplates } from '../teaching/scene-templates';
import { evaluateTeachingLesson, difficultyProfile } from '../teaching/quality';
import type { AIGuruTeachingLesson } from '../teaching/types';
import type { UniversalMathScene } from '../universal/types';

describe('safe expression evaluator', () => {
  it('evaluates arithmetic, powers, implicit multiplication and functions', () => {
    expect(evalExpr('2+3*4')).toBe(14);
    expect(evalExpr('2^3^2')).toBe(512);
    expect(evalExpr('-x^2', { x: 3 })).toBe(-9);
    expect(evalExpr('3(t+1)', { t: 1 })).toBe(6);
    expect(evalExpr('2t', { t: 4 })).toBe(8);
    expect(evalExpr('sqrt(16)+abs(-2)')).toBe(6);
    expect(evalExpr('pi')).toBeCloseTo(Math.PI);
  });
  it('never executes code and returns NaN for bad input', () => {
    expect(evalExpr('process.exit(1)')).toBeNaN();
    expect(evalExpr('constructor')).toBeNaN();
    expect(evalExpr('1 +')).toBeNaN();
    expect(isValidExpr('alert(1);')).toBe(false);
    expect(evalExpr('unknownVar+1')).toBeNaN();
  });
  it('differentiates numerically', () => { expect(derivative('x^2', 'x', 3)).toBeCloseTo(6, 4); });
});

describe('colours', () => {
  it('resolves names and hex, rejects junk', () => {
    expect(resolveColor('gold')).toBe('#fbbf24');
    expect(resolveColor('#fa0')).toBe('#ffaa00');
    expect(resolveColor('url(javascript:1)')).toBeUndefined();
    expect(normalizeBindings({ a: 'gold', b: 'nope', 'x y': 'red' })).toEqual({ a: '#fbbf24' });
  });
  it('quantises interpolation so recolours produce few distinct colours', () => {
    const set = new Set<string>();
    for (let i = 0; i <= 100; i++) set.add(lerpColor('#ffffff', '#fde047', i / 100));
    expect(set.size).toBeLessThanOrEqual(13);
    expect(lerpColor('#000000', '#ffffff', 1)).toBe('#ffffff');
  });
});

describe('per-term LaTeX colouring', () => {
  it('colours bound variables everywhere but leaves commands and \\text alone', () => {
    const out = colorizeLatex('\\frac{a}{b}+\\text{a b}+x', { a: '#fbbf24', b: '#60a5fa' });
    expect(out).toContain('\\frac{\\textcolor{#fbbf24}{a}}{\\textcolor{#60a5fa}{b}}');
    expect(out).toContain('\\text{a b}');
    expect(out).toContain('+x');
  });
  it('translates colour names inside explicit \\color groups', () => {
    expect(colorizeLatex('{\\color{gold}2ab}')).toBe('{\\color{#fbbf24}2ab}');
  });
});

const baseScene = (over: Partial<UniversalMathScene>): UniversalMathScene => ({
  schemaVersion: '1.0', id: 't', domain: 'algebra', gradeBand: '9-10', title: 't', expression: 'x', verified: true,
  nodes: [], events: [], narrationCues: [], teachingLanguage: 'english', ...over,
});

describe('runtime: recolor, count, tween, live bindings', () => {
  const scene = baseScene({
    colorBindings: { a: '#fbbf24' },
    nodes: [
      { id: 'dot', kind: 'point', x: 100, y: 200, bindX: '100 + 50*t' },
      { id: 'slope', kind: 'text', x: 0, y: 0, valueExpr: '2*t', valueFormat: 'slope = {v}', decimals: 1, color: '#f8fafc' },
      { id: 'n', kind: 'text', x: 0, y: 60, valueFormat: 'n = {v}' },
    ],
    events: [
      { id: 'e0', atMs: 0, durationMs: 100, kind: 'draw', targetId: 'dot' },
      { id: 'e1', atMs: 0, durationMs: 2000, kind: 'tween', param: 't', fromValue: 0, toValue: 4 },
      { id: 'e2', atMs: 0, durationMs: 1000, kind: 'recolor', targetId: 'slope', color: '#fde047' },
      { id: 'e3', atMs: 0, durationMs: 1000, kind: 'count', targetId: 'n', fromValue: 2, toValue: 5, decimals: 0 },
      { id: 'e4', atMs: 500, durationMs: 1000, kind: 'recolor', targetId: 'var:b', color: '#60a5fa' },
    ],
  });
  it('tweens a parameter that moves a node and drives a live readout', () => {
    const mid = createRuntimeSnapshot(scene, 1000);
    expect(mid.params.t).toBeCloseTo(2, 1);
    expect(mid.nodes.get('dot')?.x).toBeCloseTo(200, 0);
    expect(mid.nodes.get('slope')?.displayText).toBe('slope = 4.0');
    const end = createRuntimeSnapshot(scene, 2000);
    expect(end.params.t).toBe(4);
    expect(end.nodes.get('slope')?.displayText).toBe('slope = 8.0');
    expect(createRuntimeSnapshot(scene, 0).nodes.get('dot')?.x).toBe(100);
  });
  it('counts a number and recolours an object over time', () => {
    expect(createRuntimeSnapshot(scene, 0).nodes.get('n')?.displayText).toBe('n = 2');
    expect(createRuntimeSnapshot(scene, 1000).nodes.get('n')?.displayText).toBe('n = 5');
    expect(createRuntimeSnapshot(scene, 0).nodes.get('slope')?.color).toBe('#f8fafc');
    expect(createRuntimeSnapshot(scene, 1000).nodes.get('slope')?.color).toBe('#fde047');
  });
  it('recolours a variable globally: white until introduced, then its colour; bound variables keep theirs', () => {
    expect(createRuntimeSnapshot(scene, 100).bindings.b).toBe('#f8fafc');
    expect(createRuntimeSnapshot(scene, 1600).bindings.b).toBe('#60a5fa');
    expect(createRuntimeSnapshot(scene, 1600).bindings.a).toBe('#fbbf24');
  });
  it('is deterministic when seeking backwards', () => {
    const a = createRuntimeSnapshot(scene, 1500).params.t;
    createRuntimeSnapshot(scene, 2000);
    expect(createRuntimeSnapshot(scene, 1500).params.t).toBe(a);
  });
});

const shell = (grade = 9): AIGuruTeachingLesson => ({
  schemaVersion: '2.1', id: 'x', title: 'x', grade, gradeBand: '9-10', domain: 'algebra', openingQuestion: 'Q?', whyItMatters: 'Because.', learningGoal: 'g',
  prerequisites: [], runningExample: { id: 'r', description: 'd', persistentObjectIds: [] }, segments: [{ id: 's0', title: 'Intro', order: 0, intuition: { explanation: 'i' }, mathematics: { explanation: 'm', expressions: [] }, beats: [
    { id: 'b0', narration: 'Hello.', visualIntent: 'pause', targetObjects: [], actions: [{ type: 'pause', durationMs: 300 }] },
    { id: 'b1', narration: 'Again.', visualIntent: 'pause', targetObjects: [], actions: [{ type: 'pause', durationMs: 300 }] },
  ] }], finalInsight: 'f', visualGrammar: { pacing: 'medium', camera: 'focus' }, difficulty: difficultyProfile(grade),
});

describe('scene templates (verified in code, not drawn by the LLM)', () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['number-line-jump', { a: 3, b: -5 }], ['number-line-jump', { a: -4, b: 9 }], ['area-model', { p: 2, q: 3 }],
    ['completing-square', { b: 6, c: 7 }], ['moving-point-graph', { a: 2, x0: -2, x1: 2 }], ['moving-point-graph', { a: -1, x0: 0, x1: 3 }],
  ];
  for (const [id, params] of cases) for (const language of ['english', 'malayalam'] as const) {
    it(`${id} ${JSON.stringify(params)} (${language}) compiles, passes QA geometry/safe-frame/overlap and animates`, async () => {
      const lesson = shell();
      const warnings = applySceneTemplates(lesson, [{ id, params }], language);
      expect(warnings).toEqual([]);
      expect(lesson.segments.length).toBe(2);
      const quality = await evaluateTeachingLesson(lesson);
      for (const key of ['safe-frame', 'geometry-integrity', 'readable-text', 'text-overlap', 'object-id-integrity', 'concise-visual-labels', 'difficulty-adaptation'])
        expect([key, quality.checks[key]]).toEqual([key, true]);
      const compiled = compileAIGuruTeachingLesson(lesson, { teachingLanguage: language });
      expect(compiled.warnings).toEqual([]);
      const scene = compiled.scene;
      expect(Object.keys(scene.params ?? {}).length).toBeGreaterThan(0);
      expect(Object.keys(scene.colorBindings ?? {}).length).toBeGreaterThan(0);
      // Parameters must actually move the picture between the start and the end of the class.
      const start = createRuntimeSnapshot(scene, 0), end = createRuntimeSnapshot(scene, sceneDurationMs(scene));
      expect(JSON.stringify(start.params)).not.toEqual(JSON.stringify(end.params));
      for (const n of end.nodes.values()) { expect(Number.isFinite(n.x ?? 0)).toBe(true); expect(Number.isFinite(n.width ?? 0)).toBe(true); }
      if (language === 'malayalam') expect(compiled.beats.some(b => /[\u0D00-\u0D7F]/.test(b.narration))).toBe(true);
    });
  }
  it('rejects parameters that would draw a wrong or impossible picture', () => {
    for (const [id, params] of [['number-line-jump', { a: 3, b: 0 }], ['area-model', { p: 0, q: 3 }], ['completing-square', { b: 5, c: 1 }], ['completing-square', { b: 4, c: -9 }], ['moving-point-graph', { a: 0, x0: 0, x1: 1 }], ['moving-point-graph', { a: 1, x0: 1, x1: 1 }], ['nope', {}]] as Array<[string, Record<string, unknown>]>) {
      const lesson = shell();
      expect(applySceneTemplates(lesson, [{ id, params }], 'english').length).toBe(1);
      expect(lesson.segments.length).toBe(1);
    }
  });
  it('catalog lists every template', () => { expect(SCENE_TEMPLATES.map(t => t.id)).toEqual(['number-line-jump', 'area-model', 'completing-square', 'moving-point-graph']); });
});

describe('every template LaTeX string typesets in real KaTeX (with variable colours)', () => {
  it('renders without errors and keeps the colours', async () => {
    const katex = (await import('katex')).default;
    const cases: Array<[string, Record<string, unknown>]> = [['number-line-jump', { a: 3, b: -5 }], ['area-model', { p: 2, q: 3 }], ['completing-square', { b: 6, c: 7 }], ['completing-square', { b: 4, c: 5 }], ['moving-point-graph', { a: 2, x0: -2, x1: 2 }]];
    let rendered = 0;
    for (const [id, params] of cases) {
      const lesson = shell();
      applySceneTemplates(lesson, [{ id, params }], 'english');
      const bindings = normalizeBindings(lesson.colorBindings);
      for (const seg of lesson.segments) for (const b of seg.beats) for (const a of b.actions) {
        if (a.type !== 'create' || a.node?.kind !== 'latex') continue;
        const html = katex.renderToString(colorizeLatex(a.node.latex ?? '', bindings), { throwOnError: true, output: 'html', strict: 'ignore' });
        expect(html).toContain('katex');
        expect(html).toMatch(/color:\s*#[0-9a-f]{6}/i);
        rendered++;
      }
    }
    expect(rendered).toBeGreaterThan(8);
  });
});
