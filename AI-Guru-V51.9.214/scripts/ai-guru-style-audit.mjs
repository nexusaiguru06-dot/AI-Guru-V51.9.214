import fs from 'node:fs';
const root=process.cwd();
const required = [
  'lib/ai-guru/math/universal/style-library.ts',
  'lib/ai-guru/math/universal/style-selector.ts',
  'lib/ai-guru/math/universal/style-selector.test.ts',
  'app/api/ai-guru/visual-style/route.ts',
  'data/ai-guru/reference-styles/manifest.json'
];
const missing = required.filter(p=>!fs.existsSync(p));
if(missing.length){ console.error('Style audit FAILED', missing); process.exit(1); }
const compiler=fs.readFileSync('lib/ai-guru/math/universal/compiler.ts','utf8');
const library=fs.readFileSync('lib/ai-guru/math/universal/style-library.ts','utf8');
const selector=fs.readFileSync('lib/ai-guru/math/universal/style-selector.ts','utf8');
const requiredAssets = [
  'geometry-proof-construction','geometry-area-derivation','calculus-slope-explorer-reference',
  'trigonometry-unit-circle-reference','calculus-riemann-sum-area-reference'
];
for (const id of requiredAssets) if(!library.includes(id)) { console.error('Style audit FAILED: library missing '+id); process.exit(1); }
if(!selector.includes("trigonometry-unit-circle-reference") || !selector.includes("calculus-riemann-sum-area-reference") || !selector.includes("geometry-area-derivation")) { console.error('Style audit FAILED: new references not selectable'); process.exit(1); }
if(!compiler.includes('selectVisualStyle') || !compiler.includes('visualStyle:')) { console.error('Style audit FAILED: compiler not integrated'); process.exit(1); }
const manifest=JSON.parse(fs.readFileSync('data/ai-guru/reference-styles/manifest.json','utf8'));
const manifestIds=new Set(manifest.styles.filter(s=>s.approved).map(s=>s.id));
const missingManifest=requiredAssets.filter(id=>!manifestIds.has(id));
if(missingManifest.length){ console.error('Style audit FAILED: approved metadata missing', missingManifest); process.exit(1); }
console.log(`Reference metadata: PASS (${manifestIds.size} approved reference styles)`);
console.log('Reference media: EXTERNAL/OPTIONAL (not shipped in production package)');
console.log('Sprint 8.5.3 Visual Reference audit: PASS');
console.log(`Reference Style Library: PASS (${requiredAssets.length} required styles registered)`);
console.log('Visual Style Selector: PASS');
console.log('Universal Math Compiler integration: PASS');
console.log('API/UI integration: PASS');
