import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
let cache:any=null;
export async function getReferenceVideoDna(id?:string){
 if(!id) return null;
 if(!cache){
  try{ cache=JSON.parse(await readFile(path.join(process.cwd(),'data','ai-guru','video-dna','problem-solving-video-dna.json'),'utf8')); }
  catch{ cache={entries:{}}; }
 }
 return cache.entries?.[id]??null;
}
export function formatReferenceVideoDna(dna:any){
 if(!dna)return '';
 return `LOCAL REFERENCE VIDEO DNA (use as visual grammar; the physical video is NOT being resent):\n${JSON.stringify(dna)}`;
}
