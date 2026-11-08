import 'server-only';

import { loadFallbackCorpus } from './corpus';
import { retrieveGeneralTeachingDna } from './general-teaching-dna';
import { rankLexical } from './lexical';
import { rerank } from './embedder';
import { searchFaiss } from './faiss';
import { normalizeVisualPattern } from './visual-pattern';
import { formatRagBlock } from './format';
import type { MathRagContext, MathRagHit, MathRagRetrieveOptions } from './types';
import { serverKey } from '../../net/server-keys';

async function queryEmbedding(q:string):Promise<number[]|null>{
  const openai=await serverKey('OPENAI_API_KEY'); const key=openai||await serverKey('GITHUB_TOKEN'); if(!key)return null; // V51.9.176
  try{
    const m=process.env.AI_GURU_EMBEDDING_MODEL||'text-embedding-3-large';
    const url=openai?'https://api.openai.com/v1/embeddings':'https://models.github.ai/inference/embeddings';
    const body=openai?{model:m,input:[q]}:{model:`openai/${m.replace(/^openai\//,'')}`,input:[q]};
    const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${key}`},body:JSON.stringify(body)});
    if(!r.ok)return null; const j=await r.json() as any; return j.data?.[0]?.embedding??null;
  }catch{return null}
}
export async function retrieveMathContext(query:string,opts:MathRagRetrieveOptions={}):Promise<MathRagContext>{
 if(!query.trim())return {query,hits:[],patterns:[],formattedBlock:'',degraded:false,retrievalMode:'lexical'};
 const top=Math.min(opts.topK??4,4); let hits:MathRagHit[]=[]; let mode:'faiss'|'lexical'|'hybrid'='lexical';
 // V51.7: General Class uses the curated 69-pattern K-12 Visual-DNA library plus the attached 231-entry Video-DNA grammar corpus.
 // Problems & Formulae keeps its separate 20-reference-video DNA. General Class never needs a source MP4 video.
 if(process.env.AI_GURU_K12_VISUAL_DNA!=='0'){
   hits=await retrieveGeneralTeachingDna(query,top);
   if(hits.length){ const patterns=hits.map(normalizeVisualPattern); return {query,hits,patterns,formattedBlock:formatRagBlock(hits,patterns,opts.maxContextChars??9000),degraded:false,retrievalMode:'lexical'}; }
 }
 const qv=!opts.lexicalOnly?await queryEmbedding(query):null;
 if(opts.useFaiss!==false && qv){
   try{
    const [v,m]=await Promise.all([searchFaiss(qv,'3b1b_videos',Math.max(top*3,18)),searchFaiss(qv,'3b1b_manim',Math.max(top*2,12))]);
    hits=[...v,...m].sort((a,b)=>b.score-a.score).slice(0,top*3); mode='faiss';
   }catch{}
 }
 if(!hits.length){
   const corpus=await loadFallbackCorpus();
   const candidates=opts.sources?.length?corpus.filter(e=>opts.sources!.includes(e.source as any)):corpus;
   hits=rankLexical(query,candidates,Math.max(top*3,18)); mode='lexical';
 }
 if(mode==='faiss' && process.env.AI_GURU_MATH_RAG_EMBEDDINGS==='1') mode='hybrid';
 if(mode==='lexical' && process.env.AI_GURU_MATH_RAG_EMBEDDINGS==='1'){
   try{hits=await rerank(query,hits,Math.max(top*2,12));mode='hybrid'}catch{}
 }
 hits=hits.slice(0,top);
 const patterns=hits.map(normalizeVisualPattern);
 return {query,hits,patterns,formattedBlock:formatRagBlock(hits,patterns,opts.maxContextChars??18000),degraded:false,retrievalMode:mode};
}
export const retrieveMathContextBlock=async(q:string,o?:MathRagRetrieveOptions)=>(await retrieveMathContext(q,o)).formattedBlock;
