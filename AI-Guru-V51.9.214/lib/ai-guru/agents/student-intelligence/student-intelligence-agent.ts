import type { AgentRequest, AgentResult, AIGuruAgent, Lesson } from '../../contracts';
export interface StudentAttempt { studentId: string; itemId: string; paragraphId: string; conceptId: string; correct: boolean; score: number; timestamp?: string; }
export interface MasteryRecord { conceptId: string; attempts: number; correct: number; score: number; mastery: number; status: 'novice'|'developing'|'mastered'; }
export interface StudentIntelligenceOutput { studentId: string; records: MasteryRecord[]; weakConcepts: string[]; }

export class StudentIntelligenceAgent implements AIGuruAgent<{ lesson: Lesson; studentId: string; attempts: StudentAttempt[] }, StudentIntelligenceOutput> {
  readonly name = 'student-intelligence' as const;
  async execute(request: AgentRequest<{ lesson: Lesson; studentId: string; attempts: StudentAttempt[] }>): Promise<AgentResult<StudentIntelligenceOutput>> {
    const mine = request.input.attempts.filter(a => a.studentId === request.input.studentId);
    const map = new Map<string, StudentAttempt[]>();
    for (const a of mine) map.set(a.conceptId, [...(map.get(a.conceptId) ?? []), a]);
    const records = [...map.entries()].map(([conceptId, xs]) => {
      const score = xs.reduce((n, x) => n + x.score, 0) / xs.length;
      const mastery = Math.max(0, Math.min(1, score * 0.7 + (xs.filter(x => x.correct).length / xs.length) * 0.3));
      const status = mastery >= 0.8 ? 'mastered' : mastery >= 0.5 ? 'developing' : 'novice';
      return { conceptId, attempts: xs.length, correct: xs.filter(x => x.correct).length, score, mastery, status } as MasteryRecord;
    });
    return { ok: true, agent: this.name, runId: request.context.runId, output: { studentId: request.input.studentId, records, weakConcepts: records.filter(r => r.mastery < 0.6).map(r => r.conceptId) } };
  }
}
