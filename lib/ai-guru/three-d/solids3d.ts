/**
 * 3-D solids for the Solid Lab. The numbers (volume, surface area) come from the same `solidFacts` the Solids DNA
 * board uses, so the 3-D model and the lesson can never disagree. Pure maths, no three.js here.
 */
import type { SolidKind, SolidPlan } from '../motion-class/dna/types';
import { approx, solidFacts, solidProblem, valText, type Val } from '../motion-class/dna/s-math';

export interface SolidDims { a?: number; b?: number; h?: number; r?: number }
export interface SolidParam { key: 'a' | 'b' | 'h' | 'r'; label: { en: string; ml: string }; min: number; max: number }

export const SOLID_INFO: Record<SolidKind, { name: { en: string; ml: string }; defaults: Required<Pick<SolidPlan, 'solid'>> & SolidDims; params: SolidParam[] }> = {
  cuboid: { name: { en: 'Cuboid', ml: 'സമചതുരസ്തംഭം (ക്യൂബോയ്ഡ്)' }, defaults: { solid: 'cuboid', a: 6, b: 4, h: 3 }, params: [{ key: 'a', label: { en: 'length', ml: 'നീളം' }, min: 2, max: 12 }, { key: 'b', label: { en: 'width', ml: 'വീതി' }, min: 2, max: 12 }, { key: 'h', label: { en: 'height', ml: 'ഉയരം' }, min: 2, max: 12 }] },
  prism: { name: { en: 'Triangular prism', ml: 'ത്രികോണ പ്രിസം' }, defaults: { solid: 'prism', a: 3, b: 4, h: 8 }, params: [{ key: 'a', label: { en: 'leg a', ml: 'വശം a' }, min: 3, max: 12 }, { key: 'b', label: { en: 'leg b', ml: 'വശം b' }, min: 3, max: 12 }, { key: 'h', label: { en: 'length', ml: 'നീളം' }, min: 2, max: 14 }] },
  cylinder: { name: { en: 'Cylinder', ml: 'സിലിണ്ടർ' }, defaults: { solid: 'cylinder', r: 3, h: 8 }, params: [{ key: 'r', label: { en: 'radius', ml: 'ആരം' }, min: 2, max: 8 }, { key: 'h', label: { en: 'height', ml: 'ഉയരം' }, min: 2, max: 14 }] },
  cone: { name: { en: 'Cone', ml: 'കോൺ (സ്തൂപിക)' }, defaults: { solid: 'cone', r: 3, h: 4 }, params: [{ key: 'r', label: { en: 'radius', ml: 'ആരം' }, min: 2, max: 8 }, { key: 'h', label: { en: 'height', ml: 'ഉയരം' }, min: 2, max: 14 }] },
  sphere: { name: { en: 'Sphere', ml: 'ഗോളം' }, defaults: { solid: 'sphere', r: 4 }, params: [{ key: 'r', label: { en: 'radius', ml: 'ആരം' }, min: 2, max: 10 }] },
};

/** A plan for the maths helpers (one "show" step is all they need). */
export const planOf = (kind: SolidKind, d: SolidDims): SolidPlan => ({ solid: kind, ...d, unit: 'cm', steps: [{ op: 'show', say: { en: '', ml: '' } }] } as SolidPlan);

export interface Facts3d { base: string; volume: string; volumeApprox: string; surface: string; surfaceApprox: string; slant: number; problem: string | null }
const t = (v: Val) => valText(v), ap = (v: Val) => (v.pi ? approx(v) : '');
/** Volume, surface area (exact, with the π decimal beside it) or the reason the sizes cannot be drawn. */
export function facts3d(kind: SolidKind, d: SolidDims): Facts3d {
  const plan = planOf(kind, d);
  const problem = solidProblem(plan, 'solid');
  if (problem) return { base: '', volume: '', volumeApprox: '', surface: '', surfaceApprox: '', slant: 0, problem };
  const f = solidFacts(plan);
  return { base: t(f.base), volume: t(f.volume), volumeApprox: ap(f.volume), surface: t(f.surface), surfaceApprox: ap(f.surface), slant: f.slant, problem: null };
}

