#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules','.next','.git','legacy-app'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|css)$/.test(entry.name)) files.push(full);
  }
}
walk(path.join(root, 'app'));
walk(path.join(root, 'components', 'ai-guru'));
walk(path.join(root, 'lib', 'ai-guru'));

const text = files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
const checks = [
  ['native universal visual compiler', /lib\/ai-guru\/math\/universal/],
  ['semantic visual graph', /semantic-graph/],
  ['two-pass construction', /two-pass-construction/],
  ['paragraph visual QA', /qa\/visual\/visual-step-qa/],
  ['OpenMAIC runtime isolation', !/@openmaic\//.test(text)],
  ['Chilanka classroom support', /Chilanka/.test(text)],
];
let failed = false;
for (const [name, result] of checks) {
  const ok = typeof result === 'boolean' ? result : result.test(text);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed = true;
}
process.exitCode = failed ? 1 : 0;
