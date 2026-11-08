import 'server-only';

import type { AIGuruMathVisualPlan } from './types';
import { validateVisualPlan } from './validate';
import { TEACHER_STEP_CONTRACT } from '../../teaching/teacher-persona';
import type { ReferenceStyleProfile } from '../universal/style-library';
import { selectVisualStyle } from '../universal/style-selector';
import type { ReferralVideoCandidate, TeachingStrategy } from '../../teaching/strategy';
import { selectReferenceSegment } from '../universal/reference-segments';
import { retrieveMathContext } from '../rag';
import { buildReferenceVideoParts } from '../rag/reference-video-grounding';
import { getReferenceVideoDna, formatReferenceVideoDna } from '../rag/video-dna';
import { serverKey, SIGN_IN_FOR_SERVER_KEY } from '../../net/server-keys';

const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';

function extractJson(text:string){
 const fenced=text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]??text;
 const a=fenced.indexOf('{'),b=fenced.lastIndexOf('}');
 if(a<0||b<=a)throw new Error('Gemini did not return a JSON visual plan.');
 return JSON.parse(fenced.slice(a,b+1));
}

function prompt(input:string,grade:number,domain:string|undefined,style:ReferenceStyleProfile,language:'english'|'malayalam',strategy:TeachingStrategy,referral:ReferralVideoCandidate|undefined,ragBlock:string,videoAttached:boolean){
 return `${TEACHER_STEP_CONTRACT}

You are AI Guru's Universal Math Visual Planner for Kerala State/CBSE Classes 1-12.
Generate a genuinely problem-specific teaching animation. Return ONLY JSON matching schemaVersion 1.0.

INPUT QUESTION: ${input}
GRADE: ${grade}
HINT DOMAIN: ${domain??'auto'}
SELECTED VISUAL STYLE: ${style.name}
STYLE ID: ${style.id}
STYLE VIDEO PROMPT: ${style.videoPrompt??'Use AI Guru progressive mathematical construction.'}
TEACHING STRATEGY: ${strategy}
TEACHING LANGUAGE: ${language}

GENERAL CLASS VISUAL-DNA MEMORY:
${ragBlock||'No retrieved pattern. Use AI Guru verified primitives.'}

RAG RULES:
- Retrieved Visual-DNA entries are visual teaching references, not mathematical authority.
- Reuse visual grammar, not exact examples, narration, code, branding, or artwork.
- Prefer the retrieved operations when they fit the actual mathematics.
- Convert any retrieved animation grammar into AI Guru VisualActions/nodes.
- For moving digits, signs, or terms, use token-move with stable semantic identity.
- Use transform/fade/highlight/write/erase as appropriate.

REFERENCE VIDEO RULE:
${referral?`A selected reference is "${referral.originalFilename}". Actual video attachment status: ${videoAttached?'ATTACHED':'NOT ATTACHED'}. ${videoAttached?'You MUST inspect the actual visual sequence before planning and return watched=true with concrete temporal evidence.':'Do NOT claim to have watched the video; use only the supplied reference metadata/style grammar and return watched=false.'} Extract/adapt construction order, object movement, highlighting, transformation, pacing, pauses and spatial relationships only when supported.`:'No reference video selected.'}
If a reference video is attached, the returned JSON MUST include:
"referenceGrounding":{"watched":true,"evidence":[{"tStartMs":0,"tEndMs":1000,"visualBeat":"...","adaptation":"..."}]}
Do not claim watched=true unless the attached video part was actually available.

GENERAL CLASSROOM VISUAL CONTRACT (MANDATORY):
- This is a visual classroom, NOT a PDF/transcript copier. Never place paragraph-length source text or narration on the board.
- First identify a concrete visual model for the concept. Examples: counters/beads for quantities, balance/pairs for equations, number line for arithmetic, area tiles for algebra, geometric construction for geometry, coordinate graph for functions, moving secant/tangent for calculus.
- Adapt the retrieved K-12 and Video-DNA grammar into the CURRENT textbook concept; do not merely rewrite its equations.
- Every general-teaching plan MUST contain at least 3 spatial/animated nodes total from shape, line, arrow, graph, highlight, transform, and at least 2 different spatial kinds when the concept permits.
- Use short labels only (normally <= 40 characters). Detailed explanation belongs in step.narration/TTS, not text nodes.
- Begin concrete/pictorial where possible, then morph/group/move/highlight into the symbolic equation. A worked problem inside a general lesson remains in this visual grammar.
- For word problems, visualize the quantities and relationships BEFORE algebraic manipulation. Example: 100 beads with 10 extra -> separate 10 -> split remaining 90 -> restore 10 -> morph to equations.
- Do not output a plan whose board is mostly text + LaTeX. Such a plan is invalid for General Classroom.

VISUAL RULES:
- 1000x700 canvas; keep coordinates readable and within 0..1000/700.
- Preserve semantic identity across steps.
- Animate transformations instead of replacing the whole board whenever possible.
- For equations, show meaningful transformations.
- Use token-move for physical movement of a digit/operator/term. Set fadeOut=true when the old token disappears. Set atMs when the move must occur at a specific scene time; otherwise it may start at the beginning of the visual beat.
- EVERY token-move MUST include non-empty string fields: id, token, and finite numbers fromX, fromY, toX, toY (range -200..1200). Never emit token-move with an empty token or missing coordinates.
- token-move belongs in visualActions (not as a node kind) unless the node itself is the moving glyph; preferred pattern is nodes for static glyphs + visualActions for the move.
- Prefer 4-12 meaningful steps.
- Every step references node IDs and contains applicable visualChecks.
- Do not output executable source code, HTML, SVG or URLs.

JSON SHAPE:
{"schemaVersion":"1.0","visualStyleId":"${style.id}","qaProfileId":"${style.qaProfileId}","title":"...","domain":"...","grade":${grade},"teachingGoal":"...","verifiedExpression":"optional","answer":"optional","referenceGrounding":{"watched":false,"evidence":[]},"steps":[{"id":"s1","narration":"...","visualIds":["n1"],"durationMs":900,"cueWords":[],"visualChecks":[]}],"visualActions":[{"type":"token-move","id":"tm1","token":"7","fromX":200,"fromY":150,"toX":320,"toY":210,"durationMs":650,"fadeOut":true,"atMs":1200}],"nodes":[{"id":"n1","kind":"text|latex|line|shape|point|arrow|graph|highlight|transform|erase|token-move","x":100,"y":100,"width":200,"height":80,"content":"...","latex":"...","shape":"rectangle|circle|triangle","startX":0,"startY":0,"endX":0,"endY":0,"radius":8,"graph":{"x":[],"y":[],"title":"..."},"style":{"fontSize":36,"strokeWidth":4}}],"teacherNotes":[]}

Allowed domains: arithmetic, fractions, decimals_percentages, ratio_proportion, algebra, linear_equations, polynomials, sequences_series, coordinate_geometry, functions, trigonometry, geometry, mensuration, calculus, statistics, probability, matrices, vectors, complex_numbers, financial_math, 3d_geometry, general.`;
}


