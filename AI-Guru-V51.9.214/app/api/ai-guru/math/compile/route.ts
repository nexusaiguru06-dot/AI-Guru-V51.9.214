import { NextResponse } from 'next/server';
import { compileUniversalMath } from '@/lib/ai-guru/math/universal';
import { universalSceneToVisualActions } from '@/lib/ai-guru/math/universal';

export async function POST(req:Request){
  try{
    const body=await req.json();
    const expression=String(body?.expression??'').trim();
    if(!expression) return NextResponse.json({ok:false,error:'expression is required'},{status:400});
    const scene=await compileUniversalMath(expression,{grade:body?.grade,domain:body?.domain,durationMs:body?.durationMs,verify:body?.verify!==false,preferredStyle:body?.preferredStyle,bilingual:false,language:body?.language==='malayalam'?'malayalam':'english'});
    return NextResponse.json({ok:true,scene,visuals:universalSceneToVisualActions(scene)});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500});
  }
}
