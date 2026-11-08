/** Atoms, molecules and the solar system for the 3-D lab. Pure data and maths; the geometry is checked in tests. */
export type V3 = [number, number, number];

export interface Element { z: number; symbol: string; en: string; ml: string; shells: number[]; colour: string }
const NAMES: Array<[string, string, string, string]> = [
  ['H', 'Hydrogen', 'ഹൈഡ്രജൻ', '#e2e8f0'], ['He', 'Helium', 'ഹീലിയം', '#fde68a'], ['Li', 'Lithium', 'ലിഥിയം', '#c084fc'], ['Be', 'Beryllium', 'ബെറിലിയം', '#86efac'], ['B', 'Boron', 'ബോറോൺ', '#fdba74'],
  ['C', 'Carbon', 'കാർബൺ', '#94a3b8'], ['N', 'Nitrogen', 'നൈട്രജൻ', '#60a5fa'], ['O', 'Oxygen', 'ഓക്സിജൻ', '#f87171'], ['F', 'Fluorine', 'ഫ്ലൂറിൻ', '#a3e635'], ['Ne', 'Neon', 'നിയോൺ', '#f0abfc'],
  ['Na', 'Sodium', 'സോഡിയം', '#a78bfa'], ['Mg', 'Magnesium', 'മഗ്നീഷ്യം', '#4ade80'], ['Al', 'Aluminium', 'അലുമിനിയം', '#cbd5e1'], ['Si', 'Silicon', 'സിലിക്കൺ', '#d6b98c'], ['P', 'Phosphorus', 'ഫോസ്ഫറസ്', '#fb923c'],
  ['S', 'Sulphur', 'സൾഫർ', '#facc15'], ['Cl', 'Chlorine', 'ക്ലോറിൻ', '#34d399'], ['Ar', 'Argon', 'ആർഗോൺ', '#e879f9'], ['K', 'Potassium', 'പൊട്ടാസ്യം', '#8b5cf6'], ['Ca', 'Calcium', 'കാൽസ്യം', '#d4d4d8'],
];
/** Electrons per shell for atoms 1 to 20: fill 2, 8, 8, then 2 (the school-level rule). */
export function shellsOf(z: number): number[] {
  const cap = [2, 8, 8, 2]; const out: number[] = []; let left = z;
  for (const c of cap) { if (left <= 0) break; const n = Math.min(c, left); out.push(n); left -= n; }
  return out;
}
export const ELEMENTS: Element[] = NAMES.map(([symbol, en, ml, colour], i) => ({ z: i + 1, symbol, en, ml, shells: shellsOf(i + 1), colour }));

