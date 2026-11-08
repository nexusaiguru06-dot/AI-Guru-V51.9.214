/**
 * V51.9.149 — Biology agent · template "punnett": Mendel's crosses on a Punnett square. One trait (Tt × Tt, 2 × 2)
 * or two traits (RrYy × RrYy, 4 × 4). The parents, their gametes, every box of the square, and the genotype and
 * phenotype ratios are all computed here from the parents' genotypes.
 */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { isBi, label, newScene, pick, rect, ring, sparkle, uid, type Bi } from '../../kit';
import type { AgentTemplate } from '../../types';

export interface Trait {
  /** The gene letter, e.g. "T" (dominant = capital, recessive = small). */
  letter: string;
  dominant: Bi;
  recessive: Bi;
}
export interface PunnettPlan {
  traits: Trait[];
  /** e.g. "Tt" or "RrYy" — one pair of letters per trait, in the order of traits. */
  parent1: string;
  parent2: string;
  steps: Array<{ op: 'show' | 'gametes' | 'grid' | 'ratio'; say: Bi }>;
}
const ORDER = ['show', 'gametes', 'grid', 'ratio'] as const;

const pairs = (g: string) => g.match(/../g) ?? [];
/** The gametes of a genotype: one letter from each pair, every combination ("RrYy" → RY, Ry, rY, ry). */
export function gametes(g: string): string[] {
  return pairs(g).reduce<string[]>((acc, pair) => acc.flatMap((a) => [...new Set(pair.split(''))].map((x) => a + x)), ['']);
}
/** A genotype written the usual way: capital first in each pair ("tT" → "Tt"). */
const tidy = (g: string) => pairs(g).map((p) => (p[0] === p[0].toLowerCase() && p[1] !== p[1].toLowerCase() ? p[1] + p[0] : p)).join('');
const combine = (a: string, b: string) => tidy(a.split('').map((x, i) => x + b[i]).join(''));

export function punnettFacts(p: PunnettPlan) {
  const g1 = gametes(p.parent1);
  const g2 = gametes(p.parent2);
  const cells = g2.map((b) => g1.map((a) => combine(a, b)));
  const flat = cells.flat();
  const count = (xs: string[]) => { const mm = new Map<string, number>(); for (const x of xs) mm.set(x, (mm.get(x) ?? 0) + 1); return mm; };
  const caps = (g: string) => g.replace(/[a-z]/g, '').length;
  const geno = [...count(flat)].sort((a, b) => b[1] - a[1] || caps(b[0]) - caps(a[0]));
  /** phenotype: for each trait, dominant when a capital letter is present */
  const phenoKey = (g: string) => pairs(g).map((pp) => (pp !== pp.toLowerCase() ? 'D' : 'r')).join('');
  const pheno = [...count(flat.map(phenoKey))].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const g = (xs: Array<[string, number]>) => xs.reduce((acc, [, n]) => gcd(acc, n), 0) || 1;
  return { g1, g2, cells, geno: geno.map(([k, n]) => [k, n / g(geno)] as [string, number]), pheno: pheno.map(([k, n]) => [k, n / g(pheno)] as [string, number]), total: flat.length };
}

