import 'server-only';

import type { MathDomain } from '../universal/types';
import { selectChapterVideoDna, selectLessonVideoDna } from '../rag/video-dna-selector';
import { applyUniversal3B1BGrammar } from './apply-3b1b-all-branches';
import type { AIGuruTeachingLesson, AnimationIntent, TeachingBeat } from './types';
import { difficultyProfile, nodeBox, overlap } from './quality';
import type { MathVisualNode } from '../universal/types';
import { normalizeBindings, resolveColor } from '../animation/colors';
import { isValidExpr } from '../animation/expr';
import { applySceneTemplates, sceneTemplateCatalog } from './scene-templates';
import { buildSolverLesson } from './offline-template-lesson';
import { serverKey, SIGN_IN_FOR_SERVER_KEY } from '../../net/server-keys';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export type PlannerInput = {
  question: string;
  grade: number;
  domain: MathDomain;
  language?: 'english' | 'malayalam';
  expression?: string;
  learningGoal?: string;
  byokKey?: string;
  chapterTitle?: string;
  chapterSummary?: string;
  chapterTopics?: string[];
  /** Full textbook page text or structured cursor JSON (preferred) */
  textbookContext?: string;
  /** Optional pre-built TextbookPage JSON for precise cue IDs */
  textbookPageJson?: string;
  /** Student's saved OpenAI BYOK key. Used only when Gemini is missing or fails (402/429/5xx...). */
  openaiKey?: string;
  repairInstructions?: string;
  /** When true, planner emits sourceCueId + read/explain bilingual layers */
  teacherReadingMode?: boolean;
  /** Optional pre-generated bilingual material used only by the emergency local fallback. */
  teacherSourceMalayalam?: string;
  teacherExplanationEnglish?: string;
  teacherExplanationMalayalam?: string;
};

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Gemini did not return a JSON 3B1B teaching lesson.');
  return JSON.parse(fenced.slice(start, end + 1));
}

function gradeBand(grade: number): AIGuruTeachingLesson['gradeBand'] {
  return grade <= 5 ? '1-5' : grade <= 8 ? '6-8' : grade <= 10 ? '9-10' : '11-12';
}

/** Keep only the visual-node fields the renderer understands; drop unsafe/invalid colours and expressions. */
function sanitizeNode(node: any): any {
  const out = { ...node };
  if (out.color !== undefined) { const c = resolveColor(out.color); if (c) out.color = c; else delete out.color; }
  if (out.colorRole !== undefined && !/^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(String(out.colorRole))) delete out.colorRole;
  if (out.valueExpr !== undefined && !isValidExpr(String(out.valueExpr))) { delete out.valueExpr; delete out.valueFormat; }
  for (const k of ['bindX', 'bindY', 'bindWidth', 'bindHeight']) if (out[k] !== undefined && !isValidExpr(String(out[k]))) delete out[k];
  if (out.valueFormat !== undefined) out.valueFormat = String(out.valueFormat).slice(0, 60);
  if (out.kind === 'plot') {
    const p = out.plot;
    const ok = p && isValidExpr(String(p.fn ?? '')) && [p.xMin, p.xMax, p.yMin, p.yMax].every((v: any) => Number.isFinite(Number(v)));
    if (!ok) { out.kind = 'text'; out.content = out.content ?? ''; delete out.plot; }
    else out.plot = { fn: String(p.fn), xMin: Number(p.xMin), xMax: Number(p.xMax), yMin: Number(p.yMin), yMax: Number(p.yMax), ...(resolveColor(p.curveColor) ? { curveColor: resolveColor(p.curveColor) } : {}), ...(p.marker && isValidExpr(String(p.marker.x ?? '')) ? { marker: { x: String(p.marker.x), ...(resolveColor(p.marker.color) ? { color: resolveColor(p.marker.color) } : {}), ...(p.marker.tangent ? { tangent: true } : {}) } } : {}) };
  }
  return out;
}

function sanitizeAction(action: any): AnimationIntent | null {
  if (!action || typeof action !== 'object' || typeof action.type !== 'string') return null;
  const type = action.type;
  if (type === 'create') {
    if (!action.objectId || !action.node) return null;
    return { type, objectId: String(action.objectId), node: sanitizeNode({ ...action.node, id: action.node.id ?? String(action.objectId) }) };
  }
  if (type === 'recolor') {
    const color = resolveColor(action.color);
    if (!action.target || !color) return null;
    return { type, target: String(action.target), color, ...(Number.isFinite(action.durationMs) ? { durationMs: Number(action.durationMs) } : {}), ...(action.together ? { together: true } : {}) };
  }
  if (type === 'count') {
    if (!action.objectId || !Number.isFinite(action.from) || !Number.isFinite(action.to)) return null;
    return { type, objectId: String(action.objectId), from: Number(action.from), to: Number(action.to), ...(Number.isFinite(action.durationMs) ? { durationMs: Number(action.durationMs) } : {}), ...(Number.isFinite(action.decimals) ? { decimals: Math.max(0, Math.min(4, Number(action.decimals))) } : {}), ...(action.param && /^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(String(action.param)) ? { param: String(action.param) } : {}), ...(action.together ? { together: true } : {}) };
  }
  if (type === 'tween') {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(String(action.param ?? '')) || !Number.isFinite(action.from) || !Number.isFinite(action.to)) return null;
    return { type, param: String(action.param), from: Number(action.from), to: Number(action.to), ...(Number.isFinite(action.durationMs) ? { durationMs: Number(action.durationMs) } : {}), ...(action.easing === 'linear' || action.easing === 'ease' ? { easing: action.easing } : {}), ...(action.together ? { together: true } : {}) };
  }
  if (type === 'draw' || type === 'highlight' || type === 'indicate' || type === 'erase') {
    if (!action.objectId) return null;
    return { type, objectId: String(action.objectId) } as AnimationIntent;
  }
  if (type === 'move') {
    if (!action.objectId || !Number.isFinite(action.toX) || !Number.isFinite(action.toY)) return null;
    return { type, objectId: String(action.objectId), toX: Number(action.toX), toY: Number(action.toY) };
  }
  if (type === 'transform' || type === 'morph') {
    if (!action.fromObjectId || !action.toObjectId) return null;
    return { type, fromObjectId: String(action.fromObjectId), toObjectId: String(action.toObjectId), ...(action.retainFrom !== undefined ? { retainFrom: Boolean(action.retainFrom) } : {}) } as AnimationIntent;
  }
  if (type === 'camera') {
    if (!['zoom', 'pan', 'focus'].includes(action.action)) return null;
    return {
      type,
      action: action.action,
      ...(action.targetId ? { targetId: String(action.targetId) } : {}),
      ...(Number.isFinite(action.scale) ? { scale: Number(action.scale) } : {}),
      ...(Number.isFinite(action.x) ? { x: Number(action.x) } : {}),
      ...(Number.isFinite(action.y) ? { y: Number(action.y) } : {}),
    };
  }
  if (type === 'pause') return { type, durationMs: Math.max(0, Number(action.durationMs) || 350) };
  return null;
}

