import { NextResponse } from 'next/server'; import { piperTTS } from '@/lib/ai-guru/tts/providers';
export async function POST(request:Request){try{return NextResponse.json({ok:true,result:await piperTTS(await request.json())});}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:502});}}
