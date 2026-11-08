import { NextResponse } from 'next/server';
// Optional Docling bridge. Set DOCLING_URL to a running Docling service that accepts
// multipart POST /parse and returns {layout:[{page,type,content,position}],images:{...}}.
// Without it, callers can continue using OpenMAIC's /api/extract-document endpoint.
export async function POST(request:Request){const url=process.env.DOCLING_URL;if(!url)return NextResponse.json({ok:false,error:'DOCLING_URL is not configured; use /api/extract-document.'},{status:503}); try{const form=await request.formData();const r=await fetch(`${url.replace(/\/$/,'')}/parse`,{method:'POST',body:form});const data=await r.json();return NextResponse.json({ok:r.ok,data},{status:r.ok?200:502});}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:502});}}
