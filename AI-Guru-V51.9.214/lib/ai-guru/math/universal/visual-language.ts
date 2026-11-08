import type { MathDomain, MathVisualNode, MathVisualEvent, UniversalMathScene, VisualMathMode } from './types';

export interface VisualStyleProfile {
  domain: MathDomain;
  mode: VisualMathMode;
  principle: 'animate-the-mathematics';
  referenceVideoUse: 'style-only';
  forbiddenTechniqueTransfer: string[];
  construction: string[];
  transformation: string[];
}

const constructionByDomain: Record<MathDomain,string[]> = {
  arithmetic: ['decompose place values','group quantities','move operands into operation position','assemble the result'],
  number_systems: ['place numbers on a number line','compare integer/rational/irrational positions','construct square-root lengths when relevant','connect numerical and geometric representations'],
  fractions: ['partition a whole into equal parts','highlight numerator parts','compare/equate partitions','compose the result'],
  decimals_percentages: ['place values','base-10 blocks/grid','move decimal point only when mathematically justified','connect percent to whole'],
  ratio_proportion: ['build paired quantities','align corresponding parts','scale both quantities together','show equivalent ratios'],
  algebra: ['tokenize terms and coefficients','group like terms','move terms as transformations','assemble simplified expression'],
  linear_equations: ['represent both sides as objects','highlight the inverse operation','apply the same operation to both sides','balance and isolate'],
  inequalities: ['show both sides of the inequality','apply the same operation while preserving the inequality rule','flip the sign when multiplying/dividing by a negative value','show the solution interval on a number line'],
  polynomials: ['show terms separately','group factors/like powers','animate factor formation','connect factors to roots'],
  sequences_series: ['place terms along an ordered track','show common difference/ratio','extend the pattern','connect terms to formula'],
  coordinate_geometry: ['construct axes','plot points','connect geometric relationships','derive slope/distance/midpoint visually'],
  functions: ['map input to output','show domain/range','move a point through the function','connect table to graph'],
  trigonometry: ['construct/reference triangle or unit circle','highlight angle','highlight relevant sides/coordinates','connect geometry to identity'],
  geometry: ['construct points/lines/shapes','highlight relevant angles/sides','animate auxiliary constructions','transform construction into proof'],
  mensuration: ['construct solid/region','split into measurable parts','label dimensions','assemble area/volume formula'],
  calculus: ['construct curve','place moving point','construct tangent/secant or area','show limiting transformation'],
  statistics: ['place observations','sort/group data','build chart/distribution','highlight mean/median/mode/spread'],
  probability: ['construct sample space','branch outcomes','highlight favourable outcomes','assemble probability ratio'],
  matrices: ['construct matrix cells','highlight row/column operation','animate operation cell-by-cell','assemble resulting matrix'],
  vectors: ['construct origin and axes','draw vector components','show addition/decomposition','connect magnitude/direction'],
  complex_numbers: ['construct Argand plane','plot real/imaginary components','draw complex vector','show modulus/argument'],
  financial_math: ['construct principal/rate/time objects','show growth period by period','highlight interest component','assemble amount'],
  sets: ['construct sets as regions','place elements in the correct set','show union/intersection/complement','connect diagram to set notation'],
  combinatorics: ['construct the counting choices','branch arrangements or selections','highlight valid outcomes','assemble the verified count'],
  '3d_geometry': ['construct 3D object with projections','highlight dimensions/planes','animate section/decomposition','assemble measure'],
  general: ['identify mathematical objects','construct the relevant relationship','highlight the operation','assemble the conclusion'],
};

export function getVisualStyleProfile(domain: MathDomain, mode: VisualMathMode='hybrid'): VisualStyleProfile {
  return {
    domain, mode, principle: 'animate-the-mathematics',
    referenceVideoUse: 'style-only',
    forbiddenTechniqueTransfer: ['Japanese-stick multiplication','intersection-counting as a forced multiplication method','copying any reference-video-specific algorithm'],
    construction: constructionByDomain[domain] ?? constructionByDomain.general,
    transformation: ['preserve object identity when possible','move/highlight rather than abruptly replace','show cause → operation → result','keep previous verified steps available when pedagogically useful'],
  };
}

