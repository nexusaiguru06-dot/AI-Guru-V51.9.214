import { NextResponse } from 'next/server'; import { sarvamTTS } from '@/lib/ai-guru/tts/providers';
export async function POST(request:Request){try{return NextResponse.json({ok:true,result:await sarvamTTS(await request.json())});}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:502});}}
