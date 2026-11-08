import { nanoid } from 'nanoid';
import { GEMINI_TEXT_MODEL } from '@/lib/student-key';
import type { BookChapter, IndexedSource } from './types';

// Chapter understanding runs server-side, but the key it uses is the
// student's BYOK key forwarded from the browser (see the index route), so the
// model must match the one the key was validated against. A server
// GEMINI_API_KEY is still honoured as a fallback when one is configured.
const MODEL = process.env.GEMINI_MATERIAL_MODEL || process.env.GEMINI_MODEL || GEMINI_TEXT_MODEL;
function parseJson(text:string){
  // Gemini is requested to return application/json, but some responses still
  // contain two JSON objects (or a JSON object followed by commentary). The
  // old parser used the FIRST '{' and LAST '}', which combined both objects
  // and produced: "Unexpected non-whitespace character after JSON".
  const cleaned=text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  for(let start=cleaned.indexOf('{'); start>=0; start=cleaned.indexOf('{',start+1)){
    let depth=0, inString=false, escaped=false;
    for(let i=start;i<cleaned.length;i++){
      const ch=cleaned[i];
      if(inString){
        if(escaped) escaped=false;
        else if(ch==='\\') escaped=true;
        else if(ch==='\"') inString=false;
        continue;
      }
      if(ch==='\"'){inString=true;continue;}
      if(ch==='{') depth++;
      else if(ch==='}'){
        depth--;
        if(depth===0){
          try{return JSON.parse(cleaned.slice(start,i+1));}catch{break;}
        }
      }
    }
  }
  throw new Error('Book planner returned invalid JSON');
}
async function callProvider(provider:'gemini'|'openai'|'agnes'|'sarvam',prompt:string,key:string):Promise<any|null>{
  if(!key) return null;
  try{
    if(provider==='gemini'){
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(key)}`,{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:.1,responseMimeType:'application/json',maxOutputTokens:12000}})
      });
      if(!response.ok) return null;
      const data=await response.json() as any;
      return parseJson(data?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||'').join('')||'');
    }
    const base=provider==='openai'?'https://api.openai.com/v1':provider==='agnes'?'https://apihub.agnes-ai.com/v1':'https://api.sarvam.ai/v1';
    const model=provider==='openai'?'gpt-4.1-mini':provider==='agnes'?'agnes-3.0-flash':'sarvam-105b';
    const headers:any={'content-type':'application/json','Authorization':`Bearer ${key}`};
    if(provider==='sarvam') headers['api-subscription-key']=key;
    const response=await fetch(`${base}/chat/completions`,{
      method:'POST',headers,
      body:JSON.stringify({model,messages:[{role:'system',content:'Return ONLY valid JSON. Do not add markdown or commentary.'},{role:'user',content:prompt}],temperature:.1,max_tokens:12000,...(provider==='sarvam'||provider==='openai'?{response_format:{type:'json_object'}}:{})})
    });
    if(!response.ok) return null;
    const data=await response.json() as any;
    return parseJson(data?.choices?.[0]?.message?.content||'');
  }catch{return null}
}

async function callGemini(prompt:string, apiKey?:string, agnesApiKey?:string, sarvamApiKey?:string, openaiApiKey?:string, serverKey=true){
  // Indexing follows the same provider order as Material Studio generation.
  // Keys are transiently forwarded from the browser and are never stored here.
  const providers:[('gemini'|'openai'|'agnes'|'sarvam'),string][]=[
    ['openai',openaiApiKey||''],
    ['gemini',apiKey||(serverKey?process.env.GEMINI_API_KEY:'')||''], // V51.9.107: never the server's key for a guest
    ['agnes',agnesApiKey||''],
    ['sarvam',sarvamApiKey||''],
  ];
  for(const [provider,key] of providers){
    const result=await callProvider(provider,prompt,key);
    if(result) return result;
  }
  return null;
}

/** V51.9.107: "Chapter 3 Ratio A ratio compares…" → { key: 'chapter 3', title: 'Chapter 3 Ratio' } (the heading may run into the text). */
const STOP=new Set(['a','an','the','in','this','we','let','what','how','when','if','to','is','are','look','read','see','do','find']);
export function headingOf(text:string):{key:string;title:string}|null{
  const t=text.replace(/\s+/g,' ').trim();
  const m=t.match(/^(chapter|unit|lesson|module|part|അധ്യായം|യൂണിറ്റ്|പാഠം)\s*[-:.]?\s*(\d{1,3}|[ivxlc]{1,6})\b[\s:.\-–]*(.*)$/i);
  if(m){
    // the title: capitalised words (with "and", "of" … between them), stopping where the first sentence starts
    const tok=m[3].split(' ').filter(Boolean);
    const CONN=new Set(['and','of','&','or','the','in','to','with','for']);
    const cap=(w?:string)=>!!w&&/^[A-Z(]/.test(w)&&!STOP.has(w.toLowerCase());
    const ml=(w?:string)=>!!w&&/^[\u0D00-\u0D7F]/.test(w);
    const words:string[]=[];
    for(let i=0;i<tok.length&&words.length<7;i++){
      const w=tok[i];
      if(ml(w)){words.push(w.replace(/[.:,;]+$/,''));if(/[.:]$/.test(w)||words.length>=4)break;continue;}
      if(CONN.has(w.toLowerCase())&&words.length){if(cap(tok[i+1])){words.push(w.toLowerCase());continue;}break;}
      if(!cap(w))break;
      // a capitalised word followed (after any "and", "of" …) by a lower-case word starts a sentence: not the title
      let j=i+1;while(j<tok.length&&/^(and|of|&|or)$/i.test(tok[j]))j++;
      if(words.length&&!/[.:]$/.test(w)&&j<tok.length&&/^[a-z]/.test(tok[j]))break;
      words.push(w.replace(/[.:,;]+$/,''));
      if(/[.:]$/.test(w))break;
    }
    const kw=m[1][0].toUpperCase()+m[1].slice(1).toLowerCase();
    return {key:`${m[1].toLowerCase()} ${m[2].toLowerCase()}`,title:[kw,/^[ivxlc]+$/i.test(m[2])?m[2].toUpperCase():m[2],...words].join(' ').trim()};
  }
  const first=text.split(/\n/)[0].trim();
  if(first.length<=90&&/^\d+(?:\.\d+)*[.)]?\s+/.test(first))return {key:first.toLowerCase(),title:first};
  return null;
}

export function heuristicChapters(sources:IndexedSource[]):BookChapter[]{
  const groups:BookChapter[]=[];
  let current:BookChapter|undefined;
  let currentKey='';
  for(const source of sources){
    const h=headingOf(source.text);
    // a heading repeated at the top of the next page ("Chapter 1 Fractions" again) stays in the same chapter
    if(!current || (h&&h.key!==currentKey)){
      current={id:`chapter:${nanoid(8)}`,title:h?h.title:`Chapter ${groups.length+1}`,startPage:source.page,endPage:source.page,sourceIds:[]};
      currentKey=h?.key??'';
      groups.push(current);
    }
    current.endPage=Math.max(current.endPage,source.page); current.sourceIds.push(source.id);
  }
  return groups.length ? groups : [{id:`chapter:${nanoid(8)}`,title:'Book',startPage:sources[0]?.page||1,endPage:sources.at(-1)?.page||1,sourceIds:sources.map(s=>s.id)}];
}

export async function understandBook(sources:IndexedSource[], meta:{subject:string;grade:string;syllabus:string;sourceLanguage:string;teachingLanguage:string}, apiKey?:string, agnesApiKey?:string, sarvamApiKey?:string, openaiApiKey?:string, serverKey=true):Promise<BookChapter[]> {
  const compact=sources.map(s=>`[${s.id}] p.${s.page} ${s.text.slice(0,700)}`).join('\n');
  const prompt=`You are AI Guru's whole-textbook curriculum architect. Understand the complete uploaded textbook before it is taught. Identify the textbook's real chapter/unit boundaries from the supplied source inventory. Do not invent chapters. Every source ID must belong to exactly one chapter. Preserve page order. Return JSON only: {"chapters":[{"title":"","sourceIds":["S1_1"],"summary":""}]}. Subject=${meta.subject}; Class=${meta.grade}; Syllabus=${meta.syllabus}; PDF language=${meta.sourceLanguage}; teaching language=${meta.teachingLanguage}.\nSOURCE INVENTORY:\n${compact}`;
  const ai=await callGemini(prompt,apiKey,agnesApiKey,sarvamApiKey,openaiApiKey,serverKey).catch(()=>null);
  const fallback=heuristicChapters(sources);
  if(!ai || !Array.isArray(ai.chapters)) return fallback;
  const valid=new Set(sources.map(s=>s.id)); const assigned=new Set<string>();
  const chapters:BookChapter[]=[];
  for(const c of ai.chapters){
    const ids:string[]=Array.isArray(c.sourceIds)?c.sourceIds.map(String).filter((id:string)=>valid.has(id)&&!assigned.has(id)):[];
    if(!ids.length) continue;
    ids.forEach(id=>assigned.add(id));
    const ss=ids.map(id=>sources.find(s=>s.id===id)!).filter(Boolean);
    chapters.push({id:`chapter:${nanoid(8)}`,title:String(c.title||`Chapter ${chapters.length+1}`),startPage:Math.min(...ss.map(s=>s.page)),endPage:Math.max(...ss.map(s=>s.page)),sourceIds:ids,summary:String(c.summary||'')});
  }
  // Any source the model omitted is retained rather than silently discarded.
  const missing=sources.filter(s=>!assigned.has(s.id));
  if(missing.length){
    const last=chapters.at(-1);
    if(last){last.sourceIds.push(...missing.map(s=>s.id));last.endPage=Math.max(last.endPage,...missing.map(s=>s.page));}
    else return fallback;
  }
  return chapters.length?chapters:fallback;
}
