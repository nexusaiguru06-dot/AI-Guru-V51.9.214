import type { AIGuruMathVisualPlan } from './types';
import type { MathDomain } from '../universal/types';

/**
 * V51.3.1 — Resilient visual-plan validation.
 *
 * Previous behaviour threw on the first bad token-move / unknown node kind,
 * which turned every imperfect Gemini response into HTTP 500 and forced the
 * classroom onto the verified-math fallback (text-only board).
 *
 * Now:
 *  - Accept all documented MathVisualKind values (including token-move).
 *  - Accept the full MathDomain set used by the rest of the system.
 *  - Drop or repair individual bad visualActions / nodes instead of rejecting
 *    the entire plan, so the whiteboard still receives usable spatial/math
 *    nodes from the reference-video template.
 */

const domains = new Set<string>([
  'arithmetic', 'number_systems', 'fractions', 'decimals_percentages', 'ratio_proportion',
  'algebra', 'linear_equations', 'inequalities', 'polynomials', 'sequences_series',
  'coordinate_geometry', 'functions', 'trigonometry', 'geometry',
  'mensuration', 'calculus', 'statistics', 'probability',
  'matrices', 'vectors', 'complex_numbers', 'financial_math', '3d_geometry',
  'sets', 'combinatorics', 'general',
]);

/** Must stay in sync with MathVisualKind in universal/types.ts */
const kinds = new Set([
  'text', 'latex', 'line', 'shape', 'point', 'arrow', 'graph',
  'highlight', 'transform', 'erase', 'token-move',
]);

const KIND_ALIASES: Record<string, string> = {
  'token_move': 'token-move',
  'tokenmove': 'token-move',
  'move': 'token-move',
  'equation': 'latex',
  'math': 'latex',
  'label': 'text',
  'rect': 'shape',
  'rectangle': 'shape',
  'circle': 'shape',
  'triangle': 'shape',
};

function clampCoord(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(-200, Math.min(1200, n));
}

function sanitizeNode(raw: any, ids: Set<string>): any | null {
  if (!raw || typeof raw !== 'object') return null;
  let id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) id = `n-auto-${ids.size + 1}`;
  if (ids.has(id)) id = `${id}-${ids.size + 1}`;

  let kind = typeof raw.kind === 'string' ? raw.kind.trim().toLowerCase() : '';
  if (KIND_ALIASES[kind]) kind = KIND_ALIASES[kind];
  if (!kinds.has(kind)) {
    // Unknown kind: keep the node as text so content is not lost.
    kind = raw.latex ? 'latex' : 'text';
  }

  const node: any = { ...raw, id, kind };
  for (const key of ['x', 'y', 'width', 'height', 'startX', 'startY', 'endX', 'endY', 'radius'] as const) {
    if (node[key] !== undefined) node[key] = clampCoord(node[key], key === 'width' || key === 'height' ? 40 : 0);
  }
  if (node.graph) {
    const gx = Array.isArray(node.graph.x) ? node.graph.x.filter((v: any) => Number.isFinite(v)).slice(0, 500) : [];
    const gy = Array.isArray(node.graph.y) ? node.graph.y.filter((v: any) => Number.isFinite(v)).slice(0, 500) : [];
    const len = Math.min(gx.length, gy.length);
    node.graph = { ...node.graph, x: gx.slice(0, len), y: gy.slice(0, len) };
  }
  ids.add(id);
  return node;
}

function sanitizeTokenMove(raw: any, actionIds: Set<string>, index: number): any | null {
  if (!raw || typeof raw !== 'object') return null;

  // Accept common aliases Gemini may emit
  const type = String(raw.type || '').toLowerCase().replace(/_/g, '-');
  if (type && type !== 'token-move' && type !== 'tokenmove' && type !== 'move') {
    // Not a token-move — skip rather than fail the whole plan
    return null;
  }

  let id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) id = `tm-auto-${index + 1}`;
  if (actionIds.has(id)) id = `${id}-${index + 1}`;

  let token = typeof raw.token === 'string' ? raw.token.trim() : '';
  if (!token) {
    // Gemini sometimes puts the glyph in content / text / value
    token = String(raw.content || raw.text || raw.value || raw.label || '').trim();
  }
  if (!token) return null; // unusable — drop, do not throw

  const action = {
    type: 'token-move' as const,
    id,
    token,
    fromX: clampCoord(raw.fromX ?? raw.x ?? raw.from?.x, 100),
    fromY: clampCoord(raw.fromY ?? raw.y ?? raw.from?.y, 100),
    toX: clampCoord(raw.toX ?? raw.to?.x, 200),
    toY: clampCoord(raw.toY ?? raw.to?.y, 200),
    durationMs: Number.isFinite(raw.durationMs) ? Math.max(100, Math.min(8000, Number(raw.durationMs))) : 650,
    fadeOut: raw.fadeOut !== false,
    fontSize: Number.isFinite(raw.fontSize) ? Number(raw.fontSize) : undefined,
    visualStyleId: typeof raw.visualStyleId === 'string' ? raw.visualStyleId : undefined,
  };
  actionIds.add(id);
  return action;
}

