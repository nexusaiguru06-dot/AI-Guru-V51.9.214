import type { AIGuruAgent, AgentRequest, AgentResult } from '../../contracts/agent-contracts';
import type { Lesson } from '../../contracts/lesson-json';
export interface ParentRequest { lesson:Lesson; studentId:string; mastery?:Array<{concept:string;mastery:number;status:string}>; }
export interface ParentOutput { studentId:string; summary:string; strengths:string[]; needsAttention:string[]; recommendations:string[]; }
export class ParentAgent implements AIGuruAgent<ParentRequest,ParentOutput>{
 readonly name='parent' as const;
 async execute(request:AgentRequest<ParentRequest>):Promise<AgentResult<ParentOutput>>{const {lesson,studentId,mastery=[]}=request.input; const strengths=mastery.filter(x=>x.mastery>=0.8).map(x=>x.concept); const needs=mastery.filter(x=>x.mastery<0.6).map(x=>x.concept); return {ok:true,agent:this.name,runId:request.context.runId,output:{studentId,summary:`Learning report for ${lesson.title}.`,strengths,needsAttention:needs,recommendations:needs.map(x=>`Review ${x} with a targeted paragraph and practice problem.`)}};}
}
