import type { MathDomain, MathVisualNode, MathVisualEvent, UniversalMathScene } from '../universal/types';
import type { VisualCheckId, VisualStyleId } from '../universal/style-library';
import type { TeachingStrategy } from '../../teaching/strategy';

export type VisualActionPlan = {
  id: string;
  kind: MathVisualNode['kind'];
  x?: number; y?: number; width?: number; height?: number;
  content?: string; latex?: string;
  tokenParts?: Array<{ latex: string; key: string }>;
  shape?: 'rectangle'|'circle'|'triangle';
  startX?: number; startY?: number; endX?: number; endY?: number;
  radius?: number; targetId?: string; from?: string; to?: string;
  graph?: { x:number[]; y:number[]; labels?:string[]; title?:string };
  style?: Record<string,string|number>;
  revealAfterStep?: number;
};

export type VisualStepPlan = {
  id: string;
  narration: string;
  visualIds: string[];
  durationMs?: number;
  cueWords?: string[];
  visualChecks?: VisualCheckId[];
};

export type AIGuruMathVisualPlan = {
  schemaVersion: '1.0';
  title: string;
  domain: MathDomain;
  grade: number;
  teachingGoal: string;
  verifiedExpression?: string;
  answer?: string;
  steps: VisualStepPlan[];
  nodes: VisualActionPlan[];
  teacherNotes?: string[];
  visualActions?: Array<{ type: 'token-move'; id: string; token: string; fromX: number; fromY: number; toX: number; toY: number; durationMs?: number; fadeOut?: boolean; fontSize?: number; visualStyleId?: string; atMs?: number }>;
  visualStyleId?: VisualStyleId;
  qaProfileId?: string;
  teachingStrategy?: TeachingStrategy;
  plannerProvider?: 'gemini' | 'agnes' | 'sarvam';
  referenceGrounding?: { watched:boolean; evidence:Array<{tStartMs:number; tEndMs:number; visualBeat:string; adaptation:string}> };
};

export function planToScene(plan:AIGuruMathVisualPlan, verification:UniversalMathScene['verification'], verified:boolean, pacing={stepMs:1250,pauseMs:800,transitionMs:700,speedFactor:0.82}, teachingLanguage:UniversalMathScene['teachingLanguage']='english', visualStyleMeta?: UniversalMathScene['visualStyle']):UniversalMathScene {
  const nodeIds = new Set(plan.nodes.map(n=>n.id));
  const nodes:MathVisualNode[] = plan.nodes.map(n=>({ ...n, id:n.id }));
  const safeSteps: VisualStepPlan[] = plan.steps.length ? plan.steps : [{id:'step-1',narration:plan.teachingGoal,visualIds:nodes.map(n=>n.id)}];
  let clock=0;
  const events:MathVisualEvent[]=[];
  const narrationCues:UniversalMathScene['narrationCues']=[];
  for(const step of safeSteps){
    const ids=step.visualIds.filter(id=>nodeIds.has(id));
    const slowedStep=Math.round(pacing.stepMs / Math.max(0.55,pacing.speedFactor));
    const dur=Math.max(slowedStep, step.durationMs ?? slowedStep);
    const per=Math.max(Math.round(pacing.transitionMs), Math.floor(dur/Math.max(1,ids.length)));
    ids.forEach((id,i)=>events.push({id:`event:${step.id}:${id}`,atMs:clock+i*per,durationMs:Math.min(Math.max(700,Math.round(pacing.transitionMs)),per),kind:'draw',targetId:id}));
    narrationCues.push({id:`cue:${step.id}`,atMs:clock,language:teachingLanguage,text:step.narration,targetId:ids[0]});
    clock += dur;
  }
  const finalDuration=Math.max(5200,clock + Math.round(pacing.pauseMs * 0.8));
  return {
    schemaVersion:'1.0', id:`ai-plan:${Date.now()}`, domain:plan.domain,
    gradeBand:plan.grade<=5?'1-5':plan.grade<=8?'6-8':plan.grade<=10?'9-10':'11-12',
    title:plan.title, expression:plan.verifiedExpression ?? plan.answer ?? plan.teachingGoal,
    verified, verification, nodes, events, narrationCues, teachingLanguage, visualStyle: visualStyleMeta, visualActions: plan.visualActions ?? [],
  };
}
