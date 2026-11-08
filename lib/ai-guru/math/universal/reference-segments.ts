import type { VisualStyleId } from './style-library';

export type ReferenceSegmentId =
  | 'area-formula-intro'
  | 'area-formula-rectangle'
  | 'area-formula-square'
  | 'area-formula-triangle'
  | 'area-formula-parallelogram'
  | 'area-formula-rhombus'
  | 'area-formula-trapezium';

export interface ReferenceTeachingBeat {
  id: string;
  label: string;
  startMs: number;
  endMs: number;
  purpose: string;
}

export interface ReferenceSegment {
  id: ReferenceSegmentId;
  parentReferenceId: string;
  styleId: VisualStyleId;
  asset: string;
  sourceStartMs: number;
  sourceEndMs: number;
  topic: 'area';
  shape?: 'rectangle'|'square'|'triangle'|'parallelogram'|'rhombus'|'trapezium';
  domain: 'geometry'|'mensuration';
  concepts: string[];
  teachingMethod: string[];
  teachingBeats: ReferenceTeachingBeat[];
  qaProfileId: string;
  selectionTerms: string[];
}

// Source: the 112s uploaded multi-shape area-formula reference.
// Boundaries are intentionally kept in metadata so the source can be re-cut
// later without changing selection contracts. Each clip contains one shape's
// explanatory sequence, not the whole reference.
export const AREA_FORMULA_REFERENCE_SEGMENTS: readonly ReferenceSegment[] = [
  { id:'area-formula-intro', parentReferenceId:'area-formula-visual-derivation-reference', styleId:'area-formula-visual-derivation-reference', asset:'/reference-styles/area-formula/segments/intro.mp4', sourceStartMs:0, sourceEndMs:6000, topic:'area', domain:'mensuration', concepts:['unit-square','area-formulas'], teachingMethod:['visual-derivation','progressive-construction'], teachingBeats:[{id:'intro',label:'introduce area formulas',startMs:0,endMs:6000,purpose:'Set the common visual derivation grammar.'}], qaProfileId:'geometry-area-derivation-v2', selectionTerms:['area formulas','area','unit squares'] },
  { id:'area-formula-rectangle', parentReferenceId:'area-formula-visual-derivation-reference', styleId:'area-formula-visual-derivation-reference', asset:'/reference-styles/area-formula/segments/rectangle.mp4', sourceStartMs:6000, sourceEndMs:26000, topic:'area', shape:'rectangle', domain:'mensuration', concepts:['length','width','unit-squares','rectangle-area'], teachingMethod:['counting-units','dimension-highlighting','formula-derivation'], teachingBeats:[{id:'rect-count',label:'count unit squares',startMs:0,endMs:9000,purpose:'Establish area as repeated unit squares.'},{id:'rect-dimensions',label:'identify length and width',startMs:9000,endMs:15000,purpose:'Connect rows and columns to dimensions.'},{id:'rect-formula',label:'derive rectangle formula',startMs:15000,endMs:20000,purpose:'Reveal length × width after visual reasoning.'}], qaProfileId:'geometry-area-derivation-v2', selectionTerms:['rectangle','rectangular','length width','length × width','length x width','area of rectangle'] },
  { id:'area-formula-square', parentReferenceId:'area-formula-visual-derivation-reference', styleId:'area-formula-visual-derivation-reference', asset:'/reference-styles/area-formula/segments/square.mp4', sourceStartMs:26000, sourceEndMs:35000, topic:'area', shape:'square', domain:'mensuration', concepts:['side','equal-sides','square-area'], teachingMethod:['dimension-substitution','formula-derivation'], teachingBeats:[{id:'square-side',label:'identify equal sides',startMs:0,endMs:5000,purpose:'Show that both dimensions are the same side.'},{id:'square-formula',label:'derive square formula',startMs:5000,endMs:9000,purpose:'Replace length and width with a.'}], qaProfileId:'geometry-area-derivation-v2', selectionTerms:['square','side squared','a²','area of square'] },
  { id:'area-formula-triangle', parentReferenceId:'area-formula-visual-derivation-reference', styleId:'area-formula-visual-derivation-reference', asset:'/reference-styles/area-formula/segments/triangle.mp4', sourceStartMs:35000, sourceEndMs:56000, topic:'area', shape:'triangle', domain:'geometry', concepts:['base','height','half-rectangle','triangle-area'], teachingMethod:['decomposition','equivalence','height-substitution','formula-derivation'], teachingBeats:[{id:'triangle-build',label:'construct triangle in rectangle',startMs:0,endMs:7000,purpose:'Show the triangle as half of a rectangle.'},{id:'triangle-highlight',label:'identify base and height',startMs:7000,endMs:14000,purpose:'Distinguish perpendicular height from slanted side.'},{id:'triangle-derive',label:'derive half base times height',startMs:14000,endMs:21000,purpose:'Connect half the rectangle area to the triangle formula.'}], qaProfileId:'geometry-area-derivation-v2', selectionTerms:['triangle','triangular','base height','half base','area of triangle','½ base height','1/2 base height'] },
  { id:'area-formula-parallelogram', parentReferenceId:'area-formula-visual-derivation-reference', styleId:'area-formula-visual-derivation-reference', asset:'/reference-styles/area-formula/segments/parallelogram.mp4', sourceStartMs:56000, sourceEndMs:77000, topic:'area', shape:'parallelogram', domain:'geometry', concepts:['base','perpendicular-height','rectangle-equivalence','parallelogram-area'], teachingMethod:['cut-and-move','equivalence','dimension-highlighting','formula-derivation'], teachingBeats:[{id:'para-build',label:'show parallelogram',startMs:0,endMs:6000,purpose:'Establish the target shape and base/height.'},{id:'para-cut',label:'cut and move side',startMs:6000,endMs:14000,purpose:'Transform the shape into an equivalent rectangle.'},{id:'para-formula',label:'derive base times height',startMs:14000,endMs:21000,purpose:'Use the preserved base and perpendicular height to derive area.'}], qaProfileId:'geometry-area-derivation-v2', selectionTerms:['parallelogram','parallelogram area','base height','base × height','base x height','area of parallelogram'] },
  { id:'area-formula-rhombus', parentReferenceId:'area-formula-visual-derivation-reference', styleId:'area-formula-visual-derivation-reference', asset:'/reference-styles/area-formula/segments/rhombus.mp4', sourceStartMs:77000, sourceEndMs:91000, topic:'area', shape:'rhombus', domain:'geometry', concepts:['diagonals','triangles','half-product','rhombus-area'], teachingMethod:['diagonal-construction','decomposition','triangle-sum','formula-derivation'], teachingBeats:[{id:'rhombus-diagonals',label:'draw both diagonals',startMs:0,endMs:7000,purpose:'Partition the rhombus into four triangles.'},{id:'rhombus-sum',label:'combine triangle areas',startMs:7000,endMs:12000,purpose:'Relate the four triangles to the diagonal product.'},{id:'rhombus-formula',label:'derive half product',startMs:12000,endMs:14000,purpose:'Reveal the verified rhombus area formula.'}], qaProfileId:'geometry-area-derivation-v2', selectionTerms:['rhombus','diamond','diagonals','area of rhombus','half product of diagonals'] },
  { id:'area-formula-trapezium', parentReferenceId:'area-formula-visual-derivation-reference', styleId:'area-formula-visual-derivation-reference', asset:'/reference-styles/area-formula/segments/trapezium.mp4', sourceStartMs:91000, sourceEndMs:112000, topic:'area', shape:'trapezium', domain:'geometry', concepts:['parallel-sides','height','two-trapezia','half-sum','trapezium-area'], teachingMethod:['duplication','rearrangement','parallel-side-sum','formula-derivation'], teachingBeats:[{id:'trap-build',label:'show trapezium and parallel sides',startMs:0,endMs:6000,purpose:'Identify the two parallel sides and height.'},{id:'trap-duplicate',label:'join identical trapezia',startMs:6000,endMs:14000,purpose:'Create a parallelogram-like equivalent using two copies.'},{id:'trap-formula',label:'derive half sum times height',startMs:14000,endMs:21000,purpose:'Divide the doubled area by two.'}], qaProfileId:'geometry-area-derivation-v2', selectionTerms:['trapezium','trapezoid','parallel sides','area of trapezium','area of trapezoid','half sum','sum of parallel sides'] },
];

export function getReferenceSegments(referenceId?: string): readonly ReferenceSegment[] {
  if (referenceId === 'area-formula-visual-derivation-reference') return AREA_FORMULA_REFERENCE_SEGMENTS;
  return [];
}

function normalized(s: string): string { return s.toLowerCase().replace(/[×·]/g,'x').replace(/[^a-z0-9²]+/g,' ').trim(); }

export function selectReferenceSegment(referenceId: string, expression: string): ReferenceSegment | undefined {
  const segments = getReferenceSegments(referenceId);
  if (!segments.length) return undefined;
  const text = normalized(expression);
  const ranked = segments
    .filter(s => s.id !== 'area-formula-intro')
    .map(segment => {
      let score = 0;
      for (const term of segment.selectionTerms) if (text.includes(normalized(term))) score += 20;
      for (const concept of segment.concepts) if (text.includes(normalized(concept))) score += 4;
      if (segment.domain === 'geometry' && /area|shape|base|height|diagonal|parallel/.test(text)) score += 3;
      return { segment, score };
    })
    .sort((a,b)=>b.score-a.score);
  return ranked[0]?.score ? ranked[0].segment : undefined;
}
