/**
 * The ten study parts of an indexed textbook (moved here from Material Studio in V51.9.93 so the server can use the same
 * split): contiguous page ranges that prefer chapter boundaries. Pure, no AI call. Part 1 is the free trial by default.
 */
import type { BookChapter, IndexedDocument, IndexedSource, StudyMaterial } from './types';

/** V51.9.211: ten parts, one for each academic month (the office links each part to a month). */
export const PART_COUNT = 10;
export type StudyPart={
 id:string;
 index:number;
 title:string;
 startPage:number;
 endPage:number;
 chapters:BookChapter[];
 sourceIds:string[];
};

/** Build ten local, contiguous study parts without making an AI call.
 * The boundaries prefer chapter boundaries, while the source IDs are kept
 * explicitly so a part can be generated without sending the other nine parts
 * to the model. */
export function buildStudyParts(doc:IndexedDocument):StudyPart[]{
 const chapters=Array.isArray(doc.chapters)?doc.chapters:[];
 const sources=Array.isArray(doc.sources)?doc.sources:[];
 const count=PART_COUNT;
 if(!sources.length)return Array.from({length:count},(_,i)=>({id:`part-${i+1}`,index:i+1,title:`Part ${i+1}`,startPage:0,endPage:0,chapters:[],sourceIds:[]}));
 const sorted=[...chapters].sort((a,b)=>a.startPage-b.startPage);
 const groups:BookChapter[][]=Array.from({length:count},()=>[]);
 if(sorted.length>=count){
   const totalPages=Math.max(1,doc.pageCount||sources.reduce((m,s)=>Math.max(m,s.page),0));
   let cursor=0;
   for(let i=0;i<count;i++){
     const remaining=sorted.length-cursor;
     const slots=count-i;
     const target=((i+1)*totalPages)/count;
     let best=cursor;
     let bestDistance=Number.POSITIVE_INFINITY;
     for(let j=cursor;j<=sorted.length-Math.max(0,slots-1);j++){
       const end=sorted[j]?.endPage||sorted[j]?.startPage||0;
       const distance=Math.abs(end-target);
       if(distance<bestDistance){bestDistance=distance;best=j+1;}
     }
     if(best<=cursor)best=Math.min(sorted.length,cursor+Math.max(1,Math.ceil(remaining/slots)));
     groups[i]=sorted.slice(cursor,best);
     cursor=best;
   }
   if(cursor<sorted.length)groups[count-1].push(...sorted.slice(cursor));
 }else{
   // Very small books: keep ten parts anyway. Their page/source ranges are
   // derived locally and no LLM is involved in this partitioning.
   const totalPages=Math.max(1,doc.pageCount||sources.reduce((m,s)=>Math.max(m,s.page),0));
   const pageSets=Array.from({length:count},()=>[] as IndexedSource[]);
   for(const source of sources){
     const idx=Math.min(count-1,Math.max(0,Math.floor(((source.page-1)/totalPages)*count)));
     pageSets[idx].push(source);
   }
   return pageSets.map((partSources,i)=>{
     const pages=partSources.map(s=>s.page).filter(Number.isFinite);
     return {id:`part-${i+1}`,index:i+1,title:`Part ${i+1}`,startPage:pages.length?Math.min(...pages):Math.floor(i*totalPages/count)+1,endPage:pages.length?Math.max(...pages):Math.floor((i+1)*totalPages/count),chapters:[],sourceIds:partSources.map(s=>s.id)};
   });
 }
 return groups.map((partChapters,i)=>{
   const pages=partChapters.flatMap(c=>[c.startPage,c.endPage]).filter(Number.isFinite);
   const startPage=pages.length?Math.min(...pages):Math.floor(i*doc.pageCount/count)+1;
   const endPage=pages.length?Math.max(...pages):Math.floor((i+1)*doc.pageCount/count);
   // Include every indexed source whose physical page falls in this part,
   // including front matter or page content not attached to a chapter.
   const sourceIds=sources.filter(s=>s.page>=startPage&&s.page<=endPage).map(s=>s.id);
   return {id:`part-${i+1}`,index:i+1,title:`Part ${i+1}`,startPage,endPage,chapters:partChapters,sourceIds};
 });
}

/** The part (1–10) a page belongs to; pages outside every range go to the nearest part before them (or Part 1). */
export function partOfPage(parts: Pick<StudyPart, 'index' | 'startPage' | 'endPage'>[], page: number): number {
  const hit = parts.find((p) => p.startPage > 0 && page >= p.startPage && page <= p.endPage);
  if (hit) return hit.index;
  const before = parts.filter((p) => p.startPage > 0 && p.startPage <= page).sort((a, b) => b.startPage - a.startPage)[0];
  return before?.index ?? 1;
}

/** The part a saved material was made for: from its scope id ("part-3" or "part-3::chapter"), else from its pages. */
export function partOfMaterial(m: Pick<StudyMaterial, 'chapterIds' | 'sources'>, parts: Pick<StudyPart, 'index' | 'startPage' | 'endPage'>[]): number {
  for (const id of m.chapterIds ?? []) { const x = /^part-(\d+)(?:::|$)/.exec(id); if (x) return Number(x[1]); }
  const pages = (m.sources ?? []).map((s) => s.page).filter((n) => Number.isFinite(n));
  if (!pages.length) return 1;
  const votes = new Map<number, number>();
  for (const pg of pages) { const k = partOfPage(parts, pg); votes.set(k, (votes.get(k) ?? 0) + 1); }
  // A material spanning several parts belongs to the LAST one it touches, so a free part never carries a paid one's content.
  return Math.max(...votes.keys());
}

/** Free parts of a book: its own setting, else the school-wide default. */
export const freePartsOf = (doc: Pick<IndexedDocument, 'freeParts'>, fallback: number[]): number[] => (Array.isArray(doc.freeParts) ? doc.freeParts : fallback);
