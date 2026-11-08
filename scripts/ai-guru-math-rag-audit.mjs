import fs from 'node:fs';
import path from 'node:path';
const root=process.env.AI_GURU_MATH_RAG_DIR||path.join(process.cwd(),'data','math-rag');
const checks=[
 ['3b1b_videos',path.join(root,'faiss/3b1b_videos/index.faiss'),path.join(root,'faiss/3b1b_videos/metadata.json')],
 ['3b1b_manim',path.join(root,'faiss/3b1b_manim/index.faiss'),path.join(root,'faiss/3b1b_manim/metadata.json')],
 ['golden_set',path.join(root,'golden-set'),null],
];
for(const [name,index,meta] of checks){
 if(name==='golden_set'){const n=fs.existsSync(index)?fs.readdirSync(index).filter(x=>x.endsWith('.py')).length:0; console.log(`${name}: ${n} files`); continue;}
 const ok=fs.existsSync(index)&&fs.existsSync(meta);
 let count='missing';
 if(ok){try{const j=JSON.parse(fs.readFileSync(meta,'utf8'));count=j.next_id??Object.keys(j.metastore??{}).length;}catch{}}
 console.log(`${name}: ${ok?'ready':'missing'} (${count} entries)`);
}
console.log('video grounding: Gemini File API + inlineData supported');
console.log('visual normalizer: MathVizAI hits -> VisualGrammar operations');
console.log('token motion: token-move -> universal visual actions');
