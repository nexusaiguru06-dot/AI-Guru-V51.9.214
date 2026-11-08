/**
 * Offline 3B1B lesson from the deterministic solver (V51.9.8.4).
 *
 * QA-safe upgrades toward 3Blue1Brown feel:
 *  1. Side-by-side — left numeric rows, right geometric panel
 *  2. Count motion on answer digits
 *  3. Camera focus AFTER create (object-id integrity)
 *  4. Font ≥ 22px, no stacked labels, valid shape geometry
 */
import katex from 'katex';
import { planTemplateSolution } from '../template-solver';
import { rowColor, type TemplateRow, type SolutionFamily } from '../template-types';
import { normalizeBindings } from '../animation/colors';
import type { MathDomain, MathVisualNode } from '../universal/types';
import type { AIGuruTeachingLesson, AnimationIntent, TeachingBeat, TeachingSegment } from './types';
import { difficultyProfile } from './quality';

export interface OfflineLessonInput {
  question: string;
  grade: number;
  domain: MathDomain;
  language?: 'english' | 'malayalam';
  chapterTitle?: string;
}

const gradeBand = (g: number): AIGuruTeachingLesson['gradeBand'] =>
  (g <= 5 ? '1-5' : g <= 8 ? '6-8' : g <= 10 ? '9-10' : '11-12');

