import { describe, expect, it } from 'vitest';
import { evalItem, drawMotionFrame, speakable, type MotionScene } from '../reels/motion';
import { matApply, matMul, matDet, fmtNum, IDENT, type Mat } from '../reels/motion/plane';
import { blockFeatures, selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { fnOf } from './dna/plane-builders';
import type { BlockPlan, GraphPlan, PlanePlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlineGraph, offlinePlan } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { GRAPH_LINE_SAMPLE, GRAPH_PARABOLA_SAMPLE, PLANE_SAMPLE } from './samples/plane-graph';

const block = (kind: BookBlock['kind'], text: string): BookBlock => ({
  id: 'b',
  kind,
  page: 1,
  chapterId: 'c',
  sectionId: 's',
  lines: text.split('\n').map((t) => ({ text: t, math: /=/.test(t) && kind === 'math' }) as BookBlock['lines'][number]),
  text,
});

const end = (s: MotionScene) => s.durationMs + 10;
const at = (s: MotionScene, id: RegExp) =>
  s.items
    .filter((i) => id.test(i.id))
    .map((i) => evalItem(i, end(s)));

describe('samples pass the same validator as AI plans', () => {
  it('plane sample (EN + ML)', () => expect(validatePlan('plane-transform', PLANE_SAMPLE, { en: 'x', ml: 'എ' })).toEqual([]));
  it('line graph sample (EN + ML)', () => expect(validatePlan('function-graph', GRAPH_LINE_SAMPLE, { en: 'x', ml: 'എ' })).toEqual([]));
  it('parabola sample (EN + ML)', () => expect(validatePlan('function-graph', GRAPH_PARABOLA_SAMPLE, { en: 'x', ml: 'എ' })).toEqual([]));
});

describe('validator rejects pictures that cannot be right', () => {
  const g = (steps: GraphPlan['steps'], over: Partial<GraphPlan> = {}): GraphPlan => ({ xMin: -3, xMax: 3, yMin: -2, yMax: 6, steps, ...over });
  const say = { en: 'x', ml: 'എ' };
  it('a curve that leaves the picture', () => {
    const e = validatePlan('function-graph', g([{ op: 'axes', say }, { op: 'curve', fn: 'x^2+5', say }]), undefined, true);
    expect(e.join(' ')).toMatch(/leaves the picture/);
  });
  it('a formula that is not valid or not defined', () => {
    expect(validatePlan('function-graph', g([{ op: 'axes', say }, { op: 'curve', fn: 'x +* 2', say }]), undefined, true).join(' ')).toMatch(/not a valid formula/);
    expect(validatePlan('function-graph', g([{ op: 'axes', say }, { op: 'curve', fn: '1/x', from: -1, to: 1, say }]), undefined, true).join(' ')).toMatch(/no value|leaves/);
  });
  it('a tracker without a curve, a point outside the box, unknown ops', () => {
    expect(validatePlan('function-graph', g([{ op: 'axes', say }, { op: 'tracker', stops: [0, 1], say }]), undefined, true).join(' ')).toMatch(/needs a curve/);
    expect(validatePlan('function-graph', g([{ op: 'point', at: [9, 9], say }]), undefined, true).join(' ')).toMatch(/outside the picture/);
    expect(validatePlan('function-graph', g([{ op: 'axes', say }, { op: 'explode' as 'axes', say }]), undefined, true).join(' ')).toMatch(/not one of/);
  });
  it('a matrix that throws a vector off the plane', () => {
    const p: PlanePlan = { xMax: 4, yMax: 3, steps: [{ op: 'grid', say }, { op: 'vector', v: [2, 2], say }, { op: 'transform', matrix: [3, 0, 0, 3], say }] };
    expect(validatePlan('plane-transform', p, undefined, true).join(' ')).toMatch(/outside the plane/);
  });
  it('matrix entries must be numbers', () => {
    const p = { steps: [{ op: 'grid', say }, { op: 'transform', matrix: [1, 'a', 0, 1], say }] } as unknown as PlanePlan;
    expect(validatePlan('plane-transform', p, undefined, true).join(' ')).toMatch(/matrix must be/);
  });
  it('formulas are evaluated by the safe evaluator only', () => {
    expect(fnOf('constructor')(1)).toBeNaN();
    expect(fnOf('process.exit(1)')(1)).toBeNaN();
    expect(fnOf('2x+1')(3)).toBe(7);
    expect(fnOf('y = x^2 − 3')(2)).toBe(1);
  });
});

describe('the maths on the plane is true', () => {
  // Same geometry as the builder: xMax 5, yMax 4 → unit 45, left 25, top 42.
  const px = (x: number, y: number): [number, number] => [25 + ((x + 5) / 10) * 450, 42 + ((4 - y) / 8) * 360];
  const plan: PlanePlan = {
    steps: [
      { op: 'grid', say: { en: 'grid' } },
      { op: 'basis', say: { en: 'basis' } },
      { op: 'vector', v: [2, 1], label: 'v', say: { en: 'v' } },
      { op: 'square', say: { en: 'sq' } },
      { op: 'transform', matrix: [1, 1, 0, 1], name: { en: 'shear' }, say: { en: 'shear' } },
      { op: 'transform', matrix: [2, 0, 0, 2], name: { en: 'stretch' }, say: { en: 'stretch' } },
      { op: 'det', say: { en: 'det' } },
    ],
  };
  const M: Mat = matMul([2, 0, 0, 2], [1, 1, 0, 1]); // transformations compose: stretch after shear
  const [scene] = buildDnaScenes('plane-transform', plan, 'en', 'T');

  it('î, ĵ and v land where the composed matrix sends them', () => {
    const near = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 4));
    const tip = (re: RegExp) => {
      const s = at(scene, re)[0];
      return [s.x2, s.y2];
    };
    near(tip(/^pl_bi/), px(...matApply(M, [1, 0])));
    near(tip(/^pl_bj/), px(...matApply(M, [0, 1])));
    near(tip(/^pl_v\d/), px(...matApply(M, [2, 1])));
  });
  it('the unit square becomes the image of its corners', () => {
    const sq = at(scene, /^pl_sq/)[0];
    const corners = ([[0, 0], [1, 0], [1, 1], [0, 1]] as Array<[number, number]>).map((p) => px(...matApply(M, p)));
    sq.points!.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(corners[i][0], 4);
      expect(p[1]).toBeCloseTo(corners[i][1], 4);
    });
  });
  it('every grid line stays straight and parallel to its image direction', () => {
    const lines = at(scene, /^pl_gv/).filter((s) => s.alpha > 0.5);
    expect(lines.length).toBeGreaterThan(10);
    // Vertical grid lines have math direction (0,1) → image direction M·(0,1) in math space, flipped y in pixels.
    const [dx, dy] = matApply(M, [0, 1]);
    for (const l of lines) {
      const ex = l.points![1][0] - l.points![0][0];
      const ey = l.points![1][1] - l.points![0][1];
      expect(ex * -dy - ey * dx).toBeCloseTo(0, 3); // cross product = 0 → parallel
    }
  });
  it('the matrix on the board and the determinant are computed, not typed', () => {
    const nums = at(scene, /^pl_mx/).map((s) => s.text);
    expect(nums).toEqual(M.map((v) => fmtNum(v)));
    expect(matDet(M)).toBe(4);
    expect(at(scene, /^tdet/)[0].text).toBe('det = 4');
  });
  it('before any transformation the matrix is the identity', () => {
    const early = scene.items.filter((i) => /^pl_mx/.test(i.id)).map((i) => evalItem(i, 5000).text);
    expect(early).toEqual(IDENT.map(String));
  });
});

