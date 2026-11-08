/**
 * AI Guru class lint (V51.9.50) — `npm run lint:class [-- --learned f.json --sketches f.json --plans f.json]`
 *
 * Fast checks before anyone reviews a class:
 *   broken names   every registered DNA has a builder case; every learned template / sketch / plan names
 *                  DNAs that exist; every question attaches to a real step;
 *   assets         the reel fonts, the Malayalam fonts (Chilanka, Noto Sans Malayalam) and the voice API
 *                  routes the class calls are really there;
 *   plans          the golden SCERT section and the sample sketch still validate (structure, both
 *                  languages, maths), with no English left in the Malayalam captions.
 * In the app, the same module checks each prepared class for missing audio and stale narration.
 * Exits 1 when there is an error (warnings do not fail).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DNAS } from '../lib/ai-guru/motion-class/dna/registry';
import { importLearned, learnedDnas } from '../lib/ai-guru/motion-class/dna/learned';
import { buildDnaScenes } from '../lib/ai-guru/motion-class/dna/builders';
import type { BlockPlan } from '../lib/ai-guru/motion-class/dna/types';
import { lintLearned, lintPlan, type LintIssue } from '../lib/ai-guru/motion-class/lint';
import { SCERT9_CH1_S1 } from '../lib/ai-guru/motion-class/samples/scert9-ch1-s1';
import { SKETCH_TRIANGLE_180 } from '../lib/ai-guru/motion-class/samples/ai-sketch';
import { HL_SAMPLES } from '../lib/ai-guru/motion-class/samples/hcf-lcm';
import { BAL_SAMPLES } from '../lib/ai-guru/motion-class/samples/balance-scale';
import { pickBi, questionsForPlan } from '../lib/ai-guru/motion-class/interactive/questions';
import { sketchProblems, type SketchPlan } from '../lib/ai-guru/motion-class/dna/sketch-math';

const started = performance.now();
const ROOT = resolve(__dirname, '..');
const issues: LintIssue[] = [];
const err = (code: LintIssue['code'], where: string, message: string) => issues.push({ level: 'error', code, where, message });
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

/* ---- broken names: registry ↔ builders ---- */
const buildersSrc = readFileSync(join(ROOT, 'lib/ai-guru/motion-class/dna/builders.ts'), 'utf8');
for (const d of DNAS) {
  if (d.id === 'bridge') continue;
  if (!buildersSrc.includes(`case '${d.id}'`)) err('broken-name', `registry:${d.id}`, `DNA "${d.id}" is registered but buildDnaScenes has no case for it.`);
}

/* ---- assets: fonts ---- */
const fontsSrc = readFileSync(join(ROOT, 'lib/ai-guru/reels/motion/fonts.ts'), 'utf8');
for (const m of fontsSrc.matchAll(/'([\w-]+\.(?:ttf|woff2?|otf))'/g)) {
  if (!existsSync(join(ROOT, 'public/fonts/reel', m[1]))) err('broken-name', 'fonts.ts', `Reel font file public/fonts/reel/${m[1]} is missing.`);
}
const cssFiles = [join(ROOT, 'public/fonts/chilanka/chilanka.css')];
for (const css of cssFiles) {
  if (!existsSync(css)) {
    err('broken-name', 'fonts', `${css.slice(ROOT.length + 1)} is missing (Malayalam handwriting font).`);
    continue;
  }
  for (const m of readFileSync(css, 'utf8').matchAll(/url\('?(\/fonts\/[^')]+)'?\)/g)) {
    if (!existsSync(join(ROOT, 'public', m[1]))) err('broken-name', css.slice(ROOT.length + 1), `Font file public${m[1]} is missing.`);
  }
}
const layout = readFileSync(join(ROOT, 'app/layout.tsx'), 'utf8');
for (const m of layout.matchAll(/href="(\/fonts\/[^"]+)"/g)) if (!existsSync(join(ROOT, 'public', m[1]))) err('broken-name', 'app/layout.tsx', `Stylesheet public${m[1]} is missing.`);
if (!existsSync(join(ROOT, 'public/fonts/reel/NotoSansMalayalam_400Regular.ttf'))) err('broken-name', 'fonts', 'Malayalam reel font NotoSansMalayalam_400Regular.ttf is missing; Malayalam captions would fall back to a system font.');