export function validatePunnett(x: unknown): string[] {
  const p = x as PunnettPlan;
  if (!p || typeof p !== 'object') return ['plan is not an object'];
  const e: string[] = [];
  if (!Array.isArray(p.traits) || p.traits.length < 1 || p.traits.length > 2) return ['traits: 1 or 2'];
  p.traits.forEach((tr, i) => {
    if (!tr || typeof tr.letter !== 'string' || !/^[A-Z]$/.test(tr.letter)) e.push(`traits[${i}].letter is one capital letter`);
    if (!isBi(tr?.dominant) || !isBi(tr?.recessive)) e.push(`traits[${i}] needs dominant and recessive names {en, ml}`);
  });
  if (e.length) return e;
  const ok = (g: unknown) => typeof g === 'string' && g.length === 2 * p.traits.length && pairs(g).every((pp, i) => pp.toUpperCase() === p.traits[i].letter.repeat(2));
  if (!ok(p.parent1)) e.push(`parent1 is ${p.traits.length * 2} letters, a pair per trait in order (e.g. ${p.traits.map((t) => t.letter + t.letter.toLowerCase()).join('')})`);
  if (!ok(p.parent2)) e.push(`parent2 is ${p.traits.length * 2} letters, a pair per trait in order`);
  if (!Array.isArray(p.steps) || !p.steps.length) return [...e, 'steps needed'];
  let last = -1;
  p.steps.forEach((s, i) => {
    const k = ORDER.indexOf(s?.op as (typeof ORDER)[number]);
    if (k < 0 || k <= last) e.push(`steps[${i}]: the order is ${ORDER.join(', ')}, each at most once`);
    last = Math.max(last, k);
    if (!isBi(s?.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  if (p.steps[0]?.op !== 'show') e.push('the first step is "show"');
  if (!p.steps.some((s) => s.op === 'grid')) e.push('a "grid" step is needed');
  return e;
}

export function buildPunnett(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as PunnettPlan;
  const f = punnettFacts(p);
  const ml = lang === 'ml';
  const m = newScene(title, 660);
  const n = f.g1.length;
  const C = n > 2 ? 62 : 90;
  const gx = 230, gy = 150; // the grid's top-left
  const phenoName = (key: string) => key.split('').map((c, i) => pick(c === 'D' ? p.traits[i].dominant : p.traits[i].recessive, lang)).join(', ');
  const colorOf = (g: string) => { const k = pairs(g).map((pp) => (pp !== pp.toLowerCase() ? 'D' : 'r')).join(''); const idx = f.pheno.findIndex(([kk]) => kk === k); return ['c', 'carry', 'b', 'a'][idx % 4]; };
  let t = 300;

  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      label(m, `${p.parent1}  ×  ${p.parent2}`, 360, 40, t, { size: 36, color: 'accent', weight: '700' });
      label(m, p.traits.map((tr) => `${tr.letter}: ${pick(tr.dominant, lang)} · ${tr.letter.toLowerCase()}: ${pick(tr.recessive, lang)}`).join('   |   '), 360, 82, t + 500, { size: 18, color: 'ink' });
      t += 1600;
    } else if (st.op === 'gametes') {
      f.g1.forEach((g, i) => { label(m, g, gx + C * (i + 0.5), gy - 24, t + i * 200, { size: n > 2 ? 22 : 30, color: 'b', weight: '700' }); });
      f.g2.forEach((g, j) => { label(m, g, gx - 34, gy + C * (j + 0.5), t + 400 + j * 200, { size: n > 2 ? 22 : 30, color: 'a', weight: '700' }); });
      t += 600 + n * 400;
    } else if (st.op === 'grid') {
      f.cells.forEach((row, j) => row.forEach((g, i) => {
        const at = t + (j * n + i) * (n > 2 ? 90 : 300);
        rect(m, gx + C * i, gy + C * j, C, C, at, colorOf(g), { alpha: 0.22, width: 2, z: 2 });
        label(m, g, gx + C * (i + 0.5), gy + C * (j + 0.5), at + 100, { size: n > 2 ? 18 : 28, color: 'ink', weight: '700' });
      }));
      t += n * n * (n > 2 ? 90 : 300) + 600;
    } else if (st.op === 'ratio') {
      const x = gx + C * n + 40, y0 = gy + 10;
      label(m, ml ? 'ജനിതകഘടന' : 'Genotypes', x + 90, y0, t, { size: 18, color: 'done' });
      const gtxt = f.geno.map(([g, k]) => `${k} ${g}`).join(' : ');
      label(m, gtxt.length > 30 ? (ml ? `${f.geno.length} തരം` : `${f.geno.length} kinds`) : gtxt, x + 90, y0 + 30, t + 300, { size: 20, color: 'b', weight: '700' });
      label(m, ml ? 'പ്രത്യക്ഷഗുണം' : 'Appearance', x + 90, y0 + 80, t + 700, { size: 18, color: 'done' });
      f.pheno.forEach(([k, c], i) => label(m, `${c} ${phenoName(k)}`, x + 90, y0 + 110 + i * 30, t + 1000 + i * 300, { size: 18, color: ['c', 'carry', 'b', 'a'][i % 4], weight: '700' }));
      const ratio = f.pheno.map(([, c]) => c).join(' : ');
      label(m, ratio, x + 90, y0 + 130 + f.pheno.length * 30, t + 1200 + f.pheno.length * 300, { size: 34, color: 'tick', weight: '700' });
      ring(m, x + 90, y0 + 130 + f.pheno.length * 30, 70, 26, t + 1600 + f.pheno.length * 300, 'tick');
      sparkle(m, x + 90, y0 + 130 + f.pheno.length * 30, t + 1800 + f.pheno.length * 300);
      t += 2400 + f.pheno.length * 300;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

export const PUNNETT_EXAMPLE: PunnettPlan = {
  traits: [{ letter: 'T', dominant: { en: 'tall', ml: 'ഉയരമുള്ളത്' }, recessive: { en: 'dwarf', ml: 'കുള്ളൻ' } }],
  parent1: 'Tt',
  parent2: 'Tt',
  steps: [
    { op: 'show', say: { en: 'Mendel crossed two tall pea plants, each carrying one tall and one dwarf factor.', ml: 'ഓരോന്നിലും ഉയരത്തിന്റെയും കുള്ളത്തിന്റെയും ഘടകമുള്ള രണ്ട് ഉയരമുള്ള പയർച്ചെടികളെ മെൻഡൽ സങ്കരണം ചെയ്തു.' } },
    { op: 'gametes', say: { en: 'Each parent passes on only one factor in each gamete.', ml: 'ഓരോ രക്ഷിതാവും ഓരോ ബീജകോശത്തിലും ഒരു ഘടകം മാത്രം നൽകുന്നു.' } },
    { op: 'grid', say: { en: 'Fill each box with one factor from each parent.', ml: 'ഓരോ കള്ളിയിലും ഓരോ രക്ഷിതാവിൽ നിന്നും ഓരോ ഘടകം ചേർക്കുക.' } },
    { op: 'ratio', say: { en: 'Three tall to one dwarf: the dominant factor hides the recessive one.', ml: 'മൂന്ന് ഉയരമുള്ളവ: ഒരു കുള്ളൻ — പ്രബല ഘടകം ഗുപ്ത ഘടകത്തെ മറയ്ക്കുന്നു.' } },
  ],
};

export const punnettTemplate: AgentTemplate = {
  id: 'punnett',
  title: "Mendel's crosses (Punnett square)",
  about: 'Parents, gametes, the Punnett square box by box, and the genotype and phenotype ratios (3:1, 1:2:1, 9:3:3:1 …), all computed.',
  example: PUNNETT_EXAMPLE,
  validate: validatePunnett,
  build: buildPunnett,
};