describe('the graph on screen is the function', () => {
  const [scene] = buildDnaScenes('function-graph', GRAPH_PARABOLA_SAMPLE, 'en', 'T');
  const spec = { left: 78, top: 34, width: 430, height: 330, xMin: -4, xMax: 4, yMin: -4, yMax: 9 };
  const inv = (p: [number, number]) => [spec.xMin + ((p[0] - spec.left) / spec.width) * (spec.xMax - spec.xMin), spec.yMax - ((p[1] - spec.top) / spec.height) * (spec.yMax - spec.yMin)];
  it('the curve ends on the morphed formula (x² − 3)', () => {
    const c = at(scene, /^pl_c\d/)[0];
    expect(c.points!.length).toBeGreaterThan(50);
    for (const p of c.points!) {
      const [x, y] = inv(p);
      expect(y).toBeCloseTo(x * x - 3, 3);
    }
  });
  it('the curve is x² before the morph', () => {
    const c = scene.items.find((i) => /^pl_c\d/.test(i.id))!;
    for (const p of evalItem(c, 9000).points!) {
      const [x, y] = inv(p);
      expect(y).toBeCloseTo(x * x, 3);
    }
  });
  it('the tracker reads true coordinates', () => {
    const texts = scene.items.filter((i) => /^rd[xy]/.test(i.id)).map((i) => [i.text, ...i.swaps.map((w) => w.to)]);
    expect(texts[0]).toEqual(['x = −2', 'x = 0', 'x = 2']);
    expect(texts[1]).toEqual(['y = 4', 'y = 0', 'y = 4']);
  });
  it('line sample: slope triangle and reading y = 2x + 1 are consistent', () => {
    const [s] = buildDnaScenes('function-graph', GRAPH_LINE_SAMPLE, 'en', 'T');
    const ys = s.items.filter((i) => /^rdy/.test(i.id)).map((i) => [i.text, ...i.swaps.map((w) => w.to)])[0];
    expect(ys).toEqual(['y = −1', 'y = 1', 'y = 3', 'y = 5']);
  });
});

