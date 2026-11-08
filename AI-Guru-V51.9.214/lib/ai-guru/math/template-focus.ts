import type { RowFocus } from './template-types';

/**
 * Which part of the new line should carry the arc / circle, worked out by comparing it with the line
 * above (the reference video marks exactly the part that changed):
 *   - left side grew by an operation ("2x + 5" -> "2x + 5 - 5")   -> ARC over the added operation;
 *   - left side became a single term ("2x = 15")                   -> CIRCLE around that term;
 *   - variable isolated ("x = 15 / 2")                             -> ARC over the right side.
 */
export function computeFocus(prev: string | undefined, next: string): RowFocus | undefined {
  const f = rawFocus(prev, next);
  // A tiny arc over a single digit is visual noise, not guidance.
  if (f && f.style === 'arc' && f.to - f.from < 3) return undefined;
  return f;
}

function rawFocus(prev: string | undefined, next: string): RowFocus | undefined {
  if (!prev || !next || prev === next) return undefined;
  const pSides = prev.split(' = ');
  const nSides = next.split(' = ');
  const pl = pSides[0];
  const nl = nSides[0];

  if (nl !== pl && nl.startsWith(pl) && nl.length > pl.length) {
    const appended = nl.slice(pl.length); // e.g. " − 5" or " / 2"
    const mulDiv = /^\s[/×*]\s/.test(appended);
    const from = mulDiv ? pl.length + 1 : Math.max(0, pl.lastIndexOf(' ') + 1);
    return { from, to: nl.length, style: 'arc' };
  }

  const singleTerm = (s: string) => s.length > 0 && !/\s/.test(s);
  if (nl !== pl && singleTerm(nl)) {
    if (/^[A-Za-z]$/.test(nl) && nSides.length > 1) {
      const from = nl.length + 3;
      return { from, to: next.length, style: 'arc' };
    }
    return { from: 0, to: nl.length, style: 'circle' };
  }
  return undefined;
}
