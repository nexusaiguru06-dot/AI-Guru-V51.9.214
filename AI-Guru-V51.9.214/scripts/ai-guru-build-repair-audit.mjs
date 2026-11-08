#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const warnings = [];

function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function fail(message) { failures.push(message); console.error(`FAIL  ${message}`); }
function pass(message) { console.log(`PASS  ${message}`); }
function warn(message) { warnings.push(message); console.warn(`WARN  ${message}`); }

const requiredFiles = [
  'app/layout.tsx',
  'app/globals.css',
  'app/page.tsx',
  'app/ai-guru/page.tsx',
  'next-env.d.ts',
  'postcss.config.mjs',
  'next.config.ts',
  'package.json',
  'lib/ai-guru/teaching/classroom-controller.ts',
  'lib/ai-guru/qa/visual/visual-step-qa.ts',
  'lib/ai-guru/math/universal/two-pass-construction.ts',
  'app/api/ai-guru/voice/health/route.ts',
];
for (const file of requiredFiles) {
  if (exists(file)) pass(`required file ${file}`); else fail(`missing required file ${file}`);
}

const layout = exists('app/layout.tsx') ? read('app/layout.tsx') : '';
if (/<html\b/.test(layout) && /<body\b/.test(layout)) pass('root layout contains <html> and <body>');
else fail('root layout must contain <html> and <body>');

const globals = exists('app/globals.css') ? read('app/globals.css') : '';
if (globals.includes('@import "tailwindcss"')) pass('Tailwind v4 global CSS import present');
else fail('app/globals.css is missing the Tailwind v4 import');

const pkg = JSON.parse(read('package.json'));
const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
if (allDeps['@fontsource/chilanka']) pass('Chilanka is self-hosted through @fontsource/chilanka');
else fail('Chilanka dependency is missing');

const allSourceRoots = ['app', 'components/ai-guru', 'lib/ai-guru'];
const sourceFiles = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) sourceFiles.push(full);
  }
}
for (const rel of allSourceRoots) walk(path.join(root, rel));

function resolveLocal(spec, importer) {
  let candidate;
  if (spec.startsWith('@/')) candidate = path.join(root, spec.slice(2));
  else if (spec.startsWith('.')) candidate = path.resolve(path.dirname(importer), spec);
  else return true;
  const candidates = [candidate, `${candidate}.ts`, `${candidate}.tsx`, `${candidate}.js`, `${candidate}.jsx`, `${candidate}.mjs`, `${candidate}.json`, path.join(candidate, 'index.ts'), path.join(candidate, 'index.tsx'), path.join(candidate, 'index.js')];
  return candidates.some(fs.existsSync);
}

const importRe = /(?:import\s+(?:[^'";]+?\s+from\s+)?|export\s+(?:[^'";]+?\s+from\s+)?|import\s*\()(['"])([^'"\n]+)\1/g;
const unresolved = [];
const external = [];
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = importRe.exec(text))) {
    const spec = match[2];
    if (spec.startsWith('@/') || spec.startsWith('.')) {
      if (!resolveLocal(spec, file)) unresolved.push(`${path.relative(root, file)} -> ${spec}`);
    } else {
      external.push(spec);
    }
  }
}
if (unresolved.length === 0) pass(`active local import resolution (${sourceFiles.length} source files)`);
else {
  for (const item of unresolved.slice(0, 40)) fail(`unresolved local import: ${item}`);
  if (unresolved.length > 40) fail(`${unresolved.length - 40} additional unresolved local imports`);
}

const googleFontRefs = sourceFiles.filter(f => /fonts\.googleapis\.com/.test(fs.readFileSync(f, 'utf8')));
if (googleFontRefs.length === 0) pass('no runtime Google Fonts dependency in active AI Guru source');
else warn(`runtime Google Fonts references remain in ${googleFontRefs.map(f => path.relative(root, f)).join(', ')}`);

const staleControllerRefs = sourceFiles.filter(f => /ai-guru\/teaching\/controller['"]/.test(fs.readFileSync(f, 'utf8')));
if (staleControllerRefs.length === 0) pass('no stale teaching/controller import in active source');
else staleControllerRefs.forEach(f => fail(`stale teaching/controller import in ${path.relative(root, f)}`));

const activeOpenmaic = sourceFiles.filter(f => /@openmaic\//.test(fs.readFileSync(f, 'utf8')));
if (activeOpenmaic.length === 0) pass('no active @openmaic import in native AI Guru source');
else activeOpenmaic.forEach(f => fail(`active @openmaic import in ${path.relative(root, f)}`));

const fixture = 'fixtures/ai-guru/one-paragraph.json';
if (exists(fixture)) {
  const data = JSON.parse(read(fixture));
  const pageImage = data?.paragraphs?.[0]?.source?.pageImage;
  if (typeof pageImage === 'string' && exists(`public/${pageImage.replace(/^\//, '')}`)) pass(`fixture reference image exists: ${pageImage}`);
  else fail(`fixture reference image missing: ${pageImage}`);
}

const tests = ['lib/ai-guru/teaching/controller.test.ts', 'lib/ai-guru/teaching/checkpoint.test.ts'];
for (const test of tests) {
  if (!exists(test)) { fail(`missing teaching test ${test}`); continue; }
  const text = read(test);
  if (text.includes("from './controller'")) fail(`stale controller test import in ${test}`);
  else pass(`teaching test uses canonical classroom-controller: ${test}`);
}

if (exists('app/api/ai-guru/voice/health/route.ts')) pass('voice provider health endpoint present');

console.log(`\nBuild-repair audit: ${failures.length ? 'FAILED' : 'PASSED'} (${failures.length} failures, ${warnings.length} warnings)`);
process.exitCode = failures.length ? 1 : 0;
