import type { MathRagChunk, MathRagHit } from './types';
export function tokenize(s:string){ return (s.toLowerCase().match(/[a-z0-9_]+/g)??[]); }
export function lexicalScore(query:string, e:MathRagChunk){
  const q=tokenize(query), t=new Set(tokenize(`${e.file_path} ${e.topics.join(' ')} ${e.text}`));
  let score=0;
  for(const w of q){ if(t.has(w)) score+=1; if(e.topics.some(x=>x.toLowerCase()===w)) score+=3; }
  if(e.source==='golden_set') score+=2;
  return score;
}
export function rankLexical(query:string, entries:MathRagChunk[], k:number):MathRagHit[]{
  return entries.map(e=>({ ...e, score:lexicalScore(query,e), matchReasons:[] as string[] }))
    .sort((a,b)=>b.score-a.score).slice(0,k);
}