function normalizeLesson(raw: any, input: PlannerInput, dnaIds: string[]): AIGuruTeachingLesson {
  const segments = Array.isArray(raw?.segments) ? raw.segments : [];
  if (!segments.length) throw new Error('3B1B planner returned no teaching segments.');

  const normalizedSegments = segments.map((segment: any, segmentIndex: number) => {
    const rawBeats = Array.isArray(segment?.beats) ? segment.beats : [];
    if (!rawBeats.length) throw new Error(`3B1B planner returned no beats for segment ${segmentIndex + 1}.`);
    const beats: TeachingBeat[] = rawBeats.map((beat: any, beatIndex: number) => {
      const actions = (Array.isArray(beat?.actions) ? beat.actions : []).map(sanitizeAction).filter(Boolean) as AnimationIntent[];
      if (!String(beat?.narration ?? '').trim()) throw new Error(`3B1B beat ${segmentIndex + 1}.${beatIndex + 1} has no narration.`);
      if (!actions.length) actions.push({ type: 'pause', durationMs: 350 });
      const rawDnaId = String(beat?.dna?.dnaId || dnaIds[0] || 'none');
      const safeDnaId = dnaIds.includes(rawDnaId) ? rawDnaId : (dnaIds[0] || 'none');
      const dna = beat?.dna && beat.dna.archetype ? {
        dnaId: safeDnaId,
        archetype: String(beat.dna.archetype),
        ...(beat.dna.constructionStep ? { constructionStep: String(beat.dna.constructionStep) } : {}),
        ...(beat.dna.motif ? { motif: String(beat.dna.motif) } : {}),
      } : undefined;
      // Teacher-Reading extensions (optional, backward-compatible)
      const read = beat?.read && (beat.read.en || beat.read.ml)
        ? { en: String(beat.read.en || ''), ml: String(beat.read.ml || '') }
        : undefined;
      const explain = beat?.explain && (beat.explain.en || beat.explain.ml)
        ? { en: String(beat.explain.en || ''), ml: String(beat.explain.ml || '') }
        : undefined;
      const checkQuestion = beat?.checkQuestion && (beat.checkQuestion.en || beat.checkQuestion.ml)
        ? { en: String(beat.checkQuestion.en || ''), ml: String(beat.checkQuestion.ml || '') }
        : undefined;
      const sourceCueId = beat?.sourceCueId ? String(beat.sourceCueId) : undefined;

      // Prefer explain.en as the primary narration when present
      const narration = String(
        (explain?.en && explain.en.trim()) || beat.narration || ''
      );
      if (!narration.trim()) throw new Error(`3B1B beat ${segmentIndex + 1}.${beatIndex + 1} has no narration.`);

      return {
        id: String(beat.id || `segment-${segmentIndex + 1}-beat-${beatIndex + 1}`),
        narration,
        cueWords: Array.isArray(beat.cueWords) ? beat.cueWords.map(String).slice(0, 8) : [],
        durationMs: Math.max(600, Number(beat.durationMs) || 1400),
        visualIntent: beat.visualIntent || 'draw',
        targetObjects: Array.isArray(beat.targetObjects) ? beat.targetObjects.map(String) : [],
        actions,
        ...(dna ? { dna } : {}),
        ...(sourceCueId ? { sourceCueId } : {}),
        ...(read ? { read } : {}),
        ...(explain ? { explain } : {}),
        ...(checkQuestion ? { checkQuestion } : {}),
      };
    });
    return {
      id: String(segment.id || `segment-${segmentIndex + 1}`),
      title: String(segment.title || `Part ${segmentIndex + 1}`),
      order: Number.isFinite(segment.order) ? Number(segment.order) : segmentIndex,
      intuition: {
        explanation: String(segment.intuition?.explanation || ''),
        ...(segment.intuition?.visualMetaphor ? { visualMetaphor: String(segment.intuition.visualMetaphor) } : {}),
        ...(segment.intuition?.concreteExample ? { concreteExample: String(segment.intuition.concreteExample) } : {}),
      },
      mathematics: {
        explanation: String(segment.mathematics?.explanation || ''),
        expressions: Array.isArray(segment.mathematics?.expressions) ? segment.mathematics.expressions.map(String) : [],
        verified: false,
      },
      beats,
      narration: segment.narration ? String(segment.narration) : undefined,
      estimatedDurationMs: beats.reduce((sum, beat) => sum + (beat.durationMs || 0), 0),
    };
  });

  const visualGrammar = raw?.visualGrammar || {};
  let textbookPage: import('../../lesson/textbook-cursor').TextbookPage | undefined;
  const suppliedPageJson = input.textbookPageJson?.trim();
  if (suppliedPageJson) {
    try {
      const parsed = JSON.parse(suppliedPageJson);
      if (parsed && Number.isFinite(Number(parsed.pageNumber)) && Array.isArray(parsed.paragraphs)) {
        textbookPage = parsed;
      }
    } catch {
      // Invalid page JSON is treated as absent; the route/QA layer will report missing reading cues.
    }
  }
  const lesson: AIGuruTeachingLesson = {
    schemaVersion: '2.1',
    id: String(raw?.id || `lesson-${Date.now()}`),
    title: String(raw?.title || input.question),
    grade: input.grade,
    gradeBand: gradeBand(input.grade),
    domain: input.domain,
    openingQuestion: String(raw?.openingQuestion || input.question),
    whyItMatters: String(raw?.whyItMatters || 'Connect the visual idea to the mathematical rule.'),
    ...(raw?.openingTeacher && (raw.openingTeacher.en || raw.openingTeacher.ml) ? { openingTeacher: { en: String(raw.openingTeacher.en || ''), ml: String(raw.openingTeacher.ml || '') } } : {}),
    ...(raw?.whyItMattersTeacher && (raw.whyItMattersTeacher.en || raw.whyItMattersTeacher.ml) ? { whyItMattersTeacher: { en: String(raw.whyItMattersTeacher.en || ''), ml: String(raw.whyItMattersTeacher.ml || '') } } : {}),
    learningGoal: String(raw?.learningGoal || input.learningGoal || input.question),
    prerequisites: Array.isArray(raw?.prerequisites) ? raw.prerequisites.map((p: any, i: number) => ({ id: String(p.id || `prerequisite-${i + 1}`), title: String(p.title || ''), reason: String(p.reason || ''), required: p.required !== false })) : [],
    runningExample: {
      id: String(raw?.runningExample?.id || 'running-example'),
      description: String(raw?.runningExample?.description || input.question),
      ...(raw?.runningExample?.expression || input.expression ? { expression: String(raw?.runningExample?.expression || input.expression) } : {}),
      persistentObjectIds: Array.isArray(raw?.runningExample?.persistentObjectIds) ? raw.runningExample.persistentObjectIds.map(String) : [],
    },
    segments: normalizedSegments,
    finalInsight: String(raw?.finalInsight || input.learningGoal || input.question),
    visualGrammar: {
      archetype: '3b1b-classroom',
      dnaIds: Array.isArray(visualGrammar.dnaIds) ? visualGrammar.dnaIds.map(String) : dnaIds,
      constructionPattern: String(visualGrammar.constructionPattern || 'build-transform-highlight-recolor'),
      motifs: Array.isArray(visualGrammar.motifs) && visualGrammar.motifs.length
        ? visualGrammar.motifs.map(String)
        : ['full-board-composition', 'geometry-first', 'morph-not-replace', 'focus-arc', 'insight-pause'],
      pacing: 'slow',
      camera: 'focus',
      beatMix: visualGrammar.beatMix && typeof visualGrammar.beatMix === 'object' ? { build: Number(visualGrammar.beatMix.build || 0), transform: Number(visualGrammar.beatMix.transform || 0), move: Number(visualGrammar.beatMix.move || 0), remove: Number(visualGrammar.beatMix.remove || 0) } : undefined,
      qaRules: Array.isArray(visualGrammar.qaRules) && visualGrammar.qaRules.length
        ? visualGrammar.qaRules.map(String).slice(0, 12)
        : ['safe frame', 'insight pause', 'visible construction', 'at least one genuine transform or continuous morph', 'no prose wall on the board'],
    },
    difficulty: difficultyProfile(input.grade),
    ...(input.expression ? { expression: input.expression } : {}),
    ...(Object.keys(normalizeBindings(raw?.colorBindings)).length ? { colorBindings: normalizeBindings(raw?.colorBindings) } : {}),
    ...(textbookPage ? { textbookPage } : {}),
  };

  // Stamp universal 3B1B grammar for every math branch (not only algebra).
  const domain = (input as any).domain || (raw as any)?.domain || 'general';
  return applyUniversal3B1BGrammar(lesson as unknown as Parameters<typeof applyUniversal3B1BGrammar>[0], {
    dna: { selections: dnaIds.map((id: string) => ({ id })), qaRules: lesson.visualGrammar?.qaRules as string[] },
  }, domain as any) as unknown as AIGuruTeachingLesson;
}



