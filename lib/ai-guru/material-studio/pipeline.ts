import { TEACHER_STEP_CONTRACT } from '../teaching/teacher-persona';
import { developSectionVisuals, dryRunSectionVisuals, patternPromptContext, type LlmFn } from '../patterns';
import { nanoid } from 'nanoid';
import { orderSectionsBySource } from './section-order';
import { orderedUsableKeys, GEMINI_TEXT_MODEL } from '@/lib/student-key';
import { geminiTextServer } from '@/lib/ai-guru/generation/gemini-text-server';

/** V51.9.177: in the browser (Material Studio) the student's keys and providers (byok-providers, a 'use client' module);
 *  on the server (study materials made on the AI Guru cloud) a direct Gemini call with the key the job was given. */
async function aiText(system:string,prompt:string,o:{json?:boolean;maxOutputTokens?:number;geminiKey?:string;task?:string}):Promise<{text:string}>{
 if(typeof window==='undefined') return {text:await geminiTextServer(system,prompt,o)};
 const {callAiGuruText}=await import('@/lib/ai-guru/byok-providers');
 return callAiGuruText(system,prompt,o);
}
import type { IndexedSource, MaterialType, StudyMaterial, StudyMaterialSection, BookChapter } from './types';
import problemSolvingDna from '../../../data/ai-guru/video-dna/problem-solving-video-dna.json';

