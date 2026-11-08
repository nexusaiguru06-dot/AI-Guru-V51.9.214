import 'server-only';
import { serverKey } from '../../net/server-keys';

const model=process.env.AI_GURU_EMBEDDING_MODEL||'text-embedding-3-large';
async function endpoint(){const openai=await serverKey('OPENAI_API_KEY'); const key=openai||await serverKey('GITHUB_TOKEN'); if(!key)return null; return {key,url:openai?'https://api.openai.com/v1/embeddings':'https://models.github.ai/inference/embeddings'};}
async function embed(texts:string[]):Promise<number[][]>{
  const ep=await endpoint(); if(!ep) throw new Error('Embedding key unavailable');
  const body=ep.url.includes('github.ai')?{model:`openai/${model.replace(/^openai\//,'')}`,input:texts}:{model,input:texts};
  const r=await fetch(ep.url,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${ep.key}`},body:JSON.stringify(body)});
  if(!r.ok) throw new Error(`Embedding failed ${r.status}`);
  const j=await r.json() as {data:{embedding:number[];index:number}[]};
  return j.data.sort((a,b)=>a.index-b.index).map(x=>x.embedding);
}
export async function rerank(query:string,hits:any[],k:number){
  const v=await embed([query,...hits.map(h=>h.text.slice(0,6000))]), q=v[0];
  const cos=(a:number[],b:number[])=>{let d=0,na=0,nb=0;for(let i=0;i<Math.min(a.length,b.length);i++){d+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i]}return na&&nb?d/(Math.sqrt(na)*Math.sqrt(nb)):0};
  return hits.map((h,i)=>({...h,score:h.score*.35+cos(q,v[i+1])*50+(h.source==='golden_set'?8:0),matchReasons:[...(h.matchReasons||[]),`embedding ${cos(q,v[i+1]).toFixed(3)}`]})).sort((a,b)=>b.score-a.score).slice(0,k);
}
