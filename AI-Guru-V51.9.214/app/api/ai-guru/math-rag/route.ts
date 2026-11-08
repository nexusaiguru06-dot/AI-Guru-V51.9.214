import { NextResponse } from 'next/server';
import { retrieveMathContext } from '@/lib/ai-guru/math/rag';

export const runtime='nodejs';

export async function POST(req:Request){
  try{
    const body=await req.json();
    const query=String(body?.query??'').trim();
    if(!query)return NextResponse.json({ok:false,error:'query is required'},{status:400});
    const ctx=await retrieveMathContext(query,{topK:Math.min(12,Math.max(1,Number(body?.topK??6))),useFaiss:true});
    return NextResponse.json({ok:true,retrievalMode:ctx.retrievalMode,degraded:ctx.degraded,hits:ctx.hits.map(h=>({id:h.id,source:h.source,filePath:h.file_path,score:h.score,reasons:h.matchReasons})),patterns:ctx.patterns});
  }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}
}