describe('English and Malayalam share the same picture', () => {
  it('same items at the same places; only captions differ', () => {
    for (const [dna, plan] of [['plane-transform', PLANE_SAMPLE], ['function-graph', GRAPH_LINE_SAMPLE]] as const) {
      const en = buildDnaScenes(dna, plan, 'en', 'T')[0];
      const ml = buildDnaScenes(dna, plan, 'ml', 'T')[0];
      const shape = (s: MotionScene) => s.items.map((i) => `${i.id}:${i.kind}@${Math.round(i.x.at(0))},${Math.round(i.y.at(0))}`);
      expect(shape(ml)).toEqual(shape(en));
      expect(ml.captions.map((c) => c.text)).not.toEqual(en.captions.map((c) => c.text));
    }
  });
  it('î and ĵ are spoken as "i hat" / "j hat"', () => {
    expect(speakable('Green î goes right, red ĵ goes up.', 'en')).toBe('Green i hat goes right, red j hat goes up.');
    expect(speakable('î', 'ml')).toBe('ഐ ഹാറ്റ്');
  });
});

describe('selection: graph and plane units no longer fall to text', () => {
  const pick = (kind: BookBlock['kind'], text: string) => selectDna(block(kind, text)).dna;
  it('graphs, coordinates, parabola', () => {
    expect(pick('prose', 'The graph of the equation y = 2x + 1 is a straight line. Every point on the line gives a solution of the equation.')).toBe('function-graph');
    expect(pick('prose', 'Mark the points (2, 3) and (5, 7) on the coordinate plane and find the distance between them.')).toBe('coordinate-geometry');
    expect(pick('prose', 'The graph of a quadratic polynomial is a curve called a parabola. It opens upward when the coefficient is positive.')).toBe('function-graph');
  });
  it('reflection / rotation / matrix', () => {
    expect(pick('prose', 'When a shape is reflected in a line, every point moves to the opposite side of the line at the same distance.')).toBe('plane-transform');
    expect(pick('prose', 'A matrix can rotate every vector of the plane by the same angle.')).toBe('plane-transform');
  });
  it('words that only look similar do not trigger them', () => {
    expect(pick('prose', 'We transform the equation 2x − 10 = 100 into 2x = 110 by adding 10 on both sides.')).not.toBe('plane-transform');
    expect(pick('prose', 'The bar graph shows the number of students in each class; the frequency of each bar is given.')).not.toBe('function-graph');
  });
  it('an arithmetic sequence is not a mental-math chain', () => {
    expect(pick('prose', 'In the sequence 3, 5, 7, 9, each term is 2 more than the term before it. Such a sequence is called an arithmetic sequence.')).not.toBe('mental-math');
  });
  it('features count the evidence', () => {
    const f = blockFeatures(block('prose', 'Plot the graph of y = 2x + 1 on the coordinate axes.'));
    expect(f.graph).toBe(true);
    expect(f.graphHits).toBeGreaterThanOrEqual(3);
  });
});

