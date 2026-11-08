import { NextResponse } from 'next/server';
import { compileUniversalMath, detectMathDomain, selectVisualStyle } from '@/lib/ai-guru/math/universal';
import { selectTeachingStrategy } from '@/lib/ai-guru/teaching/strategy';
import { generateVisualPlan, planToScene } from '@/lib/ai-guru/math/planner';

export async function POST(req:Request){
  try{
    const body=await req.json();
    const question=String(body?.question ?? body?.expression ?? '').trim();
    const grade=Number(body?.grade ?? 12);
    if(!question) return NextResponse.json({ok:false,error:'question is required'},{status:400});
    if(!Number.isInteger(grade)||grade<1||grade>12) return NextResponse.json({ok:false,error:'grade must be 1-12'},{status:400});

    const initialDomain = (body?.domain ? String(body.domain) : detectMathDomain(question)) as Parameters<typeof selectVisualStyle>[0]['domain'];
    const teachingLanguage = body?.language === 'malayalam' ? 'malayalam' : 'english';
    const strategy = selectTeachingStrategy({ question, domain: initialDomain, grade, hasActualProblem: body?.hasActualProblem });
    const selection = selectVisualStyle({domain: initialDomain, expression: question, mode:'hybrid', grade, preferredStyle:body?.preferredStyle, bilingual:false});
    const byokKey=typeof body?.apiKey==='string'?body.apiKey.trim():undefined;
    const agnesApiKey=typeof body?.agnesApiKey==='string'?body.agnesApiKey.trim():undefined;
    const sarvamApiKey=typeof body?.sarvamApiKey==='string'?body.sarvamApiKey.trim():undefined;
    const plan=await generateVisualPlan(question,grade,body?.domain,selection.style,teachingLanguage,strategy.strategy,strategy.referral,byokKey,agnesApiKey,sarvamApiKey);
    let verification={errors:['No isolated expression was supplied for verification.']};
    let verified=false;
    if(plan.verifiedExpression){
      const base=await compileUniversalMath(plan.verifiedExpression,{grade,domain:plan.domain,verify:true,durationMs:undefined,preferredStyle:body?.preferredStyle,bilingual:false,language:teachingLanguage});
      verification=base.verification ?? {errors:[]};
      verified=base.verified;
    }
    const scene=planToScene(plan,verification,verified,selection.style.pacing,teachingLanguage);
    const styledScene = {...baseStyleScene(scene, plan.verifiedExpression || question, grade, plan.domain, body?.preferredStyle), visualStyle:{id:selection.style.id,name:selection.style.name,score:selection.score,reasons:selection.reasons,alternatives:selection.alternatives,referenceIds:selection.style.referenceIds,referenceUrls:selection.style.referenceUrls,referenceSegmentId:selection.referenceSegment?.id,referenceSegmentAsset:selection.referenceSegment?.asset,referenceSegmentStartMs:selection.referenceSegment?.sourceStartMs,referenceSegmentEndMs:selection.referenceSegment?.sourceEndMs}};
    return NextResponse.json({ok:true,source:`${plan.plannerProvider || 'gemini'}-visual-planner`,strategy,plan,scene:styledScene});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500});
  }
}

function baseStyleScene(scene: any, expression:string, grade:number, domain:any, preferredStyle?:string){ const s=selectVisualStyle({domain,expression,grade,mode:scene?.visualLanguage?.mode ?? 'hybrid',preferredStyle: preferredStyle as Parameters<typeof selectVisualStyle>[0]['preferredStyle'],bilingual:false}); return {...scene, visualStyle:{id:s.style.id,name:s.style.name,score:s.score,reasons:s.reasons,alternatives:s.alternatives,referenceIds:s.style.referenceIds,referenceUrls:s.style.referenceUrls,referenceSegmentId:s.referenceSegment?.id,referenceSegmentAsset:s.referenceSegment?.asset,referenceSegmentStartMs:s.referenceSegment?.sourceStartMs,referenceSegmentEndMs:s.referenceSegment?.sourceEndMs,commonTeachingStyleId:s.style.commonTeachingStyleId,qaProfileId:s.style.qaProfileId}}; }
