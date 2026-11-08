/**
 * Colour helpers for the 3B1B-style board.
 * Named colours keep LLM output readable ("gold", "blue"); hex is also accepted.
 * Pure functions - no DOM, safe on the server and in tests.
 */
export const NAMED_COLORS: Record<string, string> = {
  white: '#f8fafc', gray: '#94a3b8', grey: '#94a3b8',
  yellow: '#fde047', gold: '#fbbf24', orange: '#fb923c',
  red: '#f87171', pink: '#f472b6', purple: '#c084fc',
  blue: '#60a5fa', teal: '#2dd4bf', cyan: '#67e8f9', green: '#4ade80',
};

const HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** Resolve a colour name or hex to #rrggbb. Returns undefined for anything unsafe/unknown. */
export function resolveColor(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const raw = input.trim().toLowerCase();
  if (!raw) return undefined;
  if (NAMED_COLORS[raw]) return NAMED_COLORS[raw];
  const m3 = raw.match(HEX3);
  if (m3) return `#${m3[1]}${m3[1]}${m3[2]}${m3[2]}${m3[3]}${m3[3]}`;
  if (HEX6.test(raw)) return raw;
  return undefined;
}

function rgb(hex: string): [number, number, number] {
  const m = hex.match(HEX6);
  if (!m) return [248, 250, 252];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

/**
 * Linear blend of two colours. `steps` quantises t so a recolour produces only a handful of distinct
 * colours (KaTeX output is cached per colour, which keeps low-RAM phones smooth).
 */
export function lerpColor(a: string, b: string, t: number, steps = 12): string {
  const q = steps > 0 ? Math.round(Math.max(0, Math.min(1, t)) * steps) / steps : Math.max(0, Math.min(1, t));
  const [ar, ag, ab] = rgb(a), [br, bg, bb] = rgb(b);
  return `#${toHex(ar + (br - ar) * q)}${toHex(ag + (bg - ag) * q)}${toHex(ab + (bb - ab) * q)}`;
}

/** Validate a lesson-level binding map such as { a: 'gold', b: 'blue' } into { a: '#fbbf24', ... }. */
export function normalizeBindings(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const name = String(key).trim();
    const color = resolveColor(value);
    if (/^[A-Za-z]$|^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(name) && color) out[name] = color;
  }
  return out;
}