type GeneralVisualQa = {
 ok:boolean; spatialCount:number; spatialKinds:string[]; longTextCount:number; symbolicCount:number; requiredSpatial:number; failures:string[];
};

function generalVisualQuality(plan:AIGuruMathVisualPlan):GeneralVisualQa{
 const spatial=new Set(['shape','line','arrow','graph','highlight','transform']);
 const nodes=Array.isArray(plan.nodes)?plan.nodes:[];
 const spatialNodes=nodes.filter((n:any)=>spatial.has(String(n.kind)));
 const spatialKinds=new Set(spatialNodes.map((n:any)=>String(n.kind)));
 const longText=nodes.filter((n:any)=>String(n.kind)==='text' && String(n.content||'').trim().length>60);
 const symbolic=nodes.filter((n:any)=>['text','latex'].includes(String(n.kind)));
 const requiredSpatial=Math.max(3,Math.ceil(symbolic.length/3));
 const failures:string[]=[];
 if(spatialNodes.length<3) failures.push(`needs at least 3 spatial nodes; found ${spatialNodes.length}`);
 if(spatialKinds.size<2) failures.push(`needs at least 2 spatial kinds; found ${spatialKinds.size} (${[...spatialKinds].join(', ')||'none'})`);
 if(longText.length>0) failures.push(`contains ${longText.length} long text node(s); narration must stay out of the board`);
 if(spatialNodes.length<requiredSpatial) failures.push(`spatial/symbolic QA requires ${requiredSpatial} spatial nodes for ${symbolic.length} symbolic nodes; found ${spatialNodes.length}`);
 const domain = String((plan as any).domain || '').toLowerCase();
 const hasMathVisual = symbolic.length > 0 || spatialNodes.some((n:any) => ['graph','arrow','highlight','transform','line'].includes(String(n.kind)));
 if(['algebra','linear_equations','polynomials'].includes(domain) && !hasMathVisual) failures.push('algebraic lesson has no symbolic/derivation visual content; generic shapes are not an acceptable teaching plan');
 return {ok:failures.length===0,spatialCount:spatialNodes.length,spatialKinds:[...spatialKinds],longTextCount:longText.length,symbolicCount:symbolic.length,requiredSpatial,failures};
}