/* ---- assets: the API routes the class calls ---- */
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}
const callers = [...walk(join(ROOT, 'lib/ai-guru/motion-class')), ...walk(join(ROOT, 'lib/ai-guru/reels')), ...walk(join(ROOT, 'lib/ai-guru/tts')), join(ROOT, 'components/ai-guru/MotionClassroom.tsx')];
const routes = new Set<string>();
for (const f of callers) for (const m of readFileSync(f, 'utf8').matchAll(/fetch\(\s*[`'"](\/api\/[\w\-/]+)/g)) routes.add(m[1]);
for (const r of routes) if (!existsSync(join(ROOT, 'app', r, 'route.ts'))) err('broken-name', 'api', `The class calls ${r} but app${r}/route.ts does not exist.`);

/* ---- plans: golden section, sample sketch, question makers ---- */
SCERT9_CH1_S1.forEach((f, i) => issues.push(...lintPlan(`scert9[${i}]`, { ...f.plan, blockId: `scert9-${i}`, source: 'fixture' } as BlockPlan)));
for (const p of sketchProblems(SKETCH_TRIANGLE_180)) err('invalid-plan', 'samples/ai-sketch', p);
const questionPlans: Array<[string, string, unknown]> = [
  ...Object.entries(HL_SAMPLES).map(([k, p]) => [`hcf-lcm ${k}`, 'hcf-lcm', p] as [string, string, unknown]),
  ...BAL_SAMPLES.map((p, i) => [`balance-scale #${i + 1}`, 'balance-scale', p] as [string, string, unknown]),
];
for (const [where, dna, teach] of questionPlans) {
  for (const lang of ['en', 'ml'] as const) {
    const captions = new Set(buildDnaScenes(dna as never, teach, lang, 'lint').flatMap((s) => s.captions.map((c) => c.text.trim())));
    for (const q of questionsForPlan('b', { dna, teach } as BlockPlan)) {
      if (!captions.has(pickBi(q.after, lang).trim())) issues.push({ level: 'warn', code: 'question-unplaced', where: `${where} (${lang})`, message: `Question "${q.id}" has no step "${pickBi(q.after, lang).slice(0, 40)}".` });
    }
  }
}

/* ---- optional exports from the browser ---- */
const learnedFile = arg('learned');
if (learnedFile) {
  importLearned(readFileSync(learnedFile, 'utf8'));
  for (const d of learnedDnas()) issues.push(...lintLearned(d));
}
const sketchFile = arg('sketches');
if (sketchFile) {
  for (const c of JSON.parse(readFileSync(sketchFile, 'utf8')) as Array<{ id: string; plan: SketchPlan }>) for (const p of sketchProblems(c.plan)) err('invalid-plan', `sketch:${c.id}`, p);
}
const plansFile = arg('plans');
if (plansFile) {
  const raw = JSON.parse(readFileSync(plansFile, 'utf8')) as BlockPlan[] | Record<string, BlockPlan>;
  const list = Array.isArray(raw) ? raw : Object.values(raw);
  list.forEach((p, i) => issues.push(...lintPlan(p.blockId ?? `plan[${i}]`, p)));
}

/* ---- report ---- */
const ms = Math.round(performance.now() - started);
const errors = issues.filter((i) => i.level === 'error');
for (const i of issues) console.log(`${i.level === 'error' ? 'ERROR' : 'warn '} [${i.code}] ${i.where}: ${i.message}`);
console.log(`AI Guru class lint: ${errors.length} error(s), ${issues.length - errors.length} warning(s) — ${DNAS.length} DNAs, ${routes.size} API route(s), ${SCERT9_CH1_S1.length} golden plans, ${questionPlans.length} question plans checked in ${ms} ms.`);
process.exit(errors.length ? 1 : 0);