export interface Section { shape: 'rectangle' | 'triangle' | 'circle' | 'point'; text: { en: string; ml: string }; area: number }
const r2 = (x: number) => Math.round(x * 100) / 100;
/** The flat cut made parallel to the base at fraction `t` (0 = bottom, 1 = top) of the height, with its area. */
export function sectionAt(kind: SolidKind, d: SolidDims, tt: number): Section {
  const f = Math.max(0, Math.min(1, tt));
  const { a = 0, b = 0, r = 0 } = d;
  switch (kind) {
    case 'cuboid': return { shape: 'rectangle', area: a * b, text: { en: `A rectangle ${a} × ${b}, the same as the base: area ${a * b} sq cm`, ml: `${a} × ${b} ചതുരം, അടിത്തറയ്ക്ക് തുല്യം: വിസ്തീർണം ${a * b} ച.സെ.മീ` } };
    case 'prism': { const w = r2(a * (1 - f)), A = r2(w * (d.h ?? 0)); return f >= 1 ? { shape: 'point', area: 0, text: { en: 'At the top edge the cut is just a line', ml: 'മുകളിലെ അരികിൽ മുറിവ് ഒരു വരമാത്രം' } } : { shape: 'rectangle', area: A, text: { en: `A rectangle ${w} × ${d.h}: area ${A} sq cm. The prism stands on a leg, so the cut gets narrower going up.`, ml: `${w} × ${d.h} ചതുരം: വിസ്തീർണം ${A} ച.സെ.മീ. പ്രിസം ഒരു വശത്ത് നിൽക്കുന്നതിനാൽ മുകളിലേക്ക് ഇടുങ്ങുന്നു.` } }; }
    case 'cylinder': { const A = r2(Math.PI * r * r); return { shape: 'circle', area: A, text: { en: `A circle of radius ${r}, the same as the base: area about ${A} sq cm`, ml: `ആരം ${r} ഉള്ള വൃത്തം, അടിത്തറയ്ക്ക് തുല്യം: വിസ്തീർണം ഏകദേശം ${A} ച.സെ.മീ` } }; }
    case 'cone': { const rr = r2(r * (1 - f)); const A = r2(Math.PI * rr * rr); return f >= 1 ? { shape: 'point', area: 0, text: { en: 'At the tip the cut is just a point', ml: 'അഗ്രത്തിൽ മുറിവ് ഒരു ബിന്ദു മാത്രം' } } : { shape: 'circle', area: A, text: { en: `A circle of radius ${rr}: area about ${A} sq cm. Higher up, the circle shrinks.`, ml: `ആരം ${rr} ഉള്ള വൃത്തം: വിസ്തീർണം ഏകദേശം ${A} ച.സെ.മീ. മുകളിലേക്ക് പോകുംതോറും ചെറുതാകുന്നു.` } }; }
    case 'sphere': { const z = (f * 2 - 1) * r; const rr = r2(Math.sqrt(Math.max(0, r * r - z * z))); const A = r2(Math.PI * rr * rr); return rr === 0 ? { shape: 'point', area: 0, text: { en: 'At the pole the cut is just a point', ml: 'ധ്രുവത്തിൽ മുറിവ് ഒരു ബിന്ദു മാത്രം' } } : { shape: 'circle', area: A, text: { en: `A circle of radius ${rr}: area about ${A} sq cm. The biggest circle is through the centre.`, ml: `ആരം ${rr} ഉള്ള വൃത്തം: വിസ്തീർണം ഏകദേശം ${A} ച.സെ.മീ. കേന്ദ്രത്തിലൂടെയുള്ളതാണ് ഏറ്റവും വലുത്.` } }; }
  }
}
