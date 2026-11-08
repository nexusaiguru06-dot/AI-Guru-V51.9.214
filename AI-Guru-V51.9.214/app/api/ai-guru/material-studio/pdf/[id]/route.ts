import { NextResponse } from 'next/server';
import { getDocument, pdfStream } from '@/lib/ai-guru/material-studio/store';
import { cachedPdf, withPdfSlot } from '@/lib/ai-guru/material-studio/pdf-work';
import { contentAccessFor, fullFor, mayView } from '@/lib/ai-guru/admin/content-access';
import { lockedPartsOf } from '@/lib/ai-guru/material-studio/locks';
import { redactedPdf } from '@/lib/ai-guru/material-studio/redact-pdf';
export const runtime='nodejs';

/** The book's PDF. V51.9.93: for a student who has not paid, pages of locked parts are replaced by blank "locked" pages
 *  (same page numbers, none of their content), so the PDF fallback in the classroom cannot show them. */
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const a=await contentAccessFor(request);
  const doc=await getDocument(id);
  if(doc&&!mayView(doc,a))return NextResponse.json({error:'PDF not found'},{status:404});
  if(!(doc?fullFor(doc,a):a.full)){
    const {lockedParts,freeParts}=doc?lockedPartsOf(doc,a.freeParts,false,a.paidParts):{lockedParts:[] as number[],freeParts:[] as number[]};
    if(doc&&lockedParts.length){
      // V51.9.179: redaction loads the book into memory, so it waits for a free PDF slot
      const out=await withPdfSlot(async()=>{const pdf=await cachedPdf(id);return pdf?redactedPdf(doc,pdf,lockedParts,freeParts):null;});
      if(!out)return NextResponse.json({error:'PDF not found'},{status:404});
      return new Response(new Uint8Array(out),{headers:{'content-type':'application/pdf','cache-control':'private, no-store','x-pdf-locked-parts':lockedParts.join(',')}});
    }
  }
  // V51.9.179: the whole book is sent as a stream from storage, never loaded into memory
  const stream=await pdfStream(id);
  if(!stream)return NextResponse.json({error:'PDF not found'},{status:404});
  return new Response(stream,{headers:{'content-type':'application/pdf','cache-control':'private, no-store'}});
}