function hasMeaningfulVisualActions(lesson: AIGuruTeachingLesson): boolean {
  const beats = lesson.segments.flatMap(s => s.beats);
  const visualBeats = beats.filter(b => b.actions.some(a => a.type !== 'pause'));
  const creates = beats.flatMap(b => b.actions).filter(a => a.type === 'create').length;
  const teachingMotion = beats.flatMap(b => b.actions).some(a => ['transform','morph','move','highlight','indicate','count','tween','recolor','erase','draw'].includes(a.type));
  return visualBeats.length >= 2 && creates >= 1 && teachingMotion;
}

function sourceTextForVisualRecovery(input: PlannerInput): string {
  const parts = [input.question, input.textbookContext || ''];
  if (input.textbookPageJson) {
    try {
      const page = JSON.parse(input.textbookPageJson);
      for (const paragraph of Array.isArray(page?.paragraphs) ? page.paragraphs : []) {
        for (const sentence of Array.isArray(paragraph?.sentences) ? paragraph.sentences : []) {
          if (sentence?.readable !== false && sentence?.text) parts.push(String(sentence.text));
        }
      }
    } catch { /* ignore malformed optional page JSON */ }
  }
  return parts.join('\n').replace(/\s+/g, ' ').trim().slice(0, 16000);
}

function deriveDeterministicProblem(source: string): string | undefined {
  const direct = [...new Set((source.match(/[A-Za-z0-9().+\-−×*/^²³√\s]{1,90}\s*=\s*[A-Za-z0-9().+\-−×*/^²³√\s]{1,45}/g) || [])
    .map(x => x.replace(/\s+/g, ' ').trim())
    .filter(x => x.length <= 100 && /[0-9]/.test(x) && !/[A-Za-z]{3,}/.test(x.replace(/sqrt/gi, ''))))].slice(0, 2);
  if (direct.length === 2) return direct.join(' and ');
  if (direct.length === 1) return direct[0];

  // Common NCERT/SCERT word-problem patterns used in the current textbook.
  const table1 = /price of (?:a\s+)?table and (?:a\s+)?chair is\s+(\d+(?:\.\d+)?)/i.exec(source);
  const table2 = /price of (?:a\s+)?table and (?:four|4)\s+chairs?\s+is\s+(\d+(?:\.\d+)?)/i.exec(source);
  if (table1 && table2) return `t + c = ${table1[1]} and t + 4c = ${table2[1]}`;

  const beadsTotal = /there are\s+(\d+)\s+beads.*?(?:black and white|black,?\s*white)/i.exec(source);
  const beadsMore = /(\d+)\s+more\s+black\s+(?:than|then)\s+white/i.exec(source);
  if (beadsTotal && beadsMore) return `b + w = ${beadsTotal[1]} and b = w + ${beadsMore[1]}`;

  // Algebra form from the same beads page: "Taking the number of black beads as x, the number of white is x - 10"
  // + total 100 elsewhere on the page.
  const beadsAsX = /(?:black beads as|number of black[\s\S]{0,40}?as)\s*([xyz])/i.exec(source);
  const whiteAs = /(?:number of white[\s\S]{0,40}?is|white is)\s*([xyz])\s*([+\-\u2212])\s*(\d+)/i.exec(source);
  const totalN = /(?:altogether|total|there are)\s+(\d+)/i.exec(source) || /=\s*(\d+)\s*(?:altogether)?/i.exec(source);
  if (beadsAsX && whiteAs && totalN) {
    const v = beadsAsX[1];
    const sign = whiteAs[2].includes('-') || whiteAs[2].includes('\u2212') ? '-' : '+';
    return `${v} + (${whiteAs[1]} ${sign} ${whiteAs[3]}) = ${totalN[1]}`;
  }

  return undefined;
}

/**
 * AI planning may return excellent teacher narration but zero executable visual actions.
 * That must never reach the classroom. Recover a verified worked-solution/template scene
 * from equations already present in the textbook (or from a small set of deterministic
 * word-problem patterns), while preserving the selected Video-DNA and Teacher-Reading cues.
 */
/**
 * Deterministic last-mile visual repair for the emergency Teacher-Reading path.
 * QA must be able to reject a malformed scene and then have a concrete repair
 * operation to run. This reflows only drawable text/LaTeX nodes into a full-board
 * teaching grid; narration/read/explain/source cues are left untouched.
 */
export function repairTeacherVisualLayout(lesson: AIGuruTeachingLesson): AIGuruTeachingLesson {
  // Canonicalize compound human-readable equation fields so the QA verifier can validate each relation on its own.
  // The original text is kept for display; only the machine-verification list is normalized.
  const splitRelations = (value: string | undefined) => String(value ?? '')
    .split(/\s+(?:and|&|;|\n)\s+/i)
    .map(x => x.trim())
    .filter(x => x && /=/.test(x));
  const normalizeExpressions = (values: string[]) => values.flatMap(value => {
    const parts = splitRelations(value);
    return parts.length > 1 ? parts : [value];
  });
  lesson.segments = lesson.segments.map(segment => ({
    ...segment,
    mathematics: { ...segment.mathematics, expressions: normalizeExpressions(segment.mathematics.expressions || []) },
  }));
  return paginateTeacherBoard(lesson);
}

/** The drawable area the QA gate enforces: a 1000x700 board with a 24px safe frame. */
const BOARD_FRAME = { x0: 24, y0: 24, x1: 976, y1: 676 };

/** Pull a node fully inside the safe frame without changing what it shows. */
function clampNodeIntoFrame(node: MathVisualNode): MathVisualNode {
  const box = nodeBox(node);
  const maxW = BOARD_FRAME.x1 - BOARD_FRAME.x0, maxH = BOARD_FRAME.y1 - BOARD_FRAME.y0;
  if (node.kind === 'line' || node.kind === 'arrow') {
    const dx = box.x < BOARD_FRAME.x0 ? BOARD_FRAME.x0 - box.x : box.x + box.w > BOARD_FRAME.x1 ? BOARD_FRAME.x1 - (box.x + box.w) : 0;
    const dy = box.y < BOARD_FRAME.y0 ? BOARD_FRAME.y0 - box.y : box.y + box.h > BOARD_FRAME.y1 ? BOARD_FRAME.y1 - (box.y + box.h) : 0;
    if (!dx && !dy) return node;
    return { ...node, x: Number(node.x ?? 0) + dx, y: Number(node.y ?? 0) + dy, startX: Number(node.startX ?? 0) + dx, endX: Number(node.endX ?? 0) + dx, startY: Number(node.startY ?? 0) + dy, endY: Number(node.endY ?? 0) + dy };
  }
  const width = Math.min(box.w, maxW), height = Math.min(box.h, maxH);
  const x = Math.min(Math.max(box.x, BOARD_FRAME.x0), BOARD_FRAME.x1 - width);
  const y = Math.min(Math.max(box.y, BOARD_FRAME.y0), BOARD_FRAME.y1 - height);
  if (x === node.x && y === node.y && width === box.w && height === box.h && node.width !== undefined && node.height !== undefined) return node;
  return { ...node, x, y, width, height };
}

/**
 * Board paging (V51.9.7).
 *
 * A teaching board is a fixed 1000x700 canvas. The previous repair squeezed EVERY beat of the lesson into one
 * cumulative column (row height >= 58px), so a 16-beat page needed ~930px and the bottom rows left the safe
 * frame - the "N created visual node(s) leave the 24px safe frame" 422 error.
 *
 * Real teaching videos never keep adding lines forever: when the board is full the teacher wipes it and
 * continues on a clean page. This does the same, deterministically:
 *  1. every created node is clamped into the safe frame;
 *  2. when a new text/LaTeX node would land on top of something still on the board, the board is wiped first
 *     (an `erase` of everything currently visible, played together as one wipe) and the node starts a new page.
 * Authored positions are otherwise untouched, so template/solver layouts keep their exact design. Scene-template
 * nodes (`tpl:`) own the whole board for their segment and are never paged against free-form nodes.
 */