// This pipeline runs in the browser (Material Studio is a client page), so
// every Gemini call goes through the BYOK key pool in lib/student-key.ts
// rather than a single hard-coded key. callGeminiClient() already retries
// across every usable key in the pool, benching a key that returns a
// daily-quota / rate-limit / invalid-key error, so a long batch run no
// longer dies on the first quota error.
const MODEL=GEMINI_TEXT_MODEL;
const specs:Record<MaterialType,string>={
 mcq:'a rigorous school MCQ bank with four options, one correct answer, explanation and exact source citations',
 qa:'textbook-grounded question and answer set with short, conceptual and application questions',
 'revision-notes':'exam-ready revision notes with definitions, key ideas, formulas, common errors and rapid recap',
 flashcards:'high-quality flashcards with one clear question, concise answer, hint and source citation',
 worksheet:'school worksheet with mixed questions and a complete answer key',
 'question-paper':'balanced school question paper with marks, difficulty, answer key and source grounding',
 ppt:'8-12 slide teaching outline with speaker notes and visualizable points',
 'mind-map':'hierarchical concept map with grounded relationships and prerequisites',
 'whiteboard-notes':'a complete teacher-led General Class for the current textbook topic/chapter: establish meaning and intuition first, explain why the concept is useful, build visual models and applications, then use textbook examples/problems only after the concept is understood; explain deeply in English and then in the selected teaching language using the same graphics',
 'knowledge-base':'structured concept knowledge base with definitions, relationships, prerequisites and citations',
 'problems-formulae':'a textbook-grounded Problems and Formulae practice pack: organize essential formulas by topic, state symbols/conditions, then provide graded worked problems and independent exercises with answer keys. This is PRACTICE/REVISION material, not the normal classroom teaching style',
};
function json(text:string){
 const c=text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]??text;
 // Never join separate JSON objects by using lastIndexOf('}'). Gemini can
 // occasionally append a second object or explanatory text after valid JSON.
 for(let start=c.indexOf('{');start>=0;start=c.indexOf('{',start+1)){
  let depth=0,inString=false,escaped=false;
  for(let i=start;i<c.length;i++){
   const ch=c[i];
   if(inString){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='\"')inString=false;continue;}
   if(ch==='\"'){inString=true;continue;}
   if(ch==='{')depth++;
   else if(ch==='}'){depth--;if(depth===0){try{return JSON.parse(c.slice(start,i+1));}catch{break;}}}
  }
 }
 throw new Error('Model returned invalid JSON');
}
function visualDeveloperEnabled(){return typeof process!=='undefined'&&process.env?.NEXT_PUBLIC_AI_GURU_VISUAL_DEVELOPER!=='0';}
async function refineVisuals(sections:any[],apiKey?:string):Promise<any[]>{
 const llm:LlmFn=async(system,prompt,o)=>(await aiText(system,prompt,{json:Boolean(o?.json),maxOutputTokens:8000,geminiKey:apiKey?.trim()||undefined})).text;
 const develop=visualDeveloperEnabled();
 const out:any[]=[];
 for(const section of sections){
  let cur=section;
  if(develop){try{cur=await developSectionVisuals(cur,{llm,maxSearchRounds:1,maxRetries:1,maxSteps:4});}catch{/* the material is still valid without the extra pictures */}}
  try{cur=(await dryRunSectionVisuals(cur,{llm})).section;}catch{/* keep the section as it was */}
  out.push(cur);
 }
 return out;
}
async function callGemini(system:string,prompt:string,apiKey?:string,task?:string){
 const result=await aiText(system,prompt,{json:true,maxOutputTokens:30000,geminiKey:apiKey?.trim()||undefined,task});
 return json(result.text);
}
function context(sources:IndexedSource[]){return sources.map(s=>`[${s.id}] page ${s.page}, paragraph ${s.paragraph}: ${s.text}`).join('\n\n');}
function problemFormulaeDnaContext(query:string){
 if(!query.trim()) return '';
 const q=new Set((query.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(x=>x.length>2));
 const entries=((problemSolvingDna as any).entries||[]) as any[];
 const ranked=entries.map((e:any)=>{const hay=[e.branch,e.id,e.sourceVideo,...(e.concepts||[]),...(e.visualDNA?.objects||[]),...(e.visualDNA?.teachingSequence||[]),...(e.visualDNA?.rules||[])].join(' ').toLowerCase();let score=0;for(const t of q)if(hay.includes(t))score++;return {e,score};}).sort((a,b)=>b.score-a.score).slice(0,3).map(x=>x.e);
 if(!ranked.length)return '';
 return `PROBLEMS & FORMULAE VISUAL DNA (practice-material use only; never normal classroom style):\n${ranked.map((e:any,i:number)=>`${i+1}. ${e.id} [${e.branch||'math'}]\nConcepts: ${(e.concepts||[]).join(', ')}\nObjects: ${(e.visualDNA?.objects||[]).join(', ')}\nSequence: ${(e.visualDNA?.teachingSequence||[]).join(' -> ')}\nRules: ${(e.visualDNA?.rules||[]).join('; ')}`).join('\n\n')}\nReuse only the visual/solution grammar. Never copy the source video's exact example, narration, branding or artwork.`;
}

function visualInstruction(){return `Only emit renderable AI Guru VisualAction objects. Reuse one shared visuals array for both language passes. Never create separate Malayalam coordinates. Supported primitives include write, latex, shape, line, chart, highlight, move, transform, erase and pause. Coordinates are normalized to the existing V43 board. Visuals must be based on textbook content, never placeholders, and must not invent geometry/data. Every visual must have a canonical type and unique id.`;}

// Gemini sometimes returns the same visual action in a harmless wrapper
// ({action:{...}} / {visual:{...}}) or uses friendly field names.  V43's
// renderer expects the strict VisualAction union, so normalize at the
// material boundary instead of allowing malformed objects to reach QA/runtime.
const VISUAL_TYPES=new Set(['write','latex','shape','line','chart','highlight','move','token-move','transform','erase','pause']);
function num(v:any,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback;}
function inferVisualType(v:any):string|undefined{
  const t=String(v?.type||v?.actionType||v?.kind||v?.primitive||'').toLowerCase();
  if(VISUAL_TYPES.has(t)) return t;
  if(typeof v?.latex==='string'||typeof v?.formula==='string') return 'latex';
  if(typeof v?.content==='string'||typeof v?.text==='string') return 'write';
  if(v?.chartType||v?.data?.series) return 'chart';
  if(v?.targetId&&v?.toX!==undefined&&v?.toY!==undefined) return 'move';
  if(v?.fromId&&v?.toId) return 'transform';
  if(v?.targetId&&v?.durationMs!==undefined&&!v?.x&&!v?.y) return 'erase';
  if(v?.targetId) return 'highlight';
  if(v?.startX!==undefined||v?.endX!==undefined||v?.x1!==undefined||v?.x2!==undefined) return 'line';
  if(v?.shape||v?.radius!==undefined) return 'shape';
  if(v?.durationMs!==undefined&&v?.content===undefined) return 'pause';
  return undefined;
}
function normalizeVisual(v:any,index:number,sectionId:string):any|null{
  if(!v||typeof v!=='object') return null;
  const raw=(v.action&&typeof v.action==='object')?v.action:(v.visual&&typeof v.visual==='object')?v.visual:v;
  const type=inferVisualType(raw); if(!type) return null;
  const id=String(raw.id||raw.visualId||raw.actionId||`${sectionId}:visual:${index+1}`);
  const base:any={id,type};
  switch(type){
    case 'write': return {...base,content:String(raw.content??raw.text??''),x:num(raw.x,80),y:num(raw.y,100),...(raw.width!=null?{width:num(raw.width)}:{}),...(raw.height!=null?{height:num(raw.height)}:{}),...(raw.fontSize!=null?{fontSize:num(raw.fontSize,30)}:{}),...(raw.durationMs!=null?{durationMs:num(raw.durationMs)}:{}),...(raw.visualStyleId?{visualStyleId:String(raw.visualStyleId)}:{}),...(raw.fontStyle==='italic'||raw.fontStyle==='normal'?{fontStyle:raw.fontStyle}: {}),...(raw.placement==='absolute'||raw.placement==='flow'?{placement:raw.placement}:{}),...(typeof raw.color==='string'?{color:String(raw.color)}:{}),...(raw.anchor==='start'||raw.anchor==='middle'||raw.anchor==='end'?{anchor:raw.anchor}:{})};
    case 'latex': return {...base,latex:String(raw.latex??raw.formula??raw.content??''),x:num(raw.x,80),y:num(raw.y,100),...(raw.width!=null?{width:num(raw.width)}:{}),...(raw.height!=null?{height:num(raw.height)}:{}),...(raw.fontSize!=null?{fontSize:num(raw.fontSize,38)}:{}),...(raw.durationMs!=null?{durationMs:num(raw.durationMs)}:{}),...(raw.visualStyleId?{visualStyleId:String(raw.visualStyleId)}:{}),...(raw.placement==='absolute'||raw.placement==='flow'?{placement:raw.placement}:{}),...(typeof raw.color==='string'?{color:String(raw.color)}:{}),...(raw.anchor==='start'||raw.anchor==='middle'||raw.anchor==='end'?{anchor:raw.anchor}:{})};
    case 'shape': {const shape=['rectangle','circle','triangle'].includes(String(raw.shape))?String(raw.shape):'rectangle';return {...base,shape,x:num(raw.x,80),y:num(raw.y,100),width:num(raw.width,100),height:num(raw.height,100),...(raw.fill!=null?{fill:String(raw.fill)}:{}),...(raw.stroke!=null?{stroke:String(raw.stroke)}:{}),...(raw.strokeWidth!=null?{strokeWidth:num(raw.strokeWidth,5)}:{}),...(raw.durationMs!=null?{durationMs:num(raw.durationMs)}:{}),...(raw.visualStyleId?{visualStyleId:String(raw.visualStyleId)}:{})};}
    case 'line': return {...base,startX:num(raw.startX??raw.x1??raw.x,0),startY:num(raw.startY??raw.y1??raw.y,0),endX:num(raw.endX??raw.x2,100),endY:num(raw.endY??raw.y2,0),style:raw.style==='dashed'?'dashed':'solid',...(raw.stroke!=null?{stroke:String(raw.stroke)}:{}),...(raw.strokeWidth!=null?{strokeWidth:num(raw.strokeWidth,5)}:{}),...(raw.durationMs!=null?{durationMs:num(raw.durationMs)}:{}),...(raw.visualStyleId?{visualStyleId:String(raw.visualStyleId)}:{})};
    case 'chart': {const d=raw.data||{};const labels=Array.isArray(d.labels)?d.labels.map(String):Array.isArray(raw.labels)?raw.labels.map(String):[];const series=Array.isArray(d.series)?d.series.map((a:any)=>Array.isArray(a)?a.map((n:any)=>num(n)):[]):Array.isArray(raw.series)?raw.series.map((a:any)=>Array.isArray(a)?a.map((n:any)=>num(n)):[]):[];return {...base,chartType:['line','scatter','bar','column','pie','ring','area','radar'].includes(String(raw.chartType))?String(raw.chartType):'line',x:num(raw.x,100),y:num(raw.y,200),width:num(raw.width,800),height:num(raw.height,400),data:{labels,legends:Array.isArray(d.legends)?d.legends.map(String):Array.isArray(raw.legends)?raw.legends.map(String):['Data'],series},...(raw.durationMs!=null?{durationMs:num(raw.durationMs)}:{}),...(raw.visualStyleId?{visualStyleId:String(raw.visualStyleId)}:{})};}
    case 'highlight': return {...base,targetId:String(raw.targetId??raw.objectId??raw.id),...(raw.x!=null?{x:num(raw.x)}:{}),...(raw.y!=null?{y:num(raw.y)}:{}),...(raw.width!=null?{width:num(raw.width)}:{}),...(raw.height!=null?{height:num(raw.height)}:{})};
    case 'move': return {...base,targetId:String(raw.targetId??raw.objectId??''),fromX:num(raw.fromX??raw.x,0),fromY:num(raw.fromY??raw.y,0),toX:num(raw.toX??raw.x,0),toY:num(raw.toY??raw.y,0),...(raw.durationMs!=null?{durationMs:num(raw.durationMs,900)}:{durationMs:900})};
    case 'token-move': return {...base,token:String(raw.token??raw.content??raw.text??''),fromX:num(raw.fromX??raw.x,0),fromY:num(raw.fromY??raw.y,0),toX:num(raw.toX,0),toY:num(raw.toY,0),fadeOut:raw.fadeOut!==false,fontSize:num(raw.fontSize,32),...(raw.durationMs!=null?{durationMs:num(raw.durationMs,700)}:{durationMs:700}),...(raw.visualStyleId?{visualStyleId:String(raw.visualStyleId)}:{})};
    case 'transform': return {...base,fromId:String(raw.fromId??raw.fromObjectId??''),toId:String(raw.toId??raw.toObjectId??''),...(raw.durationMs!=null?{durationMs:num(raw.durationMs,1100)}:{durationMs:1100}),...(raw.retainFrom!=null?{retainFrom:Boolean(raw.retainFrom)}:{}),...(raw.derivedLineIndex!=null?{derivedLineIndex:num(raw.derivedLineIndex)}:{})};
    case 'erase': return {...base,targetId:String(raw.targetId??raw.objectId??''),...(raw.durationMs!=null?{durationMs:num(raw.durationMs,700)}:{durationMs:700})};
    case 'pause': return {...base,durationMs:Math.max(0,num(raw.durationMs??raw.duration,500))};
  }
}
function normalizeVisuals(values:any[],sectionId:string):any[]{
  const out:any[]=[]; const ids=new Set<string>();
  for(let i=0;i<(Array.isArray(values)?values:[]).length;i++){
    const v=normalizeVisual(values[i],i,sectionId); if(!v) continue;
    let id=v.id; let suffix=2; while(ids.has(id)){id=`${v.id}:${suffix++}`;} v.id=id; ids.add(id); out.push(v);
  }
  return out;
}
function normalizeMathSteps(values:any, sectionId:string): any[] {
  if (!Array.isArray(values)) return [];
  const out:any[]=[]; const ids=new Set<string>();
  for(let i=0;i<values.length;i++){
    const s=values[i]; if(!s||typeof s!=='object') continue;
    const base=String(s.id||`${sectionId}:math-step:${i+1}`); let id=base,n=2;
    while(ids.has(id)) id=`${base}:${n++}`; ids.add(id);
    const before=String(s.before??'').trim(), operation=String(s.operation??'').trim(), after=String(s.after??'').trim();
    if(!before||!operation||!after) continue;
    out.push({id,before,operation,after,captionEnglish:String(s.captionEnglish??s.caption??'').trim(),
      captionMalayalam:s.captionMalayalam?String(s.captionMalayalam).trim():undefined,
      visualIds:Array.isArray(s.visualIds)?s.visualIds.map(String):[],
      verified:Boolean(s.verified),
      source:['mathsteps','sympy','mathjs','gemini','manual'].includes(String(s.source))?String(s.source):'gemini'});
  }
  return out;
}

function normalize(raw:any,sources:IndexedSource[],type:MaterialType):StudyMaterialSection[]{const list=Array.isArray(raw?.sections)?raw.sections:[];const valid=new Set(sources.map(x=>x.id));
 // A flat 32-section cap silently truncated whole-book runs: the SCERT Class 9
 // Mathematics book indexes to ~187 paragraph units, so a "whole textbook"
 // whiteboard-note kept only the first 32 and dropped the rest without saying
 // so. Paragraph-by-paragraph teaching plans now keep one section per source
 // unit; summary material types stay bounded because they are meant to be.
 const cap=type==='whiteboard-notes'?Math.max(32,sources.length):type==='knowledge-base'||type==='revision-notes'?64:48;
 return list.slice(0,cap).map((s:any,i:number)=>{
    const sid=String(s.id||`section-${i+1}`);
    const tp=s.teachingPass?{
      sourceText:String(s.teachingPass.sourceText||s.sourceText||''),
      englishExplanation:String(s.teachingPass.englishExplanation||s.content||''),
      translatedExplanation:String(s.teachingPass.translatedExplanation||s.contentTranslation||''),
      visuals:normalizeVisuals(s.teachingPass.visuals,sid),
      sourceIds:Array.isArray(s.teachingPass.sourceIds)?s.teachingPass.sourceIds.map(String).filter((id:string)=>valid.has(id)):[]
    }:undefined;
    return {
      id:sid,heading:String(s.heading||`Section ${i+1}`),content:String(s.content||s.englishContent||''),
      contentTranslation:s.contentTranslation?String(s.contentTranslation):undefined,
      activity:s.activity?String(s.activity):undefined,activityTranslation:s.activityTranslation?String(s.activityTranslation):undefined,
      answer:s.answer?String(s.answer):undefined,answerTranslation:s.answerTranslation?String(s.answerTranslation):undefined,
      options:Array.isArray(s.options)?s.options.map(String):undefined,translatedOptions:Array.isArray(s.translatedOptions)?s.translatedOptions.map(String):undefined,
      sourceIds:Array.isArray(s.sourceIds)?s.sourceIds.map(String).filter((id:string)=>valid.has(id)):[],
      sourceText:s.sourceText?String(s.sourceText):undefined,teachingPass:tp,
      mathSteps:normalizeMathSteps(s.mathSteps,sid),visuals:normalizeVisuals(s.visuals,sid),
      whiteboardCommands:s.whiteboardCommands,notes:s.notes?String(s.notes):undefined
    };
  }).filter((s:any)=>s.content||s.activity||s.answer||s.visuals.length||s.mathSteps?.length||s.teachingPass?.englishExplanation);
}

/** Guarantee bilingual teachingPass fields so classroom can teach Malayalam even when Gemini omits wrappers. */
function ensureTeachingPass(sections: StudyMaterialSection[], language: string, sources: IndexedSource[]): StudyMaterialSection[] {
  const byId = new Map(sources.map(s => [s.id, s]));
  return sections.map((s) => {
    const cited = (s.sourceIds || []).map((id) => byId.get(id)).find(Boolean);
    const sourceText = String(s.sourceText || s.teachingPass?.sourceText || cited?.text || '').trim();
    const english = String(s.teachingPass?.englishExplanation || s.content || '').trim();
    let translated = String(s.teachingPass?.translatedExplanation || s.contentTranslation || '').trim();
    // If teaching language is not English and translation is empty, keep a clear placeholder
    // that still allows QA to pass structure checks; repair pass may fill real Malayalam later.
    if (language !== 'english' && !translated && english) {
      translated = ''; // V51.6.6: never disguise English as Malayalam; QA/repair must supply a real translation
    }
    const visuals = (s.visuals && s.visuals.length) ? s.visuals : (s.teachingPass?.visuals || []);
    const teachingPass = {
      sourceText,
      englishExplanation: english,
      translatedExplanation: translated,
      visuals,
      sourceIds: s.sourceIds || [],
    };
    return {
      ...s,
      sourceText: sourceText || s.sourceText,
      content: s.content || english,
      contentTranslation: s.contentTranslation || (translated !== english ? translated : s.contentTranslation),
      visuals,
      teachingPass,
    };
  });
}

function localQa(material:any,sources:IndexedSource[]){const issues:string[]=[];const valid=new Set(sources.map(s=>s.id));const ids=new Set<string>();for(const s of material.sections){if(!s.sourceIds.length)issues.push(`${s.heading}: missing source citation`);for(const id of s.sourceIds)if(!valid.has(id))issues.push(`${s.heading}: invalid source ${id}`);for(const v of s.visuals||[]){if(!v?.id||!VISUAL_TYPES.has(String(v?.type)))issues.push(`${s.heading}: invalid visual action`);if(v?.id&&ids.has(v.id))issues.push(`${s.heading}: duplicate visual id ${v.id}`);if(v?.id)ids.add(v.id);}for(const step of s.mathSteps||[]){if(!step.before||!step.operation||!step.after)issues.push(`${s.heading}: incomplete mathematical step`);if(!step.captionEnglish)issues.push(`${s.heading}: missing English step caption`);if(!step.captionMalayalam)issues.push(`${s.heading}: missing Malayalam step caption`);if(!step.verified)issues.push(`${s.heading}: unverified mathematical step`);if(!Array.isArray(step.visualIds)||!step.visualIds.length)issues.push(`${s.heading}: math step has no visual action mapping`);for(const vid of step.visualIds||[])if(!s.visuals.some((v:any)=>v.id===vid))issues.push(`${s.heading}: missing visual ${vid} for math step`);}if(material.teachingLanguage!=='english'&&material.type==='whiteboard-notes'&&!s.teachingPass?.englishExplanation&&!s.content)issues.push(`${s.heading}: missing English explanation`);}const coverage=new Set(material.sections.flatMap((s:any)=>s.sourceIds||[])).size;const score=Math.max(0,Math.min(100,100-issues.length*10+Math.min(12,coverage)));return {status:issues.length?'failed':'passed' as const,score,issues,checkedAt:new Date().toISOString()};}
function chapterSources(chapters:BookChapter[],sources:IndexedSource[],chapterId?:string){if(!chapterId||chapterId==='all')return sources;const c=chapters.find(x=>x.id===chapterId);if(!c)return sources;const ids=new Set(c.sourceIds);return sources.filter(s=>ids.has(s.id));}

/** V51.9.114: names used in the AI log. */
const TASK_NAME:Record<string,string>={'mcq':'MCQ','qa':'Q&A','revision-notes':'Revision notes','flashcards':'Flashcards','worksheet':'Worksheet','question-paper':'Question paper','ppt':'Slides','mind-map':'Mind map','whiteboard-notes':'Whiteboard notes','knowledge-base':'Knowledge base','problems-formulae':'Problems & formulae'};
export async function generateMaterial(documentId:string,type:MaterialType,sources:IndexedSource[],language='malayalam',apiKey?:string,chapterId='all',chapters:BookChapter[]=[],classDetail:'standard'|'detailed'='standard'):Promise<StudyMaterial>{
 const scoped=chapterSources(chapters,sources,chapterId);if(!scoped.length)throw new Error('No textbook source units are available for the selected chapter.');
 const sourceText=context(scoped);
 const detailContract = type==='whiteboard-notes' && classDetail==='detailed' ? `\nDETAILED CLASS MODE (MANDATORY):\n- Teach this as a full classroom lesson, not a summary.\n- Aim for 10-16 coherent teaching sections when the textbook context supports them.\n- Spend multiple sections on meaning, intuition, usefulness, visual models and connections BEFORE the first worked exercise.\n- Include at least two age-appropriate applications/examples when grounded by the chapter, then a recap and short understanding check.\n- Narration may be detailed, but whiteboard text must remain short; use diagrams, transformations, graphs, objects and short labels.\n- Malayalam teaching text must be real Malayalam, never an English placeholder.\n` : '';
 const generalClassArchitect = type==='whiteboard-notes' ? `
GENERAL CLASS LESSON ARCHITECT (MANDATORY):
- The topic/chapter is the lesson objective. A problem/exercise appearing in the source is an EXAMPLE, never automatically the lesson objective.
- Build an elaborate teacher-led sequence: (1) topic hook/title, (2) prerequisite recall, (3) meaning/intuition, (4) why/where useful, (5) concrete visual model, (6) mathematical representation/notation, (7) relationships and key ideas, (8) textbook worked example, (9) visual solution and interpretation, (10) generalisation/common mistakes, (11) recap/check understanding.
- For a topic such as Pairs of Equations, teach what a pair of equations means and why two simultaneous conditions matter BEFORE solving the bead problem. Use visual relationships/lines/intersection or another age-appropriate concrete model, then connect the textbook problem to that concept.
- Prefer several coherent teaching sections over one problem-solving section.
- Do not start the class with "Answer 1", "Solve", or a worked exercise unless the source itself is explicitly only a problem-solving exercise sheet.
- Problems inside the chapter are examples/exercises embedded later in the class.
- Every section must still be grounded in supplied source IDs; explanatory teaching may clarify the grounded concept but must not invent textbook facts.
` : '';
 const planner=await callGemini('You are AI Guru\'s curriculum planner and lesson architect. You have a trusted indexed textbook. Plan only from the supplied source IDs. Preserve the textbook sequence and do not invent content.',`Material request: ${specs[type]}${generalClassArchitect}${detailContract}\nTeaching language: ${language}\nReturn JSON {"title":"","overview":"","plan":[{"heading":"","sourceIds":[],"purpose":""}]}. Every plan item must cite sourceIds.\nTEXTBOOK CHAPTER/BOOK SOURCE:\n${sourceText}`,apiKey,`${TASK_NAME[type]??type} · plan`);
 const bilingualContract=`AI GURU TEACHING CONTRACT:\n1. For every teaching unit, identify the exact textbook paragraph first (sourceText). Do not paraphrase the source paragraph when quoting it.\n2. Explain that paragraph deeply in English first (englishExplanation).\n3. Then explain the same concept faithfully in ${language} (translatedExplanation). The translation may clarify wording but must not add facts absent from the source.\n4. Use ONE shared visuals array for both passes. The visual state must remain mathematically/chemically/scientifically identical while the narration language changes.\n5. For mathematics, preserve symbols, values, conditions, formulas and solution order exactly and use the V43 certified visual/maths runtime rather than invented drawing coordinates.\n6. Every claim must have sourceIds. If the source is insufficient, write 'Insufficient textbook source' rather than guessing.
7. For mathematics, keep the verified solution in mathSteps as before → operation → after. Captions are separate and explain only the current step in one or two short sentences.
8. mathSteps ORDER AND SCOPE (strict): a section gets mathSteps ONLY if its source text contains a real problem or derivation with numbers/symbols. Prefaces, introductions, tool/software descriptions (e.g. GeoGebra) and other narrative text get NO mathSteps — explain them in prose only. Within one section: (a) steps run strictly in solving order, each step's "before" equals the previous step's "after"; (b) the FIRST step's "before" is the problem's starting equation exactly as set up; (c) use ONE consistent variable naming; (d) never solve the same problem twice in one section — if the textbook shows more than one method, make each method its own section headed "Method 1 — …", "Method 2 — …" so the student always knows which method is being taught; (e) the last step's "after" is the final answer. Keep "operation" short (under 8 words, e.g. "subtract 10 from both sides").
8. Never put long teaching explanations into the mathematical visual sequence. Do not invent mathematical steps.
9. Every mathematical step must have an executable visualIds mapping. Use reference-video style actions such as token highlighting, digit/term movement, colour change, transformation, writing/erasing and reveal when appropriate.
9b. NUMBERED QUESTIONS: when a source unit begins with a question number ("3. Solve ..."), produce EXACTLY ONE section for that unit, in the same order as the units, with the number kept at the start of the heading. Never merge two questions, never skip one, never answer a question twice. Give the COMPLETE worked solution in mathSteps: one operation per step, every intermediate line written out, ending with a check of the answer.
10. Produce both captionEnglish and captionMalayalam for every mathematical step. The mathematics remains language-neutral; English and Malayalam explain the same verified transformation.`;
 // Visual Pattern RAG: proven, tested picture recipes that fit this chapter's wording are shown to the visual specialist.
 const patternContext=patternPromptContext(`${(Array.isArray(planner?.plan)?planner.plan:[]).map((p:any)=>`${p?.heading||''} ${p?.purpose||''}`).join(' ')} ${sourceText.slice(0,8000)}`,{k:6});
 const problemsFormulaeContext=type==='problems-formulae'?problemFormulaeDnaContext(`${JSON.stringify(planner)} ${sourceText.slice(0,12000)}`):'';
 const materialModeInstruction=type==='problems-formulae'?`\nSPECIAL MODE — PROBLEMS AND FORMULAE:\n- This output belongs to Material Studio practice/revision, NOT Classroom teaching style selection.\n- Extract formulas from the indexed textbook first; include conditions, symbols and units where applicable.\n- Build worked examples and exercises from the textbook scope.\n- For worked mathematics, use complete before → operation → after steps and answer checks.\n- Adapt the supplied 20-video Problem-Solving Visual DNA only as solving/whiteboard grammar.\n- Do not request, attach, or watch any MP4.\n${problemsFormulaeContext}`:'';
 const [content,visual,assessment]=await Promise.all([
  callGemini(TEACHER_STEP_CONTRACT+'\nYou are also AI Guru\'s senior study-material author. Produce publication-quality school material grounded only in the indexed textbook. Every worked example/exercise in the textbook must become mathSteps with ALL steps, each with captionEnglish and captionMalayalam. '+bilingualContract,`Return JSON {"title":"","overview":"","overviewTranslation":"","sections":[{"heading":"","content":"","contentTranslation":"","activity":"","activityTranslation":"","answer":"","answerTranslation":"","options":[],"translatedOptions":[],"sourceIds":[],"sourceText":"","mathSteps":[{"id":"","before":"","operation":"","after":"","captionEnglish":"","captionMalayalam":"","visualIds":[],"verified":false,"source":"mathsteps"}],"teachingPass":{"sourceText":"","englishExplanation":"","translatedExplanation":"","sourceIds":[],"visuals":[]}}]}. ${specs[type]}${generalClassArchitect}${detailContract}${materialModeInstruction}\nPLAN:${JSON.stringify(planner)}\n${bilingualContract}\n${visualInstruction()}\nTEXTBOOK:\n${sourceText}`,apiKey,`${TASK_NAME[type]??type} · content`),
  callGemini('You are AI Guru\'s visual specialist. Generate only visuals that the existing V43 visual engine can render. '+bilingualContract,`Return JSON {"sections":[{"visuals":[]}]}. Align visuals by section index. Prefer meaningful diagrams, equations, transformations, graphs or highlights when the source warrants them. Never add a visual just to decorate. For General Class, visuals must teach the concept before the worked example: concrete model -> relationship -> abstraction -> example. ${visualInstruction()}\n${generalClassArchitect}${detailContract}\n${patternContext}\n${materialModeInstruction}\nPLAN:${JSON.stringify(planner)}\nTEXTBOOK:\n${sourceText}`,apiKey,`${TASK_NAME[type]??type} · visuals`),
  callGemini('You are AI Guru\'s assessment and factual-check specialist. Validate educational correctness, age appropriateness and grounding. '+bilingualContract,`Return JSON {"sections":[{"activity":"","activityTranslation":"","answer":"","answerTranslation":"","options":[],"translatedOptions":[]}]}. For the requested material type, add appropriate assessment/checkpoint content. Never invent textbook facts.${materialModeInstruction}\nPLAN:${JSON.stringify(planner)}\nTEXTBOOK:\n${sourceText}`,apiKey,`${TASK_NAME[type]??type} · questions`),
 ]);
 const merged={sections:(content.sections||[]).map((s:any,i:number)=>({...s,visuals:Array.isArray(s.visuals)&&s.visuals.length?s.visuals:(visual.sections?.[i]?.visuals||[]),activity:s.activity||assessment.sections?.[i]?.activity,activityTranslation:s.activityTranslation||assessment.sections?.[i]?.activityTranslation,answer:s.answer||assessment.sections?.[i]?.answer,answerTranslation:s.answerTranslation||assessment.sections?.[i]?.answerTranslation,options:s.options?.length?s.options:assessment.sections?.[i]?.options,translatedOptions:s.translatedOptions?.length?s.translatedOptions:assessment.sections?.[i]?.translatedOptions,teachingPass:s.teachingPass?{...s.teachingPass,visuals:Array.isArray(s.teachingPass.visuals)&&s.teachingPass.visuals.length?s.teachingPass.visuals:(visual.sections?.[i]?.visuals||[])}:undefined}))};
 let material:any={id:`material:${nanoid(10)}`,documentId,type,title:String(content.title||planner.title||`${type} — AI Guru`),overview:String(content.overview||planner.overview||''),overviewTranslation:content.overviewTranslation?String(content.overviewTranslation):undefined,teachingLanguage:language,materialLanguages:language==='english'?['English']:[`English`,language],chapterIds:chapterId==='all'?chapters.map(c=>c.id):[chapterId],sections:normalize(merged,scoped,type),sources:scoped,model:MODEL,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 // Ensure every visual is shared by the two language passes and every source
 // paragraph displayed to the learner is an exact excerpt from the index.
 material.sections=material.sections.map((s:any)=>{const cited=s.sourceIds.map((id:string)=>scoped.find(x=>x.id===id)).find(Boolean);const exact=String(s.teachingPass?.sourceText||s.sourceText||'').trim();const source=String(cited?.text||'').trim();const sourceText=exact&&source&&(source.includes(exact)||exact.includes(source))?exact:source;return {...s,sourceText,teachingPass:s.teachingPass?{...s.teachingPass,sourceText,sourceIds:s.sourceIds,visuals:s.visuals}:undefined};});
 // Canonicalize once more after source-text reconciliation. This guarantees
 // the exact same executable visual state is stored in the section and its
 // bilingual teaching pass, even when Gemini emitted a malformed wrapper.
 material.sections=material.sections.map((s:any)=>{const visuals=normalizeVisuals(s.visuals,s.id);return {...s,visuals,teachingPass:s.teachingPass?{...s.teachingPass,visuals}:undefined};});
 // Visual Developer (pattern search -> build -> dry run) for steps that have no picture, then a dry run of EVERY visual:
 // errors go back to the model with the exact problems, and anything still undrawable is dropped before a student sees it.
 material.sections=await refineVisuals(material.sections,apiKey);
 material.sections=ensureTeachingPass(material.sections, language, scoped);
 material.sections=orderSectionsBySource(material.sections, scoped);
 let qa=localQa(material,scoped);
 let finalAudit=await callGemini('You are AI Guru\'s final material QA gate. Be strict. Reject any solution that skips a step, merges transformations, has a step without a caption, lacks required visuals, contains unsupported claims, wrong answers, missing source coverage, weak bilingual pairing, duplicated/inconsistent visuals, invalid math/science, or malformed material structures. Return JSON only.',`Audit this generated material. Return {"pass":true,"score":95,"issues":[]}. A score below 85 must fail. Check source paragraph → verified math steps/visual actions → captions → ${language} explanation. Every mathematical step must map to its visualIds.
MATERIAL:${JSON.stringify(material)}
SOURCES:${sourceText}`,apiKey,`${TASK_NAME[type]??type} · QA check`).catch(()=>({pass:qa.status==='passed',score:qa.score,issues:qa.issues}));
 let repairPass=0;
 while((finalAudit.pass===false||Number(finalAudit.score||0)<85||qa.status!=='passed')&&repairPass<3){
   repairPass++;
   const repaired=await callGemini(TEACHER_STEP_CONTRACT+'\nYou are AI Guru\'s targeted repair agent. This is repair pass '+repairPass+'/3. Repair ALL QA failures. If visuals are missing, regenerate meaningful textbook-grounded visual actions and wire every mathematical step to them. Preserve correct source text, source IDs, formulas, answer keys and shared visual meaning. Return the complete corrected JSON {"sections":[...]}. '+bilingualContract,`QA:${JSON.stringify(finalAudit)}
LOCAL_QA:${JSON.stringify(qa)}
DRAFT:${JSON.stringify(material.sections)}
TEXTBOOK:${sourceText}`,apiKey,`${TASK_NAME[type]??type} · repair`);
   material.sections=normalize(repaired,scoped,type);
   material.sections=material.sections.map((s:any)=>({...s,sourceText:String(s.sourceText||scoped.find(x=>s.sourceIds.includes(x.id))?.text||''),teachingPass:s.teachingPass?{...s.teachingPass,visuals:s.visuals}:undefined}));
   material.sections=await refineVisuals(material.sections,apiKey);
   material.sections=ensureTeachingPass(material.sections, language, scoped);
   material.sections=orderSectionsBySource(material.sections, scoped);
   qa=localQa(material,scoped);
   finalAudit=await callGemini('You are AI Guru\'s strict post-repair QA gate. Return JSON only. Reject anything still incorrect, unsupported, poorly grounded, bilingual-incomplete, missing required visuals, or visually inconsistent.',`Return {"pass":true,"score":95,"issues":[]}. Check the repaired material against the same textbook and ensure source paragraph → English explanation → ${language} explanation uses the identical visual state.
REPAIRED:${JSON.stringify(material)}
TEXTBOOK:${sourceText}`,apiKey,`${TASK_NAME[type]??type} · QA re-check`).catch(()=>({pass:qa.status==='passed',score:qa.score,issues:qa.issues}));
 }
 const score=Math.min(100,Number(finalAudit.score||qa.score));
 const issues=[...qa.issues,...(Array.isArray(finalAudit.issues)?finalAudit.issues.map(String):[])];
 const hardFail=issues.some(i=>/missing source|invalid source|invalid visual|duplicate visual|missing English|missing visual|text-only/i.test(String(i)));
 // Fail closed: Material Studio has no deployable `needs_review` state.
 const passed=Boolean(finalAudit.pass!==false&&qa.status==='passed'&&score>=85&&!hardFail);
 material.qa={status:passed?'passed':'failed',score,issues:[...issues, ...(repairPass? [`QA repair passes used: ${repairPass}`]:[])],checkedAt:new Date().toISOString()};
 return material as StudyMaterial;
}
