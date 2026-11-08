import { NextResponse } from 'next/server';
import { documentToParagraphSources } from '@/lib/ai-guru/document/normalize';
import type { DocumentArtifact } from '@/lib/document/types';
import { legacyLessonToCanonical } from '@/lib/ai-guru/integration/legacy-adapter';
import type { AIGuruLesson } from '@/lib/ai-guru/lesson/types';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { artifact?: DocumentArtifact; bookId?: string; chapterSize?: number };
    if (!body.artifact) return NextResponse.json({ ok:false, error:'Document artifact is required' }, { status:400 });
    const chapterSize = Math.max(10, Math.min(60, Math.floor(body.chapterSize ?? 30)));
    const bookId = body.bookId ?? `book:${Date.now()}`;
    const paragraphs = documentToParagraphSources(body.artifact, bookId);
    const pageMap = new Map<number, typeof paragraphs>();
    for (const p of paragraphs) pageMap.set(p.pageNumber, [...(pageMap.get(p.pageNumber) ?? []), p]);
    const pages = [...pageMap.entries()].sort((a,b)=>a[0]-b[0]).map(([pageNumber, pageParagraphs])=>({ pageNumber, paragraphs: pageParagraphs }));
    const chapters=[];
    for(let start=0; start<pages.length; start+=chapterSize){
      const chunk=pages.slice(start,start+chapterSize);
      chapters.push({ id:`chapter-${chapters.length+1}`, index:chapters.length, pageStart:chunk[0]?.pageNumber ?? 1, pageEnd:chunk.at(-1)?.pageNumber ?? 1, pages:chunk });
    }
    const canonicalLesson: AIGuruLesson = { schemaVersion:'1.0', id:`lesson:${bookId}`, title: body.artifact.metadata.fileName ?? 'AI Guru Book', language:{source:'english',target:'malayalam'}, teachingMode:'two-pass', paragraphs: paragraphs.map((source) => ({ id:`${source.bookId}:${source.pageNumber}:${source.paragraphIndex}`, source, english:{text:'',visuals:[]}, malayalam:{text:'',visuals:[]}, cues:[], verified:false })) };
    return NextResponse.json({ ok:true, book:{ bookId, pageCount:pages.length ? Math.max(...pages.map(p=>p.pageNumber)) : 0, chapterSize, chapters, paragraphs }, canonicalLesson: legacyLessonToCanonical(canonicalLesson) });
  } catch (error) {
    return NextResponse.json({ ok:false, error:error instanceof Error?error.message:'Book preparation failed' }, { status:400 });
  }
}
