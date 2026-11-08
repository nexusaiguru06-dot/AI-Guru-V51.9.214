'use client';
import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, FileText, Loader2, Sparkles, Upload, LibraryBig } from 'lucide-react';
import Link from 'next/link';
import { AiGuruTopNav } from '@/components/ai-guru/AiGuruTopNav';
import { studentKey, orderedUsableKeys } from '@/lib/student-key';
import { getProvider, hasUsableFallbackProvider, activeFallbackProviders } from '@/lib/ai-guru/byok-providers';
import { openRouter } from '@/lib/ai-guru/openrouter';
import { generateMaterial } from '@/lib/ai-guru/material-studio/pipeline';
import type { BookChapter, IndexedDocument, MaterialType, StudyMaterial } from '@/lib/ai-guru/material-studio/types';
import { MATERIAL_TYPES } from '@/lib/ai-guru/material-studio/types';
import { buildStudyParts } from '@/lib/ai-guru/material-studio/parts';
import { loadProfile } from '@/lib/ai-guru/student/profile';
import { AiKeysLog } from '@/components/ai-guru/AiKeysLog';
import { CHUNK_BYTES, pieces, readJsonReply } from '@/lib/ai-guru/material-studio/chunked-upload';

const labels:Record<MaterialType,string>={mcq:'MCQ',qa:'Q & A','revision-notes':'Revision Notes',flashcards:'Flashcards',worksheet:'Worksheet','question-paper':'Question Paper',ppt:'PPT','mind-map':'Mind Map','whiteboard-notes':'Whiteboard Notes','knowledge-base':'Knowledge Base','problems-formulae':'Problems and Formulae'};
const SUBJECTS=['Mathematics','Physics','Chemistry','Biology','Science','English','Social Science','Computer Science'];
const SYLLABI=[['cbse','CBSE'],['kerala','Kerala State'],['tamilnadu','Tamil Nadu'],['karnataka','Karnataka']];
const LANGUAGES=[['english','English'],['malayalam','Malayalam'],['tamil','Tamil'],['hindi','Hindi']];

/* V51.9.163: the textbooks opened in this browser — one per subject — so a student can switch subjects or add another. */
type BookRef={id:string;fileName:string;subject:string;grade:string;pageCount?:number;at?:number};
const BOOKS_KEY='ai-guru:material-documents';
function readBooks():BookRef[]{try{const v=JSON.parse(localStorage.getItem(BOOKS_KEY)||'[]');return Array.isArray(v)?v.filter((b:BookRef)=>b&&typeof b.id==='string'):[];}catch{return [];}}
function saveBook(b:BookRef):BookRef[]{const next=[{...b,at:Date.now()},...readBooks().filter(x=>x.id!==b.id)].slice(0,30);try{localStorage.setItem(BOOKS_KEY,JSON.stringify(next));}catch{/* private mode */}return next;}
function forgetBook(id:string):BookRef[]{const next=readBooks().filter(x=>x.id!==id);try{localStorage.setItem(BOOKS_KEY,JSON.stringify(next));}catch{/* private mode */}return next;}



function textContentWithLayout(content:any):string{
 let text=''; let previousY:number|undefined; let previousHeight=10;
 for(const item of content.items as any[]){if(!('str' in item)||!item.str)continue;const y=Number(item.transform?.[5]);const height=Math.max(1,Number(item.height||previousHeight||10));if(previousY!==undefined&&Number.isFinite(y)){const gap=Math.abs(y-previousY);if(gap>Math.max(previousHeight,height)*1.7)text+='\n\n';else if(gap>Math.max(previousHeight,height)*.55)text+='\n';else if(text&&!/[\s\n]$/.test(text))text+=' ';}else if(text&&!/[\s\n]$/.test(text))text+=' ';text+=String(item.str);if(item.hasEOL)text+='\n';if(Number.isFinite(y))previousY=y;previousHeight=height;}
 return text.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}

