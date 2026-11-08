import 'server-only';
import { readFile } from 'node:fs/promises'; import path from 'node:path';
import type { MathRagHit } from './types';
import { retrieveGeneralVideoDna } from './video-dna-general';
let cache:any=null;
async function load(){if(cache)return cache; try{cache=JSON.parse(await readFile(path.join(process.cwd(),'data','math-rag','general-teaching-visual-dna.json'),'utf8'));}catch{cache={entries:[]}} return cache;}
const toks=(s:string)=>new Set(s.toLowerCase().match(/[a-z0-9]+/g)||[]);
export async function retrieveGeneralTeachingDna(query:string,topK=4):Promise<MathRagHit[]>{
 const db=await load(), q=toks(query);
 const k12=(db.entries||[]).map((e:any)=>{
   const hay=[e.branch,e.grades,e.filePath,...(e.topics||[]),...(e.visualDNA?.objects||[]),...(e.visualDNA?.animationGrammar||[])].join(' ');
   const h=toks(hay); let overlap=0; for(const t of q)if(h.has(t))overlap++;
   const branchBonus=q.has(String(e.branch).split('-')[0])?3:0;
   const score=(overlap+branchBonus)/Math.max(1,Math.sqrt(q.size));
   return {id:e.id,source:e.source,file_path:e.filePath,text:`K-12 GENERAL TEACHING VISUAL DNA\nBranch: ${e.branch}; Grades: ${e.grades}; Topics: ${(e.topics||[]).join(', ')}\nObjects: ${(e.visualDNA?.objects||[]).join(', ')}\nAnimation grammar: ${(e.visualDNA?.animationGrammar||[]).join(', ')}\nTeaching sequence: ${(e.visualDNA?.teachingSequence||[]).join(' -> ')}\nRules: ${(e.visualDNA?.rules||[]).join('; ')}\nSource video required: NO.`,topics:e.topics||[],priority:1,score,matchReasons:[`visual-DNA overlap=${overlap}`,`branch=${e.branch}`]};
 }).sort((a:any,b:any)=>b.score-a.score).slice(0,Math.max(1,Math.min(topK,4))) as MathRagHit[];

 // The attached 231-entry Video-DNA corpus is an additional General Class
 // grammar layer. It is retrieved alongside the existing 69 K-12 patterns;
 // Problems & Formulae's dedicated 20-video DNA remains separate.
 const video=await retrieveGeneralVideoDna(query,Math.min(2,topK));
 const combined=[...k12,...video].sort((a,b)=>b.score-a.score);
 // Preserve both families when possible so the new corpus enriches rather
 // than replaces the curated K-12 teaching patterns.
 const picked:MathRagHit[]=[];
 const k=combined.filter(h=>h.id.startsWith('pattern:'));
 const v=combined.filter(h=>h.id.startsWith('video-dna:'));
 picked.push(...k.slice(0,Math.max(1,topK-2)),...v.slice(0,Math.min(2,topK)));
 for(const h of combined) if(picked.length<topK&&!picked.some(x=>x.id===h.id)) picked.push(h);
 return picked.slice(0,topK);
}
