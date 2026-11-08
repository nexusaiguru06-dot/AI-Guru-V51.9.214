import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const p=path.join(root,'data/ai-guru/reference-styles/ai-guru-visual-template-registry.json');
const r=JSON.parse(fs.readFileSync(p,'utf8'));
const assets=Array.isArray(r.assets)?r.assets:[];
const errors=[]; const ids=new Set();
if(!assets.length) errors.push('No visual templates registered.');
for(const a of assets){
 if(ids.has(a.id)) errors.push(`duplicate id: ${a.id}`); ids.add(a.id);
 for(const k of ['id','name','file','originalFilename','styleId','qaProfileId','subject','domains','suggestedGrades','concepts','selectionTerms','teachingMethods','teachingPrompt','qaInstructions','templateSource','templatePath','templateUrl']) if(a[k]===undefined||a[k]===null||a[k]===''||(Array.isArray(a[k])&&!a[k].length)) errors.push(`${a.id}: missing ${k}`);
 if(a.assetType!=='interactive_template') errors.push(`${a.id}: assetType must be interactive_template`);
 if(a.mediaKind!=='interactive_visual_template') errors.push(`${a.id}: mediaKind must be interactive_visual_template`);
 if(a.approved!==true) errors.push(`${a.id}: approved must be true`);
 if(a.doNotCopyContent!==true) errors.push(`${a.id}: doNotCopyContent must be true`);
 if(!/^https:\/\/math\.htpu\.net\/f\/[a-z0-9-]+\.html$/.test(a.templateUrl)) errors.push(`${a.id}: invalid Mathlet template URL`);
}
if(errors.length){console.error('AI GURU VISUAL TEMPLATE LIBRARY AUDIT: FAIL');errors.forEach(e=>console.error('- '+e));process.exit(1);}
console.log(`AI GURU VISUAL TEMPLATE LIBRARY AUDIT: PASS — ${assets.length} Mathlet visual templates registered.`);
