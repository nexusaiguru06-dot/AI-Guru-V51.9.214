import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { MathRagChunk } from './types';

let fallbackCache: MathRagChunk[]|null=null;
export function getMathRagDataDir():string {
  return process.env.AI_GURU_MATH_RAG_DIR || path.join(process.cwd(),'data','math-rag');
}
export async function loadFallbackCorpus():Promise<MathRagChunk[]> {
  if(fallbackCache) return fallbackCache;
  try {
    const raw=JSON.parse(await readFile(path.join(getMathRagDataDir(),'general-classroom-curated.json'),'utf8'));
    fallbackCache=(raw.entries??[]) as MathRagChunk[];
  } catch { fallbackCache=[]; }
  return fallbackCache;
}
export async function getChunkById(id:string){ return (await loadFallbackCorpus()).find(x=>x.id===id); }
export function clearMathRagCache(){ fallbackCache=null; }
