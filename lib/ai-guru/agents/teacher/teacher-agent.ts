import type { AIGuruAgent, AgentRequest, AgentResult } from '../../contracts/agent-contracts';
import type { Lesson } from '../../contracts/lesson-json';
export interface TeacherRequest { lesson: Lesson; action:'edit-note'|'create-homework'|'create-exam'|'review'; paragraphId?:string; text?:string; }
export interface TeacherOutput { action:string; paragraphId?:string; result:Record<string,unknown>; }
export class TeacherAgent implements AIGuruAgent<TeacherRequest,TeacherOutput> {
 readonly name='teacher' as const;
 async execute(request:AgentRequest<TeacherRequest>):Promise<AgentResult<TeacherOutput>> {
  const {lesson,action,paragraphId,text}=request.input; const p=paragraphId?lesson.paragraphs.find(x=>x.id===paragraphId):undefined;
  if(paragraphId&&!p)return {ok:false,agent:this.name,runId:request.context.runId,error:{code:'PARAGRAPH_NOT_FOUND',message:'Paragraph not found'}};
  const result=action==='edit-note'?{note:text??'',paragraphId}:{lessonId:lesson.id,paragraphCount:lesson.paragraphs.length,paragraphId,action,source:p?.source.text};
  return {ok:true,agent:this.name,runId:request.context.runId,output:{action,paragraphId,result}};
 }
}
