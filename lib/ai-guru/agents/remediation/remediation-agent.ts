import { ids, type AgentRequest, type AgentResult, type AIGuruAgent, type Lesson } from '../../contracts';
import type { MasteryRecord } from '../student-intelligence/student-intelligence-agent';
export interface RemediationPlan { studentId: string; conceptId: string; paragraphId?: string; actions: Array<'review_source'|'replay_visual'|'retry_problem'|'prerequisite_review'|'ask_doubt'>; reason: string; }
export class RemediationAgent implements AIGuruAgent<{ lesson: Lesson; studentId: string; mastery: MasteryRecord[] }, { plans: RemediationPlan[] }> {
  readonly name = 'remediation' as const;
  async execute(request: AgentRequest<{ lesson: Lesson; studentId: string; mastery: MasteryRecord[] }>): Promise<AgentResult<{ plans: RemediationPlan[] }>> {
    const plans = request.input.mastery.filter(m => m.mastery < 0.6).map(m => {
      const [paragraphId] = m.conceptId.split(':');
      const p = request.input.lesson.paragraphs.find(x => x.id === paragraphId);
      const actions: RemediationPlan['actions'] = ['review_source','replay_visual','retry_problem','ask_doubt'];
      if (p?.problems.length === 0) actions.splice(2, 1);
      return { studentId: request.input.studentId, conceptId: m.conceptId, paragraphId, actions, reason: m.mastery < 0.4 ? 'Significant concept gap detected.' : 'Concept needs reinforcement.' };
    });
    return { ok: true, agent: this.name, runId: request.context.runId, output: { plans } };
  }
}
