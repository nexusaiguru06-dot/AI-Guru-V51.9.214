export interface DerivationLine {
  id: string;
  expression: string;
  lineIndex: number;
  y: number;
  derivedFromId?: string;
  persistent: true;
}

/**
 * Builds the Manim-style cumulative derivation stack used by AI Guru.
 * Completed mathematical states remain visible; the newest state is added
 * underneath the previous state instead of replacing it.
 */
export function buildPersistentDerivation(
  expressions: string[],
  options: { startY?: number; lineGap?: number; idPrefix?: string } = {},
): DerivationLine[] {
  const startY = options.startY ?? 100;
  const lineGap = options.lineGap ?? 105;
  const idPrefix = options.idPrefix ?? 'derivation';

  return expressions.filter(Boolean).map((expression, index) => ({
    id: `${idPrefix}-${index + 1}`,
    expression,
    lineIndex: index,
    y: startY + index * lineGap,
    derivedFromId: index > 0 ? `${idPrefix}-${index}` : undefined,
    persistent: true as const,
  }));
}

// Design invariant: derivation lines are cumulative by default. A renderer may
// erase a line only when an explicit VisualAction erase is present.