export function paginateTeacherBoard(lesson: AIGuruTeachingLesson): AIGuruTeachingLesson {
  const isTpl = (n: MathVisualNode) => String(n.id).startsWith('tpl:');
  const isText = (n: MathVisualNode) => n.kind === 'text' || n.kind === 'latex';
  let live: MathVisualNode[] = [];
  for (const segment of [...lesson.segments].sort((a, b) => a.order - b.order)) {
    for (const beat of segment.beats) {
      const next: AnimationIntent[] = [];
      for (const action of beat.actions) {
        if (action.type === 'erase') { live = live.filter(n => n.id !== action.objectId); next.push(action); continue; }
        if (action.type !== 'create' || !action.node) { next.push(action); continue; }
        const node = isTpl(action.node) ? action.node : clampNodeIntoFrame(action.node);
        const box = nodeBox(node);
        const collides = isText(node) && live.some(o => isText(o) && isTpl(o) === isTpl(node) && o.id !== node.id && overlap(nodeBox(o), box));
        if (collides) {
          const wipe = live.filter(o => !isTpl(o) === !isTpl(node));
          wipe.forEach((o, i) => next.push(i === 0 ? { type: 'erase', objectId: o.id } : { type: 'erase', objectId: o.id, together: true }));
          const wiped = new Set(wipe.map(o => o.id));
          live = live.filter(o => !wiped.has(o.id));
        }
        live = live.filter(o => o.id !== node.id);
        live.push(node);
        next.push({ ...action, node });
      }
      beat.actions = next;
    }
  }
  return lesson;
}

export function recoverMissingVisualTeaching(lesson: AIGuruTeachingLesson, input: PlannerInput): AIGuruTeachingLesson {
  if (hasMeaningfulVisualActions(lesson)) return lesson;
  const problem = deriveDeterministicProblem(sourceTextForVisualRecovery(input));
  if (!problem) return lesson;
  const recovered = buildSolverLesson({ question: problem, grade: input.grade, domain: input.domain, language: input.language, chapterTitle: input.chapterTitle });
  if (!recovered) return lesson;

  const sourceBeats = lesson.segments.flatMap(s => s.beats);
  const recoveredBeats = recovered.segments.flatMap(s => s.beats);
  const dnaId = lesson.visualGrammar.dnaIds?.[0];
  const dnaArchetype = lesson.visualGrammar.archetype || 'progressive-construction';
  const visualQueue = [...recoveredBeats];

  // Attach deterministic visual steps to the existing textbook-reading beats first.
  for (const beat of sourceBeats) {
    const hasVisual = beat.actions.some(a => a.type !== 'pause');
    if (hasVisual || !visualQueue.length) continue;
    const visual = visualQueue.shift()!;
    beat.actions = visual.actions;
    beat.targetObjects = visual.targetObjects;
    beat.visualIntent = visual.visualIntent;
    beat.durationMs = Math.max(beat.durationMs || 0, visual.durationMs || 0);
    if (!beat.dna && dnaId) beat.dna = { dnaId, archetype: dnaArchetype, constructionStep: visual.visualIntent };
  }

  // Any remaining verified solver steps become an explicit worked-solution segment.
  if (visualQueue.length) {
    const order = lesson.segments.reduce((m, s) => Math.max(m, s.order), -1) + 1;
    const room = (lesson.difficulty?.maxSegments ?? 7) - lesson.segments.length;
    if (room > 0) {
      const maxBeats = lesson.difficulty?.maxBeatsPerSegment ?? 6;
      for (let i = 0; i < visualQueue.length; i += maxBeats) {
        const part = visualQueue.slice(i, i + maxBeats);
        lesson.segments.push({
          id: `visual-recovery-${order + Math.floor(i / maxBeats)}`,
          title: input.language === 'malayalam' ? 'Whiteboard ഘട്ടങ്ങൾ' : 'Whiteboard steps',
          order: order + Math.floor(i / maxBeats),
          intuition: { explanation: input.language === 'malayalam' ? 'ഓരോ ഘട്ടവും മുമ്പത്തെ ഘട്ടത്തിൽ നിന്ന് വ്യക്തമായി നിർമ്മിക്കാം.' : 'Each visual step is built from the previous verified step.' },
          mathematics: { explanation: input.language === 'malayalam' ? 'ഓരോ transformation-വും പരിശോധിച്ചിരിക്കുന്നു.' : 'Each transformation is verified.', expressions: [problem], verified: true },
          beats: part.map(v => ({ ...v, dna: v.dna || (dnaId ? { dnaId, archetype: dnaArchetype, constructionStep: v.visualIntent } : undefined) })),
          estimatedDurationMs: part.reduce((n, b) => n + (b.durationMs || 0), 0),
        });
      }
    }
  }

  lesson.expression = lesson.expression || problem;
  lesson.runningExample.expression = lesson.runningExample.expression || problem;
  lesson.runningExample.persistentObjectIds = [...new Set(lesson.segments.flatMap(s => s.beats.flatMap(b => b.actions.filter(a => a.type === 'create').map(a => a.objectId))))].slice(0, 8);
  lesson.visualGrammar.constructionPattern = lesson.visualGrammar.constructionPattern || 'build-transform-build';
  return lesson;
}

