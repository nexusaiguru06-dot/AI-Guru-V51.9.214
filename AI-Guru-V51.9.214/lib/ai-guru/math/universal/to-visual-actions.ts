import type { VisualAction } from '../../lesson/types';
import type { MathVisualNode, UniversalMathScene } from './types';

export function universalSceneToVisualActions(scene:UniversalMathScene):VisualAction[]{
  const out:VisualAction[]=[];
  const eventByTarget = new Map(scene.events.map(e=>[e.targetId ?? '', e]));
  const styleId = scene.visualStyle?.id;
  const durationFor=(id:string)=>eventByTarget.get(id)?.durationMs;
  const base=(id:string)=>({durationMs:durationFor(id),visualStyleId:styleId});
  for(const n of scene.nodes){
    const common=base(n.id);
    if(n.kind==='latex') out.push({type:'latex',id:n.id,latex:n.latex??n.content??'',x:n.x??80,y:n.y??100,width:n.width,height:n.height,fontSize:Number(n.style?.fontSize??38),...common});
    else if(n.kind==='text') out.push({type:'write',id:n.id,content:n.content??'',x:n.x??80,y:n.y??100,width:n.width,height:n.height,fontSize:Number(n.style?.fontSize??30),...common});
    else if(n.kind==='line'||n.kind==='arrow') out.push({type:'line',id:n.id,startX:n.startX??n.x??0,startY:n.startY??n.y??0,endX:n.endX??((n.x??0)+(n.width??100)),endY:n.endY??((n.y??0)+(n.height??0)),style:'solid',stroke:String(n.style?.stroke??''),strokeWidth:Number(n.style?.strokeWidth??5),...common});
    else if(n.kind==='shape'||n.kind==='point') out.push({type:'shape',id:n.id,shape:n.kind==='point'?'circle':(n.shape??'rectangle'),x:n.x??0,y:n.y??0,width:n.width??(n.radius? n.radius*2:100),height:n.height??(n.radius? n.radius*2:100),fill:typeof n.style?.fill==='string'&&n.style.fill!=='none'&&!/^0?\.?\d+$/.test(String(n.style.fill))?String(n.style.fill):undefined,stroke:String(n.style?.stroke??''),strokeWidth:Number(n.style?.strokeWidth??5),...common});
    else if(n.kind==='graph'&&n.graph){
      const labels=n.graph.x.map(v=>String(v));
      out.push({type:'chart',id:n.id,chartType:'line',x:n.x??100,y:n.y??200,width:n.width??800,height:n.height??400,data:{labels,legends:[n.graph.title??'f(x)'],series:[n.graph.y]},...common});
    }
    else if(n.kind==='highlight'&&n.targetId) out.push({type:'highlight',id:n.id,targetId:n.targetId,x:Math.max(0,(n.x??60)-18),y:Math.max(0,(n.y??60)-38),width:Math.max(120,(n.width??420)+36),height:Math.max(70,(n.height??70)+46)});
    const event=eventByTarget.get(n.id);
    if(event){
      const next=scene.events.find(e=>e.atMs>event.atMs);
      const gap=(next?.atMs ?? (event.atMs+event.durationMs))-(event.atMs+event.durationMs);
      if(gap>120) out.push({type:'pause',id:`pause:${n.id}`,durationMs:gap});
    }
  }
  for(const a of scene.visualActions ?? []){
    if(a.type==='token-move') out.push({type:'token-move',id:a.id,token:a.token,fromX:a.fromX,fromY:a.fromY,toX:a.toX,toY:a.toY,durationMs:a.durationMs??700,fadeOut:a.fadeOut!==false,fontSize:a.fontSize??32,visualStyleId:a.visualStyleId??styleId,atMs:a.atMs} as VisualAction);
  }
  const byId=new Map(scene.nodes.map(n=>[n.id,n]));
  for(const step of scene.semanticVisualPlan?.steps ?? []){
    for(const a of step.actions){
      const objectId=a.type==='transform'?a.toObjectId:a.type==='move'?a.objectId:a.type==='highlight'?a.objectId:a.type==='erase'?a.objectId:a.type==='create'?a.objectId:'';
      const nodeId=objectId.startsWith('object:')?objectId.slice(7):'';
      const node=byId.get(nodeId);
      if(!node) continue;
      if(a.type==='highlight') out.push({type:'highlight',id:`${step.id}:highlight:${nodeId}`,targetId:nodeId,x:Math.max(0,(node.x??60)-18),y:Math.max(0,(node.y??60)-38),width:Math.max(120,(node.width??420)+36),height:Math.max(70,(node.height??70)+46)});
      if(a.type==='move') out.push({type:'move',id:`${step.id}:move:${nodeId}`,targetId:nodeId,fromX:node.x??0,fromY:node.y??0,toX:a.toX,toY:a.toY,durationMs:900,visualStyleId:styleId});
      if(a.type==='transform') out.push({type:'transform',id:`${step.id}:transform`,fromId:a.fromObjectId.slice(7),toId:a.toObjectId.slice(7),durationMs:1100,visualStyleId:styleId});
      if(a.type==='erase') out.push({type:'erase',id:`${step.id}:erase:${nodeId}`,targetId:nodeId,durationMs:700,visualStyleId:styleId});
      if(a.type==='pause') out.push({type:'pause',id:`${step.id}:pause`,durationMs:a.durationMs});
    }
  }
  return out;
}
