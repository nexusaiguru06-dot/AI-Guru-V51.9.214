import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/ai-guru/reference-styles/manifest.json'),'utf8'));
const styleLib=fs.readFileSync(path.join(root,'lib/ai-guru/math/universal/style-library.ts'),'utf8');
const selector=fs.readFileSync(path.join(root,'lib/ai-guru/math/universal/style-selector.ts'),'utf8');
const compiler=fs.readFileSync(path.join(root,'lib/ai-guru/math/universal/compiler.ts'),'utf8');
const renderer=fs.readFileSync(path.join(root,'components/ai-guru/MathLikeAnimBoard.tsx'),'utf8');
const planRoute=fs.readFileSync(path.join(root,'app/api/ai-guru/math/plan/route.ts'),'utf8');
const failures=[];
for(const s of manifest.styles){
  if(!s.approved) failures.push(`unapproved reference: ${s.id}`);
  if(!styleLib.includes(`id:'${s.id}'`)) failures.push(`manifest style not in library: ${s.id}`);
}
for(const id of manifest.styles.map(s=>s.id)) if(!selector.includes(id)) failures.push(`selector missing style id: ${id}`);
if(!compiler.includes('styleSelection.style.pacing')) failures.push('compiler does not use style pacing');
if(!renderer.includes('action.durationMs')) failures.push('renderer ignores action duration');
if(!planRoute.includes('detectMathDomain(question)')) failures.push('AI plan route does not detect question domain before style selection');
console.log(`Reference metadata: ${manifest.styles.length}`);
console.log('Reference media: EXTERNAL/OPTIONAL (not shipped in production package)');
if(failures.length){ console.error('FAIL'); failures.forEach(x=>console.error(' - '+x)); process.exit(1); }
console.log('PASS: reference registration, selector coverage, pacing, renderer duration and domain-aware AI planning');
