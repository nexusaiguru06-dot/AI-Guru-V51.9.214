import { ids, type Lesson } from '../contracts';
import { AssessmentAgent, type AssessmentResponse } from '../agents/assessment';
import { StudentIntelligenceAgent, type StudentAttempt } from '../agents/student-intelligence';
import { RemediationAgent } from '../agents/remediation';
import { DoubtAgent } from '../agents/doubt';
import { executeAIGuruAgent } from '../runtime/execute-agent';
import { recordAIGuruAudit } from '../runtime/audit-trail';

export async function buildAssessment(lesson: Lesson, paragraphId?: string) {
  const agent = new AssessmentAgent();
  const r = await executeAIGuruAgent(agent,{ agent: 'assessment', context: { runId: ids.agentRun(`assessment-${lesson.id}-${Date.now()}`), lessonId: lesson.id, paragraphId }, input: { lesson, paragraphId }});
  if (!r.ok || !r.output) throw new Error(r.error?.message ?? 'Assessment failed');
  return r.output;
}

export async function evaluateAssessment(lesson: Lesson, response: AssessmentResponse) {
  const agent = new AssessmentAgent();
  const runId = ids.agentRun(`assessment-eval-${lesson.id}-${Date.now()}`);
  await recordAIGuruAudit({ type: 'agent_started', agent: 'assessment', runId, lessonId: lesson.id, data: { action: 'evaluate' } });
  const r = agent.evaluate({ agent: 'assessment', context: { runId, lessonId: lesson.id }, input: { lesson, response } });
  await recordAIGuruAudit({ type: 'agent_completed', agent: 'assessment', runId, lessonId: lesson.id, status: r.ok ? 'PASS' : 'FAIL', data: { action: 'evaluate' } });
  if (!r.ok || !r.output) throw new Error(r.error?.message ?? 'Assessment evaluation failed');
  return r.output;
}

export async function analyzeStudent(lesson: Lesson, studentId: string, attempts: StudentAttempt[]) {
  const intelligence = new StudentIntelligenceAgent();
  const r = await executeAIGuruAgent(intelligence,{ agent: 'student-intelligence', context: { runId: ids.agentRun(`student-${studentId}-${Date.now()}`), lessonId: lesson.id }, input: { lesson, studentId, attempts }});
  if (!r.ok || !r.output) throw new Error(r.error?.message ?? 'Student intelligence failed');
  const remediation = new RemediationAgent();
  const plan = await executeAIGuruAgent(remediation,{ agent: 'remediation', context: { runId: ids.agentRun(`remediation-${studentId}-${Date.now()}`), lessonId: lesson.id }, input: { lesson, studentId, mastery: r.output.records }});
  if (!plan.ok || !plan.output) throw new Error(plan.error?.message ?? 'Remediation failed');
  return { intelligence: r.output, remediation: plan.output };
}

export async function answerDoubt(lesson: Lesson, paragraphId: string, question: string, language: 'english'|'malayalam' = 'english') {
  const agent = new DoubtAgent();
  const r = await executeAIGuruAgent(agent,{ agent: 'doubt', context: { runId: ids.agentRun(`doubt-${lesson.id}-${Date.now()}`), lessonId: lesson.id, paragraphId, language }, input: { lesson, paragraphId, question }});
  if (!r.ok || !r.output) throw new Error(r.error?.message ?? 'Doubt agent failed');
  return r.output;
}