// pdfjs-dist REQUIRES GlobalWorkerOptions.workerSrc to be set before
// getDocument() is called — without it, getDocument() throws immediately
// with 'No "GlobalWorkerOptions.workerSrc" specified.' before reading a
// single page. `disableWorker` (used previously) is not a real pdfjs-dist
// option — it was silently ignored, so every upload failed at the very
// first step, before progress ever advanced past its initial 2%, and the
// real error was then swallowed by the UI (see the error-display fix below).
// Exact version pin matches package.json's pdfjs-dist so the worker build
// always matches the API build loaded in the browser.
const PDFJS_VERSION='4.8.69';
const PDFJS_CDN_WORKER=`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
function configurePdfWorker(pdfjs:any,useCdn=false){
 if(useCdn){pdfjs.GlobalWorkerOptions.workerSrc=PDFJS_CDN_WORKER;return;}
 if(pdfjs.GlobalWorkerOptions.workerSrc)return;
 try{
  // The bundler-recommended pattern: Next.js/webpack/Turbopack statically
  // detect this literal `new URL(..., import.meta.url)` call and bundle the
  // worker file as a served asset, so PDFs are read fully offline.
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
 }catch{
  pdfjs.GlobalWorkerOptions.workerSrc=PDFJS_CDN_WORKER;
 }
}
async function openPdf(pdfjs:any,data:ArrayBuffer){
 configurePdfWorker(pdfjs);
 try{
  return await pdfjs.getDocument({data:data.slice(0)}).promise;
 }catch(e){
  // If the bundler couldn't resolve/serve the local worker asset (a real,
  // observed failure mode across different Next.js build setups), retry
  // once against the pinned CDN build before giving up.
  if(pdfjs.GlobalWorkerOptions.workerSrc===PDFJS_CDN_WORKER)throw e;
  configurePdfWorker(pdfjs,true);
  return await pdfjs.getDocument({data:data.slice(0)}).promise;
 }
}
async function extractPdfPages(file:File,onProgress:(info:{page:number;total:number;message:string})=>void){
 const pdfjs:any=await import('pdfjs-dist');
 const data=await file.arrayBuffer();
 const pdf=await openPdf(pdfjs,data);
 const pages:{page:number;text:string}[]=[];
 for(let page=1;page<=pdf.numPages;page++){onProgress({page,total:pdf.numPages,message:`Reading page ${page} of ${pdf.numPages}…`});const p=await pdf.getPage(page);const c=await p.getTextContent();pages.push({page,text:textContentWithLayout(c)});}
 return pages;
}
/** A short, actionable next step under the raw error, so "what happened" is
 *  never left as "what do I do about it". */
function explainUploadError(message:string):string{
 const m=message.toLowerCase();
 if(m.includes('workersrc')||m.includes('worker'))return 'The PDF reader engine failed to load in this browser. Try again — if it keeps happening, check that your network/firewall allows loading scripts from cdn.jsdelivr.net.';
 if(m.includes('scanned')||m.includes('ocr'))return 'This file has no selectable text layer (it is likely scanned pages/images). Run it through an OCR tool (e.g. Adobe Acrobat, Google Drive OCR) and upload the OCR\u2019d PDF instead.';
 if(m.includes('invalid pdf')||m.includes('corrupt'))return 'The file may be corrupted or not a real PDF. Try re-exporting or re-downloading it, then upload again.';
 if(m.includes('gemini')||m.includes('byok')||m.includes('api key'))return 'Open Settings \u2192 Your AI keys and confirm at least one key shows \u201cActive\u201d, then try uploading again.';
 if(m.includes('indexing failed')||m.includes('json'))return 'AI Guru could not finish understanding this textbook on this attempt. This is often temporary \u2014 try again in a moment.';
 return 'Try selecting the PDF again. If this keeps happening on this file, try a different export of the same PDF.';
}

export default function MaterialStudio(){
 const [doc,setDoc]=useState<IndexedDocument|null>(null),[materials,setMaterials]=useState<StudyMaterial[]>([]),[selected,setSelected]=useState<StudyMaterial|null>(null);
 const [subject,setSubject]=useState(''),[grade,setGrade]=useState(''),[syllabus,setSyllabus]=useState(''),[sourceLanguage,setSourceLanguage]=useState(''),[teachingLanguage,setTeachingLanguage]=useState('');
 const [chapterId,setChapterId]=useState('all'),[selectedPartId,setSelectedPartId]=useState('part-1'),[selectedPartIds,setSelectedPartIds]=useState<string[]>(['part-1']),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
 const [byok,setByok]=useState(false),[byokMasked,setByokMasked]=useState<string|null>(null);
 const [fallbackReady,setFallbackReady]=useState(false),[activeFallback,setActiveFallback]=useState<string[]>([]);
 const [progress,setProgress]=useState(0),[progressPage,setProgressPage]=useState(0),[progressTotal,setProgressTotal]=useState(0),[progressStage,setProgressStage]=useState('idle');
 const [batch,setBatch]=useState<Record<string,{state:'pending'|'running'|'done'|'failed';detail?:string}>>({});
 const [activeMaterialType,setActiveMaterialType]=useState<MaterialType|null>(null);
 const [selectedMaterialTypes,setSelectedMaterialTypes]=useState<MaterialType[]>([]);
 const [batchRunning,setBatchRunning]=useState(false);
 // V51.9.163: the textbooks opened in this browser (one per subject), to switch between them or start another subject
 const [myBooks,setMyBooks]=useState<BookRef[]>([]);
 useEffect(()=>{setMyBooks(readBooks());},[]);
 const rememberBook=(d:IndexedDocument)=>setMyBooks(saveBook({id:d.id,fileName:d.fileName,subject:d.subject||'',grade:d.grade||'',pageCount:d.pageCount}));
 /** V51.9.163: start another subject — the open book is put aside (it stays in "My textbooks"), the five choices are cleared. */
 function startAnotherSubject(){
  if(busy)return;
  setDoc(null);setMaterials([]);setSelected(null);setBatch({});setError('');setStatus('');setProgress(0);setProgressStage('idle');
  setSelectedMaterialTypes([]);setSelectedPartId('part-1');setSelectedPartIds(['part-1']);setChapterId('all');setActiveMaterialType(null);
  setSubject('');setGrade('');setSyllabus('');setSourceLanguage('');setTeachingLanguage('');
  try{localStorage.removeItem('ai-guru:material-document');}catch{/* ignore */}
  window.scrollTo({top:0,behavior:'smooth'});
 }
 function openBook(id:string){if(busy||id===doc?.id)return;localStorage.setItem('ai-guru:material-document',id);setSelected(null);setSelectedMaterialTypes([]);setProgressStage('idle');void load(id);}
 const ready=Boolean(subject&&grade&&syllabus&&sourceLanguage&&teachingLanguage);
 const [wholeBook,setWholeBook]=useState(false); // V51.9.205: off = only Part 1 of the book is uploaded
 const [signedIn,setSignedIn]=useState<boolean|null>(null);useEffect(()=>{let live=true;fetch('/api/ai-guru/material-studio/whoami',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{if(live&&j?.ok)setSignedIn(!!j.signedIn);}).catch(()=>{});return()=>{live=false};},[]); // V51.9.180: say only what applies to this visitor
 const [guest,setGuest]=useState(false); // V51.9.107: working without signing in (books and materials private to this browser)
 const [cloudMode,setCloudMode]=useState(false);useEffect(()=>{setCloudMode(new URLSearchParams(window.location.search).has('cloud'));},[]); // V51.9.95
 const canCreate=Boolean(doc&&!busy); // Keep material tabs clickable once a textbook is loaded. BYOK is validated on click so the UI can explain what is missing instead of looking broken/inactive.
 useEffect(()=>{const id=localStorage.getItem('ai-guru:material-document');if(id)void load(id); const sync=()=>{
   const geminiReady=studentKey.hasValidatedKey();
   const fallbacks=[...(openRouter.hasUsable()?['OpenRouter']:[]),...['openai','agnes','sarvam'].filter((p:any)=>Boolean(getProvider(p as any)?.key))]; // V51.9.164: OpenRouter is listed
   setByok(geminiReady);
   setByokMasked(studentKey.masked(studentKey.getSaved()||undefined));
   setFallbackReady(hasUsableFallbackProvider());
   setActiveFallback(fallbacks);
  }; sync(); window.addEventListener('gemini-key-pool-changed',sync); window.addEventListener('ai-guru-byok-providers-changed',sync); window.addEventListener('ai-guru-openrouter-changed',sync); return()=>{window.removeEventListener('gemini-key-pool-changed',sync);window.removeEventListener('ai-guru-byok-providers-changed',sync);window.removeEventListener('ai-guru-openrouter-changed',sync)}},[]);
 async function load(id:string){try{const [d,m]=await Promise.all([fetch(`/api/ai-guru/material-studio/sources/${encodeURIComponent(id)}`).then(r=>r.json()),fetch(`/api/ai-guru/material-studio/materials?documentId=${encodeURIComponent(id)}`).then(r=>r.json())]);if(!d.ok&&/not found|no such|missing/i.test(String(d.error||'')))setMyBooks(forgetBook(id));if(d.ok){setDoc(d.document);rememberBook(d.document);setSelectedPartId('part-1');setSelectedPartIds(['part-1']);setBatch({});setError('');setStatus('');setChapterId('all');setSubject(d.document.subject||'');setGrade(d.document.grade||'');setSyllabus(d.document.syllabus||'');setSourceLanguage(d.document.sourceLanguage||'');setTeachingLanguage(d.document.teachingLanguage||'');}if(m.ok){const loaded=m.materials||[];setMaterials(loaded);setBatch(Object.fromEntries(MATERIAL_TYPES.map(type=>{const made=loaded.some((x:StudyMaterial)=>x.type===type);return [batchKey('all',type),{state:made?'done':'pending'}];})));}}catch{}}
 async function upload(file:File){ // V51.9.205: `file` becomes Part 1 only unless the whole book is asked for
  if(!ready){setError('Complete Subject, Class, Syllabus, PDF language and Teaching language before selecting a PDF.');return;}
  setBusy(true);setError('');setSelected(null);setActiveMaterialType(null);setSelectedMaterialTypes([]);setSelectedPartId('part-1');setSelectedPartIds(['part-1']);setChapterId('all');setBatch({});setProgress(2);setProgressPage(0);setProgressTotal(0);setProgressStage('reading');setStatus('Opening the PDF and preparing the complete-book read…');
  try{
   let pages=await extractPdfPages(file,(info)=>{setProgressTotal(info.total);setProgressPage(info.page);setProgress(Math.max(3,Math.round((info.page/info.total)*62)));setProgressStage('reading');setStatus(info.message);});
   // V51.9.205: Part 1 only (the first fifth of the book, the free part) unless the whole book is asked for: a small
   // file that uploads and is read well inside a host's time limits — enough to show how AI Guru works
   let excerpt:{part:number;of:number;fromPage:number;toPage:number;totalPages:number}|null=null;
   if(!wholeBook&&pages.length>=10){
    const total=pages.length, last=Math.ceil(total/5);
    setStatus(`Keeping Part 1 of 5 (pages 1–${last} of ${total})…`);
    const {PDFDocument}=await import('pdf-lib');
    const src=await PDFDocument.load(await file.arrayBuffer(),{ignoreEncryption:true});
    const out=await PDFDocument.create();
    (await out.copyPages(src,Array.from({length:last},(_,i)=>i))).forEach(pg=>out.addPage(pg));
    const bytes=await out.save();
    file=new File([bytes as BlobPart],file.name.replace(/\.pdf$/i,'')+' (Part 1 of 5).pdf',{type:'application/pdf'});
    pages=pages.filter(pg=>pg.page<=last);
    excerpt={part:1,of:5,fromPage:1,toPage:last,totalPages:total};
   }
   setProgress(65);setProgressPage(pages.length);setProgressTotal(pages.length);setProgressStage('indexing');setStatus(`All ${pages.length} pages read. Building the paragraph/source index…`);
   // V51.9.179: on Google Cloud a large PDF goes straight to the private bucket (Cloud Run takes at most 32 MB per request)
   let uploadKey='';
   // V51.9.204: on Netlify (and anywhere without a direct link) a PDF over 3 MB goes in 3 MB pieces, so the host's
   // ~4.5 MB request limit no longer cuts the upload off ("Unexpected end of JSON input")
   if(file.size>CHUNK_BYTES){
    setStatus('Sending the PDF to AI Guru storage…');
    const u=await fetch('/api/ai-guru/material-studio/upload-url',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({size:file.size,fileName:file.name})}).then(x=>readJsonReply(x,'Preparing the upload')).catch(()=>null);
    if(u&&!u.ok)throw new Error(u.error||'This PDF cannot be uploaded.');
    if(u?.direct){
     const put=await fetch(String(u.url),{method:'PUT',headers:u.headers as Record<string,string>,body:file});
     if(!put.ok)throw new Error(`Uploading the PDF failed (${put.status}). Please try again.`);
     uploadKey=String(u.key);
    }else if(u?.chunked){
     const size=Number(u.chunkBytes)||CHUNK_BYTES, ranges=pieces(file.size,size);
     const id=Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>b.toString(16).padStart(2,'0')).join('');
     for(let i=0;i<ranges.length;i++){
      setStatus(`Sending the PDF to AI Guru storage… piece ${i+1} of ${ranges.length}`);
      let j:Awaited<ReturnType<typeof readJsonReply>>={ok:false};
      for(let tryNo=0;tryNo<3&&!j.ok;tryNo++){ // a dropped piece is sent again
       j=await fetch(`/api/ai-guru/material-studio/upload-chunk?id=${id}&part=${i}&parts=${ranges.length}`,{method:'POST',headers:{'content-type':'application/octet-stream'},body:file.slice(ranges[i][0],ranges[i][1])}).then(x=>readJsonReply(x,`Sending piece ${i+1}`)).catch(()=>({ok:false,error:`Sending piece ${i+1} failed. Check the internet connection.`}));
      }
      if(!j.ok)throw new Error(j.error||'Uploading the PDF failed. Please try again.');
      if(j.done)uploadKey=String(j.key);
     }
    }
   }
   const form=new FormData(); if(uploadKey){form.append('uploadKey',uploadKey);form.append('fileName',file.name);}else form.append('file',file); form.append('pages',JSON.stringify(pages)); if(excerpt)form.append('excerpt',JSON.stringify(excerpt)); form.append('geminiKey',studentKey.get()||'');
   form.append('agnesApiKey',getProvider('agnes')?.key||'');
   form.append('sarvamApiKey',getProvider('sarvam')?.key||'');
   form.append('openaiApiKey',getProvider('openai')?.key||''); form.append('subject',subject); form.append('grade',grade); form.append('syllabus',syllabus); form.append('sourceLanguage',sourceLanguage); form.append('teachingLanguage',teachingLanguage); form.append('guestName',loadProfile().name||''); // V51.9.107: the name typed on this device, if not signed in
   setProgress(70);setProgressStage('understanding');setStatus('Complete book read finished. AI Guru is identifying chapters and understanding the textbook structure…');
   const r=await fetch('/api/ai-guru/material-studio/index',{method:'POST',body:form});
   setProgress(94);setProgressStage('saving');setStatus('Chapter map complete. Saving the indexed textbook and page-to-paragraph map…');
   const j=await readJsonReply(r,'Reading the textbook') as any;if(!r.ok||!j.ok)throw new Error(j.error||'Indexing failed');if(j.guest)setGuest(true); // V51.9.204: a non-JSON reply is explained
   if(j.reused){/* V51.9.95: this PDF is already in the library — load it with its materials instead of indexing it again */localStorage.setItem('ai-guru:material-document',j.document.id);await load(j.document.id);setProgress(100);setProgressStage('complete');setStatus(`This textbook is already in the AI Guru library (${j.document.pageCount} pages). Its study materials are loaded below; create only the ones that are missing.`);return;}
   setDoc(j.document);rememberBook(j.document);localStorage.setItem('ai-guru:material-document',j.document.id);setMaterials([]);setChapterId('all');setProgress(100);setProgressPage(j.document.pageCount);setProgressTotal(j.document.pageCount);setProgressStage('complete');const ocrInfo=j.ocr?.engine&&j.ocr.engine!=='none'?` · OCR: ${j.ocr.engine} (${j.ocr.pagesRecovered}/${j.ocr.pagesRequested} weak pages recovered)`:'';{const fp=j.freePart as {parts:number[];queued:number;error?:string}|undefined;/* V51.9.183: the free part is made in full on the cloud */const fpNote=fp?(fp.queued?` Free Part ${fp.parts.join(', ')}: ${fp.queued} study materials (notes, PPT, MCQ, revision and more) are being made on the AI Guru cloud — they appear in the library and the classroom as each is ready.`:fp.error?` Free part not made automatically: ${fp.error}`:''):'';setStatus(`Book understood and indexed: ${j.document.pageCount} pages · ${j.document.chapters.length} chapters · ${j.document.sources.length} paragraph units${ocrInfo}. Ready.${fpNote}`);}
  }catch(e){setProgressStage('error');setError(e instanceof Error?e.message:'PDF upload/indexing failed');setStatus('');}finally{setBusy(false)}
 }
 /** Every Gemini call inside generateMaterial() rotates across the saved BYOK
  *  key pool, so this only has to check that at least one key is usable. */
 function byokGate(){
  const usable=orderedUsableKeys();
  const fallbackReady=hasUsableFallbackProvider();
  const fallbacks=[...(openRouter.hasUsable()?['OpenRouter']:[]),...activeFallbackProviders()];
  setByok(Boolean(usable.length));
  setFallbackReady(fallbackReady);
  setActiveFallback(fallbacks);
  if(usable.length){
   // The key pool can be changed in Settings while Material Studio remains mounted.
   // Re-sync here so a valid key never leaves the material tabs looking inactive.
   setByokMasked(studentKey.masked(studentKey.getSaved()||undefined));
   return true;
  }
  if(fallbackReady){
   setByokMasked('');
   return true;
  }
  setError('No AI provider is active. Open Settings → Your AI keys and save/check a Gemini, OpenRouter, OpenAI, Agnes AI, or Sarvam AI key.');
  return false;
 }
 const studyParts=useMemo(()=>doc?buildStudyParts(doc):[],[doc]);
 // V51.9.192 (pay by part): parts not paid yet cannot be used to make study materials — not even with your own key
 const docAccess=(doc as (IndexedDocument&{access?:{createLocked?:number[];partPrice?:number}})|null)?.access;
 const createLocked=useMemo(()=>new Set<number>(docAccess?.createLocked??[]),[docAccess]);
 const [payNotice,setPayNotice]=useState<number|null>(null);
 const priceText=docAccess?.partPrice?` (₹${docAccess.partPrice.toLocaleString('en-IN')})`:'';
 const selectedPart=studyParts.find(p=>p.id===selectedPartId)||studyParts[0];
 const partSourceSet=useMemo(()=>new Set<string>(selectedPart?.sourceIds||[]),[selectedPart]);
  const chapterOptions=useMemo(()=>doc?doc.chapters.filter(c=>partSourceSet.size===0?false:(c.sourceIds||[]).some(id=>partSourceSet.has(id))):[],[doc,partSourceSet]);
 const generationScope=(scopeId:string):{id:string;title:string;chapter:BookChapter}=>{
  if(!doc)throw new Error('No indexed textbook is loaded.');
  // V51.9.163: the part comes from the scope id itself ("part-2" or "part-2::chapter"), so several parts can be made in one go
  const part=studyParts.find(p=>p.id===scopeId.split('::')[0])||studyParts.find(p=>p.id===selectedPartId)||selectedPart;
  if(!part)throw new Error('Select a textbook part first.');
  if(scopeId.startsWith('part-')){
    const ids=new Set<string>(part.sourceIds);
    return {id:part.id,title:`${part.title} · pp. ${part.startPage}–${part.endPage}`,chapter:{id:part.id,title:part.title,startPage:part.startPage,endPage:part.endPage,sourceIds:[...ids]}};
  }
  const chapterIdOnly=scopeId.includes('::')?scopeId.split('::').pop()||'':scopeId;
  const chapter=doc.chapters.find(c=>c.id===chapterIdOnly);
  if(!chapter)throw new Error('Selected chapter is not available in this part.');
  const ids=new Set<string>(part.sourceIds);
  const scopedIds=(chapter.sourceIds||[]).filter(id=>ids.has(id));
  if(!scopedIds.length)throw new Error('The selected chapter has no source units inside this part.');
  const start=Math.min(...scopedIds.map(id=>doc.sources.find(s=>s.id===id)?.page||chapter.startPage));
  const end=Math.max(...scopedIds.map(id=>doc.sources.find(s=>s.id===id)?.page||chapter.endPage));
  return {id:`${part.id}::${chapter.id}`,title:chapter.title,chapter:{...chapter,id:`${part.id}::${chapter.id}`,startPage:start,endPage:end,sourceIds:scopedIds}};
 };
 const batchKey=(cid:string,type:MaterialType)=>`${cid}::${type}`;
 async function generateOne(type:MaterialType,forChapterId:string=chapterId){
  if(!doc) throw new Error('No indexed textbook is loaded.');
  const scope=generationScope(forChapterId);
  const generationChapters=[...doc.chapters,scope.chapter];
  const material=await generateMaterial(doc.id,type,doc.sources,teachingLanguage,undefined,scope.chapter.id,generationChapters);
  // Deployment rule: only a fully passed material may be persisted. The pipeline
  // performs up to three repair/regeneration passes; `needs_review` is not deployable.
  if(material.qa.status!=='passed'||Number(material.qa.score||0)<85)throw new Error(`QA gate not passed after regeneration (${material.qa.status}, ${material.qa.score}/100). ${material.qa.issues?.slice(0,4).join(' ')||''}`);
  const save=await fetch('/api/ai-guru/material-studio/materials',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({material,guestName:loadProfile().name||''})});
  const j=await save.json();
  if(!save.ok||!j.ok)throw new Error(j.error||'Material save failed');
  setMaterials(prev=>[j.material,...prev.filter((x:StudyMaterial)=>x.id!==j.material.id)]);
  return j.material as StudyMaterial;
 }
 function toggleMaterialType(type:MaterialType){
  setSelectedMaterialTypes(current=>current.includes(type)?current.filter(item=>item!==type):[...current,type]);
 }
 /** Creates only the explicitly selected material types for the current
  * five-part textbook scope. A part is a local source-ID filter; the other
  * four parts never enter generateMaterial(). If a chapter is selected, the
  * source set is narrowed again to that chapter inside the selected part.
  */
 type Task={chapterId:string;chapterTitle:string;type:MaterialType};
 /** V51.9.163: the parts ticked on the left (one or more), in book order. */
 const chosenParts=useMemo(()=>studyParts.filter(p=>selectedPartIds.includes(p.id)),[studyParts,selectedPartIds]);
 async function createTypes(types:MaterialType[]){
  if(!doc||!byokGate())return;
  if(!types.length){setError('Select at least one material type to create.');return;}
  if(!chosenParts.length){setError('Select at least one of the textbook parts first.');return;}
  const shut=chosenParts.find(p=>createLocked.has(p.index));if(shut){setPayNotice(shut.index);return;}
  // one part: the chosen chapter (or the whole part); several parts: each whole part
  const scopes=chosenParts.length===1&&chapterId!=='all'
   ?[{id:`${chosenParts[0].id}::${chapterId}`,title:doc.chapters.find(c=>c.id===chapterId)?.title||'Selected chapter'}]
   :chosenParts.map(p=>({id:p.id,title:p.title}));
  await runTasks(scopes.flatMap(sc=>types.map(type=>({chapterId:sc.id,chapterTitle:sc.title,type}))),true);
 }
 /** V51.9.163: makes every material that failed in the last run again (the "Try again" button). */
 async function retryFailed(){
  if(!doc||!byokGate())return;
  const tasks:Task[]=Object.entries(batch).filter(([,v])=>v.state==='failed').map(([key])=>{
   const type=MATERIAL_TYPES.find(t=>key.endsWith(`::${t}`))!;
   const cid=key.slice(0,-(type.length+2));
   const title=cid.includes('::')?(doc.chapters.find(c=>c.id===cid.split('::').pop())?.title||cid):(studyParts.find(p=>p.id===cid)?.title||cid);
   return {chapterId:cid,chapterTitle:title,type};
  });
  if(!tasks.length)return;
  await runTasks(tasks,false);
 }
 async function runTasks(tasks:Task[],fresh:boolean){
  if(!doc)return;
  setActiveMaterialType(tasks[0]?.type??null);
  const lanes=Math.max(1,Math.min(3,orderedUsableKeys().length));
  setBusy(true);setBatchRunning(true);setError('');
  const pending=Object.fromEntries(tasks.map(t=>[batchKey(t.chapterId,t.type),{state:'pending' as const}]));
  setBatch(b=>fresh?pending:{...b,...pending});
  let done=0,failed=0;let firstReason='';
  const queue=[...tasks];
  const worker=async()=>{
   for(;;){
    const task=queue.shift();
    if(!task)return;
    setBatch(b=>({...b,[batchKey(task.chapterId,task.type)]:{state:'running'}}));
    setStatus(`Creating ${labels[task.type]} · ${task.chapterTitle}… (${done+failed}/${tasks.length} finished)`);
    try{
     const material=await generateOne(task.type,task.chapterId);
     done++;setBatch(b=>({...b,[batchKey(task.chapterId,task.type)]:{state:'done'}}));setSelected(prev=>prev||material);
    }catch(e){
     failed++;
     const detail=e instanceof Error?e.message:'Generation failed';
     if(!firstReason)firstReason=detail;
     setBatch(b=>({...b,[batchKey(task.chapterId,task.type)]:{state:'failed',detail}}));
    }
   }
  };
  try{
   await Promise.all(Array.from({length:lanes},()=>worker()));
   setStatus(`Study-material pack finished · ${done} created${failed?` · ${failed} failed (see the per-chapter progress below)`:''}`);
   if(failed&&!done)setError(`Every material failed. ${firstReason?`Reason: ${firstReason.slice(0,240)} — `:''}the most common causes are an exhausted Gemini key pool or a chapter with too little readable source text. Press Try again in a moment.`);
   else if(failed)setError(`${failed} material${failed===1?'':'s'} failed. ${firstReason?`Reason: ${firstReason.slice(0,240)}. `:''}Press Try again to make only the failed ones again.`);
  }finally{setBusy(false);setBatchRunning(false)}
 }
 async function createSelected(){await createTypes([...selectedMaterialTypes]);}
 const chapterLabel=useMemo(()=>chapterId==='all'?(selectedPart?.title||'Selected part'):doc?.chapters.find(c=>c.id===chapterId)?.title||'Selected chapter',[chapterId,doc,selectedPart]);
 const activeScopeId=chapterId==='all'?selectedPart?.id||'part-1':`${selectedPart?.id||'part-1'}::${chapterId}`;
 const materialMade=(type:MaterialType)=>materials.some(m=>m.type===type&&((m.chapterIds||[]).includes(activeScopeId)||((m.chapterIds||[]).length===1&&m.chapterIds?.[0]===chapterId)));
 const createdMaterialCount=useMemo(()=>MATERIAL_TYPES.filter(type=>materialMade(type)).length,[materials,activeScopeId]);
 const failedCount=Object.values(batch).filter(v=>v.state==='failed').length;
 const chaptersInBatch=useMemo(()=>[...new Set(Object.keys(batch).map(k=>{const type=MATERIAL_TYPES.find(t=>k.endsWith(`::${t}`));return type?k.slice(0,-(type.length+2)):k}))],[batch]);
 async function retryChapterType(cid:string,type:MaterialType){
  if(!doc||!byokGate())return;
  const key=batchKey(cid,type);
  setBusy(true);setError('');setBatch(b=>({...b,[key]:{state:'running'}}));
  try{
   await generateOne(type,cid);
   setBatch(b=>({...b,[key]:{state:'done'}}));
  }catch(e){
   setBatch(b=>({...b,[key]:{state:'failed',detail:e instanceof Error?e.message:'Generation failed'}}));
  }finally{setBusy(false)}
 }
 return <main className="min-h-screen bg-[#070a0f] text-white" style={{fontFamily:'Noto Sans, Chilanka, Noto Sans Malayalam, Nirmala UI, sans-serif'}}>
  <AiGuruTopNav activeLabel="Material Studio" />
  {/* V51.9.114: the page's own second menu was removed — the site menu above already has every link. */}
  <div className="border-b border-cyan-300/10 bg-[#091725] px-4 py-2">
   <div className="mx-auto flex max-w-7xl items-center justify-end gap-2">
    <Link href="/ai-guru/settings/gemini" className={`rounded-lg border px-3 py-2 text-xs font-semibold ${(byok||fallbackReady)?'border-emerald-300/25 bg-emerald-300/10 text-emerald-100':'border-amber-300/20 bg-amber-300/10 text-amber-100'}`}>{byok?'✓ Gemini key active':activeFallback.includes('OpenRouter')?'✓ OpenRouter key active':fallbackReady?'✓ AI key active':'Your AI keys'}</Link>
   </div>
  </div>
  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><div><Link href="/ai-guru" className="text-xs text-white/45"><ArrowLeft className="mr-1 inline" size={14}/> Back to AI Guru</Link><h1 className="mt-2 text-2xl font-semibold">Material Studio</h1><p className="text-sm text-white/45">Understand the textbook once · create grounded materials without changing the AI Guru classroom</p></div></header>
  {/* V51.9.181: the cloud and private-book notices sit under the page title (they were above the site menu) */}
  {cloudMode&&<div className="mx-auto mt-3 max-w-7xl rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">☁ AI Guru cloud: upload your textbook PDF here without a key of your own. When it is indexed, open <a className="underline" href="/ai-guru/student/library?all=1">your library</a> and use “Create on cloud” on its parts.</div>}{guest&&<div className="mx-auto mt-2 max-w-7xl rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">🔒 Not signed in: this book and its materials are saved privately for this browser (not in the shared library). AI uses only your own keys from Settings. <a className="underline" href="/ai-guru/student">Sign in</a> to share them with your class.</div>}
  {/* V51.9.180 (UX review): where this visitor's books go — one sentence for their actual state, under the page title */}
  {signedIn!==null&&!guest&&<p className="mx-auto max-w-7xl px-5 pt-3 text-xs text-white/60" data-studio-where>{signedIn?<>You are signed in: books and study materials you make here go to the AI Guru library, so students of the same syllabus and class can use them. <a className="text-cyan-300 underline" href="/ai-guru/student/library">Library</a></>:<>You are not signed in: books and study materials you make here are kept privately in this browser. <a className="text-cyan-300 underline" href="/ai-guru/student">Sign in</a> to share them with your class.</>}</p>}
  <section className="mx-auto max-w-7xl pt-5"><div className="rounded-2xl border border-white/10 bg-[#10141b] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-xs font-semibold uppercase tracking-[.18em] text-white/45">My textbooks</div><div className="mt-0.5 text-[11px] text-white/35">One textbook per subject. Pick a book to make its study materials, or start another subject.</div></div><button type="button" disabled={busy} onClick={startAnotherSubject} className="min-h-[40px] rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40">＋ Another subject</button></div>
   <div className="mt-3 flex flex-wrap gap-2">{myBooks.length===0&&<span className="text-xs text-white/35">No textbook yet — choose the subject below and upload its PDF.</span>}{myBooks.map(b=>{const on=doc?.id===b.id;return <span key={b.id} className={`group inline-flex max-w-full items-center gap-1 rounded-xl border text-xs ${on?'border-cyan-300/60 bg-cyan-300/15 text-cyan-50':'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'}`}><button type="button" disabled={busy} onClick={()=>openBook(b.id)} className="flex min-w-0 items-center gap-2 px-3 py-2 text-left disabled:opacity-50" title={b.fileName}><b className="shrink-0">{b.subject||'Subject?'}</b><span className="shrink-0 text-white/45">{b.grade?`Class ${b.grade}`:''}</span><span className="truncate text-white/50">{b.fileName}</span>{on&&<span className="shrink-0 rounded bg-cyan-300 px-1.5 text-[10px] font-semibold text-black">open</span>}</button>{!on&&<button type="button" disabled={busy} onClick={()=>setMyBooks(forgetBook(b.id))} className="px-2 py-2 text-white/30 hover:text-red-200" title="Remove from this list (the book and its materials are not deleted)" aria-label={`Remove ${b.fileName} from the list`}>×</button>}</span>;})}</div></div></section>
  <section className="mx-auto max-w-7xl py-5"><div className="rounded-2xl border border-white/10 bg-[#10141b] p-5"><div className="flex items-start gap-3"><LibraryBig className="mt-1 text-cyan-300" size={22}/><div><h2 className="text-lg font-semibold"><span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-300 text-sm font-bold text-black">1</span>About the textbook</h2><p className="mt-1 text-sm text-white/60">Answer these five first. They decide how the book is read, the chapters, the teaching language and every study material made from it.</p></div></div>
   <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
    <Field label="Subject" value={subject} set={setSubject} options={SUBJECTS.map(x=>[x,x])}/><Field label="Class" value={grade} set={setGrade} options={Array.from({length:12},(_,i)=>[String(i+1),`Class ${i+1}`])}/><Field label="Syllabus" value={syllabus} set={setSyllabus} options={SYLLABI}/><Field label="PDF language" value={sourceLanguage} set={setSourceLanguage} options={LANGUAGES}/><Field label="Teach me in" value={teachingLanguage} set={setTeachingLanguage} options={LANGUAGES}/>
   </div>
   <div className={`mt-4 rounded-xl border p-3 text-sm ${ready?'border-cyan-300/20 bg-cyan-300/5 text-cyan-100':'border-white/10 bg-black/20 text-white/45'}`}>{ready?<><CheckCircle2 className="mr-2 inline" size={16}/>Ready. Study materials will contain English plus <b>{LANGUAGES.find(x=>x[0]===teachingLanguage)?.[1]||teachingLanguage}</b>. Teaching follows the two-pass paragraph method.</>:<>Answer all five, then choose the PDF below.</>}</div>
   {/* V51.9.181 (UX review item 5): step 2 comes after the questions that unlock it, instead of a greyed-out button at the top of the page */}
   <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4" data-studio-step="pdf">
    <h2 className="text-base font-semibold"><span className={`mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${ready?'bg-cyan-300 text-black':'bg-white/15 text-white/70'}`}>2</span>Choose the textbook PDF</h2>
    <label className={`mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold sm:w-auto sm:inline-flex ${ready&&!busy?'cursor-pointer bg-cyan-300 text-black hover:bg-cyan-200':'cursor-not-allowed bg-white/10 text-white/60'}`}><Upload size={18}/> {busy?'Reading the book…':doc?'Add another PDF':ready?'Choose PDF':'Choose PDF (answer step 1 first)'}<input type="file" accept="application/pdf" className="hidden" disabled={!ready||busy} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>e.target.files?.[0]&&void upload(e.target.files[0])}/></label>
    <label className="mt-3 flex items-start gap-2 text-sm text-white/70" data-whole-book><input type="checkbox" className="mt-1" checked={wholeBook} disabled={busy} onChange={(e)=>setWholeBook(e.target.checked)}/><span>Upload the whole book. <span className="text-white/45">Off: only <b>Part 1</b> (the first fifth, the free part) is uploaded and its study materials are made. Faster, and best for a demonstration.</span></span></label>
   </div>
    <div className={`mt-3 rounded-xl border p-3 text-sm ${(byok||fallbackReady)?'border-emerald-300/20 bg-emerald-300/5 text-emerald-100':'border-amber-300/20 bg-amber-300/5 text-amber-100'}`}>{(byok||fallbackReady)?<><CheckCircle2 className="mr-2 inline" size={16}/>{byok?'Your Gemini key is ready.':activeFallback.includes('OpenRouter')?'OpenRouter is ready (no Gemini key).':'No Gemini key, but another AI key is ready.'} {fallbackReady&&<span className="text-emerald-200/80">Configured providers: {activeFallback.join(' → ')}.</span>} OpenAI is used first when configured; otherwise Gemini is tried first, followed by available providers.</>:<>No AI provider is active. <Link href="/ai-guru/settings/gemini" className="underline">Open Your AI keys</Link> and connect Gemini, OpenAI, Agnes AI, or Sarvam AI before creating study materials.</>}</div><AiKeysLog/></div></section>
  {(busy || progressStage==='complete' || progressStage==='error') && <section className="mx-auto max-w-7xl pb-5" aria-live="polite">
    <div className={`rounded-2xl border p-5 ${progressStage==='error' ? 'border-red-400/30 bg-red-950/20' : progressStage==='complete' ? 'border-emerald-300/20 bg-emerald-300/5' : 'border-cyan-300/20 bg-[#101a20]'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {busy ? <Loader2 className="animate-spin text-cyan-300" size={22}/> : progressStage==='complete' ? <CheckCircle2 className="text-emerald-300" size={22}/> : <FileText className="text-red-300" size={22}/>} 
            <div>
              <h2 className="text-lg font-semibold">{busy ? 'AI Guru is processing your textbook' : progressStage==='complete' ? 'Textbook processing complete' : 'Textbook processing stopped'}</h2>
              <p className="mt-1 text-sm text-white/60">{status || (progressStage==='complete' ? 'The complete book is indexed and ready for study-material creation.' : 'Please correct the error and choose the PDF again.')}</p>
            </div>
          </div>
          {/* V51.9.181 (UX review item 5): step 3 — the obvious next thing to do */}
          {progressStage==='complete'&&!busy&&doc&&<a href={`/ai-guru/classroom?materialDocument=${encodeURIComponent(doc.id)}`} className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-base font-extrabold text-[#1a1200] shadow-[0_10px_30px_rgba(245,184,61,.3)] hover:bg-amber-300" data-studio-start-class><span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#1a1200] text-sm text-amber-300">3</span>Start a class with this book →</a>}
        </div>
        <div className="min-w-[190px] text-right">
          <div className="text-2xl font-bold text-cyan-200">{progress}%</div>
          <div className="text-xs text-white/40">overall progress</div>
        </div>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/40" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <div className={`h-full rounded-full transition-all duration-300 ${progressStage==='complete' ? 'bg-emerald-300' : progressStage==='error' ? 'bg-red-400' : 'bg-cyan-300'}`} style={{width:`${progress}%`}} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className={`rounded-lg px-3 py-2 ${progressStage==='reading'?'bg-cyan-300/10 text-cyan-100':'bg-white/5 text-white/45'}`}><b>1. Read PDF</b>{progressTotal ? <span className="ml-2 font-mono">Page {progressPage} / {progressTotal}</span> : null}</div>
        <div className={`rounded-lg px-3 py-2 ${progressStage==='indexing'?'bg-cyan-300/10 text-cyan-100':'bg-white/5 text-white/45'}`}><b>2. Index paragraphs</b></div>
        <div className={`rounded-lg px-3 py-2 ${progressStage==='understanding'?'bg-cyan-300/10 text-cyan-100':'bg-white/5 text-white/45'}`}><b>3. Understand chapters</b></div>
        <div className={`rounded-lg px-3 py-2 ${progressStage==='saving'?'bg-cyan-300/10 text-cyan-100':'bg-white/5 text-white/45'}`}><b>4. Save textbook</b></div>
      </div>
      {progressStage==='reading' && progressTotal>0 && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/45"><span>Reading every page before AI Guru builds the chapter map.</span><span className="font-mono text-cyan-200">{progressPage} of {progressTotal} pages · {Math.round((progressPage/progressTotal)*100)}%</span></div>}
      {progressStage==='complete' && doc && <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-sm text-emerald-100"><b>{doc.fileName}</b> · {doc.pageCount} pages · {doc.chapters.length} chapters · {doc.sources.length} paragraph units. All materials will reuse this index.</div>}
      {/* This used to only be shown inside the {doc && ...} panel further down
          the page, which never renders when upload/indexing fails BEFORE a
          document exists — so a failed upload showed the generic fallback
          text above and nothing else. This is the actual thrown error text
          plus a concrete next step, and it is not gated on `doc`. */}
      {progressStage==='error' && error && <div className="mt-3 space-y-2">
        <div role="alert" className="rounded-xl border border-red-400/40 bg-red-950/30 p-3 text-sm text-red-100"><b>What went wrong: </b>{error}</div>
        <div className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-3 text-sm text-amber-100"><b>What to do: </b>{explainUploadError(error)}</div>
      </div>}
    </div>
  </section>}
  {doc&&<div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[300px_1fr]">
   <aside className="rounded-2xl border border-white/10 bg-[#10141b] p-4"><div className="text-xs uppercase tracking-[.2em] text-white/35">Indexed Textbook</div><h2 className="mt-2 font-semibold">{doc.fileName}</h2><div className="mt-1 text-xs text-white/45">{doc.pageCount} pages · {doc.sources.length} paragraph units</div>{(doc as IndexedDocument & {access?:{full:boolean}}).access?.full===false&&<div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-xs text-amber-100">🔒 Parts that are not paid are locked for this sign-in: their text is not loaded and no study materials can be made for them. Pay a part in My account → Pay by UPI to open it (its materials are then made for you).</div>}<div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3 text-xs text-cyan-100"><CheckCircle2 className="mr-1 inline" size={14}/> The textbook is indexed once. Study materials are generated only for the part/chapter and material type you choose.</div>
   <div className="mt-5"><div className="flex items-center justify-between gap-2"><div className="text-xs font-semibold text-white/65">1. Choose textbook part(s)</div>{studyParts.length>1&&<button type="button" disabled={busy} onClick={()=>{const open=studyParts.filter(p=>!createLocked.has(p.index));const all=selectedPartIds.length===open.length;setSelectedPartIds(all?[selectedPart?.id||'part-1']:open.map(p=>p.id));setChapterId('all');}} className="text-[11px] text-cyan-300 underline disabled:opacity-40">{selectedPartIds.length===studyParts.length?'Only one part':'Select all parts'}</button>}</div><div className="mt-1 text-[11px] text-white/35">The book is divided locally into 5 contiguous study parts. Tick one or more parts (for example Part 2 and Part 3) — materials are made for each ticked part. Selecting a part does not call an AI API.</div><div className="mt-3 grid grid-cols-1 gap-2">{payNotice!==null&&<div role="alert" className="mt-3 rounded-xl border border-amber-300/50 bg-amber-300/10 p-3 text-xs text-amber-50" data-pay-notice><b className="block text-sm">🔒 Part {payNotice} opens when its fee{priceText} is paid</b>Pay it in My account → Pay by UPI. Part {payNotice} then opens in every book, and its study materials are made for you automatically.{payNotice}<div className="mt-2 flex gap-2"><a href="/ai-guru/student#pay" className="rounded-lg bg-amber-300 px-3 py-1.5 font-extrabold text-[#1a1200]">💳 Pay now</a><button type="button" onClick={()=>setPayNotice(null)} className="rounded-lg border border-amber-200/40 px-3 py-1.5">Close</button></div></div>}{studyParts.map(part=>{const ticked=selectedPartIds.includes(part.id);const focus=selectedPart?.id===part.id;const shut=createLocked.has(part.index);if(shut)return <button key={part.id} type="button" aria-disabled="true" onClick={()=>setPayNotice(part.index)} data-part-locked={part.index} className="cursor-not-allowed rounded-xl border border-white/10 bg-white/[.02] p-3 text-left opacity-70"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-sm font-semibold text-white/60">🔒 {part.title}</span><span className="text-[10px] text-white/40">pp. {part.startPage}–{part.endPage}</span></div><div className="mt-1 text-[11px] text-amber-200/80">Pay{docAccess?.partPrice?` ₹${docAccess.partPrice.toLocaleString('en-IN')}`:' the fee'} to open this part</div></button>;return <button key={part.id} type="button" disabled={busy} aria-pressed={ticked} onClick={()=>{
       // V51.9.163: parts toggle on and off (at least one stays ticked); the last one ticked is the one shown below
       if(ticked&&selectedPartIds.length>1){const rest=selectedPartIds.filter(id=>id!==part.id);setSelectedPartIds(rest);if(focus)setSelectedPartId(rest[rest.length-1]);}
       else if(!ticked){setSelectedPartIds(ids=>studyParts.map(p=>p.id).filter(id=>id===part.id||ids.includes(id)));setSelectedPartId(part.id);}
       else setSelectedPartId(part.id);
       setChapterId('all');setSelected(null);setActiveMaterialType(null);
      }} className={`rounded-xl border p-3 text-left transition ${ticked?'border-cyan-300/60 bg-cyan-300/10':'border-white/10 bg-white/5 hover:bg-white/10'} ${focus&&selectedPartIds.length>1?'ring-1 ring-cyan-300/50':''} disabled:opacity-50`}><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 font-semibold text-sm"><span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${ticked?'border-cyan-300 bg-cyan-300 text-black':'border-white/30'}`}>{ticked?'✓':''}</span>{part.title}</span><span className="text-[10px] text-white/40">pp. {part.startPage}–{part.endPage}</span></div><div className="mt-1 text-[11px] text-white/45">{part.chapters.length?`${part.chapters.length} chapter${part.chapters.length===1?'':'s'}`:'textbook section'}</div></button>})}</div></div>
   <div className="mt-5"><div className="text-xs font-semibold text-white/65">2. Choose chapter (optional)</div><label className="mt-2 block text-xs text-white/45">Create for</label><select value={chapterId} disabled={selectedPartIds.length>1} style={{colorScheme:'dark'}} onChange={e=>setChapterId(e.target.value)} className="mt-2 w-full disabled:opacity-40 rounded-xl border border-white/10 bg-[#161c26] p-2.5 text-sm text-white outline-none focus:border-cyan-300"><option className="bg-[#161c26] text-white" value="all">Entire {selectedPart?.title||'selected part'}</option>{chapterOptions.map(c=><option className="bg-[#161c26] text-white" key={c.id} value={c.id}>{c.title} · pp. {c.startPage}–{c.endPage}</option>)}</select><div className="mt-1 text-[11px] text-white/35">{selectedPartIds.length>1?`${selectedPartIds.length} parts are ticked: each whole part gets its own materials. Tick one part to choose a single chapter.`:'Choosing a chapter further reduces the AI context to that chapter inside the selected part.'}</div></div>
   <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-xs font-semibold text-white/65">3. Choose study material</div><div className="mt-1 text-[11px] text-white/35">Select only what you want to study now. Nothing is generated until you press Create selected.</div></div><div className="text-xs font-mono text-white/45">{createdMaterialCount}/{MATERIAL_TYPES.length} in scope</div></div><div className="mt-3 flex flex-wrap gap-2">{MATERIAL_TYPES.map(type=>{const st=batch[batchKey(activeScopeId,type)]?.state;const made=materialMade(type)||st==='done';const active=activeMaterialType===type;const chosen=selectedMaterialTypes.includes(type);return <button key={type} type="button" disabled={!canCreate} aria-pressed={chosen} onClick={()=>toggleMaterialType(type)} title={batch[batchKey(activeScopeId,type)]?.detail||(!byok?'Select this type; add an AI key before creating':`Select ${labels[type]} for creation`)} className={`rounded-xl border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${st==='failed'?'border-red-400/40 bg-red-950/25 text-red-100':chosen?'border-cyan-300/60 bg-cyan-300/15 text-cyan-100':made?'border-emerald-300/35 bg-emerald-300/15 text-emerald-100':active||st==='running'?'border-violet-400/60 bg-violet-600/30 text-white shadow-[0_0_18px_rgba(124,58,237,.22)]':'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10 hover:text-white'}`}>{chosen?<CheckCircle2 className="mr-1 inline" size={13}/>:st==='running'?<Loader2 className="mr-1 inline animate-spin" size={13}/>:made?<CheckCircle2 className="mr-1 inline" size={13}/>:<Sparkles className="mr-1 inline" size={13}/>} {labels[type]}{st==='failed'&&<span className="ml-1 opacity-80">· Retry</span>}</button>})}</div><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!canCreate||selectedMaterialTypes.length===0} onClick={()=>void createSelected()} className="rounded-lg bg-cyan-300 px-4 py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">{batchRunning?`Creating selected (${selectedMaterialTypes.length})…`:`Create selected (${selectedMaterialTypes.length}${chosenParts.length>1?` × ${chosenParts.length} parts`:''})`}</button><button type="button" disabled={!canCreate||selectedMaterialTypes.length===0} onClick={()=>setSelectedMaterialTypes([])} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/45 disabled:cursor-not-allowed disabled:opacity-40">Clear selection</button></div><div className="mt-2 text-[10px] text-emerald-200/70">Cost control: only the selected part/chapter + selected material type(s) are sent to the AI generation pipeline.</div></div>
   {chaptersInBatch.length>0&&<div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
    <div className="text-xs font-semibold text-white/60">Per-chapter progress</div>
    <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">{chaptersInBatch.map(cid=>{
     const chTitle=cid.startsWith('part-')?(studyParts.find(p=>p.id===cid)?.title||cid):cid.includes('::')?(doc.chapters.find(c=>c.id===cid.split('::').pop())?.title||cid): (doc.chapters.find(c=>c.id===cid)?.title||cid);
      const rows=MATERIAL_TYPES.filter(type=>batch[batchKey(cid,type)]).map(type=>({type,st:batch[batchKey(cid,type)]?.state}));
     const done=rows.filter(r=>r.st==='done').length,failed=rows.filter(r=>r.st==='failed').length,running=rows.filter(r=>r.st==='running').length;
     return <div key={cid} className="rounded-lg border border-white/10 bg-white/5 p-2">
       <div className="flex items-center justify-between gap-2 text-[11px]"><span className="truncate text-white/70">{chTitle}</span><span className={failed?'text-red-200':running?'text-cyan-200':rows.length>0&&done===rows.length?'text-emerald-200':'text-white/40'}>{done}/{rows.length}{failed?` · ${failed} failed`:''}</span></div>
      <div className="mt-1.5 flex flex-wrap gap-1">{rows.map(r=><button key={r.type} title={`${labels[r.type]}${batch[batchKey(cid,r.type)]?.detail?`: ${batch[batchKey(cid,r.type)]?.detail}`:''}`} onClick={()=>r.st==='failed'&&void retryChapterType(cid,r.type)} className={`h-2 w-4 rounded-full ${r.st==='done'?'bg-emerald-300':r.st==='failed'?'bg-red-400 cursor-pointer':r.st==='running'?'bg-cyan-300 animate-pulse':'bg-white/15'}`}/>)}</div>
     </div>;
    })}</div>
   </div>}
  </aside>
   <section className="min-h-[620px] rounded-2xl border border-white/10 bg-[#10141b] p-4">{busy&&<div className="mb-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4"><div className="flex items-center justify-between gap-3 text-sm"><div className="flex items-center gap-2"><Loader2 className="animate-spin text-cyan-300" size={17}/><span>{status}</span></div><b className="text-cyan-200">{progress}%</b></div><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-cyan-300 transition-all duration-300" style={{width:`${progress}%`}}/></div><div className="mt-3 grid grid-cols-4 gap-2 text-[11px]"><div className={progressStage==='reading'?'text-cyan-200':'text-white/40'}>1. Read pages{progressTotal?` · ${progressPage}/${progressTotal}`:''}</div><div className={progressStage==='indexing'?'text-cyan-200':'text-white/40'}>2. Index paragraphs</div><div className={progressStage==='understanding'?'text-cyan-200':'text-white/40'}>3. Understand chapters</div><div className={progressStage==='saving'?'text-cyan-200':'text-white/40'}>4. Save textbook</div></div></div>}{!busy&&status&&<div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/70">{status}</div>}{error&&<div role="alert" className="mb-4 rounded-xl border border-red-400/40 bg-red-950/30 p-3 text-sm text-red-100"><div>{error}</div>{failedCount>0&&<div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" disabled={busy} onClick={()=>void retryFailed()} className="rounded-lg bg-red-300 px-4 py-2 text-xs font-semibold text-black hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50">{busy?<><Loader2 className="mr-1 inline animate-spin" size={13}/>Trying again…</>:<>↻ Try again ({failedCount})</>}</button><Link href="/ai-guru/settings/gemini" className="rounded-lg border border-red-300/40 px-3 py-2 text-xs text-red-100 hover:bg-red-300/10">Check my AI keys</Link></div>}</div>}
    {!materials.length?<div className="flex h-[540px] items-center justify-center text-center text-white/35"><div><BookOpen className="mx-auto mb-3" size={42}/><p>{chapterId==='all'?`${selectedPart?.title||'Study part'} selected.`:'Chapter selected.'}</p><p className="mt-1 text-xs">Now click a study-material type on the left, such as Whiteboard Notes. Each material is QA-checked before it is saved.</p>{!(byok||fallbackReady)&&<p className="mt-3 text-xs text-amber-200">No AI provider is active. Connect Gemini, OpenRouter, OpenAI, Agnes AI, or Sarvam AI in Settings → Your AI keys.</p>}</div></div>:<div><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">Created Materials</h2><p className="text-xs text-white/40">{chapterLabel} · English + {LANGUAGES.find(x=>x[0]===doc.teachingLanguage)?.[1]||doc.teachingLanguage}</p></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{materials.map(m=>{const scopedChapter=m.chapterIds?.length===1?doc.chapters.find(c=>c.id===m.chapterIds![0]):undefined;return <button key={m.id} onClick={()=>setSelected(m)} className={`rounded-xl border p-3 text-left ${selected?.id===m.id?'border-cyan-300 bg-cyan-300/10':'border-white/10 bg-white/5'}`}><div className="font-medium">{scopedChapter?`${scopedChapter.title} — `:''}{m.title}</div><div className="mt-1 text-xs text-white/45">{labels[m.type]} · QA {m.qa.score}/100 · {m.sections.length} units</div></button>;})}</div>{selected&&<article className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{selected.title}</h3><div className="text-xs text-white/40">QA {selected.qa.status} · {selected.qa.score}/100 · {selected.materialLanguages.join(' + ')}</div></div><Link href={`/ai-guru?materialDocument=${encodeURIComponent(selected.documentId)}&material=${encodeURIComponent(selected.id)}`} className="rounded-xl bg-cyan-300 px-3 py-2 text-xs font-semibold text-black">Teach in Classroom</Link></div><p className="mt-3 text-sm text-white/70">{selected.overview}</p><div className="mt-4 space-y-3">{selected.sections.slice(0,8).map(s=><div key={s.id} className="rounded-xl border border-white/10 p-3"><b>{s.heading}</b>{s.teachingPass&&<><p className="mt-2 text-xs text-white/40">Source paragraph</p><p className="text-sm text-white/60">{s.teachingPass.sourceText}</p><p className="mt-2 text-xs text-cyan-200">English explanation</p><p className="text-sm text-white/70">{s.teachingPass.englishExplanation}</p><p className="mt-2 text-xs text-cyan-200">{doc.teachingLanguage} explanation</p><p className="text-sm text-white/70">{s.teachingPass.translatedExplanation}</p></>}</div>)}</div></article>}</div>}
   </section></div>}
 </main>
}
// The native dropdown popup is painted by the OS/browser, not by the page, so a
// translucent Tailwind background (bg-white/5) resolved against the popup's own
// white surface while the text kept inheriting the page's white colour — which is
// why the open list looked blank. Both the closed control and every <option> now
// carry a solid dark background and an explicit light text colour.
function Field({label,value,set,options}:{label:string;value:string;set:(v:string)=>void;options:string[][]}){return <label className="space-y-1"><span className="text-xs font-semibold text-white/55">{label}</span><select value={value} style={{colorScheme:'dark'}} onChange={e=>set(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#161c26] p-3 text-sm text-white outline-none focus:border-cyan-300"><option className="bg-[#161c26] text-white" value="">Select {label.toLowerCase()}</option>{options.map(([id,text])=><option className="bg-[#161c26] text-white" key={id} value={id}>{text}</option>)}</select></label>}
