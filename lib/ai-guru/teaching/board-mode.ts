/**
 * The selected teaching template decides HOW the class is shown on the (single) whiteboard.
 *
 *  - 'derivation': symbolic / numeric work. The board is an ordered derivation column
 *    (problem, starting line, one operation at a time, answer) - see math/derivation-beat.ts.
 *  - 'visual':     constructive / graphical work (geometry, graphs, statistics ...). The board
 *    plays the lesson's authored visual actions (shapes, lines, labels) in order.
 *
 * With no template the default is 'derivation', the safe grammar for worked solutions.
 */
export type BoardMode = 'derivation' | 'visual';

const VISUAL_DOMAINS = new Set([
  'geometry', '3d_geometry', 'coordinate_geometry', 'functions', 'trigonometry',
  'statistics', 'probability', 'mensuration',
]);

export function boardModeFor(decision?: { domain?: string; referral?: { domains?: string[] } } | null): BoardMode {
  const domain = decision?.domain;
  if (domain && VISUAL_DOMAINS.has(domain)) return 'visual';
  return 'derivation';
}

export function boardModeLabel(mode: BoardMode): string {
  return mode === 'visual' ? 'Visual construction' : 'Step-by-step derivation';
}
