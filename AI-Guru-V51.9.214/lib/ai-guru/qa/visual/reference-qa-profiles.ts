import type { VisualCheckId, VisualStyleId } from '../../math/universal/style-library';

export type ReferenceQAProfileId =
  | 'common-visual-v1'
  | 'equation-transformation-v1'
  | 'concept-explanation-v1'
  | 'geometry-proof-construction-v1'
  | 'geometry-area-derivation-v1'
  | 'geometry-area-derivation-v2'
  | 'geometry-construction-v1'
  | 'graph-explorer-v1'
  | 'fraction-visual-v1'
  | 'trigonometry-visual-v1'
  | 'trigonometry-unit-circle-v1'
  | 'calculus-cinematic-v1'
  | 'calculus-slope-explorer-v1'
  | 'calculus-riemann-sum-v1'
  | 'statistics-build-v1'
  | '3d-math-explorer-v1'
  | 'calculus-first-principles-v1'
  | 'calculus-slope-to-derivative-v1'
  | 'quadratic-formula-derivation-v1'
  | 'arithmetic-multiplication-visual-v1'
  | 'mathlet-template-v1'
  | 'linear-equation-step-by-step-v1';

export interface ReferenceQAProfile {
  id: ReferenceQAProfileId;
  styleId: VisualStyleId;
  description: string;
  requiredChecks: VisualCheckId[];
  orderedBeats?: string[];
  requiredActionEvidence?: Record<string, string[]>;
  minPauseMs?: number;
  finalFormulaAfterReasoning?: boolean;
}

const common: ReferenceQAProfile = {
  id:'common-visual-v1', styleId:'ai-guru-standard',
  description:'Common explanation grammar shared by every approved visual reference.',
  requiredChecks:['pause-emphasis','voice-cue-sync','transformation-qa'],
  minPauseMs:500, finalFormulaAfterReasoning:true,
};

