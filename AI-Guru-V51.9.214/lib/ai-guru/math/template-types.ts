/**
 * Board template grammar ("worked solution" template).
 *
 * Reference-video grammar (used as a teaching pattern only - no content, wording, branding or artwork copied):
 *   - every transformation is its own line, each in its own colour;
 *   - an ARC over the part that was just operated on, or a CIRCLE around the isolated term;
 *   - a coloured LABEL to the right of the line ("Subtract 5 from both sides", "Simplifies to", "Therefore");
 *   - the answer boxed;
 *   - then a CHECK: substitute the answer back, show both sides agree, and state the solution.
 */
export type RowKind = 'original' | 'step' | 'result' | 'check-title' | 'check' | 'check-ok' | 'answer' | 'note';

export interface RowFocus { from: number; to: number; style: 'arc' | 'circle' }

/** Everything the board needs to draw one row. Pure data, so it can be tested without a DOM. */
export interface TemplateRowSpec {
  text: string;
  color: string;
  label?: string;
  labelColor?: string;
  focus?: RowFocus;
  boxed?: boolean;
  size?: number;
  muted?: boolean;
}

export interface TemplateRow {
  id: string;
  kind: RowKind;
  text: string;
  label?: string;
  labelMl?: string;
  focus?: RowFocus;
  /** Ordinal of this transformation (0-based) - picks the colour of a step. */
  ordinal: number;
  boxed?: boolean;
  captionEn: string;
  captionMl?: string;
}

export type SolutionFamily = 'linear' | 'quadratic' | 'simultaneous' | 'identity' | 'expression' | 'arithmetic' | 'surd';

export interface TemplateSolution {
  family: SolutionFamily;
  problem: string;
  rows: TemplateRow[];
  answerText: string;
  /** The answer was independently substituted back / re-evaluated and agrees. */
  verified: boolean;
}

// Dark-board equivalents of the reference palette: original (navy in the video), then red, blue, purple, green.
export const ORIGINAL_COLOR = '#c7d2fe';
export const STEP_COLORS = ['#f87171', '#60a5fa', '#c084fc', '#4ade80'] as const;
export const RESULT_COLOR = '#4ade80';
export const CHECK_COLOR = '#fb923c';
export const ANSWER_COLOR = '#f8fafc';
export const NOTE_COLOR = '#94a3b8';

export function rowColor(row: Pick<TemplateRow, 'kind' | 'ordinal'>): string {
  switch (row.kind) {
    case 'original': return ORIGINAL_COLOR;
    case 'result': return RESULT_COLOR;
    case 'check-title': case 'check': return CHECK_COLOR;
    case 'check-ok': return RESULT_COLOR;
    case 'answer': return ANSWER_COLOR;
    case 'note': return NOTE_COLOR;
    default: return STEP_COLORS[row.ordinal % STEP_COLORS.length];
  }
}

const sizeFor = (text: string) => (text.length > 40 ? 18 : text.length > 34 ? 20 : text.length > 28 ? 23 : 27);

export function rowToSpec(row: TemplateRow): TemplateRowSpec {
  const color = rowColor(row);
  return {
    text: row.text,
    color,
    label: row.label,
    labelColor: color,
    focus: row.focus,
    boxed: row.boxed,
    size: row.kind === 'answer' ? Math.min(sizeFor(row.text), 22) : sizeFor(row.text),
    muted: row.kind === 'note',
  };
}
