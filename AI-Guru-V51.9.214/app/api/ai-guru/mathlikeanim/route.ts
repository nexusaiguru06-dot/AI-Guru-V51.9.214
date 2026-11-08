import { NextResponse } from 'next/server';
import { createMathLikeAnimRenderer } from '@/lib/ai-guru/math/mathlikeanim';

export async function POST(request:Request){
  try {
    const scene=await request.json();
    return NextResponse.json({ok:true,result:await createMathLikeAnimRenderer().render(scene)});
  } catch(e) {
    return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:400});
  }
}
