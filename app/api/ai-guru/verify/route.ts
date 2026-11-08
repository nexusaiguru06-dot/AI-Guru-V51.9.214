import { NextResponse } from 'next/server';
import { HybridMathVerifier } from '@/lib/ai-guru/math/verifier';
export async function POST(request:Request){try{const b=await request.json() as {expression:string;expected?:string}; if(!b.expression)return NextResponse.json({ok:false,error:'expression required'},{status:400}); const result=await new HybridMathVerifier().verify(b.expression,b.expected); return NextResponse.json({ok:true,result});}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}}