function visualQaRepairPrompt(attempt:number,quality:GeneralVisualQa){
 return `GENERAL CLASSROOM VISUAL QA — REPAIR PASS ${attempt}/3\nThe previous generated plan FAILED QA. Keep the QA standard; regenerate the lesson so it passes.\nExact failures:\n- ${quality.failures.join('\n- ')}\nCurrent counts: spatial=${quality.spatialCount}, spatialKinds=${quality.spatialKinds.length} [${quality.spatialKinds.join(', ')||'none'}], symbolic=${quality.symbolicCount}, requiredSpatial=${quality.requiredSpatial}, longText=${quality.longTextCount}.\n\nREPAIR RULES:\n- Do NOT ask QA to accept less. Repair the animation plan.\n- Start with a concrete/pictorial model appropriate to the CURRENT concept and retrieved K-12 Visual DNA.\n- Add meaningful shape/line/arrow/graph/highlight/transform nodes until the required spatial count is genuinely met. Never add decorative dummy shapes just to satisfy the count.\n- Use at least 2 meaningful spatial kinds.\n- Reduce duplicate text/LaTeX nodes by transforming/reusing symbolic objects instead of creating a fresh equation node for every narration sentence.\n- No text node over 60 characters. Put explanations in step.narration/TTS.\n- For word problems, show quantities and relationships visually before symbolic algebra.\n- Preserve mathematical correctness and semantic identity across transformations.\nReturn a COMPLETE replacement JSON plan only.`;
}

