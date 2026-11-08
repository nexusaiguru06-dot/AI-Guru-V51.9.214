import type { MathVerificationResult, MathVerifier } from '../adapter';
import { HybridMathVerifier } from '../verifier';
import type { MathDomain, UniversalMathCompileOptions, UniversalMathScene } from './types';
import { buildVisualLanguageEvents, buildVisualLanguageNodes, getVisualStyleProfile } from './visual-language';
import { buildSemanticVisualPlan } from './semantic-visual-plan';
import { buildSemanticVisualGraph } from './semantic-graph';
import { buildTwoPassConstructionPlan } from './two-pass-construction';
import { selectVisualStyle } from './style-selector';
import { resolveMathDomainByVocabulary } from '../domains';

export function detectMathDomain(input:string): MathDomain {
  const s=input.toLowerCase().trim();
  if (/\b(set|sets|subset|union|intersection|complement|venn diagram|proposition|logic)\b/.test(s)) return 'sets';
  if (/\b(permutation|combination|factorial|counting principle|arrangement|selection|ncr|npr)\b/.test(s)) return 'combinatorics';
  if (/\b(inequality|inequalities|less than|greater than|at most|at least|interval|solution set)\b|[<>]\s*=?/.test(s)) return 'inequalities';
  if (/\b(natural number|whole number|integer|rational number|irrational number|real number|number system|number line|surds)\b/.test(s)) return 'number_systems';
  if (/\b(probability|probability of|sample space|event|odds|chance)\b|p\s*\(/.test(s)) return 'probability';
  if (/\b(mean|median|mode|variance|standard deviation|histogram|frequency)\b/.test(s)) return 'statistics';
  if (/\b(sin|cos|tan|cot|sec|csc|trigonometry|radians|degrees)\b/.test(s)) return 'trigonometry';
  if (/\b(limit|derivative|differentiate|integral|integrate|continuity|d\/dx|∫|lim)\b/.test(s)) return 'calculus';
  if (/\b(matrix|matrices|determinant|inverse matrix)\b|\[[^\]]*;[^\]]*\]/.test(s)) return 'matrices';
  if (/\b(vector|dot product|cross product|magnitude)\b|<[^>]+>/.test(s)) return 'vectors';
  if (/\b(complex|imaginary|real part|argand|modulus of z)\b|\bi\b/.test(s)) return 'complex_numbers';
  if (/\b(volume|surface area|area of|perimeter|cylinder|sphere|cone|cuboid|prism)\b/.test(s)) return 'mensuration';
  if (/\b(3d|three dimensional|plane|3-dimensional)\b/.test(s)) return '3d_geometry';
  if (/\b(angle|triangle|circle|quadrilateral|parallel|perpendicular|congruent|similar|theorem|proof)\b/.test(s)) return 'geometry';
  if (/\b(sequence|series|arithmetic progression|geometric progression|ap|gp|nth term)\b/.test(s)) return 'sequences_series';
  if (/\b(slope|gradient|coordinate|x-intercept|y-intercept|distance between|midpoint)\b|\(\s*-?\d+\s*,\s*-?\d+\s*\)/.test(s)) return 'coordinate_geometry';
  if (/\b(function|domain|range|f\s*\(|g\s*\(|graph of)\b/.test(s)) return 'functions';
  if (/\b(ratio|proportion|directly proportional|inverse proportional|scale factor)\b/.test(s)) return 'ratio_proportion';
  if (/\b(percent|percentage|discount|tax|decimal)\b/.test(s)) return 'decimals_percentages';
  if (/\b(fraction|numerator|denominator|mixed number)\b|\d+\s*\/\s*\d+/.test(s)) return 'fractions';
  if (/\b(profit|loss|interest|simple interest|compound interest|installment|emi|principal)\b/.test(s)) return 'financial_math';
  if (/\b(factor|factorise|factorize|quadratic|polynomial|roots)\b|x\s*\^\s*\d+/.test(s)) return 'polynomials';
  if (/\b(solve|equation|unknown|linear equation)\b|[a-z]\s*[+\-]\s*\d+\s*=/.test(s)) return 'linear_equations';
  // A worded problem that carries a real equation (an "=", a lone variable letter and a number,
  // e.g. "(W + 10) + W = 100" in the beads problem) is a linear-equation problem even if the
  // word "equation" never appears; without this it fell through to 'general' and no template applied.
  if (/=/.test(s) && /(^|[^a-z])[a-z]([^a-z]|$)/.test(s) && /\d/.test(s) && !/[<>]/.test(s)) return 'linear_equations';
  if (/[a-z]\s*\^|\b(algebra|term|coefficient|simplify|expand|identity)\b/.test(s)) return 'algebra';
  if (/\b(add|subtract|multiply|divide|sum|difference|product|quotient)\b|\d+\s*[×x*]\s*\d+/.test(s)) return 'arithmetic';
  return resolveMathDomainByVocabulary(s);
}

function gradeBand(grade:number|undefined): UniversalMathScene['gradeBand'] {
  if (!grade || grade <= 5) return '1-5';
  if (grade <= 8) return '6-8';
  if (grade <= 10) return '9-10';
  return '11-12';
}

function localizeNodesForLanguage(nodes: ReturnType<typeof buildVisualLanguageNodes>, language: 'english'|'malayalam') {
  if (language === 'english') return nodes;
  const map: Record<string,string> = {
    'Identify the quantities and operation':'അളവുകളും പ്രവർത്തനവും തിരിച്ചറിയാം',
    'Apply the same operation to both sides':'ഇരുവശത്തും ഒരേ പ്രവർത്തനം പ്രയോഗിക്കാം',
    'Equivalent form':'തുല്യ രൂപം',
    'equal groups':'തുല്യ ഗ്രൂപ്പുകൾ',
    'of equal parts':'തുല്യ ഭാഗങ്ങളിൽ',
    'Focus on the active terms':'പ്രധാന പദങ്ങളിൽ ശ്രദ്ധിക്കാം',
    'Now focus on the next mathematical step':'അടുത്ത ഗണിത ഘട്ടത്തിലേക്ക് ശ്രദ്ധിക്കാം',
    'Result':'ഫലം',
    'Area':'വിസ്തീർണ്ണം',
    'Perimeter':'ചുറ്റളവ്',
    'Base':'അടിസ്ഥാനം',
    'Height':'ഉയരം',
    'Step':'ഘട്ടം',
    'Solution':'പരിഹാരം',
    'Answer':'ഉത്തരം',
  };
  return nodes.map(n => {
    if ((n.kind === 'text' || n.kind === 'latex') && n.content) {
      let content = n.content;
      for (const [en, ml] of Object.entries(map)) content = content.replaceAll(en, ml);
      return {...n, content};
    }
    return n;
  });
}

export async function compileUniversalMath(expression:string, options:UniversalMathCompileOptions={}, verifier:MathVerifier=new HybridMathVerifier()):Promise<UniversalMathScene>{
  const domain=options.domain??detectMathDomain(expression);
  const verification:MathVerificationResult=options.verify===false?{valid:true,expression,errors:[]} : await verifier.verify(expression);
  const mode=options.visualMode ?? (domain==='arithmetic'||domain==='fractions'||domain==='geometry'||domain==='statistics'||domain==='probability'?'construction':'hybrid');
  const teachingLanguage = options.language ?? 'english';
  const styleSelection = selectVisualStyle({ domain, expression, mode, grade: options.grade, preferredStyle: options.preferredStyle as Parameters<typeof selectVisualStyle>[0]['preferredStyle'], bilingual: false });
  const nodes=localizeNodesForLanguage(buildVisualLanguageNodes(domain, expression, mode), teachingLanguage);
  const pacing=styleSelection.style.pacing;
  const duration=options.durationMs??Math.max(5200, nodes.length * pacing.stepMs + Math.max(0,nodes.length-1) * Math.round(pacing.pauseMs * 0.35));
  const events=buildVisualLanguageEvents(nodes,duration,mode,pacing);
  const profile=getVisualStyleProfile(domain,mode);
  const semanticVisualPlan = buildSemanticVisualPlan(domain, expression, nodes);
  // Sprint 8.3: two-pass planning is metadata/validation only. The existing
  // AI Guru graphics engine remains responsible for rendering the nodes/actions.
  const semanticGraph = buildSemanticVisualGraph(nodes, semanticVisualPlan);
  const constructionPlan = buildTwoPassConstructionPlan(
    semanticGraph,
    semanticVisualPlan.steps.map(step => step.id),
  );
  return {
    schemaVersion:'1.0', id:options.id??`math:${Date.now()}`, domain, gradeBand:gradeBand(options.grade),
    title:`${domain.replace(/_/g,' ')} · ${mode} visual lesson`, expression, verified:verification.valid,
    verification:{normalized:verification.normalized,steps:(verification as MathVerificationResult & {steps?:string[]}).steps,errors:verification.errors},
    nodes, events,
    teachingLanguage,
    narrationCues:events.map((e,i)=>({
      id:`cue:${e.id}`,atMs:e.atMs,language:teachingLanguage,
      text: teachingLanguage==='malayalam'
        ? (i===0?'നമുക്ക് ഈ ഗണിത ആശയം ഘട്ടം ഘട്ടമായി പഠിക്കാം.':'അടുത്ത ഗണിത ഘട്ടത്തിലേക്ക് ശ്രദ്ധിക്കാം.')
        : (i===0?'Let’s build this mathematical idea step by step.':`Now focus on ${nodes[i]?.id??'the next mathematical step'}`),
      targetId:e.targetId
    })),
    visualStyle:{ id:styleSelection.style.id, name:styleSelection.style.name, score:styleSelection.score, reasons:styleSelection.reasons, alternatives:styleSelection.alternatives, referenceIds:styleSelection.style.referenceIds, referenceUrls:styleSelection.style.referenceUrls, commonTeachingStyleId:styleSelection.style.commonTeachingStyleId, qaProfileId:styleSelection.style.qaProfileId, referenceSegmentId:styleSelection.referenceSegment?.id, referenceSegmentAsset:styleSelection.referenceSegment?.asset, referenceSegmentStartMs:styleSelection.referenceSegment?.sourceStartMs, referenceSegmentEndMs:styleSelection.referenceSegment?.sourceEndMs },
    visualLanguage:{
      mode:profile.mode, principle:profile.principle, referenceVideoUse:profile.referenceVideoUse,
      forbiddenTechniqueTransfer:profile.forbiddenTechniqueTransfer
    },
    semanticVisualPlan,
    semanticGraph,
    constructionPlan,
  };
}