export function validateVisualPlan(value: unknown): AIGuruMathVisualPlan {
  if (!value || typeof value !== 'object') throw new Error('Visual plan must be an object.');
  const raw = value as any;

  if (raw.schemaVersion !== '1.0') throw new Error('Unsupported visual plan schema.');
  if (!raw.title || typeof raw.title !== 'string') throw new Error('Visual plan title is required.');

  let domain = String(raw.domain || 'general');
  if (!domains.has(domain)) domain = 'general';

  let grade = Number(raw.grade);
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) grade = 8;

  if (!Array.isArray(raw.nodes)) throw new Error('Invalid visual node list.');
  if (!Array.isArray(raw.steps)) throw new Error('Invalid visual step list.');
  if (raw.nodes.length > 160) raw.nodes = raw.nodes.slice(0, 160);
  if (raw.steps.length > 80) raw.steps = raw.steps.slice(0, 80);

  // --- nodes (repair instead of reject) ---
  const ids = new Set<string>();
  const nodes: any[] = [];
  for (const n of raw.nodes) {
    const cleaned = sanitizeNode(n, ids);
    if (cleaned) nodes.push(cleaned);
  }

  // --- visualActions (repair / drop bad token-moves — never throw) ---
  let visualActions: AIGuruMathVisualPlan['visualActions'] | undefined;
  if (raw.visualActions !== undefined) {
    if (!Array.isArray(raw.visualActions)) {
      visualActions = [];
    } else {
      const actionIds = new Set<string>();
      const cleaned: NonNullable<AIGuruMathVisualPlan['visualActions']> = [];
      const list = raw.visualActions.slice(0, 80);
      list.forEach((a: any, i: number) => {
        const fixed = sanitizeTokenMove(a, actionIds, i);
        if (fixed) cleaned.push(fixed);
      });
      visualActions = cleaned;
    }
  }

  // --- steps (drop references to missing nodes instead of throwing) ---
  const steps: AIGuruMathVisualPlan['steps'] = [];
  for (const s of raw.steps) {
    if (!s || typeof s.id !== 'string') continue;
    const narration = typeof s.narration === 'string' ? s.narration : String(s.narration || s.text || s.caption || '').trim() || 'Step';
    const visualIds = Array.isArray(s.visualIds)
      ? s.visualIds.filter((id: any) => typeof id === 'string' && ids.has(id))
      : [];
    steps.push({
      id: s.id,
      narration,
      visualIds,
      durationMs: Number.isFinite(s.durationMs) ? Number(s.durationMs) : undefined,
      cueWords: Array.isArray(s.cueWords) ? s.cueWords.filter((w: any) => typeof w === 'string') : undefined,
      visualChecks: Array.isArray(s.visualChecks) ? s.visualChecks : undefined,
    });
  }

  // Guarantee at least one step so the classroom has something to play
  if (steps.length === 0 && nodes.length > 0) {
    steps.push({
      id: 's1',
      narration: typeof raw.teachingGoal === 'string' ? raw.teachingGoal : 'Follow the board',
      visualIds: nodes.map((n) => n.id),
    });
  }

  const plan: AIGuruMathVisualPlan = {
    schemaVersion: '1.0',
    title: String(raw.title),
    domain: domain as MathDomain,
    grade,
    teachingGoal: typeof raw.teachingGoal === 'string' ? raw.teachingGoal : String(raw.title),
    verifiedExpression: typeof raw.verifiedExpression === 'string' ? raw.verifiedExpression : undefined,
    answer: typeof raw.answer === 'string' ? raw.answer : undefined,
    steps,
    nodes,
    teacherNotes: Array.isArray(raw.teacherNotes) ? raw.teacherNotes.filter((t: any) => typeof t === 'string') : undefined,
    visualActions,
    visualStyleId: raw.visualStyleId,
    qaProfileId: raw.qaProfileId,
    teachingStrategy: raw.teachingStrategy,
    referenceGrounding: raw.referenceGrounding,
  };

  return plan;
}