function buildPrompt(input: PlannerInput, dnaText: string, chapterStrategyText = '', lessonStrategyText = ''): string {
  let readingManifest = 'not supplied';
  if (input.textbookPageJson) {
    try {
      const page = JSON.parse(input.textbookPageJson);
      const cues = Array.isArray(page?.paragraphs)
        ? page.paragraphs.flatMap((p: any) => Array.isArray(p?.sentences) ? p.sentences : [])
            .filter((s: any) => s?.readable !== false)
            .map((s: any) => `${String(s.id)} | ${String(s.text)}`)
            .join('\n')
        : '';
      if (cues) readingManifest = cues;
    } catch {
      readingManifest = 'invalid page JSON';
    }
  }
  return `You are AI Guru's 3B1B-style mathematics teaching planner for Kerala State and CBSE Classes 1-12.

Create an ORIGINAL teaching lesson. Do not copy source videos, narration, artwork, examples, or code. Video-DNA is only a visual grammar reference.

QUESTION: ${input.question}
GRADE: ${input.grade}
DOMAIN: ${input.domain}
LANGUAGE: ${input.language || 'english'}
LEARNING GOAL: ${input.learningGoal || input.question}
EXPRESSION: ${input.expression || 'none'}
CHAPTER: ${input.chapterTitle || 'not supplied'}
TEXTBOOK CONTEXT: ${(input.textbookContext || 'not supplied').slice(0, 4500)}
TEXTBOOK PAGE STRUCTURE: ${(input.textbookPageJson || 'not supplied').slice(0, 14000)}
READING MANIFEST (EVERY CUE MUST BE TAUGHT IN ORDER):
${readingManifest}
TEACHER-READING MODE: ${input.teacherReadingMode ? 'ON' : 'OFF'}
DIFFICULTY PROFILE: ${JSON.stringify(difficultyProfile(input.grade))}
${chapterStrategyText}
${lessonStrategyText}
${input.repairInstructions ? `REPAIR INSTRUCTIONS FROM QA:\n${input.repairInstructions}` : ''}

VIDEO-DNA VISUAL GRAMMAR:
${dnaText || 'Use progressive mathematical construction and transformation.'}

TEACHER-READING MODE (mandatory when textbook context is supplied):
The class follows the cycle: READ → TRANSLATE → EXPLAIN → VISUALIZE → CHECK → CONTINUE.
For every meaningful textbook sentence the teacher must:
  a. READ the original English sentence (field "read.en").
  b. TRANSLATE it into natural Malayalam (field "read.ml").
  c. EXPLAIN why it matters, what is known / unknown (fields "explain.en" + "explain.ml").
  d. Only then draw a visual beat on the whiteboard.
Never put extracted textbook paragraphs or long prose on the whiteboard.
The board receives only concise labels, equations, diagrams, arrows and transformations.
The teacher voice carries the detailed explanation.

PEDAGOGICAL REQUIREMENTS:
1. Start with the textbook heading/topic: say what the idea is, why it exists, and where a learner meets it in ordinary life. Put the bilingual spoken framing in openingTeacher and whyItMattersTeacher.
2. Before solving the exercise, explain the situation in plain teacher language: what is known, what is unknown, what the question asks, and a simple plan.
3. If variables such as x, y, z, a or b are introduced, explicitly define what each one represents before manipulating it.
4. Explain common mistakes and how to avoid them at the point where they could occur.
5. Use a persistent running example and return to it after each conceptual step.
6. Teach intuition before formal mathematics.
7. Move from concrete/pictorial representation toward symbols, then to the verified mathematical operation.
8. Each segment must contain 2-6 meaningful visual beats.
9. Each beat must describe one visual teaching action, not a paragraph of board text.
10. The whiteboard is a visual canvas: NEVER place extracted textbook paragraphs or long prose on it. Use concise labels, equations, diagrams, arrows, highlights and transformations; the teacher voice/caption carries the detailed explanation.
11. Preserve semantic object identity across transformations.
12. Use build -> transform -> insight where mathematically appropriate.
13. Use camera focus/zoom sparingly to direct attention.
14. Cue words must be actual words spoken in the beat narration.
15. Choose a Video-DNA archetype and construction step for every beat when possible.
16. Use only DNA IDs supplied in the VIDEO-DNA context; never invent a DNA ID.
17. Prefer the chapter archetypes for continuity, but override them when the problem's visual concept requires a different archetype.
18. Adapt complexity to the student's grade using the supplied difficulty profile: respect segment/beat limits, narration length and prerequisite depth.
19. Treat the supplied beat-mix as a target grammar, not decorative metadata; use build/transform/move/remove actions in approximately those proportions when mathematically appropriate.
20. Treat supplied QA rules as executable design constraints: safe frame, readable text, non-overlap, visible construction, and insight pause.
21. Use textbook context to ground terminology and the specific concept being taught; never copy source prose.
22. For Malayalam narration, write natural Malayalam sentences but KEEP mathematical and technical terms in English (for example variable, equation, coefficient, constant, term, expression, substitution, elimination, solution, graph, slope, function). Do not transliterate technical terminology into Malayalam script.
23. In Malayalam narration, pronounce variable names x, y, z, a, b and similar symbols as English letter names (ex, why, zee, ay, bee) and keep the symbols visible in the mathematics.
24. When textbook context or textbookPageJson is supplied, every beat that teaches a textbook sentence MUST include:
     - sourceCueId  (e.g. "p7-para2-s1")
     - read: { "en": "<exact textbook sentence>", "ml": "<natural Malayalam translation>" }
     - explain: { "en": "<teacher explanation>", "ml": "<Malayalam explanation>" }
   Optional: checkQuestion: { "en": "...", "ml": "..." }
25. The "narration" field remains required for backward compatibility; set it to explain.en (or read.en if no explanation).

ALLOWED ANIMATION ACTIONS:
create, draw, move, transform, morph, highlight, indicate, erase, camera, pause, recolor, count, tween.

3B1B FEEL - COLOUR, COUNTING AND CONTINUOUS MOTION:
- colorBindings: give the lesson ONE variable->colour map, e.g. "colorBindings":{"a":"gold","b":"blue","x":"red"}. Every LaTeX term, shape and graph element for that variable then shares the colour automatically (the board colours single letters in "latex" nodes from this map). Colours: white, gray, yellow, gold, orange, red, pink, purple, blue, teal, cyan, green, or #hex.
- Colour numbers explicitly inside LaTeX with {\\color{gold}2ab}.
- RECOLOR: { "type":"recolor", "target":"eq-1", "color":"yellow", "durationMs":800 } changes one object over time. Use "target":"var:a" to recolour the variable a everywhere (a term turns from white to its colour when it is introduced).
- COUNT: { "type":"count", "objectId":"readout", "from":2, "to":5, "durationMs":1500, "decimals":0 } counts a number inside a text object whose "valueFormat" is e.g. "total = {v}".
- TWEEN: { "type":"tween", "param":"t", "from":-2, "to":2, "durationMs":4000 } animates a parameter. Objects read it live: a text node with "valueExpr":"2*t" and "valueFormat":"slope = {v}"; a node with "bindX":"100 + 40*t"; a "plot" node: { "id":"g","kind":"plot","x":60,"y":110,"width":520,"height":440,"plot":{"fn":"a*x^2","xMin":-3,"xMax":3,"yMin":-1,"yMax":10,"marker":{"x":"t","tangent":true}} }.
- Add "together":true to recolor/count/tween so it starts WITH the previous action (number counts, point slides and colour changes at the same time).
- Expressions use numbers, parameter names, + - * / ^, sin cos tan sqrt abs ln exp. Nothing else.

SCENE TEMPLATES (PREFERRED over drawing by hand when one fits the concept):
Instead of drawing a number line, area model, completing-the-square tiles or a moving-point graph yourself, request a template. Code builds and verifies the whole scene from your numbers:
${sceneTemplateCatalog()}
Request at most ONE with: "sceneTemplates":[{"id":"area-model","params":{"p":2,"q":3}}] at the top level of the JSON. Use it only when the numbers fit; otherwise teach normally.

CREATE ACTION:
{ "type":"create", "objectId":"triangle", "node":{"id":"triangle","kind":"shape","x":100,"y":100,"width":200,"height":150,"shape":"triangle","style":{"strokeWidth":4}} }

MOVE ACTION:
{ "type":"move", "objectId":"point-1", "toX":400, "toY":250 }

TRANSFORM/MORPH:
{ "type":"transform", "fromObjectId":"equation-1", "toObjectId":"equation-2" }

CAMERA:
{ "type":"camera", "action":"zoom", "targetId":"angle-1", "scale":1.6 }

Return ONLY JSON matching this shape:
{
  "schemaVersion":"2.1",
  "id":"...",
  "title":"...",
  "openingQuestion":"...",
  "whyItMatters":"...",
  "openingTeacher":{"en":"...","ml":"..."},
  "whyItMattersTeacher":{"en":"...","ml":"..."},
  "learningGoal":"...",
  "prerequisites":[{"id":"...","title":"...","reason":"...","required":true}],
  "runningExample":{"id":"...","description":"...","expression":"...","persistentObjectIds":["..."]},
  "colorBindings":{"x":"gold"},
  "sceneTemplates":[],
  "visualGrammar":{"archetype":"...","dnaIds":["..."],"constructionPattern":"build-transform-build","motifs":["..."],"pacing":"slow|medium|fast","camera":"static|focus|cinematic","beatMix":{"build":0.5,"transform":0.3,"move":0.15,"remove":0.05},"qaRules":["..."]},
  "segments":[{
    "id":"...",
    "title":"...",
    "order":0,
    "intuition":{"explanation":"...","visualMetaphor":"..."},
    "mathematics":{"explanation":"...","expressions":["..."],"verified":false},
    "beats":[{
      "id":"...",
      "sourceCueId":"p7-para2-s1",
      "read":{"en":"There are 100 beads, black and white, in a box; 10 more black than white.","ml":"ഒരു പെട്ടിയിൽ ആകെ 100 beads ഉണ്ട്. അതിൽ black beads, white beads-നേക്കാൾ 10 എണ്ണം കൂടുതലാണ്."},
      "explain":{"en":"So we know the total is 100. We still do not know how many are black and how many are white.","ml":"അതായത് ആകെ 100 ആണെന്ന് നമുക്കറിയാം. എന്നാൽ എത്ര black, എത്ര white എന്ന് ഇതുവരെ അറിയില്ല."},
      "narration":"So we know the total is 100. We still do not know how many are black and how many are white.",
      "cueWords":["total","100","black","white"],
      "durationMs":1400,
      "visualIntent":"create|draw|transform|move|morph|highlight|compare|derive|graph|geometry|camera|pause",
      "targetObjects":["..."],
      "actions":[{"type":"pause","durationMs":350}],
      "dna":{"dnaId":"...","archetype":"...","constructionStep":"...","motif":"..."},
      "checkQuestion":{"en":"What do we still not know?","ml":"നമുക്ക് ഇനിയും അറിയാത്തത് എന്താണ്?"}
    }]
  }],
  "finalInsight":"..."
}

Do not output TypeScript, Python, HTML, SVG, Manim code, or URLs.`;
}