export async function generateVisualPlan(input:string,grade:number,domain?:string,selectedStyle?:ReferenceStyleProfile,teachingLanguage:'english'|'malayalam'='english',strategy:TeachingStrategy='step_by_step',referral?:ReferralVideoCandidate,byokKey?:string,agnesApiKey?:string,sarvamApiKey?:string):Promise<AIGuruMathVisualPlan>{
 const key=byokKey?.trim() || await serverKey('GEMINI_API_KEY'); // V51.9.176: the server's key only for signed-in users
 if(!key)throw new Error(process.env.GEMINI_API_KEY ? SIGN_IN_FOR_SERVER_KEY : 'GEMINI_API_KEY is not configured.');
 const resolvedDomain=(domain??'general') as Parameters<typeof selectVisualStyle>[0]['domain'];
 const styleSelection=selectedStyle
  ? {style:selectedStyle,referenceSegment:selectedStyle.segmentCollectionId?selectReferenceSegment(selectedStyle.segmentCollectionId,input):undefined}
  : selectVisualStyle({domain:resolvedDomain,expression:input,mode:'hybrid',grade,bilingual:false});
 const style=styleSelection.style;

 let ragBlock='';
 try{
  if(process.env.AI_GURU_MATH_RAG!=='0'){
   const ctx=await retrieveMathContext(input,{
    topK:Number(process.env.AI_GURU_MATH_RAG_TOP_K??6),
    lexicalOnly:false,
    useFaiss:process.env.AI_GURU_MATH_RAG_FAISS!=='0',
   });
   ragBlock=ctx.formattedBlock;
  }
 }catch{/* RAG is non-blocking */}

 // V51.4: normal lessons use the local Visual-DNA cache. Physical video upload is
 // opt-in only for one-time enrichment/diagnostics to protect BYOK/free quotas.
 const dna=await getReferenceVideoDna(referral?.id);
 if(dna) ragBlock += `\n\n${formatReferenceVideoDna(dna)}`;
 const videoEnabled=process.env.AI_GURU_MATH_RAG_WATCH_VIDEO==='1';
 const videoParts=videoEnabled&&referral?.file?await buildReferenceVideoParts(referral.file,key):null;
 const videoAttached=Boolean(videoParts?.length);
 const text=prompt(input,grade,domain,style,teachingLanguage,strategy,referral,ragBlock,videoAttached);
 const parts:any[]=[{text}];
 if(videoParts) parts.push(...videoParts);

 let plannerProvider:'gemini'|'agnes'|'sarvam'='gemini';
 const callPlanner=async(extra='')=>{
  const requestParts=[...parts];
  if(extra) requestParts.push({text:extra});
  try {
   if(!key) throw new Error('Gemini key unavailable');
   const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({contents:[{role:'user',parts:requestParts}],generationConfig:{temperature:0.12,responseMimeType:'application/json'}})
   });
   if(!response.ok)throw new Error(`Gemini visual planning failed: ${response.status}`);
   const data=await response.json() as any;
   const outText=data?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||'').join('')||'';
   plannerProvider='gemini';
   return validateVisualPlan(extractJson(outText));
  } catch(geminiError) {
   const fallbackPrompt = `${text}

${extra}

FALLBACK PROVIDER CONTRACT: Return ONLY the complete JSON visual plan. Do not claim to have watched a physical reference video. Use the supplied local Visual-DNA context and create an original animation plan. Keep the same required schema and mathematical correctness.`;
   const fallbacks:[string,string][]=[['agnes',agnesApiKey||''],['sarvam',sarvamApiKey||'']];
   let last:any=geminiError;
   for(const [provider,providerKey] of fallbacks){
    if(!providerKey) continue;
    try{
     const base=provider==='agnes'?'https://apihub.agnes-ai.com/v1':'https://api.sarvam.ai/v1';
     const modelId=provider==='agnes'?'agnes-3.0-flash':'sarvam-105b';
     const headers:any={'content-type':'application/json','Authorization':`Bearer ${providerKey}`};
     if(provider==='sarvam') headers['api-subscription-key']=providerKey;
     const body:any={model:modelId,messages:[{role:'system',content:"You are AI Guru's strict visual lesson planner. Output only valid JSON matching the requested schema."},{role:'user',content:fallbackPrompt}],temperature:0.12,max_tokens:30000,stream:false};
     if(provider==='sarvam') body.response_format={type:'json_object'};
     const response=await fetch(`${base}/chat/completions`,{method:'POST',headers,body:JSON.stringify(body)});
     if(!response.ok) throw new Error(`${provider} visual planning failed: ${response.status}`);
     const data=await response.json() as any;
     const outText=data?.choices?.[0]?.message?.content||'';
     plannerProvider=provider as any;
     const fallbackPlan=validateVisualPlan(extractJson(outText));
     fallbackPlan.referenceGrounding={watched:false,evidence:[]};
     return fallbackPlan;
    }catch(e){ last=e; }
   }
   throw last instanceof Error ? last : new Error('No AI visual planner is available.');
  }
 };
 let plan=await callPlanner();
 let quality=generalVisualQuality(plan);
 const qaAttempts:Array<{attempt:number;ok:boolean;spatialCount:number;spatialKinds:string[];symbolicCount:number;requiredSpatial:number;longTextCount:number;failures:string[]}> = [];
 qaAttempts.push({attempt:1,...quality});
 // V51.6.4: QA is the contract. Do not weaken it. Up to three total generation
 // passes are allowed; each repair receives the exact failures from the previous pass.
 for(let attempt=2; attempt<=3 && !quality.ok; attempt++){
  plan=await callPlanner(visualQaRepairPrompt(attempt,quality));
  quality=generalVisualQuality(plan);
  qaAttempts.push({attempt,...quality});
 }
 if(!quality.ok){
  throw new Error(`General Classroom visual QA failed after 3 passes: ${quality.failures.join('; ')}`);
 }
 // Runtime log metadata only; this is not part of the planner schema and is never rendered.
 (plan as any).generalVisualQa={standard:'strict',passed:true,attempts:qaAttempts};
 // Never allow the model to claim it watched a reference that was not attached.
 if(!videoAttached && plan.referenceGrounding?.watched){
  plan.referenceGrounding={watched:false,evidence:[]};
 }
 // When a video was attached, require auditable temporal evidence instead of silently
 // accepting metadata-only planning. This makes selection != watching unambiguous.
 if(plannerProvider==='gemini' && videoAttached && (!plan.referenceGrounding?.watched || !plan.referenceGrounding.evidence?.length)){
  throw new Error('Gemini received the reference video but did not return temporal grounding evidence.');
 }
 return {
  ...plan,
  teachingStrategy:strategy,
  plannerProvider,
  visualStyleId:style.id,
  qaProfileId:style.qaProfileId,
  steps:plan.steps.map(step=>({...step,visualChecks:step.visualChecks?.length?step.visualChecks:inferStepChecks(step,plan.nodes,style.visualChecks)})),
 };
}

