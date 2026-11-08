import type { AIGuruAgent, AgentRequest, AgentResult } from '../../contracts/agent-contracts';

export interface SessionState {
  studentId: string;
  lessonId: string;
  paragraphId?: string;
  problemId?: string;
  pageNumber?: number;
  visualStepId?: string;
  audioCueId?: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface SessionRequest {
  action: 'save' | 'load' | 'clear';
  studentId: string;
  lessonId: string;
  sessionId?: string;
  state?: Partial<SessionState>;
}

/** Native AI Guru session store. It intentionally has no dependency on the legacy server persistence stack. */
const memory = new Map<string, SessionState>();

function keyOf(input: SessionRequest): string {
  return `${input.studentId}:${input.lessonId}:${input.sessionId ?? ''}`;
}

export class SessionMemoryAgent implements AIGuruAgent<SessionRequest, SessionState | undefined> {
  readonly name = 'session-memory' as const;

  async execute(request: AgentRequest<SessionRequest>): Promise<AgentResult<SessionState | undefined>> {
    const input = request.input;
    const key = keyOf(input);

    if (input.action === 'clear') {
      memory.delete(key);
      return { ok: true, agent: this.name, runId: request.context.runId };
    }

    if (input.action === 'load') {
      return { ok: true, agent: this.name, runId: request.context.runId, output: memory.get(key) };
    }

    const next: SessionState = {
      ...(memory.get(key) ?? {}),
      ...(input.state ?? {}),
      studentId: input.studentId,
      lessonId: input.lessonId,
      updatedAt: new Date().toISOString(),
    };
    memory.set(key, next);
    return { ok: true, agent: this.name, runId: request.context.runId, output: next };
  }
}

export function clearSessionMemory(): void {
  memory.clear();
}