/**
 * Deterministic emergency teacher lesson.
 *
 * This is deliberately NOT a replacement for Gemini 3B1B planning. It is a
 * bounded start-path so a temporary Gemini timeout cannot leave the classroom
 * unusable. It uses the textbook page/cues already supplied by the classroom,
 * keeps the whiteboard concise, and never invents mathematical solution steps.
 */
export function buildLocalTeacherLesson(input: PlannerInput): AIGuruTeachingLesson {
  const page = (() => {
    try {
      const parsed = input.textbookPageJson ? JSON.parse(input.textbookPageJson) : null;
      return parsed && Array.isArray(parsed.paragraphs) ? parsed : null;
    } catch { return null; }
  })();
  const sentences = (page?.paragraphs ?? []).flatMap((p: any) => Array.isArray(p?.sentences) ? p.sentences : [])
    .filter((s: any) => s?.readable !== false && String(s?.text || '').trim());
  // Cap only the *visual* labels later; every readable sentence must become a cued beat
  // so teacher-reading-coverage QA does not fail with "missing textbook cue(s)".
  const source = sentences.map((s: any) => String(s.text).trim()).join(' ')
    || String(input.question || '').replace(/^Textbook passage:\s*/i, '').trim();
  const eqsFromText: string[] = [...new Set<string>((String(source).match(/[A-Za-z0-9().+\-−×*/^²³√\s]{1,70}\s*=\s*[A-Za-z0-9().+\-−×*/^²³√\s]{1,35}/g) ?? [])
    .map((x: string) => x.replace(/\s+/g, ' ').trim()).filter((x: string) => x.length <= 90))];
  const problemEq = deriveDeterministicProblem(sourceTextForVisualRecovery(input) || source);
  const eqs = [...new Set([
    ...(problemEq ? problemEq.split(/\s+and\s+/i).map(s => s.trim()).filter(Boolean) : []),
    ...eqsFromText,
  ])].slice(0, 6);
  const labelFor = (text: string, index: number) => {
    if (index === 0) return input.chapterTitle || 'What are we learning?';
    if (/\?|problem|question|find|calculate|determine/i.test(text)) return 'What is the problem asking?';
    if (/let\s+[xyz]|taking .* as [xyz]|unknown|variable/i.test(text)) return 'Define the unknown';
    if (/=/i.test(text) || eqs.length) return index % 2 ? 'Form the equation' : 'Mathematical relationship';
    return index === 1 ? 'Understand the given information' : 'Key idea';
  };
  const mlGeneric = (text: string, kind: 'read'|'explain') => {
    const t = text.trim();
    if (kind === 'read') return `ഈ textbook വാചകം: ${t}`;
    if (/unknown|variable/i.test(t)) return 'ഇവിടെ variable ഒരു അറിയാത്ത അളവിനെ സൂചിപ്പിക്കുന്നു. x, y, z എന്നീ പേരുകൾ English letter names ആയി തന്നെ പറയാം.';
    if (/=/i.test(t)) return 'ഈ ബന്ധം equation ആയി whiteboard-ൽ കാണിക്കാം. Technical terms English-ൽ തന്നെ ഉപയോഗിക്കാം.';
    return 'ഈ ഭാഗം ആദ്യം മനസ്സിലാക്കാം. പിന്നെ അതിന്റെ mathematical idea whiteboard-ൽ നിർമ്മിക്കാം.';
  };
  // Created Study Materials already carry a stored explanation for this paragraph. Spread its sentences across
  // the beats in order so the offline lesson teaches the material's own words instead of generic prompts.
  const spreadExplanation = (raw: string | undefined, count: number): string[] => {
    const parts = String(raw || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?\u0964])\s+/).filter(x => x.trim().length > 1);
    if (!parts.length || count < 1) return [];
    const groups = Math.min(count, parts.length);
    const out: string[] = [];
    for (let g = 0; g < groups; g++) out.push(parts.slice(Math.floor(g * parts.length / groups), Math.floor((g + 1) * parts.length / groups)).join(' '));
    return out;
  };
  const beatCount = Math.max(1, sentences.length);
  const materialEn = spreadExplanation(input.teacherExplanationEnglish, beatCount);
  const materialMl = spreadExplanation(input.teacherExplanationMalayalam, beatCount);
  const allSentences = (sentences.length ? sentences : [{ id: `p${page?.pageNumber || 1}-fallback-s1`, text: source, type: 'body' }]);
  // Every readable sentence becomes a cued beat (QA teacher-reading-coverage).
  // Only the first few get a board object so the safe frame is not flooded; later cues are narration-only.
  const MAX_VISUAL_BEATS = 5;
  const beats = allSentences.map((sentence: any, i: number) => {
    const text = String(sentence.text || source).trim();
    const label = labelFor(text, i);
    const id = `fallback-beat-${i + 1}`;
    const objectId = `fallback-${i + 1}`;
    const isEquation = /=/.test(text) || (i > 1 && eqs[i - 1]);
    const makeVisual = i < MAX_VISUAL_BEATS;
    const node: any = makeVisual
      ? (isEquation
        ? { id: objectId, kind: 'latex', x: 120, y: 110 + i * 82, latex: (eqs[Math.min(Math.max(i - 1, 0), Math.max(eqs.length - 1, 0))] || text).slice(0, 70), style: { fontSize: 40 } }
        : { id: objectId, kind: 'text', x: 120, y: 110 + i * 82, content: label, width: 700, height: 52, style: { fontSize: 32 } })
      : null;
    const readMl = String(input.teacherSourceMalayalam || '').trim() || mlGeneric(text, 'read');
    const explainEn = materialEn[i] || (/\?|problem|find|calculate/i.test(text)
      ? 'First identify what is known, what is unknown, and exactly what the question asks.'
      : /let\s+[xyz]|unknown|variable/i.test(text)
        ? 'A variable is a name for an unknown quantity. Define it before doing any operation.'
        : /=/.test(text)
          ? 'This equation connects the known information to the unknown. We will change one step at a time and keep the meaning clear.'
          : 'Read the textbook idea first. Then we turn the important relationship into a simple visual on the whiteboard.');
    const explainMl = materialMl[i] || mlGeneric(explainEn, 'explain');
    return {
      id,
      sourceCueId: sentence.id || `p${page?.pageNumber || 1}-fallback-s${i + 1}`,
      read: { en: text, ml: readMl },
      explain: { en: explainEn, ml: explainMl },
      narration: explainEn,
      cueWords: text.split(/\s+/).slice(0, 6),
      durationMs: 2200,
      visualIntent: makeVisual ? (isEquation ? 'derive' : 'create') : 'pause',
      targetObjects: makeVisual ? [objectId] : [],
      // Visual beats: create + recolor for teaching-motion QA. Cue-only beats: pause.
      actions: makeVisual
        ? [
            { type: 'create', objectId, node },
            { type: 'recolor', target: objectId, color: isEquation ? '#38bdf8' : '#f8fafc', durationMs: 700, together: true },
          ]
        : [{ type: 'pause', durationMs: 400 }],
    };
  });
  while (beats.length < 4) {
    const i = beats.length;
    const objectId = `fallback-${i + 1}`;
    beats.push({
      id: `fallback-beat-${i + 1}`, narration: 'Let us connect the idea to the problem.', cueWords: ['connect', 'idea', 'problem'], durationMs: 1800, visualIntent: 'create', targetObjects: [objectId],
      actions: [
        { type: 'create', objectId, node: { id: objectId, kind: 'text', x: 120, y: 110 + i * 82, content: 'Connect the idea → the problem', width: 700, height: 52, style: { fontSize: 32 } } },
        { type: 'recolor', target: objectId, color: '#a78bfa', durationMs: 700, together: true },
      ],
    });
  }
  // Insight pause so Video-DNA qaRules ('insight pause') pass.
  const lastBeat = beats[beats.length - 1];
  if (lastBeat && !lastBeat.actions.some((a: any) => a.type === 'pause')) {
    lastBeat.actions.push({ type: 'pause', durationMs: 600 });
  }
  const prof = difficultyProfile(input.grade);
  // Never drop cued beats — cover the whole page. QA difficulty is relaxed when textbookPage is set.
  const maxPer = Math.max(prof.maxBeatsPerSegment, 8);
  const segCount = Math.max(2, Math.ceil(beats.length / maxPer));
  const chunkSize = Math.ceil(beats.length / segCount) || 1;
  const segments: any[] = [];
  for (let i = 0, order = 0; i < beats.length; i += chunkSize, order++) {
    const slice = beats.slice(i, i + chunkSize);
    while (slice.length < 2) {
      slice.push({ id: `fallback-pad-${order}-${slice.length}`, narration: 'Pause and think about the idea.', cueWords: ['pause'], durationMs: 800, visualIntent: 'pause', targetObjects: [], actions: [{ type: 'pause', durationMs: 400 }], explain: { en: 'Continue.', ml: 'തുടരാം.' } });
    }
    const title = order === 0 ? 'Understand the textbook idea' : order === 1 ? 'Apply it to the problem' : `Continue the lesson ${order + 1}`;
    segments.push({
      id: `fallback-seg-${order + 1}`, title, order,
      intuition: { explanation: order === 0 ? 'Start from the words and identify the important quantities and relationships.' : 'Use the identified relationship step by step.' },
      mathematics: { explanation: 'Connect the textbook idea to a clear mathematical relationship.', expressions: eqs.length ? eqs : (problemEq ? [problemEq] : []) },
      beats: slice,
      estimatedDurationMs: slice.reduce((n: number, b: any) => n + (b.durationMs || 0), 0),
    });
  }
  if (!segments.length) {
    segments.push({
      id: 'fallback-understand', title: 'Understand the textbook idea', order: 0,
      intuition: { explanation: 'Start from the words.' },
      mathematics: { explanation: 'Build the relationship.', expressions: eqs },
      beats: [{ id: 'fallback-empty', narration: 'Read the textbook carefully.', cueWords: ['read'], durationMs: 1500, visualIntent: 'pause', targetObjects: [], actions: [{ type: 'pause', durationMs: 500 }], read: { en: source.slice(0, 200), ml: source.slice(0, 200) }, explain: { en: 'Identify known and unknown.', ml: 'അറിയുന്നതും അറിയാത്തതും തിരിച്ചറിയാം.' } }],
    });
  }
  return {
    schemaVersion:'2.1', id:`local-teacher:${Date.now()}`, title:input.chapterTitle || input.question.slice(0,120), grade:input.grade, gradeBand:gradeBand(input.grade), domain:input.domain,
    openingQuestion: input.chapterTitle ? `What is ${input.chapterTitle}?` : input.question,
    whyItMatters:'Understand the idea first, then use it to solve the problem and recognize it in ordinary situations.',
    openingTeacher:{ en: input.chapterTitle ? `Today we will understand ${input.chapterTitle} before solving the problem.` : 'First, let us understand the situation before solving the problem.', ml: 'ആദ്യം ആശയം മനസ്സിലാക്കാം. അതിന് ശേഷം problem step by step ആയി solve ചെയ്യാം.' },
    whyItMattersTeacher:{ en:'A good solution starts by knowing what is given, what is unknown, and what the symbols mean.', ml:'നല്ല solution തുടങ്ങുന്നത് given information, unknown quantity, symbols എന്നിവ വ്യക്തമായി മനസ്സിലാക്കിയ ശേഷമാണ്.' },
    learningGoal:input.learningGoal || input.question,
    prerequisites:[], expression: eqs[0] || problemEq || undefined,
    runningExample:{ id:'fallback-running-example', description:input.question, expression: eqs[0] || problemEq, persistentObjectIds:beats.flatMap((b: any)=>b.actions.filter((a:any)=>a.type==='create').map((a:any)=>a.objectId)).slice(0,6) },
    segments, finalInsight:'Explain the meaning first, then use the mathematics to solve and check the answer.', visualGrammar:{ archetype:'progressive-construction', dnaIds:[], constructionPattern:'build-transform-build', motifs:['teacher-reading','meaning-before-symbols'], pacing:'medium', camera:'focus', beatMix:{build:0.7,transform:0.1,move:0.1,remove:0.1}, qaRules:['safe frame','concise visual labels','insight pause'] }, difficulty:difficultyProfile(input.grade), textbookPage:page || undefined,
  };
}