function inferStepChecks(step:AIGuruMathVisualPlan['steps'][number],nodes:AIGuruMathVisualPlan['nodes'],available:ReferenceStyleProfile['visualChecks']){
 const kinds=new Set(nodes.filter(n=>step.visualIds.includes(n.id)).map(n=>n.kind));
 const text=`${step.narration} ${step.cueWords?.join(' ')??''}`.toLowerCase();
 return available.filter(check=>{
  if(check==='geometry-progressive-construction')return ['shape','line','point','arrow'].some(k=>kinds.has(k as never));
  if(check==='graph-progressive-drawing')return ['graph','line','point'].some(k=>kinds.has(k as never));
  if(check==='latex-token-decomposition')return kinds.has('latex')||/equation|term|symbol|expression/.test(text);
  if(check==='token-equation-transformation'||check==='term-movement'||check==='symbol-morphing')return kinds.has('transform')||/transform|move|rearrange|simplif/.test(text);
  if(check==='fraction-transformation')return /fraction|numerator|denominator/.test(text)||kinds.has('transform');
  if(check==='arrow-annotation')return kinds.has('arrow')||/arrow|show|because|therefore|annotat/.test(text);
  if(check==='highlight-circle-underline')return kinds.has('highlight')||/highlight|focus|notice|important/.test(text);
  if(check==='write-erase')return ['text','latex','erase'].some(k=>kinds.has(k as never))||/write|erase|label/.test(text);
  if(check==='camera-zoom-pan')return /zoom|pan|camera|focus/.test(text);
  if(check==='pause-emphasis')return /pause|emphasis|notice|important|key/.test(text);
  if(check==='voice-cue-sync')return Boolean(step.cueWords?.length);
  if(check==='operation-animation')return /add|subtract|minus|plus|multiply|divide|operation|apply/.test(text)||kinds.has('transform');
  if(check==='transformation-qa')return kinds.has('transform')||/transform|derive|change|becomes|therefore/.test(text);
  return false;
 });
}
