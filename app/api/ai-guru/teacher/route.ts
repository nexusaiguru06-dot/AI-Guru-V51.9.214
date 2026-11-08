import { NextResponse } from 'next/server';
import { teacherAction } from '@/lib/ai-guru/integration/sprint7-platform';
export async function POST(request:Request){try{const b=await request.json();if(!b.lesson||!b.input)return NextResponse.json({ok:false,error:'lesson and input are required'},{status:400});const r=await teacherAction(b.lesson,b.input);return NextResponse.json(r,{status:r.ok?200:422});}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}}
