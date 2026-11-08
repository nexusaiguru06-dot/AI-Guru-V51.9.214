import type { VisualAction } from '../lesson/types';
import { actionSvg } from '../visual/action-svg';
import { CANVAS } from './geom';
import type { VerifyIssue, VerifyResult } from './types';

/**
 * Dry run for generated visuals (the counterpart of MathVizAI's "render it once before you trust it").
 * It checks structure, geometry, references and timing, and really runs every action through the board's
 * SVG renderer, so a visual that cannot be drawn is caught at generation time, not in front of a student.
 */
const ALLOWED = new Set(['write', 'latex', 'shape', 'line', 'chart', 'highlight', 'move', 'transform', 'erase', 'pause']);
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

export interface VerifyOptions {
  /** Ids drawn before these actions (e.g. earlier steps), so highlight/erase/move targets resolve. */
  knownIds?: Iterable<string>;
  /** Narration length; used to check that the animation fits the speech (timing contract). */
  narrationMs?: number;
  /** Hard limit outside the board (error) vs soft safe-area margin (warning). */
  hardOutside?: number;
}

export function verifyVisualActions(input: unknown, opts: VerifyOptions = {}): VerifyResult {
  const issues: VerifyIssue[] = [];
  const add = (severity: 'error' | 'warning', code: string, message: string, actionId?: string) => issues.push({ severity, code, message, actionId });
  if (!Array.isArray(input)) {
    add('error', 'NOT_ARRAY', 'Visuals must be an array of VisualAction objects.');
    return finish(issues);
  }
  const ids = new Set<string>(opts.knownIds ?? []);
  const seen = new Set<string>();
  const hard = opts.hardOutside ?? 60, m = CANVAS.margin;
  const inBoard = (id: string, what: string, x: number, y: number) => {
    if (x < -hard || x > CANVAS.width + hard || y < -hard || y > CANVAS.height + hard) add('error', 'OUT_OF_BOARD', `${what} at (${Math.round(x)}, ${Math.round(y)}) is outside the 1000x700 board.`, id);
    else if (x < m || x > CANVAS.width - m || y < m || y > CANVAS.height - m) add('warning', 'OUTSIDE_SAFE_AREA', `${what} at (${Math.round(x)}, ${Math.round(y)}) is inside the outer ${m}px margin and may be cut off.`, id);
  };
  let totalMs = 0;
  const texts: Array<{ id: string; x: number; y: number; content: string }> = [];

  input.forEach((raw, i) => {
    const a = raw as Record<string, any>;
    if (!a || typeof a !== 'object') { add('error', 'NOT_OBJECT', `Action #${i + 1} is not an object.`); return; }
    const id = typeof a.id === 'string' ? a.id : '';
    if (!id.trim()) add('error', 'MISSING_ID', `Action #${i + 1} has no id.`);
    else if (seen.has(id)) add('error', 'DUPLICATE_ID', `Duplicate action id "${id}".`, id);
    seen.add(id);
    if (!ALLOWED.has(String(a.type))) { add('error', 'UNKNOWN_TYPE', `Unsupported action type "${a.type}".`, id); return; }
    const dur = a.durationMs;
    if (dur != null && (!finite(dur) || dur < 0)) add('error', 'BAD_DURATION', 'durationMs must be a non-negative number.', id);
    else if (finite(dur) && dur > 12000) add('warning', 'LONG_ACTION', `Action lasts ${dur} ms; consider splitting it.`, id);
    totalMs += finite(dur) ? dur : a.type === 'pause' ? 500 : 600;

    switch (a.type) {
      case 'write': case 'latex': {
        const content = String(a.type === 'latex' ? a.latex ?? '' : a.content ?? '');
        if (!content.trim()) add('error', 'EMPTY_TEXT', 'Text action has no content.', id);
        if (content.length > 240) add('warning', 'LONG_TEXT', 'Text longer than 240 characters: put long explanations in the caption, not on the board.', id);
        if (a.placement === 'absolute') {
          if (!finite(a.x) || !finite(a.y)) add('error', 'MISSING_POSITION', 'Absolute label needs numeric x and y.', id);
          else { inBoard(id, 'Label', a.x, a.y); texts.push({ id, x: a.x, y: a.y, content }); }
        }
        break;
      }
      case 'shape': {
        for (const k of ['x', 'y', 'width', 'height']) if (!finite(a[k])) add('error', 'MISSING_FIELD', `Shape needs numeric "${k}".`, id);
        if (finite(a.width) && finite(a.height)) {
          if (a.width <= 0 || a.height <= 0) add('error', 'BAD_SIZE', 'Shape width/height must be positive.', id);
          else { inBoard(id, 'Shape corner', a.x, a.y); inBoard(id, 'Shape corner', a.x + a.width, a.y + a.height); }
        }
        if (!['rectangle', 'circle', 'triangle'].includes(String(a.shape))) add('error', 'BAD_SHAPE', `Unknown shape "${a.shape}".`, id);
        break;
      }
      case 'line': {
        for (const k of ['startX', 'startY', 'endX', 'endY']) if (!finite(a[k])) add('error', 'MISSING_FIELD', `Line needs numeric "${k}".`, id);
        if (['startX', 'startY', 'endX', 'endY'].every((k) => finite(a[k]))) {
          if (a.startX === a.endX && a.startY === a.endY) add('warning', 'ZERO_LENGTH_LINE', 'Line has zero length.', id);
          inBoard(id, 'Line start', a.startX, a.startY); inBoard(id, 'Line end', a.endX, a.endY);
        }
        break;
      }
      case 'chart': {
        const s = a.data?.series;
        if (!Array.isArray(s) || !s.length || !s.every((r: unknown) => Array.isArray(r) && r.every(finite))) add('error', 'BAD_CHART_DATA', 'Chart needs data.series as arrays of numbers.', id);
        break;
      }
      case 'highlight': case 'erase': case 'move': {
        const t = String(a.targetId ?? '');
        if (!t) add(a.type === 'highlight' && finite(a.x) && finite(a.y) ? 'warning' : 'error', 'MISSING_TARGET', `${a.type} needs a targetId.`, id);
        else if (!ids.has(t) && !seen.has(t)) add('warning', 'DANGLING_TARGET', `${a.type} targets "${t}" which has not been drawn before it.`, id);
        if (a.type === 'move') for (const k of ['fromX', 'fromY', 'toX', 'toY']) if (!finite(a[k])) add('error', 'MISSING_FIELD', `move needs numeric "${k}".`, id);
        break;
      }
      case 'transform': {
        for (const k of ['fromId', 'toId']) if (!String(a[k] ?? '')) add('error', 'MISSING_FIELD', `transform needs "${k}".`, id);
        break;
      }
      case 'pause':
        if (!finite(a.durationMs)) add('error', 'MISSING_FIELD', 'pause needs durationMs.', id);
        break;
    }
    if (id) ids.add(id);

    // Real dry run: the board's own renderer must be able to turn the action into SVG.
    try {
      const svg = actionSvg(a as VisualAction);
      if (typeof svg !== 'string' || !svg.startsWith('<svg')) add('error', 'RENDER_FAILED', 'Renderer did not return SVG.', id);
      else if (/NaN|undefined|Infinity/.test(svg)) add('error', 'RENDER_BAD_NUMBER', 'Rendered SVG contains NaN/undefined/Infinity.', id);
    } catch (e) { add('error', 'RENDER_THROW', `Renderer threw: ${e instanceof Error ? e.message : String(e)}`, id); }
  });

  // Labels drawn on top of each other are unreadable.
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const p = texts[i], q = texts[j];
    if (Math.abs(p.x - q.x) < 24 && Math.abs(p.y - q.y) < 20 && p.content !== q.content) add('warning', 'OVERLAPPING_LABELS', `Labels "${p.content}" and "${q.content}" overlap.`, q.id);
  }

  if (opts.narrationMs && opts.narrationMs > 0) {
    if (totalMs > opts.narrationMs * 1.25) add('warning', 'TOO_SLOW', `Animation needs ${totalMs} ms but the narration is ${opts.narrationMs} ms: call fitTiming().`);
  }
  return finish(issues);
}

