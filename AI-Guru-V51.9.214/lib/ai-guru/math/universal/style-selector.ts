import type { MathDomain, VisualMathMode } from './types';
import { getReferenceStyle, REFERENCE_STYLE_LIBRARY, type ReferenceStyleProfile, type VisualStyleId } from './style-library';
import { selectReferenceSegment, type ReferenceSegment } from './reference-segments';

export interface VisualStyleSelectionInput {
  domain: MathDomain;
  expression: string;
  mode: VisualMathMode;
  grade?: number;
  preferredStyle?: VisualStyleId;
  bilingual?: boolean;
}

export interface VisualStyleSelection {
  style: ReferenceStyleProfile;
  score: number;
  reasons: string[];
  alternatives: VisualStyleId[];
  referenceSegment?: ReferenceSegment;
}

const keyword = (s:string, terms:string[]) => terms.some(t => s.toLowerCase().includes(t));

export function selectVisualStyle(input: VisualStyleSelectionInput): VisualStyleSelection {
  if (input.preferredStyle) {
    const style = getReferenceStyle(input.preferredStyle);
    return { style, score: 100, reasons:['Teacher/user explicitly selected this style.'], alternatives: REFERENCE_STYLE_LIBRARY.filter(s=>s.id!==style.id && s.bestFor.includes(input.domain)).slice(0,3).map(s=>s.id), referenceSegment: style.segmentCollectionId ? selectReferenceSegment(style.segmentCollectionId, input.expression) : undefined };
  }
  const ranked = REFERENCE_STYLE_LIBRARY.map(style => {
    let score = style.bestFor.includes(input.domain) ? 60 : 0;
    const candidateSegment = style.segmentCollectionId ? selectReferenceSegment(style.segmentCollectionId, input.expression) : undefined;
    // A segmented reference cannot be selected unless a concept segment is known.
    // This prevents the system from silently using an unrelated shape clip.
    if (style.segmentCollectionId && !candidateSegment) score -= 120;
    if (style.modes.includes(input.mode)) score += 15;
    if (input.bilingual && style.caption === 'bilingual') score += 5;
    if (keyword(input.expression,['=','solve','simplify','factor','expand','differentiate','integrate'])) {
      if (style.id === 'easy-equation-transformation' || style.id === 'calculus-cinematic') score += 20;
    }
    if (keyword(input.expression,['triangle','circle','angle','parallel','perpendicular','theorem','proof','congruent','similar','bisector','pythagoras','construction'])) {
      if ((style.id === 'geometry-area-derivation' || style.id === 'area-formula-visual-derivation-reference') && keyword(input.expression,['area','derive','derivation','formula','base','height','decompose','split','triangle area'])) score += style.id === 'area-formula-visual-derivation-reference' ? 85 : 70;
      if (style.id === 'geometry-construction') score += 20;
      if (style.id === 'geometry-proof-construction' && keyword(input.expression,['theorem','proof','congruent','similar','pythagoras','bisector','prove'])) score += 55;
    }
    if (keyword(input.expression,['area of parallelogram','area of triangle','area of rectangle','area of square','area of rhombus','area of trapezium','area of trapezoid','area derivation','derive area','area formula','base times height','base × height','base x height','decompose the shape','split into triangles','diagonals'])) {
      if (style.id === 'geometry-area-derivation' || style.id === 'area-formula-visual-derivation-reference') score += style.id === 'area-formula-visual-derivation-reference' ? 90 : 75;
    }
    if (style.id === 'area-formula-visual-derivation-reference' && keyword(input.expression,['rhombus','diamond','diagonal','diagonals','trapezium','trapezoid','parallel sides','square','rectangle','triangle','parallelogram'])) score += 30;
    if (keyword(input.expression,['first principle','first principles','first-principles','limit definition','definition of derivative','from first principles','secant to tangent','secant-to-tangent','h→0','delta x tends to zero','Δx tends to zero'])) {
      if (style.id === 'calculus-first-principles-reference') score += 85;
    }
    if (keyword(input.expression,['slope to derivative','slope and derivative','rise over run to derivative','gradient to derivative','slope function','derivative as slope'])) {
      if (style.id === 'calculus-slope-to-derivative-reference') score += 80;
    }
    if (keyword(input.expression,['quadratic formula','quadratic equation','discriminant','completing the square','complete the square','ax²+bx+c','ax^2+bx+c'])) {
      if (style.id === 'quadratic-formula-derivation-reference') score += 90;
    }
    if (keyword(input.expression,['graph','function','f(x)','plot','slope','intercept','tangent','secant','derivative','differentiate','gradient','rate of change'])) {
      if (style.id === 'graph-explorer' && keyword(input.expression,['graph','function','f(x)','plot','intercept'])) score += 25;
      if (style.id === 'calculus-slope-explorer-reference' && keyword(input.expression,['slope','tangent','secant','derivative','differentiate','gradient','rate of change','f(x)'])) score += 55;
    }
    if (keyword(input.expression,['tangent','secant','slope value','gradient','rate of change','derivative','differentiate'])) if (style.id === 'calculus-slope-explorer-reference') score += 30;
    if (keyword(input.expression,['fraction','numerator','denominator','/'])) if (style.id === 'fraction-visual') score += 25;
    if (keyword(input.expression,['sin','cos','tan','radian','unit circle','trigonometric identity','trig identity','sin(a+b)','sin(a-b)','cos(a+b)','cos(a-b)'])) {
      if (style.id === 'trigonometry-visual') score += 25;
      if (style.id === 'trigonometry-unit-circle-reference') score += 50;
    }
    if (keyword(input.expression,['unit circle','sin θ','cos θ','tan θ','identity','compound angle','double angle','triple angle'])) {
      if (style.id === 'trigonometry-unit-circle-reference') score += 20;
    }
    if (keyword(input.expression,['definite integral','riemann','riemann sum','area under','area beneath','partition','rectangles','delta x','Δx','sigma f','sum to integral','lower sum','upper sum','midpoint sum','left sum','right sum'])) {
      if (style.id === 'calculus-riemann-sum-area-reference') score += 65;
    }
    if (keyword(input.expression,['mean','median','mode','variance','histogram','frequency'])) if (style.id === 'statistics-build') score += 25;
    if (keyword(input.expression,['surface','volume','3d','solid','plane'])) if (style.id === '3d-math-explorer') score += 25;
    return {style, score};
  }).sort((a,b)=>b.score-a.score);
  const winner = ranked[0];
  const selectedSegment = winner.style.segmentCollectionId ? selectReferenceSegment(winner.style.segmentCollectionId, input.expression) : undefined;
  const reasons = [
    winner.style.bestFor.includes(input.domain) ? `Domain ${input.domain} matches this style.` : 'Fallback style selected because no domain-specific profile scored higher.',
    winner.style.modes.includes(input.mode) ? `Visual mode ${input.mode} is supported.` : 'Style adapted to the requested visual mode.',
    selectedSegment ? `Reference segment selected: ${selectedSegment.id}.` : 'No concept segment is required for this style.',
  ];
  return { style:winner.style, score:winner.score, reasons, alternatives:ranked.slice(1,4).map(x=>x.style.id), referenceSegment: selectedSegment };
}
