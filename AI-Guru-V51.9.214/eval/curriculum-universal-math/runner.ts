import fs from 'node:fs';
import path from 'node:path';
import { CURRICULUM_CASES, type CurriculumCase } from './cases';
import { compileUniversalMath, detectMathDomain } from '../../lib/ai-guru/math/universal/compiler';
import { validateAIGuruLesson } from '../../lib/ai-guru/qa/validator';
import type { UniversalMathScene } from '../../lib/ai-guru/math/universal/types';
import { validateVisualPlan, type AIGuruMathVisualPlan } from '../../lib/ai-guru/math/planner/validate';
import { validateAIGuruLesson } from '../../lib/ai-guru/qa/validator';
import type { AIGuruLesson, VisualAction } from '../../lib/ai-guru/lesson/types';

export type CaseResult = {
  id: string; board: string; grade: number; topic: string; prompt: string;
  expectedDomain: string; detectedDomain: string; compiledDomain: string;
  passed: boolean; score: number; checks: Record<string, boolean>; warnings: string[]; errors: string[];
};

function hasKind(scene:UniversalMathScene, kind:string){ return scene.nodes.some(n=>n.kind===kind); }
function gradeBand(grade:number){ return grade<=5?'1-5':grade<=8?'6-8':grade<=10?'9-10':'11-12'; }
function checkCoordinates(scene:UniversalMathScene){
  return scene.nodes.every(n=>['x','y','width','height','startX','startY','endX','endY'].every(k => {
    const v=(n as any)[k]; return v===undefined || Number.isFinite(v);
  }));
}

function sceneToVisualPlan(scene:UniversalMathScene, grade:number):AIGuruMathVisualPlan {
  const nodes=scene.nodes.map(n=>({
    id:n.id, kind:n.kind, x:n.x, y:n.y, width:n.width, height:n.height,
    content:n.content, latex:n.latex, shape:n.shape, startX:n.startX, startY:n.startY,
    endX:n.endX, endY:n.endY, graph:n.graph, style:n.style,
  }));
  return {schemaVersion:'1.0',title:scene.title,domain:scene.domain,grade,teachingGoal:`Explain ${scene.expression} visually`,verifiedExpression:scene.expression,steps:scene.events.map((e,i)=>({id:`step-${i+1}`,narration:scene.narrationCues[i]?.text ?? `Explain ${e.targetId ?? 'the next visual'}.`,visualIds:e.targetId?[e.targetId]:[]})),nodes};
}
function monotonicCues(scene:UniversalMathScene){
  let previous=-1;
  for(const e of scene.events){ if(e.atMs<previous || e.durationMs<=0) return false; previous=e.atMs; }
  return true;
}
function minimalLesson(scene:UniversalMathScene, tc:CurriculumCase):AIGuruLesson {
  const visual = scene.nodes.slice(0,4).map((n):VisualAction => n.kind==='latex'
    ? {type:'latex',id:n.id,latex:n.latex ?? scene.expression,x:n.x??80,y:n.y??100,width:n.width,height:n.height,fontSize:Number(n.style?.fontSize??32)}
    : n.kind==='shape' && n.shape ? {type:'shape',id:n.id,shape:n.shape,x:n.x??100,y:n.y??100,width:n.width??100,height:n.height??100}
    : n.kind==='line' ? {type:'line',id:n.id,startX:n.startX??100,startY:n.startY??300,endX:n.endX??800,endY:n.endY??300}
    : {type:'write',id:n.id,content:n.content ?? n.id,x:n.x??100,y:n.y??100,width:n.width,height:n.height});
  const cues=scene.events.slice(0,visual.length).map((e,i)=>({id:`qa-cue-${i}`,paragraphId:tc.id,track:'english' as const,startMs:e.atMs,endMs:e.atMs+e.durationMs,trigger:'time' as const,action:visual[i]}));
  return {schemaVersion:'1.0',id:`qa:${tc.id}`,title:tc.topic,language:{source:'english',target:'malayalam'},paragraphs:[{id:tc.id,source:{bookId:'curriculum-harness',chapterIndex:1,paragraphIndex:1,pageNumber:1,text:tc.prompt,pageImage:'fixture://page-1'},english:{text:`We will solve ${tc.prompt}.`,visuals:visual},malayalam:{text:'ഇത് ഘട്ടം ഘട്ടമായി പഠിക്കാം.',visuals:visual},cues,verified:scene.verified}]};
}