function finish(issues: VerifyIssue[]): VerifyResult {
  const errors = issues.filter((i) => i.severity === 'error');
  return { ok: errors.length === 0, errors, warnings: issues.filter((i) => i.severity === 'warning'), issues };
}

/** One line per problem, for retry prompts and QA messages. */
export function formatIssues(issues: VerifyIssue[], max = 8): string {
  return issues.slice(0, max).map((i) => `- [${i.severity}] ${i.code}${i.actionId ? ` (${i.actionId})` : ''}: ${i.message}`).join('\n');
}

/* ------------------------------ timing contract -------------------------------- */

/** Rough speaking time. Malayalam is slower than English per word. */
export function estimateSpeechMs(text: string, lang: 'english' | 'malayalam' = 'english'): number {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.round((words / (lang === 'malayalam' ? 1.9 : 2.5)) * 1000);
}

const WEIGHT: Record<string, number> = { line: 1.2, shape: 1.4, write: 0.8, latex: 0.9, chart: 2, highlight: 0.9, move: 1.2, transform: 1.2, erase: 0.5, pause: 0 };

/**
 * Timing contract: make the whole animation last exactly as long as the narration of its step.
 * Durations are scaled by action weight and kept within 120..4000 ms; pauses are left alone.
 */
export function fitTiming<T extends VisualAction>(actions: T[], totalMs: number): T[] {
  const timed = actions.filter((a) => a.type !== 'pause');
  const fixed = actions.filter((a) => a.type === 'pause').reduce((s, a) => s + ((a as any).durationMs || 0), 0);
  const budget = Math.max(timed.length * 120, totalMs - fixed);
  const weights = timed.map((a) => WEIGHT[a.type] ?? 1);
  const sum = weights.reduce((s, w) => s + w, 0) || 1;
  let k = 0;
  return actions.map((a) => {
    if (a.type === 'pause') return a;
    const ms = Math.round(Math.min(4000, Math.max(120, (budget * weights[k++]) / sum)));
    return { ...a, durationMs: ms } as T;
  });
}
