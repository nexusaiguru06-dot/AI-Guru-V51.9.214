import type { AIGuruAgent, AgentRequest, AgentResult } from '../../contracts/agent-contracts';
export type ModelTask='lesson'|'math'|'visual'|'voice'|'material'|'assessment'|'doubt';
export interface ModelRouteRequest{task:ModelTask;preferredModel?:string;availableModels?:string[];}
export interface ModelRouteOutput{task:ModelTask;model:string;reason:string;}
const defaults:Record<ModelTask,string>={lesson:'gemini',math:'deterministic-math-verifier',visual:'universal-math-compiler',voice:'piper',material:'user-selected',assessment:'user-selected',doubt:'user-selected'};
export class ModelRouterAgent implements AIGuruAgent<ModelRouteRequest,ModelRouteOutput>{readonly name='model-router' as const;async execute(request:AgentRequest<ModelRouteRequest>):Promise<AgentResult<ModelRouteOutput>>{const i=request.input;const model=i.preferredModel&&(!i.availableModels||i.availableModels.includes(i.preferredModel))?i.preferredModel:defaults[i.task];return{ok:true,agent:this.name,runId:request.context.runId,output:{task:i.task,model,reason:i.preferredModel===model?'preferred model available':'capability default'}};}}
