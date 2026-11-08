import { NextResponse } from 'next/server';
import { sessionAction } from '@/lib/ai-guru/integration/sprint7-platform';
export async function POST(request:Request){try{const b=await request.json();if(!b.action||!b.studentId||!b.lessonId)return NextResponse.json({ok:false,error:'action, studentId and lessonId are required'},{status:400});const r=await sessionAction(b);return NextResponse.json(r,{status:r.ok?200:422});}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}}
