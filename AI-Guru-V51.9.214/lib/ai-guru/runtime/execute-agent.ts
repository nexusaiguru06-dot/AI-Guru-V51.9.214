import type { AIGuruAgent, AgentRequest, AgentResult } from '../contracts/agent-contracts';
import { getAgentDefinition } from './agent-registry';
import { recordAIGuruAudit } from './audit-trail';

/** Production wrapper: permission-checks and audits every AI Guru agent invocation. */
export async function executeAIGuruAgent<TIn,TOut>(agent:AIGuruAgent<TIn,TOut>, request:AgentRequest<TIn>, action?:string):Promise<AgentResult<TOut>> {
  const def=getAgentDefinition(agent.name);
  const scope=request.context.problemId?'problem':request.context.paragraphId?'paragraph':request.context.lessonId?'lesson':'session';
  if(!def.scopes.includes(scope as never)) throw new Error(`Agent ${agent.name} cannot run at ${scope} scope`);
  await recordAIGuruAudit({type:'agent_started',agent:agent.name,runId:request.context.runId,lessonId:request.context.lessonId,paragraphId:request.context.paragraphId,problemId:request.context.problemId,data:{action,scope},sessionId:request.context.sessionId});
  try {
    const result=await agent.execute(request);
    await recordAIGuruAudit({type:'agent_completed',agent:agent.name,runId:request.context.runId,lessonId:request.context.lessonId,paragraphId:request.context.paragraphId,problemId:request.context.problemId,status:result.ok?'PASS':'FAIL',data:{action,scope},sessionId:request.context.sessionId});
    return result;
  } catch(error) {
    await recordAIGuruAudit({type:'agent_failed',agent:agent.name,runId:request.context.runId,lessonId:request.context.lessonId,paragraphId:request.context.paragraphId,problemId:request.context.problemId,status:'ERROR',data:{action,message:error instanceof Error?error.message:String(error)},sessionId:request.context.sessionId});
    throw error;
  }
}