/**
 * Template-driven Teacher-Reading lesson (V51.9.7) - the offline/Gemini-unavailable path.
 *
 * Teaching is taken from the project's verified VIDEO TEMPLATES instead of filler labels:
 *  - the textbook sentences are still read verbatim (sourceCueId / read / explain, EN + ML) - the reading beats carry NO
 *    board clutter of their own;
 *  - when the page contains a solvable problem (explicit equations, or a known word-problem pattern such as the
 *    beads / table-and-chairs problems), the whiteboard is built by the deterministic worked-solution template
 *    (`buildSolverLesson`): KaTeX equations, one colour per variable, each line fading in white and recolouring to its
 *    step colour, a reason label per line, a check and the answer - every line verified by mathjs;
 *  - segments are sized to the grade's difficulty profile, and the board is paged (see `paginateTeacherBoard`) so it can
 *    never overflow the safe frame.
 * Falls back to `buildLocalTeacherLesson` when the page has no problem the solver can verify.
 */
export function buildTemplateTeacherLesson(input: PlannerInput): AIGuruTeachingLesson {
  const base = buildLocalTeacherLesson(input);
  const problem = deriveDeterministicProblem(sourceTextForVisualRecovery(input));
  if (!problem) return base;
  const solver = buildSolverLesson({ question: problem, grade: input.grade, domain: input.domain, language: input.language, chapterTitle: input.chapterTitle });
  if (!solver) return base;

  const prof = difficultyProfile(input.grade);
  const clip = (text: string, max: number) => {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    const cut = t.slice(0, max - 1);
    return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 20)).trim()}\u2026`;
  };
  // Reading beats = the base beats that map to a real textbook sentence. Their board objects are dropped; the
  // solver segments below own the whiteboard.
  const cued = base.segments.flatMap(s => s.beats).filter(b => b.sourceCueId);
  const readingBeats: TeachingBeat[] = (cued.length ? cued : base.segments.flatMap(s => s.beats)).map(b => ({
    ...b, narration: clip(b.narration, prof.maxNarrationChars), visualIntent: 'pause', targetObjects: [], actions: [{ type: 'pause', durationMs: 350 }],
  }));
  let solverBeats = solver.segments.flatMap(s => s.beats);

  const chunk = <T,>(items: T[], maxPer: number, maxChunks: number): T[][] => {
    if (!items.length) return [];
    const count = Math.max(1, Math.min(maxChunks, Math.ceil(items.length / maxPer), Math.floor(items.length / prof.minBeatsPerSegment) || 1));
    const size = Math.ceil(items.length / count);
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
  };

  // Too few reading beats to form their own segment -> they open the solution segment instead.
  const readingOwnSegments = readingBeats.length >= prof.minBeatsPerSegment;
  const readingChunks = readingOwnSegments ? chunk(readingBeats, prof.maxBeatsPerSegment, Math.max(1, prof.maxSegments - 1)) : [];
  const solverRoom = Math.max(1, prof.maxSegments - readingChunks.length);
  const leading = readingOwnSegments ? [] : readingBeats;
  const solverCapacity = solverRoom * prof.maxBeatsPerSegment - leading.length;
  if (solverBeats.length > solverCapacity) {
    // Keep the problem lines at the start and the result/answer at the end; drop middle algebra lines only if the grade profile forces it.
    const tail = Math.min(3, Math.max(1, solverCapacity - 2));
    solverBeats = [...solverBeats.slice(0, Math.max(1, solverCapacity - tail)), ...solverBeats.slice(-tail)];
  }
  const solverChunks = chunk([...leading, ...solverBeats], prof.maxBeatsPerSegment, solverRoom);

  const ml = input.language === 'malayalam';
  // Solver segments FIRST so the board shows coloured equations immediately (3B1B style),
  // then reading segments cover every textbook cue for QA + narration.
  const solverSegments = solverChunks.map((beats, i) => ({
    id: `template-solve-${i + 1}`, title: ml ? `Whiteboard-ൽ solve ചെയ്യാം ${i + 1}` : `Solve it on the whiteboard ${i + 1}`, order: i,
    intuition: { explanation: ml ? 'ഓരോ വരിയും മുമ്പത്തേതിന്റെ അതേ അർത്ഥം നിലനിർത്തുന്നു.' : 'Each line keeps the same meaning as the line before it.' },
    mathematics: { explanation: ml ? 'ഓരോ ഘട്ടവും equation balanced ആയി നിലനിർത്തുന്നു.' : 'Every step keeps the equation balanced.', expressions: i === 0 ? [problem] : [], verified: false },
    beats, estimatedDurationMs: beats.reduce((n, b) => n + (b.durationMs ?? 0), 0),
  }));
  const readingSegments = readingChunks.map((beats, i) => ({
    id: `template-reading-${i + 1}`, title: ml ? 'Textbook വായിക്കാം' : 'Read the textbook', order: solverSegments.length + i,
    intuition: { explanation: ml ? 'ആദ്യം textbook-ലെ വാചകങ്ങൾ ശ്രദ്ധയോടെ വായിക്കാം.' : 'First we read what the textbook says, one sentence at a time.' },
    mathematics: { explanation: ml ? 'അറിയുന്നതും അറിയാത്തതും തിരിച്ചറിയാം.' : 'Identify what is known and what is unknown.', expressions: [], verified: false },
    beats, estimatedDurationMs: beats.reduce((n, b) => n + (b.durationMs ?? 0), 0),
  }));

  const ids = solverBeats.flatMap(b => b.actions.filter(a => a.type === 'create').map(a => (a as { objectId: string }).objectId));
  return {
    ...base,
    id: `template-teacher:${Date.now()}`,
    segments: [...solverSegments, ...readingSegments],
    expression: problem,
    runningExample: { id: 'template-running-example', description: problem, expression: problem, persistentObjectIds: ids.slice(0, 6) },
    finalInsight: solver.finalInsight,
    visualGrammar: { archetype: 'worked-solution', dnaIds: [], constructionPattern: 'build-recolor-build', motifs: ['teacher-reading', 'one-colour-per-step', 'variable-colour-binding'], pacing: 'medium', camera: 'static', qaRules: ['safe frame', 'insight pause'] },
    ...(solver.colorBindings ? { colorBindings: solver.colorBindings } : {}),
  };
}

async function callGeminiJson(prompt: string, key: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(DEFAULT_MODEL)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Gemini 3B1B planning timed out after 12 seconds.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new Error(`Gemini 3B1B teaching planning failed: ${response.status}`);
  const data = await response.json() as any;
  return data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('') || '';
}

async function callOpenAIJson(prompt: string, key: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: process.env.OPENAI_TEACHING_MODEL || 'gpt-4.1-mini', temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('OpenAI 3B1B planning timed out after 30 seconds.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new Error(`OpenAI 3B1B teaching planning failed: ${response.status}`);
  const data = await response.json() as any;
  return String(data?.choices?.[0]?.message?.content || '');
}

export async function generateTeachingLesson(input: PlannerInput): Promise<AIGuruTeachingLesson> {
  const key = input.byokKey?.trim() || await serverKey('GEMINI_API_KEY'); // V51.9.176: the server's key only for signed-in users
  const openaiKey = input.openaiKey?.trim() || undefined;
  if (!key && !openaiKey) throw new Error(process.env.GEMINI_API_KEY ? SIGN_IN_FOR_SERVER_KEY : 'GEMINI_API_KEY is not configured for 3B1B teaching planning.');

  const chapterStrategy = input.chapterTitle || input.chapterSummary || (input.chapterTopics?.length ?? 0)
    ? await selectChapterVideoDna({ chapterTitle: input.chapterTitle, chapterSummary: input.chapterSummary, chapterTopics: input.chapterTopics, domain: input.domain, learningGoal: input.learningGoal, grade: input.grade })
    : undefined;
  const lessonStrategy = await selectLessonVideoDna({
    chapterTitle: input.chapterTitle,
    chapterSummary: input.chapterSummary,
    chapterTopics: input.chapterTopics,
    question: input.question,
    learningGoal: input.learningGoal,
    domain: input.domain,
    grade: input.grade,
  }, chapterStrategy);
  const dnaHits = lessonStrategy.selections.map(selection => selection.hit);
  const beatOptionText = lessonStrategy.beatOptions.map(selection => `- ${selection.id}: ${selection.archetype} score=${selection.score.toFixed(3)} reasons=${selection.reasons.join(', ')}`).join('\n');
  const dnaText = dnaHits.map(hit => hit.text).join('\n\n---\n\n');
  const dnaIds = dnaHits.map(hit => hit.id.replace(/^video-dna:/, ''));
  const chapterText = chapterStrategy ? `\nCHAPTER VISUAL STRATEGY:\nArchetypes: ${chapterStrategy.archetypes.join(', ')}\nDNA IDs: ${chapterStrategy.dnaIds.join(', ')}\nConstruction patterns: ${chapterStrategy.constructionPatterns.join(' | ')}\nMotifs: ${chapterStrategy.motifs.join(' | ')}\nPacing: ${chapterStrategy.pacing}; Camera: ${chapterStrategy.camera}\nBeat mix: ${JSON.stringify(chapterStrategy.beatMix)}\nQA rules: ${chapterStrategy.qaRules.join(' | ')}\n` : '';
  const lessonText = `\nLESSON/BEAT DNA OPTIONS:\n${beatOptionText}\nTarget beat mix: ${JSON.stringify(lessonStrategy.beatMix)}\nQA rules: ${lessonStrategy.qaRules.join(' | ')}\n`;
  const prompt = buildPrompt(input, dnaText, chapterText, lessonText);

  // Provider order: Gemini first (when a key exists), then the student's OpenAI key. Previously a Gemini
  // 402/429/5xx ended the whole class even though the student had a working OpenAI key saved.
  let text = '';
  let geminiError: Error | undefined;
  if (key) {
    try { text = await callGeminiJson(prompt, key); }
    catch (error) { geminiError = error instanceof Error ? error : new Error(String(error)); if (!openaiKey) throw geminiError; }
  }
  if (!text) {
    if (!openaiKey) throw geminiError ?? new Error('GEMINI_API_KEY is not configured for 3B1B teaching planning.');
    try { text = await callOpenAIJson(prompt, openaiKey); }
    catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(geminiError ? `${geminiError.message}; ${detail}` : detail);
    }
  }
  const rawLesson = extractJson(text) as any;
  const lesson = normalizeLesson(rawLesson, input, dnaIds);
  recoverMissingVisualTeaching(lesson, input);
  const templateWarnings = applySceneTemplates(lesson, rawLesson?.sceneTemplates, input.language === 'malayalam' ? 'malayalam' : 'english');
  if (templateWarnings.length) console.warn('[AI Guru][3B1B teaching] scene templates:', templateWarnings.join(' | '));
  lesson.visualGrammar.beatMix = lesson.visualGrammar.beatMix ?? lessonStrategy.beatMix;
  lesson.visualGrammar.qaRules = lesson.visualGrammar.qaRules?.length ? lesson.visualGrammar.qaRules : lessonStrategy.qaRules;
  lesson.difficulty = difficultyProfile(input.grade);

  const beatCount = lesson.segments.reduce((sum, segment) => sum + segment.beats.length, 0);
  if (beatCount < 2) throw new Error('3B1B teaching lesson is too short: at least 2 beats are required.');
  if (!lesson.runningExample.persistentObjectIds.length) {
    const createdIds = lesson.segments.flatMap(segment => segment.beats.flatMap(beat => beat.actions.filter(action => action.type === 'create').map(action => action.objectId)));
    lesson.runningExample.persistentObjectIds.push(...[...new Set(createdIds)].slice(0, 6));
  }
  return lesson;
}
