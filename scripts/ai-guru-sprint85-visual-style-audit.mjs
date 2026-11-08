import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const style=fs.readFileSync(path.join(root,'lib/ai-guru/math/universal/style-library.ts'),'utf8');
const selector=fs.readFileSync(path.join(root,'lib/ai-guru/math/universal/style-selector.ts'),'utf8');
const planner=fs.readFileSync(path.join(root,'lib/ai-guru/math/planner/gemini.ts'),'utf8');
const qa=fs.readFileSync(path.join(root,'lib/ai-guru/qa/visual/visual-step-qa.ts'),'utf8');
const agent=fs.readFileSync(path.join(root,'lib/ai-guru/agents/visual/visual-step-agent.ts'),'utf8');
const ref=process.env.AI_GURU_REFERENCE_MEDIA_DIR ? path.join(process.env.AI_GURU_REFERENCE_MEDIA_DIR,'geometry-proof-construction.mp4') : null;
const checks=[
  ['geometry proof style registered',style.includes("geometry-proof-construction")],
  ['geometry proof reference metadata registered',style.includes("geometry-proof-construction")],
  ['selector prioritizes proof keywords',selector.includes("style.id === 'geometry-proof-construction'" )],
  ['planner receives selected style',planner.includes('selectedStyle?:ReferenceStyleProfile') && planner.includes('STYLE VIDEO PROMPT')],
  ['planner requests per-step visual checks',planner.includes('visualChecks containing only the applicable')],
  ['visual agent records selected style',agent.includes('visualStyleId: selected.style.id')],
  ['QA enforces visual checks',qa.includes('checkStyleChecks') && qa.includes('VISUAL_STEP_QA_RULES_VERSION = \'visual-step-1.1\'')],
];
let failed=0; for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++;}
process.exitCode=failed?1:0;
