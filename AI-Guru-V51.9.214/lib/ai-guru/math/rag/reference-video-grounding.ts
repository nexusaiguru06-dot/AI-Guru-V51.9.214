import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

type Part = { text:string } | { inlineData:{mimeType:string;data:string} } | { fileData:{mimeType:string;fileUri:string} };
const INLINE_MAX = Number(process.env.AI_GURU_MATH_RAG_VIDEO_INLINE_MAX_BYTES ?? 18_000_000);
const POLL_MS = 1200;

function resolveAsset(assetPath:string){
  const rel=assetPath.replace(/^\//,'');
  return [
    path.join(process.cwd(),'public',rel),
    path.join(process.cwd(),'aiguru_src','public',rel),
    path.join(process.cwd(),rel),
  ].find(Boolean)!;
}
function mime(file:string){
  if(file.endsWith('.webm')) return 'video/webm';
  if(file.endsWith('.mov')) return 'video/quicktime';
  return 'video/mp4';
}
function sleep(ms:number){return new Promise(r=>setTimeout(r,ms));}

async function uploadGeminiFile(buf:Buffer, fileName:string, mimeType:string, key:string){
  const start=await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(key)}`,{
    method:'POST',
    headers:{
      'X-Goog-Upload-Protocol':'resumable',
      'X-Goog-Upload-Command':'start',
      'X-Goog-Upload-Header-Content-Length':String(buf.byteLength),
      'X-Goog-Upload-Header-Content-Type':mimeType,
      'Content-Type':'application/json',
    },
    body:JSON.stringify({file:{display_name:fileName}}),
  });
  if(!start.ok) throw new Error(`Gemini file start failed ${start.status}`);
  const uploadUrl=start.headers.get('x-goog-upload-url');
  if(!uploadUrl) throw new Error('Gemini upload URL missing');
  const finish=await fetch(uploadUrl,{method:'POST',headers:{
    'Content-Length':String(buf.byteLength),
    'X-Goog-Upload-Offset':'0',
    'X-Goog-Upload-Command':'upload, finalize',
    'Content-Type':mimeType,
  },body:new Uint8Array(buf)});
  if(!finish.ok) throw new Error(`Gemini file upload failed ${finish.status}`);
  let file=await finish.json() as any;
  const name=file?.file?.name;
  if(!name) throw new Error('Gemini file name missing');
  for(let i=0;i<30;i++){
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}?key=${encodeURIComponent(key)}`);
    if(r.ok){
      file=await r.json();
      const state=file?.state??file?.file?.state;
      if(state==='ACTIVE') {
        const f=file?.file??file;
        return {fileData:{mimeType:f.mimeType??mimeType,fileUri:f.uri}} as Part;
      }
      if(state==='FAILED') throw new Error('Gemini file processing failed');
    }
    await sleep(POLL_MS);
  }
  throw new Error('Gemini file processing timed out');
}

export async function buildReferenceVideoParts(assetPath:string,key:string):Promise<Part[]|null>{
  try{
    const file=resolveAsset(assetPath); const buf=await readFile(file); const mt=mime(file);
    if(buf.byteLength<=INLINE_MAX) return [{inlineData:{mimeType:mt,data:buf.toString('base64')}}];
    return [await uploadGeminiFile(buf,path.basename(file),mt,key)];
  }catch{return null}
}
