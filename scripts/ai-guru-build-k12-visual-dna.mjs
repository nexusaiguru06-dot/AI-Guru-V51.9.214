import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd(), data=path.join(root,'data','math-rag');
const catalog=JSON.parse(fs.readFileSync(path.join(data,'AI-GURU-K12-VIDEO-AND-RAG-CATALOG.json'),'utf8'));
const corpus=JSON.parse(fs.readFileSync(path.join(data,'general-classroom-curated.json'),'utf8')).entries||[];
const byId=new Map(corpus.map(x=>[x.id,x]));
const branches=catalog.generalClassroomRag.branches;
const priority=['arithmetic','algebra','geometry','trigonometry','functions-graphs','calculus','probability-statistics','number-theory','linear-algebra-vectors'];
const hints={
 arithmetic:/count|fraction|measure|number|hanoi|binary|music/i, algebra:/algebra|equation|polynomial|inventing_math/i,
 geometry:/pythag|sphere|geometry|circle|triangle|area|brachistochrone|cycloid/i, trigonometry:/trig|sine|cosine|complex_exponential/i,
 'functions-graphs':/graph|function|parametric|coordinate|fluid_flow/i, calculus:/calculus|derivative|integral|limit|taylor|area/i,
 'probability-statistics':/probab|bayes|statistics|covariance|dice|random/i, 'number-theory':/prime|number_theory|binary|counting/i,
 'linear-algebra-vectors':/eola|vector|matrix|linear|determinant|eigen/i
};
const memberships=new Map(); for(const b of priority) for(const x of branches[b]||[]) { const a=memberships.get(x.id)||[]; a.push(b); memberships.set(x.id,a); }
function choose(id, file, ms){ for(const b of priority){if(ms.includes(b)&&hints[b]?.test(file)) return b;} return ms[0]||'algebra'; }
function grades(branch){return ({arithmetic:'1-7',algebra:'6-12',geometry:'4-12',trigonometry:'9-12','functions-graphs':'7-12',calculus:'11-12','probability-statistics':'6-12','number-theory':'5-12','linear-algebra-vectors':'10-12'})[branch]||'6-12'}
function extract(text=''){
 const names=[...text.matchAll(/\b(Create|Write|FadeIn|FadeOut|TransformMatchingTex|Transform|ReplacementTransform|MoveToTarget|ApplyMethod|Rotate|Indicate|ShowCreation|GrowArrow|DrawBorderThenFill|LaggedStart|AnimationGroup)\s*\(/g)].map(m=>m[1]);
 const objs=[...text.matchAll(/\b(Circle|Square|Rectangle|Triangle|Polygon|Line|Arrow|Vector|NumberLine|Axes|Graph|Dot|OldTex|Tex|Text|Brace|Arc|VMobject|VGroup)\s*\(/g)].map(m=>m[1]);
 return {animations:[...new Set(names)].slice(0,12),objects:[...new Set(objs)].slice(0,12)};
}
const entries=[]; for(const [id,ms] of memberships){const c=byId.get(id); if(!c)continue; const branch=choose(id,c.file_path||'',ms); const e=extract(c.text); entries.push({id,branch,grades:grades(branch),filePath:c.file_path,source:c.source,sourceKind:'manim-code-pattern',topics:[branch,...(c.file_path||'').replace(/\.py$/,'').split(/[\/_-]+/).filter(x=>x.length>3).slice(-5)],visualDNA:{objects:e.objects,animationGrammar:e.animations,teachingSequence:['introduce visual object','apply one visible transformation at a time','preserve spatial continuity','connect visual change to the current mathematical statement'],rules:['adapt the technique, never copy source narration','prefer diagrams/equations over prose','one conceptual change per beat','keep labels short'],videoRequired:false},provenance:{repository:'3b1b/videos or curated golden-set source',licenseNote:'Retain source attribution/license metadata; AI-Guru runtime uses extracted pattern/DNA rather than redistributing a finished source video.'}});}
entries.sort((a,b)=>a.branch.localeCompare(b.branch)||a.filePath.localeCompare(b.filePath));
const counts={}; for(const e of entries)counts[e.branch]=(counts[e.branch]||0)+1;
const out={schemaVersion:'2.0',purpose:'K-12 general-classroom visual DNA. Distinct from the 20 physical problem-solving videos.',count:entries.length,countsByBranch:counts,runtimePolicy:{sendSourceVideoToGemini:false,usePhysicalVideo:false,useVisualDNA:true,maxRetrievedPatterns:4},entries};
fs.writeFileSync(path.join(data,'general-teaching-visual-dna.json'),JSON.stringify(out,null,2)); console.log(JSON.stringify({count:entries.length,counts},null,2));
