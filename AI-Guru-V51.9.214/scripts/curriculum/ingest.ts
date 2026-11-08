import fs from 'node:fs';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

type SourceBoard = 'NCERT' | 'CBSE';
export type CurriculumRecord = {
  id: string; board: SourceBoard; grade?: number; subject: 'Mathematics';
  chapter?: string; topic?: string; question: string; sourceFile: string;
  sourcePage: number; sourceType: 'official-pdf'; provenance: string;
};

const ROOT = path.resolve(process.cwd());
const INPUT = path.join(ROOT, 'data/curriculum-sources');
const OUT = path.join(ROOT, 'data/curriculum');
const questionStart = /^(?:Q(?:uestion)?\.?\s*)?(?:\(?\d{1,3}[.)]|[a-z][.)])\s+/i;
const skip = /^(chapter|exercise|example|solution|answer|contents|mathematics|class|appendix|activity|figure|illustration)\b/i;

function boardFrom(file:string):SourceBoard { return file.toLowerCase().includes(`${path.sep}cbse${path.sep}`) ? 'CBSE' : 'NCERT'; }
function inferGrade(text:string, file:string):number|undefined {
  const m = `${file} ${text.slice(0,500)}`.match(/(?:class|grade|std)[ _-]?(1[0-2]|[1-9])\b/i);
  return m ? Number(m[1]) : undefined;
}
function clean(s:string){ return s.replace(/\s+/g,' ').replace(/^[•●▪]+/,'').trim(); }

async function extractPdf(file:string):Promise<CurriculumRecord[]> {
  const data = new Uint8Array(fs.readFileSync(file));
  const pdf = await getDocument({data, useWorkerFetch:false, isEvalSupported:false}).promise;
  const records:CurriculumRecord[]=[];
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p);
    const content=await page.getTextContent();
    const lines:string[]=[]; let current='';
    for(const item of content.items as any[]){
      const str=typeof item.str==='string'?item.str:'';
      if(!str) continue;
      current += ` ${str}`;
      if(item.hasEOL){ lines.push(clean(current)); current=''; }
    }
    if(current.trim()) lines.push(clean(current));
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      if(!line || skip.test(line)) continue;
      if(questionStart.test(line) || /\?$/.test(line) || /\b(find|calculate|solve|show|prove|determine|evaluate|simplify|construct|plot|explain)\b/i.test(line)) {
        let q=line;
        while(q.length<60 && i+1<lines.length && !questionStart.test(lines[i+1]) && lines[i+1]) q += ` ${lines[++i]}`;
        if(q.length<18 || q.length>1200) continue;
        const board=boardFrom(file);
        records.push({id:`${board.toLowerCase()}-${path.basename(file,'.pdf')}-p${p}-q${records.length+1}`,board,grade:inferGrade(q,file),subject:'Mathematics',question:q,sourceFile:path.relative(ROOT,file),sourcePage:p,sourceType:'official-pdf',provenance:board==='NCERT'?'Official NCERT PDF supplied by project operator':'Official CBSE PDF supplied by project operator'});
      }
    }
  }
  return records;
}

async function main(){
  fs.mkdirSync(OUT,{recursive:true});
  const files:string[]=[];
  for(const board of ['ncert','cbse']){
    const dir=path.join(INPUT,board); if(!fs.existsSync(dir)) continue;
    for(const f of fs.readdirSync(dir,{recursive:true}) as string[]) if(f.toLowerCase().endsWith('.pdf')) files.push(path.join(dir,f));
  }
  const all:CurriculumRecord[]=[];
  for(const f of files){ console.log(`Extracting ${path.relative(ROOT,f)}`); try{ all.push(...await extractPdf(f)); }catch(e){ console.error(`Failed ${f}:`,e); }}
  const dedup=new Map<string,CurriculumRecord>();
  for(const r of all) dedup.set(r.question.toLowerCase().replace(/\W+/g,' ').trim(),r);
  const records=[...dedup.values()];
  fs.writeFileSync(path.join(OUT,'questions.jsonl'),records.map(r=>JSON.stringify(r)).join('\n')+(records.length?'\n':''));
  fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify({schemaVersion:'1.0',generatedAt:new Date().toISOString(),files:files.map(f=>path.relative(ROOT,f)),questionCount:records.length,officialSources:{NCERT:'https://ncert.nic.in/textbook.php',CBSE:'https://parikshasangam.cbse.gov.in/ps/frmSchRef?REF=Exam+Reference+Material'}},null,2));
  console.log(`Ingested ${records.length} unique mathematics question candidates.`);
}
main().catch(e=>{console.error(e);process.exit(2)});