const latex = (s:string) => s.replace(/\*/g,'\\cdot ');
const nums = (s:string) => (s.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

function textNode(id:string, content:string, x:number, y:number, fontSize=34): MathVisualNode {
  return {id,kind:'text',x,y,content,style:{fontSize}};
}
function latexNode(id:string, content:string, x:number, y:number, fontSize=42): MathVisualNode {
  return {id,kind:'latex',x,y,latex:latex(content),style:{fontSize}};
}
function highlight(id:string,targetId:string): MathVisualNode {
  return {id,kind:'highlight',targetId,x:0,y:0,width:0,height:0};
}
function arrow(id:string,x1:number,y1:number,x2:number,y2:number): MathVisualNode {
  return {id,kind:'arrow',startX:x1,startY:y1,endX:x2,endY:y2,x:x1,y:y1,style:{strokeWidth:5}};
}

function arithmeticConstruction(expression:string): MathVisualNode[] {
  const m=expression.replace(/,/g,'').match(/^\s*(\d+)\s*[×x*]\s*(\d+)\s*$/i);
  if(!m) return [latexNode('expression',expression,70,100,46), textNode('operation-focus','Identify the quantities and operation',120,300)];
  const a=Number(m[1]), b=Number(m[2]);
  const out:MathVisualNode[]=[latexNode('expression',`${a} \\times ${b}`,70,90,50)];
  // Visual style only: represent the quantities with semantic number cards and
  // grouped counters. No Japanese-stick/intersection method is used.
  String(a).split('').forEach((d,i)=>out.push({id:`digit-card-${i}`,kind:'shape',x:130+i*115,y:220,width:90,height:90,shape:'rectangle',style:{strokeWidth:4}}));
  String(a).split('').forEach((d,i)=>out.push(textNode(`digit-label-${i}`,d,162+i*115,280,42)));
  out.push(textNode('multiply-sign','×',485,280,42), {id:'multiplier-card',kind:'shape',x:545,y:220,width:90,height:90,shape:'circle',style:{strokeWidth:4}}, textNode('multiplier-label',String(b),577,280,42));
  const groups=Math.min(Math.max(b,1),6);
  for(let g=0;g<groups;g++){
    out.push({id:`group-card-${g}`,kind:'shape',x:120+g*125,y:390,width:100,height:110,shape:'rectangle',style:{strokeWidth:3}});
    out.push(textNode(`group-label-${g}`,String(a),148+g*125,455,34));
  }
  out.push(textNode('group-note',`${groups} equal groups of ${a}`,250,550,30));
  out.push(latexNode('result',`= ${a*b}`,360,640,56));
  return out;
}

function fractionConstruction(expression:string): MathVisualNode[] {
  const m=expression.match(/(\d+)\s*\/\s*(\d+)/); const n=m?+m[1]:1,d=m?+m[2]:4;
  const out:MathVisualNode[]=[latexNode('expression',`${n}/${d}`,70,100,50)];
  const w=700/d;
  for(let i=0;i<d;i++) out.push({id:`part-${i}`,kind:'shape',x:150+i*w,y:280,width:w-4,height:180,shape:'rectangle',style:{fill:i<n?'0.22':'none',strokeWidth:3}});
  out.push(textNode('meaning',`${n} of ${d} equal parts`,310,560,34));
  return out;
}

function equationTransformation(expression:string): MathVisualNode[] {
  const parts=expression.split('=').map(s=>s.trim());
  const out:MathVisualNode[]=[latexNode('original',expression,70,100,48)];
  if(parts.length===2){
    out.push(textNode('instruction','Apply the same operation to both sides',90,230,30));
    out.push(arrow('transform-arrow',420,270,420,330));
    out.push(latexNode('left-right',`${parts[0]} = ${parts[1]}`,70,420,42));
    out.push(textNode('check','Equivalent form',90,520,30));
  }
  return out;
}

function geometryConstruction(): MathVisualNode[] {
  return [
    {id:'triangle',kind:'shape',x:250,y:260,width:500,height:300,shape:'triangle',style:{strokeWidth:5}},
    textNode('A','A',220,590,30), textNode('B','B',740,590,30), textNode('C','C',490,240,30),
    arrow('construction-arrow',770,300,850,230),
    textNode('construction-note','Construct → highlight → prove',300,650,30),
  ];
}

function geometryAreaDerivationConstruction(expression:string): MathVisualNode[] {
  const lower=expression.toLowerCase();
  const out:MathVisualNode[]=[latexNode('expression',expression,55,70,42)];
  // Parallelogram is drawn from four continuous edges so the renderer does not
  // need a new shape primitive; the diagonal and height make the decomposition
  // visually explicit for area derivation QA.
  if(lower.includes('parallelogram')){
    out.push(
      {id:'para-top',kind:'line',startX:300,startY:230,endX:760,endY:230,x:300,y:230,style:{strokeWidth:6}},
      {id:'para-right',kind:'line',startX:760,startY:230,endX:680,endY:500,x:760,y:230,style:{strokeWidth:6}},
      {id:'para-bottom',kind:'line',startX:680,startY:500,endX:220,endY:500,x:680,y:500,style:{strokeWidth:6}},
      {id:'para-left',kind:'line',startX:220,startY:500,endX:300,endY:230,x:220,y:500,style:{strokeWidth:6}},
      {id:'para-diagonal',kind:'line',startX:220,startY:500,endX:760,endY:230,x:220,y:500,style:{strokeWidth:5,stroke:'#f9a8d4'}},
      {id:'para-height',kind:'line',startX:300,startY:230,endX:300,endY:500,x:300,y:230,style:{strokeWidth:4,stroke:'#facc15'}},
      {id:'para-height-foot',kind:'shape',x:288,y:488,width:24,height:24,shape:'rectangle',style:{strokeWidth:2,stroke:'#facc15'}},
      textNode('vertex-A','A',205,525,26), textNode('vertex-B','B',680,525,26), textNode('vertex-C','C',765,220,26), textNode('vertex-D','D',285,220,26),
      textNode('base-label','b',445,535,30),
      textNode('height-label','h',315,365,28),
      textNode('decompose-note','Split into two equivalent triangles',285,600,28),
      latexNode('area-step-1','A = 2 × (½ × b × h)',250,660,34),
      latexNode('area-result','A = b × h',330,715,40),
    );
  } else {
    out.push(
      {id:'area-triangle',kind:'shape',x:270,y:250,width:500,height:300,shape:'triangle',style:{strokeWidth:5}},
      {id:'area-height',kind:'line',startX:520,startY:250,endX:520,endY:550,x:520,y:250,style:{strokeWidth:4}},
      textNode('height-label','height',535,390,26),
      textNode('base-label','base',480,575,28),
      latexNode('area-result','A = ½ × base × height',250,660,38),
    );
  }
  return out;
}

function trigonometryUnitCircleConstruction(expression:string): MathVisualNode[] {
  const cx=500, cy=410, r=220;
  const theta=Math.PI/4;
  const px=cx+r*Math.cos(theta), py=cy-r*Math.sin(theta);
  return [
    latexNode('expression',expression,55,65,42),
    {id:'unit-circle',kind:'shape',x:cx-r,y:cy-r,width:r*2,height:r*2,shape:'circle',style:{strokeWidth:5}},
    {id:'x-axis',kind:'line',startX:180,startY:cy,endX:820,endY:cy,x:180,y:cy,style:{strokeWidth:3}},
    {id:'y-axis',kind:'line',startX:cx,startY:150,endX:cx,endY:670,x:cx,y:150,style:{strokeWidth:3}},
    {id:'radius',kind:'line',startX:cx,startY:cy,endX:px,endY:py,x:cx,y:cy,style:{strokeWidth:6}},
    {id:'projection',kind:'line',startX:px,startY:py,endX:px,endY:cy,x:px,y:py,style:{strokeWidth:4}},
    {id:'point',kind:'point',x:px-10,y:py-10,width:20,height:20,style:{radius:10}},
    textNode('theta-label','θ',cx+55,cy-55,32),
    textNode('sin-label','sin θ',px+18,(py+cy)/2,28),
    textNode('cos-label','cos θ',cx+95,cy+18,28),
    latexNode('identity-link','(cos θ, sin θ)',555,650,34),
  ];
}

function riemannSumConstruction(expression:string): MathVisualNode[] {
  const xs=Array.from({length:61},(_,i)=>-3+i*0.1);
  const ys=xs.map(x=>Math.max(0,2.2-x*x/2));
  const out:MathVisualNode[]=[
    latexNode('expression',expression,45,55,40),
    {id:'x-axis',kind:'line',startX:120,startY:560,endX:900,endY:560,x:120,y:560,style:{strokeWidth:3}},
    {id:'y-axis',kind:'line',startX:170,startY:160,endX:170,endY:610,x:170,y:160,style:{strokeWidth:3}},
    {id:'curve',kind:'graph',x:120,y:170,width:780,height:390,graph:{x:xs,y:ys,title:'f(x)'},style:{strokeWidth:4}},
  ];
  const addRects=(n:number,prefix:string)=>{
    const left=-2.4,right=2.4,dx=(right-left)/n;
    for(let i=0;i<n;i++){
      const x=left+(i+0.5)*dx, h=Math.max(0,2.2-x*x/2);
      const px=170+(x+3)/6*730, w=730*dx/6;
      const py=560-h/2.2*340;
      out.push({id:`${prefix}-${i}`,kind:'shape',x:px,y:py,width:w-3,height:560-py,shape:'rectangle',style:{strokeWidth:2,stroke:'#60a5fa',fill:'rgba(96,165,250,.14)'}});
    }
  };
  addRects(4,'riemann-rect-4');
  out.push(textNode('coarse-note','A few rectangles approximate the area',265,620,28));
  addRects(8,'riemann-rect-8');
  out.push(textNode('dx-note','Δx becomes smaller',400,650,30),latexNode('sum-step','Σ f(xᵢ)Δx',360,700,38),latexNode('integral-result','∫ f(x) dx',390,750,42));
  return out;
}

function graphConstruction(domain:MathDomain): MathVisualNode[] {
  const xs=Array.from({length:41},(_,i)=>-5+i*.25);
  let ys:number[];
  if(domain==='trigonometry') ys=xs.map(x=>Math.sin(x));
  else if(domain==='calculus') ys=xs.map(x=>x*x/4);
  else ys=xs.map(x=>x);
  return [
    {id:'x-axis',kind:'line',x:120,y:450,startX:120,startY:450,endX:880,endY:450,style:{strokeWidth:3}},
    {id:'y-axis',kind:'line',x:500,y:170,startX:500,startY:170,endX:500,endY:650,style:{strokeWidth:3}},
    {id:'function-graph',kind:'graph',x:120,y:190,width:760,height:440,graph:{x:xs,y:ys,title:domain==='calculus'?'f(x) and change':'f(x)'}},
    textNode('graph-note',domain==='calculus'?'Curve → point → tangent → limit':'Input → relationship → graph',180,690,28),
  ];
}

function statisticsConstruction(expression:string): MathVisualNode[] {
  const values=nums(expression).slice(0,12); const v=values.length?values:[2,4,4,5,7,8,9];
  const min=Math.min(...v), max=Math.max(...v), range=Math.max(1,max-min);
  return v.map((n,i)=>({id:`bar-${i}`,kind:'shape',x:110+i*62,y:570-(n-min)/range*300,width:42,height:Math.max(15,(n-min)/range*300),shape:'rectangle',style:{strokeWidth:2}} as MathVisualNode))
    .concat([textNode('stat-note','Observe → organize → measure → interpret',180,650,28)]);
}

function probabilityConstruction(): MathVisualNode[] {
  return [
    {id:'root',kind:'point',x:150,y:350,width:18,height:18,style:{radius:9}},
    arrow('branch-a',160,350,390,240), arrow('branch-b',160,350,390,460),
    arrow('branch-a1',400,240,650,180), arrow('branch-a2',400,240,650,300),
    arrow('branch-b1',400,460,650,420), arrow('branch-b2',400,460,650,520),
    textNode('prob-note','Sample space → favourable outcomes → probability',230,650,28),
  ];
}

function sequenceConstruction(expression:string): MathVisualNode[] {
  const v=nums(expression).slice(0,7); const a=v.length>=2?v:[2,5,8,11,14];
  return a.map((n,i)=>({id:`term-${i}`,kind:'shape',x:100+i*125,y:350,width:72,height:72,shape:'circle',style:{strokeWidth:3}} as MathVisualNode))
    .concat(a.map((n,i)=>textNode(`term-label-${i}`,String(n),120+i*125,397,24)))
    .concat([textNode('sequence-note','Terms → pattern → rule → next term',220,520,30)]);
}

function matrixConstruction(): MathVisualNode[] {
  const out:MathVisualNode[]=[];
  for(let r=0;r<3;r++) for(let c=0;c<3;c++) out.push({id:`cell-${r}-${c}`,kind:'shape',x:260+c*150,y:250+r*100,width:120,height:75,shape:'rectangle',style:{strokeWidth:3}});
  out.push(textNode('matrix-note','Highlight row/column → operate → assemble',245,620,28));
  return out;
}

function vectorConstruction(): MathVisualNode[] {
  return [
    arrow('vector',180,560,720,260), {id:'origin',kind:'point',x:170,y:550,width:18,height:18,style:{radius:9}},
    arrow('x-component',180,560,720,560), arrow('y-component',720,560,720,260),
    textNode('vector-note','Decompose → operate → recombine',280,650,30),
  ];
}

function complexConstruction(): MathVisualNode[] {
  return [
    {id:'real-axis',kind:'line',x:130,y:450,startX:130,startY:450,endX:870,endY:450,style:{strokeWidth:3}},
    {id:'imag-axis',kind:'line',x:500,y:160,startX:500,startY:160,endX:500,endY:660,style:{strokeWidth:3}},
    {id:'complex-point',kind:'point',x:680,y:330,width:20,height:20,style:{radius:10}},
    arrow('complex-vector',500,450,690,330),
    textNode('complex-note','Real part + imaginary part → modulus/argument',220,680,28),
  ];
}



function numberSystemConstruction(expression:string): MathVisualNode[] {
  const out:MathVisualNode[]=[latexNode('expression',expression,60,90,44),
    {id:'number-line',kind:'line',startX:120,startY:340,endX:880,endY:340,x:120,y:340,style:{strokeWidth:4}},
    arrow('number-line-left',200,340,145,340), arrow('number-line-right',800,340,855,340),
    textNode('number-note','Number → position → relationship',270,520,30)];
  return out;
}
function inequalityConstruction(expression:string): MathVisualNode[] {
  return [latexNode('expression',expression,60,100,48),
    textNode('ineq-rule','Transform both sides; preserve the inequality rule',100,240,28),
    {id:'ineq-line',kind:'line',startX:120,startY:420,endX:880,endY:420,x:120,y:420,style:{strokeWidth:4}},
    {id:'ineq-open',kind:'point',x:540,y:420,width:18,height:18,style:{radius:10}},
    textNode('ineq-note','Solution set → interval on the number line',220,560,28)];
}
function setConstruction(expression:string): MathVisualNode[] {
  return [latexNode('expression',expression,55,80,42),
    {id:'set-a',kind:'shape',x:250,y:230,width:300,height:240,shape:'circle',style:{strokeWidth:5}},
    {id:'set-b',kind:'shape',x:450,y:230,width:300,height:240,shape:'circle',style:{strokeWidth:5}},
    textNode('set-a-label','A',370,350,32), textNode('set-b-label','B',620,350,32),
    textNode('set-note','Elements → sets → union / intersection / complement',150,560,28)];
}
function combinatoricsConstruction(expression:string): MathVisualNode[] {
  return [latexNode('expression',expression,55,80,42),
    {id:'count-root',kind:'point',x:150,y:340,width:18,height:18,style:{radius:9}},
    arrow('count-1',160,340,390,250), arrow('count-2',160,340,390,430),
    arrow('count-3',400,250,650,190), arrow('count-4',400,250,650,310),
    arrow('count-5',400,430,650,370), arrow('count-6',400,430,650,490),
    textNode('count-note','Choices → arrangements/selections → verified count',190,610,28)];
}

function semanticDomainConstruction(domain:MathDomain, expression:string): MathVisualNode[] {
  const labels: Record<string,string> = {
    number_systems:'Number → position → classification → relationship',
    decimals_percentages:'Whole → parts → decimal/percent relationship',
    ratio_proportion:'Quantity A ↔ Quantity B → scale together',
    algebra:'Terms → coefficients → like terms → simplify',
    linear_equations:'Left side ↔ right side → same operation → isolate',
    inequalities:'Both sides → valid transformation → solution interval → number line',
    polynomials:'Terms → factors → product → roots',
    sets:'Elements → sets → union/intersection/complement → notation',
    combinatorics:'Choices → branches → arrangements/selections → count',
    '3d_geometry':'Solid → dimensions → sections → measure',
    mensuration:'Region/solid → dimensions → formula → measure',
    financial_math:'Principal → rate → time → amount',
    general:'Objects → relationship → operation → conclusion',
  };
  const note=labels[domain] ?? constructionByDomain[domain]?.join(' → ') ?? constructionByDomain.general.join(' → ');
  const out:MathVisualNode[]=[latexNode('expression',expression,70,100,46),textNode('semantic-note',note,90,250,30)];
  const words=note.split(' → ');
  words.forEach((w,i)=>{
    out.push({id:`semantic-${i}`,kind:'shape',x:110+i*210,y:370,width:170,height:90,shape:'rectangle',style:{strokeWidth:3}});
    out.push(textNode(`semantic-label-${i}`,w,125+i*210,425,22));
    if(i<words.length-1) out.push(arrow(`semantic-arrow-${i}`,280+i*210,415,310+i*210,415));
  });
  return out;
}

export function buildVisualLanguageNodes(domain:MathDomain, expression:string, mode:VisualMathMode='hybrid'): MathVisualNode[] {
  const construction = (() => {
    const lower=expression.toLowerCase();
    switch(domain){
      case 'arithmetic': return arithmeticConstruction(expression);
      case 'number_systems': return numberSystemConstruction(expression);
      case 'sets': return setConstruction(expression);
      case 'combinatorics': return combinatoricsConstruction(expression);
      case 'fractions': return fractionConstruction(expression);
      case 'geometry': case 'mensuration':
        return /area|derive|formula|base|height|parallelogram|triangle area/i.test(lower)
          ? geometryAreaDerivationConstruction(expression) : geometryConstruction();
      case '3d_geometry': return geometryConstruction();
      case 'coordinate_geometry': case 'functions': return graphConstruction(domain);
      case 'trigonometry': return trigonometryUnitCircleConstruction(expression);
      case 'calculus':
        return /definite integral|riemann|area under|partition|rectangle|delta x|Δx|sum to integral/i.test(lower)
          ? riemannSumConstruction(expression) : graphConstruction(domain);
      case 'statistics': return statisticsConstruction(expression);
      case 'probability': return probabilityConstruction();
      case 'sequences_series': return sequenceConstruction(expression);
      case 'inequalities': return inequalityConstruction(expression);
      case 'matrices': return matrixConstruction();
      case 'vectors': return vectorConstruction();
      case 'complex_numbers': return complexConstruction();
      default: return [latexNode('expression',expression,70,100,46), textNode('concept-note',constructionByDomain[domain]?.join(' → ') ?? constructionByDomain.general.join(' → '),100,300,28)];
    }
  })();
  const transform = (mode==='construction') ? [] : equationTransformation(expression);
  if(mode==='transformation') return transform.length ? transform : construction;
  return [...construction, ...transform.map(n=>({...n,id:`transform-${n.id}`}))];
}

export interface VisualPacing { stepMs:number; pauseMs:number; transitionMs:number; speedFactor:number; }

export function buildVisualLanguageEvents(nodes:MathVisualNode[], durationMs:number, mode:VisualMathMode='hybrid', pacing:VisualPacing={stepMs:1250,pauseMs:800,transitionMs:700,speedFactor:0.82}): MathVisualEvent[] {
  const slowedStep=Math.round(pacing.stepMs / Math.max(0.55, pacing.speedFactor));
  const slowedPause=Math.round(pacing.pauseMs / Math.max(0.55, pacing.speedFactor));
  const minDuration = Math.max(3500, nodes.length * Math.max(700, slowedStep) + Math.max(0, nodes.length-1) * Math.round(slowedPause * 0.35));
  const dur=Math.max(minDuration,durationMs);
  const per=Math.max(700, Math.floor(dur/Math.max(1,nodes.length)));
  return nodes.map((n,i)=>({
    id:`vme:${n.id}`, atMs:Math.min(i*per,dur-per), durationMs:Math.min(Math.max(700, pacing.transitionMs),per),
    kind:n.kind==='highlight'?'highlight':n.kind==='transform'?'transform':'draw', targetId:n.id,
  }));
}
