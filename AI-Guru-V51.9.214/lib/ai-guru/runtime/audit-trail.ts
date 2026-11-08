import type { AgentName } from '../contracts/agent-contracts';

/**
 * AI Guru native audit trail.
 *
 * Sprint 8.2 deliberately keeps the classroom runtime independent from the
 * legacy server-agent/persistence stack. A bounded in-process audit buffer is
 * always available; an external persistence adapter can be attached later
 * without importing the old runtime into the classroom bundle.
 */
export interface AIGuruAuditEvent {
  type: string;
  agent?: AgentName;
  runId?: string;
  lessonId?: string;
  paragraphId?: string;
  problemId?: string;
  status?: string;
  data?: Record<string, unknown>;
  timestamp?: string;
  sessionId?: string;
}

const localEvents: AIGuruAuditEvent[] = [];
const MAX_LOCAL_EVENTS = 2000;

export async function recordAIGuruAudit(event: AIGuruAuditEvent): Promise<AIGuruAuditEvent> {
  const normalized = { ...event, timestamp: event.timestamp ?? new Date().toISOString() };
  localEvents.push(normalized);
  if (localEvents.length > MAX_LOCAL_EVENTS) {
    localEvents.splice(0, localEvents.length - MAX_LOCAL_EVENTS);
  }
  return normalized;
}

export function readRecentAIGuruAudit(limit = 100): AIGuruAuditEvent[] {
  return localEvents.slice(-Math.max(1, Math.min(limit, MAX_LOCAL_EVENTS)));
}

export function clearAIGuruAudit(): void {
  localEvents.length = 0;
}