describe('offline planner draws "y = …" without AI', () => {
  const text = 'The graph of the equation y = 2x + 1 is a straight line. Every point on the line gives a solution of the equation.';
  it('builds a valid graph that fits its own range', () => {
    const g = offlineGraph(text)!;
    expect(g).toBeTruthy();
    expect(validatePlan('function-graph', g, undefined, true)).toEqual([]);
    const plan = offlinePlan(block('prose', text), 'Linear graphs', 'S');
    expect(plan.dna).toBe('function-graph');
    expect(textOnlyWarning(plan)).toBeUndefined();
    expect(plan.warnings?.join(' ') ?? '').not.toMatch(/Text-only/);
  });
  it('a formula that cannot be shown nicely is declined, not drawn badly', () => {
    expect(offlineGraph('y = 1000000x')).toBeNull();
    expect(offlineGraph('There is no formula here.')).toBeNull();
  });
});

describe('visual QA flags text-only boards', () => {
  it('the graph and plane samples are pictures', () => {
    for (const [dna, plan] of [['plane-transform', PLANE_SAMPLE], ['function-graph', GRAPH_LINE_SAMPLE]] as const) {
      const v = visualStats(buildDnaScenes(dna, plan, 'en', 'T'));
      expect(v.textOnly).toBe(false);
      expect(v.graphicShare).toBeGreaterThan(0.8);
    }
  });
  it('a concept board is flagged (units with no graphic DNA yet are visible, not hidden)', () => {
    const plan = offlinePlan(block('prose', 'The chance of an event is the number of favourable outcomes divided by all possible outcomes.'), 'Probability', 'S');
    expect(plan.dna).toBe('concept-board');
    expect(plan.warnings?.join(' ')).toMatch(/Text-only board/);
  });
  it('headings and bridges are exempt', () => {
    expect(textOnlyWarning({ dna: 'bridge', teach: null })).toBeUndefined();
    const plan = offlinePlan(block('heading', 'Pairs of equations'), 'C', 'S');
    expect(textOnlyWarning(plan)).toBeUndefined();
  });
});

describe('inside the class', () => {
  const plan: BlockPlan = { blockId: 'b', dna: 'function-graph', read: { en: 'Graph of y = x².', ml: 'y = x² ന്റെ ഗ്രാഫ്.' }, teach: GRAPH_PARABOLA_SAMPLE, source: 'fixture' };
  it('compiles Read/Teach in both languages and every teach step has a caption on a picture', () => {
    const segs = compileClass([block('prose', 'The graph of y = x squared is a parabola.')], new Map([['b', plan]]), { title: 'T' });
    expect(segs.map((s) => `${s.phase}:${s.lang}`)).toEqual(['read:en', 'teach:en', 'read:ml', 'teach:ml']);
    for (const seg of segs.filter((s) => s.phase === 'teach')) {
      const reel = segmentReel(seg);
      expect(reel.parts[0].captions.length).toBe(GRAPH_PARABOLA_SAMPLE.steps.length);
      expect(visualStats(reel.parts).textOnly).toBe(false);
    }
  });
  it('draws without errors in every format (clip, vectors, morphing polygons)', () => {
    const calls: string[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (t, k: string) => {
        if (k === 'measureText') return (s: string) => ({ width: s.length * 8 });
        if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
        if (k in t) return t[k];
        return (...a: unknown[]) => {
          calls.push(`${k}(${a.length})`);
        };
      },
      set: (t, k: string, v) => ((t[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    for (const [dna, plan] of [['plane-transform', PLANE_SAMPLE], ['function-graph', GRAPH_LINE_SAMPLE]] as const) {
      const sc = buildDnaScenes(dna, plan, 'en', 'T')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) {
        for (const f of [0.1, 0.5, 0.9]) drawMotionFrame(ctx, sc, sc.durationMs * f, { format } as never);
      }
    }
    expect(calls.some((c) => c.startsWith('clip'))).toBe(true);
  });
});
