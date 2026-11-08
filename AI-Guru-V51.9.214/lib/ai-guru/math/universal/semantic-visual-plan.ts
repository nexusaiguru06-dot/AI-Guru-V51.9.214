import type { MathDomain, MathVisualNode, SemanticMathObject, SemanticMathRelation, SemanticVisualPlan, VisualConstructionStep } from './types';

const obj=(id:string,kind:SemanticMathObject['kind'],value?:string,visualNodeId?:string,role:SemanticMathObject['role']='context'):SemanticMathObject=>({id,kind,value,visualNodeId,role});
const rel=(id:string,from:string,to:string,relation:SemanticMathRelation['relation']):SemanticMathRelation=>({id,from,to,relation});

export function buildSemanticVisualPlan(domain:MathDomain, expression:string, nodes:MathVisualNode[]):SemanticVisualPlan{
  const nodeIds=new Set(nodes.map(n=>n.id));
  const visual=(id:string)=>nodeIds.has(id)?id:undefined;
  const objects:SemanticMathObject[]=[];
  const relations:SemanticMathRelation[]=[];
  const steps:VisualConstructionStep[]=[];

  // Generic objectization: every rendered mathematical node becomes a semantic object.
  nodes.forEach(n=>objects.push(obj(`object:${n.id}`, n.kind==='latex'?'term':n.kind==='point'?'point':n.kind==='shape'?'shape':n.kind==='line'?'line':n.kind==='graph'?'graph':'label', n.latex??n.content, n.id, n.id==='result'||n.id.includes('answer')?'result':'context')));

  const addStep=(id:string,narrationKey:string,actions:VisualConstructionStep['actions'])=>steps.push({id,narrationKey,actions});
  const objectId=(nodeId:string)=>`object:${nodeId}`;

  if(domain==='linear_equations' || domain==='algebra' || domain==='polynomials'){
    const main=nodes.filter(n=>n.kind==='latex').map(n=>n.id);
    if(main.length){
      addStep('construct-given','construct-given',[{type:'create',objectId:objectId(main[0])},{type:'highlight',objectId:objectId(main[0])}]);
      for(let i=1;i<main.length;i++) addStep(`transform-${i}`, 'transform-step',[{type:'highlight',objectId:objectId(main[i-1])},{type:'move',objectId:objectId(main[i-1]),toX:(nodes.find(n=>n.id===main[i])?.x??80),toY:(nodes.find(n=>n.id===main[i])?.y??100)},{type:'transform',fromObjectId:objectId(main[i-1]),toObjectId:objectId(main[i])}]);
      relations.push(...main.slice(1).map((id,i)=>rel(`derived-${i}`,objectId(main[i]),objectId(id),'derived-from')));
    }
  } else if(domain==='geometry' || domain==='3d_geometry'){
    const lower=expression.toLowerCase();
    const shapes=nodes.filter(n=>n.kind==='shape'||n.kind==='line'||n.kind==='point');
    shapes.forEach((n,i)=>addStep(`construct-${i}`,'construct-object',[{type:'create',objectId:objectId(n.id)},{type:'highlight',objectId:objectId(n.id)},{type:'move',objectId:objectId(n.id),toX:n.x??0,toY:n.y??0}]));
    if(/area|derive|formula|base|height|parallelogram|triangle area/i.test(lower)){
      const diagonal=nodes.find(n=>n.id.includes('diagonal'));
      const height=nodes.find(n=>n.id.includes('height'));
      const result=nodes.find(n=>n.id.includes('area-result'));
      if(diagonal) addStep('decompose-region','decompose-region',[{type:'create',objectId:objectId(diagonal.id)},{type:'highlight',objectId:objectId(diagonal.id)}]);
      if(height) addStep('identify-base-height','identify-base-height',[{type:'create',objectId:objectId(height.id)},{type:'highlight',objectId:objectId(height.id)}]);
      if(result) addStep('derive-area-formula','derive-area-formula',[{type:'create',objectId:objectId(result.id)},{type:'highlight',objectId:objectId(result.id)}]);
    }
    for(let i=1;i<shapes.length;i++) relations.push(rel(`rel-${i}`,objectId(shapes[0].id),objectId(shapes[i].id),'contains'));
  } else if(domain==='trigonometry'){
    const trigNodes=nodes.filter(n=>n.kind==='shape'||n.kind==='line'||n.kind==='point');
    trigNodes.forEach((n,i)=>addStep(`construct-${i}`,'construct-object',[{type:'create',objectId:objectId(n.id)},{type:'highlight',objectId:objectId(n.id)}]));
    const identity=nodes.find(n=>n.id==='identity-link');
    if(identity) addStep('connect-identity','connect-identity',[{type:'create',objectId:objectId(identity.id)},{type:'highlight',objectId:objectId(identity.id)}]);
  } else if(domain==='calculus' || domain==='functions' || domain==='coordinate_geometry'){
    const lower=expression.toLowerCase();
    const graph=nodes.find(n=>n.kind==='graph');
    if(domain==='calculus' && /definite integral|riemann|area under|partition|rectangle|delta x|Δx|sum to integral/i.test(lower)){
      if(graph) addStep('construct-curve','construct-curve',[{type:'create',objectId:objectId(graph.id)}]);
      nodes.filter(n=>n.id.startsWith('riemann-rect-')).forEach((n,i)=>addStep(`add-rectangle-${i}`,'add-rectangle',[{type:'create',objectId:objectId(n.id)},{type:'highlight',objectId:objectId(n.id)}]));
      const sum=nodes.find(n=>n.id==='sum-step'); const integral=nodes.find(n=>n.id==='integral-result');
      if(sum) addStep('form-sum','form-sum',[{type:'create',objectId:objectId(sum.id)},{type:'highlight',objectId:objectId(sum.id)}]);
      if(integral) addStep('limit-to-integral','limit-to-integral',[{type:'create',objectId:objectId(integral.id)},{type:'highlight',objectId:objectId(integral.id)}]);
    } else {
      if(graph){ addStep('construct-graph','construct-graph',[{type:'create',objectId:objectId(graph.id)}]); addStep('focus-point','focus-point',[{type:'highlight',objectId:objectId(graph.id)}]); }
      nodes.filter(n=>n.kind==='point'||n.kind==='line').forEach((n,i)=>addStep(`construct-feature-${i}`,'construct-feature',[{type:'create',objectId:objectId(n.id)},{type:'highlight',objectId:objectId(n.id)}]));
    }
  } else if(domain==='statistics' || domain==='probability' || domain==='sequences_series' || domain==='matrices' || domain==='vectors'){
    nodes.filter(n=>['shape','point','line','arrow','graph','text','latex'].includes(n.kind)).forEach((n,i)=>addStep(`build-${i}`,'build-object',[{type:'create',objectId:objectId(n.id)},{type:'highlight',objectId:objectId(n.id)},{type:'move',objectId:objectId(n.id),toX:(n.x??0)+Math.min(i*8,40),toY:n.y??0}]));
  } else {
    nodes.forEach((n,i)=>addStep(`build-${i}`,'build-object',[{type:'create',objectId:objectId(n.id)}]));
  }

  // Add semantic relationships from explicit target references.
  nodes.forEach(n=>{ if(n.targetId && nodeIds.has(n.targetId)) relations.push(rel(`targets-${n.id}`,objectId(n.id),objectId(n.targetId),'highlights')); });
  return {objects,relations,steps};
}
