/**
 * Heading intro: a short cinematic title for the heading of any whiteboard (V51.9.80). In the browser it is drawn as a
 * three.js scene (symbols streaming through a lit grid tunnel, the chapter's key expression flying in, the title
 * landing with a flare). Everywhere three.js cannot run it is the plain night-blue title card below, so nothing breaks.
 * The key expression comes from a fixed table, never from AI, so the maths shown is always right.
 */
import { Motion, type MotionScene } from '../reels/motion/engine';
import { tokenWidth } from '../reels/motion/metrics';
import type { Lang } from '../reels/motion/captions';
import type { Layer3d } from '../reels/motion/layer3d';

const W = 720, H = 405;
const BG = '#0b1d44';
export const INTRO_MS = 4800;

/** Keyword (lower case, any language the heading may use) → the expression that best opens that heading. */
const EXPR: Array<[RegExp, string]> = [
  [/polynomial|ബഹുപദ/, 'P(x) = 3x⁴ − 2x³ + 5x − 7'],
  [/quadratic|ദ്വിമാന|വർഗ/, 'ax² + bx + c = 0'],
  [/pair of|linear equation|simultaneous|സമവാക്യ/, 'a₁x + b₁y = c₁'],
  [/arithmetic|progression|സമാന്തര/, 'aₙ = a + (n − 1)d'],
  [/circle|വൃത്ത/, 'A = πr²'],
  [/triangle|pythag|ത്രികോണ/, 'a² + b² = c²'],
  [/fraction|ഭിന്ന/, 'a/b + c/d = (ad + bc)/bd'],
  [/statistic|mean|average|ശരാശരി|സ്ഥിതി/, 'x̄ = Σx / n'],
  [/probab|സാധ്യത/, 'P(E) = n(E) / n(S)'],
  [/trigon|ത്രികോണമിതി/, 'sin²θ + cos²θ = 1'],
  [/solid|cylinder|cone|sphere|volume|ഘന/, 'V = πr²h'],
  [/coordinate|distance|സ്ഥാന/, 'd = √((x₂−x₁)² + (y₂−y₁)²)'],
  [/ratio|percent|proportion|അനുപാത|ശതമാന/, 'a : b = c : d'],
  [/set|venn|ഗണ/, 'n(A ∪ B) = n(A) + n(B) − n(A ∩ B)'],
  [/matri|മാട്രി/, 'AB ≠ BA'],
  [/algebra|identity|ബീജ/, '(a + b)² = a² + 2ab + b²'],
];
export function expressionFor(heading: string): string | undefined {
  const h = heading.toLowerCase();
  return EXPR.find(([re]) => re.test(h))?.[1];
}

const SYMBOLS: Record<string, string[]> = {
  maths: ['∑', '√', 'π', '∫', 'x²', 'y = mx + c', 'a² + b² = c²', 'sin θ', '½', 'Δ', '∞', 'f(x)', '(a+b)²', 'x = −b/2a', '≠', '≥', 'log x', 'θ', '3/4', 'n!'],
  science: ['H₂O', 'CO₂', 'E = mc²', 'v = u + at', 'F = ma', 'pH', 'Na⁺', 'DNA', 'ATP', 'O₂', 'λ', 'Ω', 'g = 9.8', 'e⁻', 'ΔT', '°C', 'Fe', 'CH₄', 'ρ = m/V', 'P = F/A'],
  general: ['A', 'B', 'C', '1', '2', '3', '?', '!', '✓', '★', '+', '=', '→', '“ ”', '∞', '1947', '1950', '#', '&', '@'],
};
export function symbolsFor(subject: string | undefined): string[] {
  const k = (subject ?? '').toLowerCase();
  if (SYMBOLS[k]) return SYMBOLS[k];
  if (/sci|phys|chem|bio|ശാസ്ത്ര|ഭൗതിക|രസതന്ത്ര|ജീവ/.test(k)) return SYMBOLS.science;
  if (/social|histor|geograph|civic|econom|english|malayalam|hindi|സാമൂഹ്യ|ചരിത്ര|ഭാഷ/.test(k)) return SYMBOLS.general;
  return SYMBOLS.maths;
}

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const fit = (text: string, size: number, maxW: number, weight = '700') => { let s = size; while (s > 14 && tokenWidth(text, s, weight) > maxW) s -= 2; return s; };

export interface HeadingIntroOptions { heading: string; sub?: string; lang: Lang; title: string; subject?: string; /** 0–5: which of the six looks (the class gives neighbouring headings different ones) */ variant?: number }

/** The intro as one scene: the 3D layer plus a 2D title card that shows when 3D is unavailable. */
export function headingIntroScene(o: HeadingIntroOptions): MotionScene {
  const m = new Motion(o.title, W, H);
  m.fixView(W / 2, W);
  m.poly('bg', [[-80, -80], [W + 80, -80], [W + 80, H + 80], [-80, H + 80]], 0, { color: BG, fill: BG, fillAlpha: 1, dur: 1, z: -1, silent: true, background: true });
  const bg = m.get('bg'); bg.alpha.segs = []; bg.alpha.init = 1; bg.draw.segs = []; bg.draw.init = 1; bg.fillAlpha.segs = []; bg.fillAlpha.init = 1;
  const shown = o.lang === 'en' ? o.heading.toUpperCase() : o.heading;
  let t = m.step(o.heading, 300, 3600);
  const size = fit(shown, 62, 620);
  m.text('title', shown, W / 2, 190, { size, color: '#ffffff', weight: '700', z: 4 });
  t = m.write('title', t + 300, 0, 900);
  if (o.sub) { m.text('sub', o.sub, W / 2, 190 + size * 0.9, { size: fit(o.sub, 24, 620, '400'), color: '#9fc2ff', weight: '400', z: 4 }); t = m.appear('sub', t + 200, 0); }
  m.sound(150, 'whoosh'); m.sound(2400, 'ding');
  m.hold(Math.max(t + 600, INTRO_MS - 400));
  const scene = m.build(400);
  const expr = expressionFor(`${o.heading} ${o.title}`);
  const layer: Layer3d = { kind: 'heading', heading: shown, sub: o.sub, expr, symbols: symbolsFor(o.subject), accent: '#ffd54a', seed: hash(o.heading), lang: o.lang, variant: o.variant };
  scene.layer3d = layer;
  scene.durationMs = Math.max(scene.durationMs, INTRO_MS);
  return scene;
}
