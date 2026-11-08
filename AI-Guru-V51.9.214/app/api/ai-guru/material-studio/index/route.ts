import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { indexPdf } from '@/lib/ai-guru/material-studio/index-pdf';
import { understandBook } from '@/lib/ai-guru/material-studio/book-understanding';
import { saveDocument, saveDocumentFromUpload, UPLOAD_KEY } from '@/lib/ai-guru/material-studio/store';
import { withPdfSlot } from '@/lib/ai-guru/material-studio/pdf-work';
import { blobs } from '@/lib/ai-guru/storage';
import { createReadStream, promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { recoverPdfPagesWithOCR } from '@/lib/ai-guru/material-studio/ocr';
import { createHash } from 'node:crypto';
import { listDocuments } from '@/lib/ai-guru/material-studio/store';
import { ownerFor, requesterOrGuest } from '@/lib/ai-guru/library/requester';
import { guestCookie } from '@/lib/ai-guru/library/guest';
import { cloudKeyFor, requestCloudMaterials } from '@/lib/ai-guru/library/cloud';
import { MATERIAL_TYPES } from '@/lib/ai-guru/material-studio/types';
import { freePartsOf } from '@/lib/ai-guru/material-studio/parts';
import { readData } from '@/lib/ai-guru/admin/store';
export const runtime='nodejs';
export async function POST(request:Request){
  try{
    // V51.9.95: books go into the shared library under who uploaded them.
    // V51.9.107: signing in is not needed: a guest's book is private to their browser (not in the shared library), and
    // a guest never uses the AI Guru cloud key or the server's key (their own keys only, or chapters found without AI).
    const form=await request.formData();
    const who=await requesterOrGuest(request,form.get('guestName'));
    if((who.kind as string)==='student')return NextResponse.json({ ok:false, error:'Textbooks are uploaded by your teachers in the admin portal. Open My Textbooks to download them.' },{status:403}); // V51.9.211
    const guest=who.kind==='guest';
    const done=(body:Record<string,unknown>)=>{const r=NextResponse.json(body);if(guest&&who.isNew)r.headers.append('set-cookie',guestCookie(who.id,new URL(request.url).protocol==='https:'));return r;};
    const pagesRaw=String(form.get('pages')||'[]');
    // V51.9.168: typed (and cleaned) — an untyped JSON.parse made `pages.map(p=>…)` fail the production build (noImplicitAny)
    const parsedPages:unknown=JSON.parse(pagesRaw);
    const pages:Array<{page:number;text:string}>=Array.isArray(parsedPages)?parsedPages.filter((p):p is {page:number;text:string}=>!!p&&typeof p==='object'&&Number.isFinite(Number((p as {page?:unknown}).page))).map(p=>({page:Number(p.page),text:String(p.text??'')})):[];
    const subject=String(form.get('subject')||'').trim();
    const grade=String(form.get('grade')||'').trim();
    const syllabus=String(form.get('syllabus')||'').trim();
    const sourceLanguage=String(form.get('sourceLanguage')||'').trim();
    const teachingLanguage=String(form.get('teachingLanguage')||'').trim();
    // BYOK: the browser forwards the student's own Gemini key so chapter
    // understanding works without a server-side GEMINI_API_KEY.
    // V51.9.205: only Part 1 of a big book was sent (for a demo, or a host with short time limits): all of it is free
    let excerpt:{part:number;of:number;fromPage:number;toPage:number;totalPages:number}|undefined;
    try{const x=JSON.parse(String(form.get('excerpt')||'null'));if(x&&[x.part,x.of,x.fromPage,x.toPage,x.totalPages].every((n:unknown)=>Number.isInteger(n)&&(n as number)>0)&&x.toPage<=x.totalPages)excerpt={part:x.part,of:x.of,fromPage:x.fromPage,toPage:x.toPage,totalPages:x.totalPages};}catch{/* none */}
    const geminiKey=String(form.get('geminiKey')||'').trim()||undefined;
    const agnesApiKey=String(form.get('agnesApiKey')||'').trim()||undefined;
    const sarvamApiKey=String(form.get('sarvamApiKey')||'').trim()||undefined;
    const openaiApiKey=String(form.get('openaiApiKey')||'').trim()||undefined;
    const file=form.get('file');
    // V51.9.179: a large PDF may already be in Cloud Storage (sent there by the browser with a link from upload-url)
    const uploadKey=String(form.get('uploadKey')||'');
    const fromUpload=!(file instanceof File)&&UPLOAD_KEY.test(uploadKey);
    const fileName=file instanceof File?file.name:(String(form.get('fileName')||'').slice(0,200)||'textbook.pdf');
    if(!(file instanceof File)&&!fromUpload) return NextResponse.json({ok:false,error:'The original PDF file is required.'},{status:400});
    const maxBytes=Number(process.env.AI_GURU_MAX_PDF_MB||200)*1024*1024;
    if(!subject||!grade||!syllabus||!sourceLanguage||!teachingLanguage) return NextResponse.json({ok:false,error:'Subject, class, syllabus, PDF language and teaching language are required before upload.'},{status:400});
    if(!pages.length) return NextResponse.json({ok:false,error:'No readable PDF pages were received.'},{status:400});
    // V51.9.179: an uploaded book is copied to a temporary file and fingerprinted as a stream; its bytes are loaded into
    // memory only if a page needs OCR. A book sent in the request itself is small (Cloud Run allows 32 MB per request).
    let pdfBytes:Buffer|null=null; let tmpFile='';
    if(fromUpload){
      const size=await blobs.size(uploadKey);
      if(size===null) return NextResponse.json({ok:false,error:'The uploaded PDF was not found. Please upload it again.'},{status:400});
      if(size>maxBytes){ await blobs.del(uploadKey).catch(()=>undefined); return NextResponse.json({ok:false,error:`The PDF is larger than ${Math.round(maxBytes/1048576)} MB.`},{status:413}); }
      tmpFile=path.join(await fsp.mkdtemp(path.join(tmpdir(),'ai-guru-upload-')),'book.pdf');
      await blobs.toFile(uploadKey,tmpFile);
    } else {
      if((file as File).size>maxBytes) return NextResponse.json({ok:false,error:`The PDF is larger than ${Math.round(maxBytes/1048576)} MB.`},{status:413});
      pdfBytes=Buffer.from(await (file as File).arrayBuffer());
    }
    const cleanup=async()=>{ if(tmpFile) await fsp.rm(path.dirname(tmpFile),{recursive:true,force:true}).catch(()=>undefined); };
    try{
    // V51.9.95: the same PDF is indexed once. A second upload gets the book already in the library (with its materials).
    const pdfHash=pdfBytes?createHash('sha256').update(pdfBytes).digest('hex'):await new Promise<string>((ok,fail)=>{const h=createHash('sha256');createReadStream(tmpFile).on('data',(c)=>h.update(c)).on('error',fail).on('end',()=>ok(h.digest('hex')));});
    const mine=(d:{owner?:{kind:string;id?:string}})=>guest?d.owner?.kind==='guest'&&d.owner.id===who.id:who.kind==='student'&&d.owner?.kind==='student'&&d.owner.id===who.student.id;
    const same=(await listDocuments()).find(d=>d.pdfHash===pdfHash&&(!d.hidden||mine(d)||who.kind==='admin'));
    if(same){ if(fromUpload) await blobs.del(uploadKey).catch(()=>undefined); return done({ok:true,document:same,reused:true}); }
    // ODL-style hybrid OCR: keep the fast PDF.js text layer where it is healthy,
    // but recover empty/weak pages from the rendered page image. This is the
    // important fix for textbooks whose embedded font map makes a page appear
    // blank to browser text extraction even though the page visibly contains text.
    const ocr=await withPdfSlot(()=>recoverPdfPagesWithOCR(pdfBytes??(()=>fsp.readFile(tmpFile)),pages,{force:false}));
    const recoveredByPage=new Map(ocr.pages.map(p=>[p.page,p.text]));
    const pagesWithOcr=pages.map(p=>({page:p.page,text:recoveredByPage.get(p.page)||p.text}));
    const indexed=indexPdf(pagesWithOcr,fileName);
    indexed.parser = `${indexed.parser}+${ocr.parser}`; 
    // No key of the uploader's own: the AI Guru cloud key, when the admin allows this person to use it.
    const key=geminiKey||await cloudKeyFor(who);
    const chapters=await understandBook(indexed.sources,{subject,grade,syllabus,sourceLanguage,teachingLanguage},key,agnesApiKey,sarvamApiKey,openaiApiKey,!guest);
    const chapterBySource=new Map(chapters.flatMap(c=>c.sourceIds.map(id=>[id,c] as const)));
    const sources=indexed.sources.map(s=>{const c=chapterBySource.get(s.id);return c?{...s,chapterId:c.id,chapterTitle:c.title}:s;});
    const id=`doc:${nanoid(12)}`;
    const record={id,fileName,...(excerpt?{excerpt,freeParts:[1,2,3,4,5]}:{}),mimeType:'application/pdf',pageCount:indexed.pageCount,indexedAt:new Date().toISOString(),parser:indexed.parser,subject,grade,syllabus,sourceLanguage,teachingLanguage,chapters,sources,owner:ownerFor(who,geminiKey?'studio':'cloud'),pdfHash,hidden:guest||(who.kind==='student'&&(await readData()).settings.library.reviewStudentWork)||undefined};
    const doc=fromUpload?await saveDocumentFromUpload(record as Parameters<typeof saveDocument>[0],uploadKey):await saveDocument(record as Parameters<typeof saveDocument>[0],pdfBytes as Buffer);
    // V51.9.183: a book the office uploads gets its free part(s) made in full straight away — every study-material type,
    // on the cloud key — so each subject has a complete free trial (and the classroom, reels and library can use it)
    let freePart:{parts:number[];queued:number;error?:string}|undefined;
    if(who.kind==='admin'){const st=await readData();if(st.settings.library.autoFreeParts!==false){const parts=freePartsOf(doc,st.settings.access.freeParts);let queued=0,error:string|undefined;for(const part of parts){const r=await requestCloudMaterials(who,doc.id,part,[...MATERIAL_TYPES]).catch((e)=>({ok:false as const,error:e instanceof Error?e.message:String(e),status:500}));if(r.ok)queued+=r.results.filter(x=>x.job).length;else error=r.error;}freePart={parts,queued,error};}}
    return done({ok:true,document:doc,ocr:ocr.diagnostics,...(guest?{guest:true}:{}),...(freePart?{freePart}:{})});
    } finally { await cleanup(); }
  }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:422});}
}
