import { ids, type Lesson } from '../contracts';
import { TeacherAgent, type TeacherRequest } from '../agents/teacher';
import { ParentAgent } from '../agents/parent';
import { AnalyticsAgent, type AIGuruEvent } from '../agents/analytics';
import { SessionMemoryAgent, type SessionRequest } from '../agents/session-memory';
import { ModelRouterAgent, type ModelRouteRequest } from '../agents/model-router';
import { executeAIGuruAgent } from '../runtime/execute-agent';
import { recordAIGuruAudit, readRecentAIGuruAudit } from '../runtime/audit-trail';
const run=(x:string)=>ids.agentRun(`${x}-${Date.now()}`);
export async function teacherAction(lesson:Lesson,input:TeacherRequest){return executeAIGuruAgent(new TeacherAgent(),({agent:'teacher',context:{runId:run('teacher'),lessonId:lesson.id,paragraphId:input.paragraphId},input}));}
export async function parentReport(lesson:Lesson,studentId:string,mastery:any[]=[]){return executeAIGuruAgent(new ParentAgent(),({agent:'parent',context:{runId:run('parent'),lessonId:lesson.id,studentId},input:{lesson,studentId,mastery}}));}
export async function analyticsReport(events:AIGuruEvent[]){return executeAIGuruAgent(new AnalyticsAgent(),({agent:'analytics',context:{runId:run('analytics')},input:{events}}));}
export async function sessionAction(input:SessionRequest){return executeAIGuruAgent(new SessionMemoryAgent(),({agent:'session-memory',context:{runId:run('session'),lessonId:input.lessonId,studentId:input.studentId,sessionId:(input as any).sessionId},input}));}
export async function routeModel(input:ModelRouteRequest){return executeAIGuruAgent(new ModelRouterAgent(),({agent:'model-router',context:{runId:run('router')},input}));}

export { recordAIGuruAudit, readRecentAIGuruAudit };
