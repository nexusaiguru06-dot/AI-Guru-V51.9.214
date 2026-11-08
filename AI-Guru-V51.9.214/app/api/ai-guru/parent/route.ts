import { NextResponse } from 'next/server';
import { parentReport } from '@/lib/ai-guru/integration/sprint7-platform';
export async function POST(request:Request){try{const b=await request.json();if(!b.lesson||!b.studentId)return NextResponse.json({ok:false,error:'lesson and studentId are required'},{status:400});const r=await parentReport(b.lesson,b.studentId,b.mastery??[]);return NextResponse.json(r,{status:r.ok?200:422});}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}}