async function evaluateCase(tc:CurriculumCase):Promise<CaseResult>{
  const checks:Record<string,boolean>={}; const warnings:string[]=[]; const errors:string[]=[];
  const detected=detectMathDomain(tc.prompt);
  checks.domain=detected===tc.domain;
  if(!checks.domain) warnings.push(`Domain classifier returned ${detected}, expected ${tc.domain}.`);
  let scene:UniversalMathScene;
  try { scene=await compileUniversalMath(tc.prompt,{grade:tc.grade,domain:tc.domain}); }
  catch(e){ return {id:tc.id,board:tc.board,grade:tc.grade,topic:tc.topic,prompt:tc.prompt,expectedDomain:tc.domain,detectedDomain:detected,compiledDomain:'error',passed:false,score:0,checks:{compile:false},warnings,errors:[String(e)]}; }
  checks.compile=true;
  checks.gradeBand=scene.gradeBand===gradeBand(tc.grade);
  checks.verified=scene.verified;
  if(!scene.verified) warnings.push('Mathematical verification did not pass; review expression parsing for this case.');
  checks.nodes=scene.nodes.length>= (tc.minNodes??2);
  checks.events=scene.events.length>= (tc.minEvents??2);
  checks.uniqueNodeIds=new Set(scene.nodes.map(n=>n.id)).size===scene.nodes.length;
  checks.coordinates=checkCoordinates(scene);
  checks.eventTargets=scene.events.every(e=>!e.targetId || scene.nodes.some(n=>n.id===e.targetId));
  checks.syncMonotonic=monotonicCues(scene);
  const plan=sceneToVisualPlan(scene,tc.grade);
  try { validateVisualPlan(plan); checks.visualPlanContract=true; } catch(e) { checks.visualPlanContract=false; errors.push(`Visual plan contract: ${String(e)}`); }
  const lesson=minimalLesson(scene,tc);
  const qa=validateAIGuruLesson(lesson);
  checks.lessonQA=qa.every(x=>x.severity!=='error');
  if(!checks.lessonQA) errors.push(...qa.filter(x=>x.severity==='error').map(x=>`Lesson QA ${x.code}: ${x.message}`));
  checks.bandCorrect=scene.gradeBand===gradeBand(tc.grade);
  const missingKinds=tc.expectedVisualKinds.filter(k=>!hasKind(scene,k));
  checks.visualStrategy=missingKinds.length===0;
  if(missingKinds.length) warnings.push(`Missing expected visual kinds: ${missingKinds.join(', ')}`);
  const weighted=['compile','gradeBand','nodes','events','uniqueNodeIds','coordinates','eventTargets','syncMonotonic','visualPlanContract','lessonQA','bandCorrect','visualStrategy'];
  const score=Math.round(100*weighted.filter(k=>checks[k]).length/weighted.length);
  const passed=score>=78 && checks.compile && checks.nodes && checks.events && checks.uniqueNodeIds && checks.coordinates && checks.eventTargets;
  return {id:tc.id,board:tc.board,grade:tc.grade,topic:tc.topic,prompt:tc.prompt,expectedDomain:tc.domain,detectedDomain:detected,compiledDomain:scene.domain,passed,score,checks,warnings,errors};
}

function md(results:CaseResult[], started:string){
  const passed=results.filter(r=>r.passed).length;
  const lines:string[]=[];
  lines.push('# AI Guru Universal Math Curriculum Evaluation');
  lines.push(''); lines.push(`Generated: ${started}`); lines.push(`Cases: ${results.length}`); lines.push(`Passed: ${passed}`); lines.push(`Failed: ${results.length-passed}`); lines.push(`Pass rate: ${(passed/results.length*100).toFixed(1)}%`); lines.push('');
  lines.push('## By grade'); lines.push(''); lines.push('| Grade | Cases | Passed | Rate |'); lines.push('|---:|---:|---:|---:|');
  for(let g=1;g<=12;g++){ const rs=results.filter(r=>r.grade===g); if(!rs.length) continue; const p=rs.filter(r=>r.passed).length; lines.push(`| ${g} | ${rs.length} | ${p} | ${(p/rs.length*100).toFixed(0)}% |`); }
  lines.push(''); lines.push('## By domain'); lines.push(''); lines.push('| Domain | Cases | Passed | Rate |'); lines.push('|---|---:|---:|---:|');
  [...new Set(results.map(r=>r.expectedDomain))].sort().forEach(d=>{const rs=results.filter(r=>r.expectedDomain===d);const p=rs.filter(r=>r.passed).length;lines.push(`| ${d} | ${rs.length} | ${p} | ${(p/rs.length*100).toFixed(0)}% |`);});
  lines.push(''); lines.push('## Case results'); lines.push(''); lines.push('| Status | Grade | Board | Topic | Domain | Score | Notes |'); lines.push('|---|---:|---|---|---|---:|---|');
  results.forEach(r=>lines.push(`| ${r.passed?'PASS':'FAIL'} | ${r.grade} | ${r.board} | ${r.topic} | ${r.expectedDomain} | ${r.score} | ${(r.warnings.join(' ')+ ' '+r.errors.join(' ')).replace(/\|/g,'/')} |`));
  lines.push(''); lines.push('## Interpretation'); lines.push(''); lines.push('- This harness evaluates the **current deterministic Universal Math compiler**; it does not silently claim that a domain has production-quality rendering just because the domain is classified.');
  lines.push('- A case fails when core scene integrity is broken or its expected visual strategy is missing.');
  lines.push('- Use the JSON report to drive regression tests as new visual compilers and AI-generated plans are added.');
  return lines.join('\n');
}

async function main(){
  const started=new Date().toISOString();
  const results:CaseResult[]=[];
  for(const tc of CURRICULUM_CASES) results.push(await evaluateCase(tc));
  const outDir=path.resolve(process.cwd(),'eval/curriculum-universal-math/results'); fs.mkdirSync(outDir,{recursive:true});
  const report={schemaVersion:'1.0',generatedAt:started,total:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};
  fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(outDir,'report.md'),md(results,started));
  console.log(`AI Guru curriculum evaluation: ${report.passed}/${report.total} passed`);
  console.log(`Reports: ${path.join(outDir,'report.json')} and ${path.join(outDir,'report.md')}`);
  // Exit non-zero only for severe engine integrity failures, not for pedagogical coverage gaps.
  const severe=results.filter(r=>!r.checks.compile||!r.checks.uniqueNodeIds||!r.checks.coordinates||!r.checks.eventTargets).length;
  if(severe) process.exitCode=2;
}
main().catch(err=>{console.error(err);process.exitCode=2;});