export function displayToTex(text: string): string {
  return String(text)
    .replace(/√\(([^()]*)\)/g, '\\sqrt{$1}').replace(/√(\d+(?:\.\d+)?|[A-Za-z])/g, '\\sqrt{$1}')
    .replace(/²/g, '^{2}').replace(/³/g, '^{3}').replace(/×/g, '\\times ').replace(/÷/g, '\\div ').replace(/·/g, '\\cdot ')
    .replace(/[−–]/g, '-').replace(/±/g, '\\pm ').replace(/≠/g, '\\neq ').replace(/≤/g, '\\leq ').replace(/≥/g, '\\geq ').replace(/≈/g, '\\approx ')
    .replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function typesets(tex: string): boolean {
  try { katex.renderToString(tex, { throwOnError: true, output: 'html', strict: 'ignore' }); return true; } catch { return false; }
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 20)).trim()}…`;
}

function extractAnswerNumbers(answerText: string): Array<{ name: string; value: number }> {
  const out: Array<{ name: string; value: number }> = [];
  const re = /([a-zA-Z])\s*=\s*(-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(answerText)) !== null) {
    out.push({ name: m[1], value: Number(m[2]) });
  }
  if (!out.length) {
    const alone = /(-?\d+(?:\.\d+)?)/.exec(answerText);
    if (alone) out.push({ name: 'ans', value: Number(alone[1]) });
  }
  return out.slice(0, 4);
}

function geometricPanel(
  family: SolutionFamily,
  answerNums: Array<{ name: string; value: number }>,
  ml: boolean,
): { introBeats: TeachingBeat[]; ids: string[] } {
  const ids: string[] = [];
  const introBeats: TeachingBeat[] = [];
  const titleId = 'geo-title';
  const dividerId = 'geo-divider';
  ids.push(titleId, dividerId);

  const titleActions: AnimationIntent[] = [
    {
      type: 'create',
      objectId: dividerId,
      node: {
        id: dividerId,
        kind: 'shape',
        shape: 'rectangle',
        x: 70,
        y: 525,
        width: 860,
        height: 3,
        style: { strokeWidth: 1 },
        color: '#334155',
      } as MathVisualNode,
    },
    {
      type: 'create',
      objectId: titleId,
      node: {
        id: titleId,
        kind: 'text',
        x: 80,
        y: 35,
        width: 840,
        height: 40,
        content: 'Build the mathematics across the whole board',
        style: { fontSize: 24 },
        color: '#94a3b8',
      },
    },
  ];
  introBeats.push({
    id: 'geo-intro',
    narration: ml ? 'മുഴുവൻ whiteboard-ലും ഗണിതം ഘട്ടം ഘട്ടമായി നിർമ്മിക്കാം.' : 'We build the mathematics across the whole whiteboard, step by step.',
    actions: titleActions,
    targetObjects: [titleId, dividerId],
    visualIntent: 'create',
    durationMs: 1000,
  });

  if (family === 'simultaneous' || family === 'linear') {
    const vars = answerNums.length >= 1 ? answerNums : [{ name: 'x', value: 1 }];
    const barActions: AnimationIntent[] = [];
    const barTargets: string[] = [];
    vars.slice(0, 2).forEach((v, i) => {
      const barId = `geo-bar-${v.name}`;
      const labelId = `geo-bar-label-${v.name}`;
      const readId = `geo-readout-${v.name}`;
      ids.push(barId, labelId, readId);
      barTargets.push(barId, labelId, readId);
      const y = 560 + i * 58;
      const color = i === 0 ? '#fbbf24' : '#60a5fa';
      barActions.push({
        type: 'create',
        objectId: barId,
        node: {
          id: barId,
          kind: 'shape',
          shape: 'rectangle',
          x: 120 + i * 360,
          y,
          width: 260,
          height: 34,
          style: { strokeWidth: 2 },
          color,
        } as MathVisualNode,
      });
      barActions.push({
        type: 'create',
        objectId: labelId,
        node: {
          id: labelId,
          kind: 'text',
          x: 120 + i * 360,
          y: y - 28,
          width: 180,
          height: 28,
          content: String(v.name),
          style: { fontSize: 22 },
          color,
        },
      });
      barActions.push({
        type: 'create',
        objectId: readId,
        node: {
          id: readId,
          kind: 'text',
          x: 400 + i * 360,
          y,
          width: 160,
          height: 40,
          content: '0',
          style: { fontSize: 28 },
          color,
        },
      });
    });
    introBeats.push({
      id: 'geo-bars',
      narration: ml ? 'Each quantity keeps its colour.' : 'Each quantity keeps its own colour.',
      actions: barActions,
      targetObjects: barTargets,
      visualIntent: 'create',
      durationMs: 1400,
    });
  } else if (family === 'quadratic') {
    const curveId = 'geo-parabola';
    ids.push(curveId);
    introBeats.push({
      id: 'geo-curve',
      narration: 'A parabola — roots meet the axis.',
      actions: [{
        type: 'create',
        objectId: curveId,
        node: {
          id: curveId,
          kind: 'shape',
          shape: 'triangle',
          x: 620,
          y: 200,
          width: 200,
          height: 160,
          style: { strokeWidth: 3 },
          color: '#c084fc',
        } as MathVisualNode,
      }],
      targetObjects: [curveId],
      visualIntent: 'geometry',
      durationMs: 1200,
    });
  } else {
    const boxId = 'geo-box';
    ids.push(boxId);
    introBeats.push({
      id: 'geo-box',
      narration: 'Each step keeps the same meaning.',
      actions: [{
        type: 'create',
        objectId: boxId,
        node: {
          id: boxId,
          kind: 'shape',
          shape: 'rectangle',
          x: 580,
          y: 180,
          width: 300,
          height: 100,
          style: { strokeWidth: 2 },
          color: '#475569',
        } as MathVisualNode,
      }],
      targetObjects: [boxId],
      visualIntent: 'create',
      durationMs: 1000,
    });
  }

  return { introBeats, ids };
}

function answerMotionBeats(
  answerNums: Array<{ name: string; value: number }>,
  ml: boolean,
  existingIds: Set<string>,
): { beats: TeachingBeat[]; ids: string[] } {
  const beats: TeachingBeat[] = [];
  const ids: string[] = [];
  if (!answerNums.length) return { beats, ids };

  answerNums.slice(0, 2).forEach((v, i) => {
    const readId = `geo-readout-${v.name}`;
    const barId = `geo-bar-${v.name}`;
    const fillId = `geo-bar-fill-${v.name}`;
    if (!existingIds.has(readId)) return;

    ids.push(fillId);
    const y = 560 + i * 58;
    const color = i === 0 ? '#fbbf24' : '#60a5fa';
    const barWidth = Math.min(180, Math.max(40, Math.abs(v.value) * 2));

    const actions: AnimationIntent[] = [
      {
        type: 'create',
        objectId: fillId,
        node: {
          id: fillId,
          kind: 'shape',
          shape: 'rectangle',
          x: 120 + i * 360,
          y,
          width: barWidth,
          height: 34,
          style: { strokeWidth: 0 },
          color,
        } as MathVisualNode,
      },
      {
        type: 'count',
        objectId: readId,
        from: 0,
        to: v.value,
        durationMs: 1600,
        decimals: Number.isInteger(v.value) ? 0 : 2,
        param: v.name,
        together: true,
      },
      { type: 'recolor', target: readId, color, durationMs: 500, together: true },
      { type: 'highlight', objectId: readId },
    ];
    if (existingIds.has(barId)) {
      actions.push({ type: 'highlight', objectId: barId });
    }
    actions.push({ type: 'camera', action: 'focus', targetId: readId, scale: 1.2 });
    actions.push({ type: 'pause', durationMs: 400 });

    beats.push({
      id: `geo-count-${v.name}`,
      narration: ml ? `${v.name} = ${v.value}` : `${v.name} grows to ${v.value}`,
      actions,
      targetObjects: [fillId, readId, ...(existingIds.has(barId) ? [barId] : [])],
      visualIntent: 'highlight',
      durationMs: 2600,
    });
  });

  if (beats.length) {
    beats.push({
      id: 'geo-camera-reset',
      narration: 'The answer is on the board.',
      actions: [
        { type: 'camera', action: 'zoom', scale: 1, x: 0, y: 0 },
        { type: 'pause', durationMs: 500 },
      ],
      targetObjects: [],
      visualIntent: 'camera',
      durationMs: 700,
    });
  }

  return { beats, ids };
}

export function buildSolverLesson(input: OfflineLessonInput): AIGuruTeachingLesson | null {
  const solution = planTemplateSolution(input.question);
  if (!solution || solution.rows.length < 2) return null;
  const ml = input.language === 'malayalam';
  const profile = difficultyProfile(input.grade);
  let rows: TemplateRow[] = solution.rows;
  if (rows.length > 8) rows = [...rows.slice(0, 7), rows[rows.length - 1]];

  const step = rows.length <= 5 ? 68 : rows.length <= 7 ? 58 : 52;
  const letters = [...new Set((solution.problem.match(/(?<![A-Za-z])[a-z](?![A-Za-z])/g) ?? []))].slice(0, 4);
  const colorBindings = normalizeBindings(Object.fromEntries(letters.map((l, i) => [l, ['gold', 'blue', 'green', 'pink'][i]])));

  const answerNums = extractAnswerNumbers(solution.answerText);
  const geo = geometricPanel(solution.family, answerNums, ml);

  const ids: string[] = [...geo.ids];
  const beats: TeachingBeat[] = [...geo.introBeats];
  const existingIds = new Set<string>(geo.ids);

  rows.forEach((row, i) => {
    const y = 105 + i * step;
    const id = `row-${i + 1}`;
    const color = rowColor(row);
    const tex = displayToTex(row.text);
    const asText = row.kind === 'check-title' || row.kind === 'note' || /[A-Za-z]{3,}/.test(row.text) || !typesets(tex);
    const fontSize = Math.max(24, row.text.length > 42 ? 24 : 28);
    const node: MathVisualNode = asText
      ? { id, kind: 'text', x: 100, y, width: 800, height: 48, content: clip(row.text, 48), style: { fontSize: 28 }, color: '#f8fafc' }
      : { id, kind: 'latex', x: 100, y, width: 800, height: 48, latex: tex, style: { fontSize: Math.max(28, fontSize) }, color: '#f8fafc' };
    ids.push(id);
    existingIds.add(id);

    const actions: AnimationIntent[] = [
      { type: 'create', objectId: id, node },
      ...(i > 0 ? [{ type: 'transform', fromObjectId: `row-${i}`, toObjectId: id, retainFrom: false } as AnimationIntent] : []),
      { type: 'recolor', target: id, color, durationMs: 800, together: true },
      { type: 'camera', action: 'focus', targetId: id, scale: i > 0 ? 1.08 : 1.04 },
    ];

    if (row.focus) {
      const focusId = `${id}-focus`;
      ids.push(focusId);
      existingIds.add(focusId);
      actions.push({
        type: 'create',
        objectId: focusId,
        node: {
          id: focusId,
          kind: 'shape',
          shape: 'circle',
          x: 90 + Math.max(0, row.focus.from) * 12,
          y: y - 5,
          width: Math.max(56, (row.focus.to - row.focus.from) * 12 + 36),
          height: 56,
          style: { strokeWidth: 3 },
          color,
        } as MathVisualNode,
      });
      actions.push({ type: 'highlight', objectId: id });
    }

    if (row.kind === 'answer' || i === rows.length - 1) {
      actions.push({ type: 'highlight', objectId: id }, { type: 'pause', durationMs: 500 });
    } else {
      actions.push({ type: 'pause', durationMs: 280 });
    }

    const label = ml ? (row.labelMl ?? row.label) : row.label;
    beats.push({
      id: `step-${i + 1}`,
      narration: label || row.text,
      actions,
      targetObjects: [id],
      visualIntent: row.kind === 'answer' ? 'highlight' : 'create',
      durationMs: 2000,
    });
  });

  const motion = answerMotionBeats(answerNums, ml, existingIds);
  ids.push(...motion.ids);
  beats.push(...motion.beats);

  const chunks = Math.max(
    1,
    Math.ceil(beats.length / profile.maxBeatsPerSegment),
    Math.min(profile.minSegments, Math.floor(beats.length / Math.max(1, profile.minBeatsPerSegment))),
  );
  const size = Math.ceil(beats.length / chunks);
  const segments: TeachingSegment[] = [];
  for (let c = 0; c < chunks; c++) {
    const part = beats.slice(c * size, (c + 1) * size);
    if (!part.length) continue;
    segments.push({
      id: `offline-seg-${c + 1}`,
      title: `Steps ${c + 1}`,
      order: c,
      intuition: { explanation: 'Left: numeric steps. Right: geometric meaning.' },
      mathematics: {
        explanation: 'Every step keeps the equation balanced.',
        expressions: c === 0 ? [solution.problem] : [],
        verified: false,
      },
      beats: part,
      estimatedDurationMs: part.reduce((n, b) => n + (b.durationMs ?? 0), 0),
    });
  }
  if (!segments.length) return null;

  const problem = solution.problem;
  return {
    schemaVersion: '2.1',
    id: `offline-template:${Date.now()}`,
    title: input.chapterTitle || clip(problem, 100),
    grade: input.grade,
    gradeBand: gradeBand(input.grade),
    domain: input.domain,
    openingQuestion: `How do we solve ${problem}?`,
    whyItMatters: 'When every step has a reason, the same method solves any similar problem.',
    openingTeacher: {
      en: `Let us solve ${problem} — numbers on the left, meaning on the right.`,
      ml: `${problem} — ഇടത് സംഖ്യകൾ, വലത് അർത്ഥം.`,
    },
    whyItMattersTeacher: {
      en: 'Each line keeps the equation true, so the answer is trustworthy.',
      ml: 'ഓരോ വരിയും equation ശരിയായി നിലനിർത്തുന്നു.',
    },
    learningGoal: problem,
    prerequisites: [],
    runningExample: {
      id: 'offline-running-example',
      description: problem,
      expression: problem,
      persistentObjectIds: ids.slice(0, 8),
    },
    segments,
    finalInsight: `The answer is ${solution.answerText}.`,
    visualGrammar: {
      archetype: 'worked-solution',
      dnaIds: [],
      constructionPattern: 'build-transform-highlight-recolor',
      motifs: [
        'one-colour-per-step',
        'variable-colour-binding',
        'full-board-equation-transform',
        'camera-focus-active',
        'transform-matching-equation',
        'full-canvas-composition',
        'count-to-answer',
      ],
      pacing: 'medium',
      camera: 'focus',
      qaRules: ['insight pause', 'visible construction'],
    },
    difficulty: profile,
    expression: problem,
    ...(Object.keys(colorBindings).length ? { colorBindings } : {}),
  };
}
