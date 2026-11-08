import 'server-only';

import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { MathRagChunk, MathRagHit, MathRagSource } from './types';

type Meta={metastore:Record<string,{metadata?:any; text?:string}>;next_id:number};
let cache=new Map<string,{index:any;meta:Meta}>();
async function load(kind:'3b1b_videos'|'3b1b_manim'){
  if(cache.has(kind)) return cache.get(kind)!;
  const dir=path.join(process.env.AI_GURU_MATH_RAG_DIR||path.join(process.cwd(),'data','math-rag'),'faiss',kind);
  // V51.9.174: @faiss-node/native is optional (it needs a C++ compiler to install, which the Cloud Run image has not).
  // Loaded only at run time, so the build works without it; when it is missing, retrieval falls back to lexical search.
  const FAISS_PKG = '@faiss-node/native';
  const [{FaissIndex},raw]=await Promise.all([import(/* webpackIgnore: true */ /* turbopackIgnore: true */ FAISS_PKG) as Promise<{FaissIndex:any}>,readFile(path.join(dir,'metadata.json'),'utf8')]);
  const index=await FaissIndex.load(path.join(dir,'index.faiss'));
  const meta=JSON.parse(raw) as Meta; const value={index,meta}; cache.set(kind,value); return value;
}
function toChunk(source:MathRagSource,id:number,entry:any):MathRagChunk{
 const m=entry?.metadata??entry??{}; return {id:String(m.chunk_id??id),source,file_path:String(m.file_path??''),text:String(entry?.text??m.content??''),topics:[],priority:source==='3b1b_manim'?2:1,token_count:Number(m.token_count??0),chunk_index:Number(m.chunk_index??0)};
}
function labels(result:any):number[]{ return Array.isArray(result)?result:(result?.labels??result?.ids??[]); }
export async function searchFaiss(queryVector:number[],kind:'3b1b_videos'|'3b1b_manim',k=10):Promise<MathRagHit[]>{
 const {index,meta}=await load(kind);
 const r=await index.search(queryVector,k);
 const ls=labels(r); const distances=(r?.distances??r?.scores??[]) as number[];
 return ls.map((label,i)=>{const e=meta.metastore[String(label)];return e?{...toChunk(kind as any,label,e),score:Number(distances[i]??0),matchReasons:[`faiss:${kind}`]}:null}).filter(Boolean) as MathRagHit[];
}
export function clearFaissCache(){cache.clear();}
export async function faissAvailable(){try{await load('3b1b_videos');return true}catch{return false;}}
