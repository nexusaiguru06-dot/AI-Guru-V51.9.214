import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';

const input = process.argv[2];
const output = process.argv[3] ?? 'fixtures/ai-guru/book-index.json';
const chapterSize = Number(process.argv[4] ?? 30);
if (!input) throw new Error('Usage: pnpm book:prepare <pdf> [output] [chapterSize]');

const data = await fs.readFile(input);
const parser = new PDFParse({ data });
const result = await parser.getText();
const pages = result.pages ?? [];

function paragraphs(text: string) {
  return text.replace(/\r/g,'').split(/\n\s*\n+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(x=>x.length>0);
}
function chapterTitle(text:string, start:number, end:number) {
  const lines=text.split(/\n/).map(x=>x.trim()).filter(Boolean);
  const heading=lines.find(x=>x.length<100 && /chapter|unit|lesson|mathematics|maths/i.test(x));
  return heading ?? `Chapter ${Math.floor((start-1)/chapterSize)+1} · Pages ${start}–${end}`;
}

const normalized=pages.map((p:any,i:number)=>({
  pageNumber:i+1,
  text:String(p.text??'').trim(),
  paragraphs:paragraphs(String(p.text??''))
}));
const chapters=[];
for(let start=1; start<=normalized.length; start+=chapterSize){
  const end=Math.min(normalized.length,start+chapterSize-1);
  const slice=normalized.slice(start-1,end);
  chapters.push({id:`chapter-${chapters.length+1}`,index:chapters.length,pageStart:start,pageEnd:end,title:chapterTitle(slice.map(p=>p.text).join('\n'),start,end),pages:slice});
}
const book={version:1,bookId:path.basename(input).replace(/[^a-z0-9]+/gi,'-').toLowerCase(),fileName:path.basename(input),pageCount:normalized.length,chapterSize,chapters};
const out=path.resolve(output); await fs.mkdir(path.dirname(out),{recursive:true}); await fs.writeFile(out,JSON.stringify(book,null,2));
console.log(`Prepared ${normalized.length} pages into ${chapters.length} chapters: ${out}`);