export const REFERENCE_QA_PROFILES: readonly ReferenceQAProfile[] = [
  common,
  { id:'equation-transformation-v1', styleId:'easy-equation-transformation', description:'Equation changes must be explicit and term-preserving.', requiredChecks:['latex-token-decomposition','token-equation-transformation','term-movement','operation-animation','pause-emphasis','voice-cue-sync'], orderedBeats:['original equation','active operation','term movement/transformation','intermediate equation','verified result'], finalFormulaAfterReasoning:true },
  { id:'concept-explanation-v1', styleId:'concept-explain', description:'One simple concept per beat with restrained annotation.', requiredChecks:['highlight-circle-underline','arrow-annotation','pause-emphasis','voice-cue-sync'], finalFormulaAfterReasoning:true },
  { id:'geometry-proof-construction-v1', styleId:'geometry-proof-construction', description:'Proofs must preserve construction continuity and theorem logic.', requiredChecks:['geometry-progressive-construction','arrow-annotation','highlight-circle-underline','camera-zoom-pan','pause-emphasis','voice-cue-sync'], orderedBeats:['given figure','auxiliary construction','highlight relationship','equation/theorem step','conclusion'], finalFormulaAfterReasoning:true },
  { id:'geometry-area-derivation-v1', styleId:'geometry-area-derivation', description:'Area derivations must establish base/height or decomposition before formula.', requiredChecks:['geometry-progressive-construction','arrow-annotation','highlight-circle-underline','camera-zoom-pan','pause-emphasis','voice-cue-sync'], orderedBeats:['target shape','key dimensions','decomposition/equivalence','known-area equations','simplification','final formula'], finalFormulaAfterReasoning:true },
  { id:'geometry-area-derivation-v2', styleId:'area-formula-visual-derivation-reference', description:'Canonical visual-derivation profile for area lessons based on the newly added reference video.', requiredChecks:['geometry-progressive-construction','arrow-annotation','highlight-circle-underline','write-erase','pause-emphasis','voice-cue-sync'], orderedBeats:['introduce shape','identify dimensions','construct/decompose','show relationship to known area','derive equation','pause at insight','reveal formula'], minPauseMs:800, finalFormulaAfterReasoning:true },
  { id:'geometry-construction-v1', styleId:'geometry-construction', description:'Geometric objects and auxiliary constructions must appear in construction order.', requiredChecks:['geometry-progressive-construction','arrow-annotation','highlight-circle-underline','pause-emphasis','voice-cue-sync'], finalFormulaAfterReasoning:true },
  { id:'graph-explorer-v1', styleId:'graph-explorer', description:'Graph lessons must build axes, meaningful data and relationship progressively.', requiredChecks:['graph-progressive-drawing','arrow-annotation','highlight-circle-underline','pause-emphasis','voice-cue-sync'], orderedBeats:['axes','plot/curve','meaningful point','relationship','conclusion'] },
  { id:'fraction-visual-v1', styleId:'fraction-visual', description:'Fraction reasoning must preserve whole/parts and numerator/denominator identity.', requiredChecks:['fraction-transformation','highlight-circle-underline','write-erase','pause-emphasis','voice-cue-sync'], finalFormulaAfterReasoning:true },
  { id:'trigonometry-visual-v1', styleId:'trigonometry-visual', description:'Trig relationships must be grounded in visible angle/side geometry.', requiredChecks:['geometry-progressive-construction','highlight-circle-underline','arrow-annotation','pause-emphasis','voice-cue-sync'] },
  { id:'trigonometry-unit-circle-v1', styleId:'trigonometry-unit-circle-reference', description:'Unit-circle relationships must be constructed before symbolic identity.', requiredChecks:['geometry-progressive-construction','graph-progressive-drawing','arrow-annotation','highlight-circle-underline','camera-zoom-pan','pause-emphasis','voice-cue-sync'], orderedBeats:['circle','angle','radius/point','projection','identity'], finalFormulaAfterReasoning:true },
  { id:'calculus-cinematic-v1', styleId:'calculus-cinematic', description:'Calculus visuals must connect motion/limit to symbolic reasoning.', requiredChecks:['graph-progressive-drawing','term-movement','symbol-morphing','pause-emphasis','voice-cue-sync'] },
  { id:'calculus-slope-explorer-v1', styleId:'calculus-slope-explorer-reference', description:'Slope lessons must visibly track a point and tangent/secant relationship.', requiredChecks:['graph-progressive-drawing','arrow-annotation','highlight-circle-underline','camera-zoom-pan','pause-emphasis','voice-cue-sync'], orderedBeats:['function','moving point','tangent/secant','slope value','comparison/insight'] },
  { id:'calculus-riemann-sum-v1', styleId:'calculus-riemann-sum-area-reference', description:'Riemann lessons must progress from curve to partitions to integral.', requiredChecks:['graph-progressive-drawing','arrow-annotation','highlight-circle-underline','pause-emphasis','voice-cue-sync'], orderedBeats:['curve','interval','few rectangles','finer partition','sum','integral'], finalFormulaAfterReasoning:true },
  { id:'statistics-build-v1', styleId:'statistics-build', description:'Data lessons must build the representation before interpretation.', requiredChecks:['graph-progressive-drawing','highlight-circle-underline','arrow-annotation','pause-emphasis','voice-cue-sync'] },
  { id:'calculus-first-principles-v1', styleId:'calculus-first-principles-reference', description:'First-principles derivative lessons must visibly progress from secant slope to tangent and then to the limit definition.', requiredChecks:['graph-progressive-drawing','arrow-annotation','highlight-circle-underline','term-movement','symbol-morphing','write-erase','pause-emphasis','voice-cue-sync'], orderedBeats:['function','two points','secant slope','delta-x/h change','secant approaches tangent','limit insight','verified derivative'], minPauseMs:800, finalFormulaAfterReasoning:true },
  { id:'calculus-slope-to-derivative-v1', styleId:'calculus-slope-to-derivative-reference', description:'Slope-to-derivative lessons must establish Δy/Δx geometrically before the derivative notation.', requiredChecks:['graph-progressive-drawing','arrow-annotation','highlight-circle-underline','pause-emphasis','voice-cue-sync'], orderedBeats:['axes/function','two points','rise/run','secant slope','point approaches target','tangent slope','derivative relationship'], minPauseMs:750, finalFormulaAfterReasoning:true },
  { id:'quadratic-formula-derivation-v1', styleId:'quadratic-formula-derivation-reference', description:'Quadratic-formula lessons must preserve coefficient identity, show transformations in order, and verify the result with an example.', requiredChecks:['latex-token-decomposition','token-equation-transformation','term-movement','symbol-morphing','operation-animation','arrow-annotation','highlight-circle-underline','write-erase','pause-emphasis','voice-cue-sync','transformation-qa'], orderedBeats:['standard quadratic','coefficient roles','isolate quadratic term','complete-square/square-root reasoning','plus-or-minus','discriminant','formula','worked example','sign check'], minPauseMs:750, finalFormulaAfterReasoning:true },
  { id:'linear-equation-step-by-step-v1', styleId:'linear-equation-two-step-reference', description:'Two-step linear-equation references must show equivalent operations, term isolation and final verification in order.', requiredChecks:['latex-token-decomposition','token-equation-transformation','term-movement','operation-animation','highlight-circle-underline','pause-emphasis','voice-cue-sync','transformation-qa'], orderedBeats:['original equation','active operation','same operation on both sides','intermediate equation','isolate variable','verify result'], minPauseMs:750, finalFormulaAfterReasoning:true },
  { id:'mathlet-template-v1', styleId:'ai-guru-standard', description:'QA profile for external interactive visual templates used as visual teaching grammar. The generated AI Guru scene must be original and independently verified.', requiredChecks:['highlight-circle-underline','arrow-annotation','pause-emphasis','voice-cue-sync','transformation-qa'], minPauseMs:500, finalFormulaAfterReasoning:true },
  { id:'arithmetic-multiplication-visual-v1', styleId:'arithmetic-multiplication-visual-reference', description:'Simple multiplication references must preserve digit identity, place value and the visual grouping/counting logic.', requiredChecks:['latex-token-decomposition','term-movement','operation-animation','arrow-annotation','highlight-circle-underline','pause-emphasis','voice-cue-sync'], orderedBeats:['original multiplication','active digit/group','visual grouping/counting','intermediate quantity','verified result'], minPauseMs:650, finalFormulaAfterReasoning:true },  { id:'3d-math-explorer-v1', styleId:'3d-math-explorer', description:'Spatial lessons must use camera motion only when it clarifies geometry.', requiredChecks:['geometry-progressive-construction','camera-zoom-pan','highlight-circle-underline','pause-emphasis','voice-cue-sync'] },
];

export function getReferenceQAProfile(id: ReferenceQAProfileId | string): ReferenceQAProfile {
  return REFERENCE_QA_PROFILES.find(p=>p.id===id) ?? common;
}