export interface Molecule { id: string; formula: string; name: { en: string; ml: string }; atoms: Array<{ el: string; at: V3 }>; bonds: Array<{ a: number; b: number; order: 1 | 2 }>; angle?: number; note: { en: string; ml: string } }
const rad = (d: number) => (d * Math.PI) / 180;
const bent = (len: number, deg: number): V3[] => [[len * Math.sin(rad(deg / 2)), -len * Math.cos(rad(deg / 2)), 0], [-len * Math.sin(rad(deg / 2)), -len * Math.cos(rad(deg / 2)), 0]];
const tet = (len: number): V3[] => { const k = len / Math.sqrt(3); return [[k, k, k], [k, -k, -k], [-k, k, -k], [-k, -k, k]]; };
const pyramid = (len: number, deg: number): V3[] => {
  // three bonds equally spaced round the axis, each making `deg` with the others
  const cosA = Math.cos(rad(deg));
  // angle theta from the axis: cos(deg) = cos^2(t) + sin^2(t) cos(120)
  const c2 = (cosA + 0.5) / 1.5; const ct = Math.sqrt(c2), st = Math.sqrt(1 - c2);
  return [0, 120, 240].map((p) => [len * st * Math.cos(rad(p)), len * ct * -1, len * st * Math.sin(rad(p))] as V3);
};
export const MOLECULES: Molecule[] = [
  { id: 'h2o', formula: 'H₂O', name: { en: 'Water', ml: 'ജലം' }, angle: 104.5, atoms: [{ el: 'O', at: [0, 0, 0] }, ...bent(0.96, 104.5).map((at) => ({ el: 'H', at }))], bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }], note: { en: 'Bent: the two H atoms make an angle of about 104.5° at O.', ml: 'വളഞ്ഞ ആകൃതി: രണ്ട് H ആറ്റങ്ങൾ O-യിൽ ഏകദേശം 104.5° കോണുണ്ടാക്കുന്നു.' } },
  { id: 'co2', formula: 'CO₂', name: { en: 'Carbon dioxide', ml: 'കാർബൺ ഡൈ ഓക്സൈഡ്' }, angle: 180, atoms: [{ el: 'C', at: [0, 0, 0] }, { el: 'O', at: [1.16, 0, 0] }, { el: 'O', at: [-1.16, 0, 0] }], bonds: [{ a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 2 }], note: { en: 'Straight line: two double bonds, 180° apart.', ml: 'നേർരേഖ: രണ്ട് ദ്വിബന്ധനങ്ങൾ, 180° അകലെ.' } },
  { id: 'ch4', formula: 'CH₄', name: { en: 'Methane', ml: 'മീഥെയ്ൻ' }, angle: 109.5, atoms: [{ el: 'C', at: [0, 0, 0] }, ...tet(1.09).map((at) => ({ el: 'H', at }))], bonds: [1, 2, 3, 4].map((b) => ({ a: 0, b, order: 1 as const })), note: { en: 'Tetrahedral: four H atoms, every bond angle about 109.5°.', ml: 'ചതുഷ്ഫലകം: നാല് H ആറ്റങ്ങൾ, എല്ലാ കോണും ഏകദേശം 109.5°.' } },
  { id: 'nh3', formula: 'NH₃', name: { en: 'Ammonia', ml: 'അമോണിയ' }, angle: 107, atoms: [{ el: 'N', at: [0, 0, 0] }, ...pyramid(1.01, 107).map((at) => ({ el: 'H', at }))], bonds: [1, 2, 3].map((b) => ({ a: 0, b, order: 1 as const })), note: { en: 'Pyramid: three H atoms below N, bond angle about 107°.', ml: 'പിരമിഡ് ആകൃതി: N-ന് താഴെ മൂന്ന് H ആറ്റങ്ങൾ, കോൺ ഏകദേശം 107°.' } },
  { id: 'o2', formula: 'O₂', name: { en: 'Oxygen', ml: 'ഓക്സിജൻ' }, atoms: [{ el: 'O', at: [0.6, 0, 0] }, { el: 'O', at: [-0.6, 0, 0] }], bonds: [{ a: 0, b: 1, order: 2 }], note: { en: 'Two oxygen atoms joined by a double bond.', ml: 'ദ്വിബന്ധനം കൊണ്ട് ബന്ധിച്ച രണ്ട് ഓക്സിജൻ ആറ്റങ്ങൾ.' } },
];
export const bondAngle = (m: Molecule, centre = 0, i = 1, j = 2): number => {
  const c = m.atoms[centre].at, p = m.atoms[i].at, q = m.atoms[j].at;
  const u = p.map((x, k) => x - c[k]), v = q.map((x, k) => x - c[k]);
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  return (Math.acos(dot / (Math.hypot(...(u as V3)) * Math.hypot(...(v as V3)))) * 180) / Math.PI;
};

export interface Planet { id: string; en: string; ml: string; au: number; years: number; radius: number; colour: string }
/** Real orbit sizes (AU), periods (years) and sizes (Earth = 1). */
export const PLANETS: Planet[] = [
  { id: 'mercury', en: 'Mercury', ml: 'ബുധൻ', au: 0.387, years: 0.241, radius: 0.383, colour: '#a8a29e' },
  { id: 'venus', en: 'Venus', ml: 'ശുക്രൻ', au: 0.723, years: 0.615, radius: 0.949, colour: '#fcd34d' },
  { id: 'earth', en: 'Earth', ml: 'ഭൂമി', au: 1, years: 1, radius: 1, colour: '#38bdf8' },
  { id: 'mars', en: 'Mars', ml: 'ചൊവ്വ', au: 1.524, years: 1.881, radius: 0.532, colour: '#f87171' },
  { id: 'jupiter', en: 'Jupiter', ml: 'വ്യാഴം', au: 5.203, years: 11.86, radius: 10.97, colour: '#fdba74' },
  { id: 'saturn', en: 'Saturn', ml: 'ശനി', au: 9.537, years: 29.46, radius: 9.14, colour: '#fde68a' },
  { id: 'uranus', en: 'Uranus', ml: 'യുറാനസ്', au: 19.19, years: 84.01, radius: 3.98, colour: '#67e8f9' },
  { id: 'neptune', en: 'Neptune', ml: 'നെപ്റ്റ്യൂൺ', au: 30.07, years: 164.8, radius: 3.86, colour: '#818cf8' },
];
/** Drawing scale: orbit radius grows with the square root of the real distance so Neptune still fits next to Mercury. */
export const orbitRadius = (au: number) => 3 * Math.sqrt(au);
export const planetSize = (r: number) => 0.12 + 0.1 * Math.sqrt(r);
/** Angle (radians) of a planet after `years` of simulated time, starting at 0. */
export const orbitAngle = (p: Planet, years: number) => (2 * Math.PI * years) / p.years;
