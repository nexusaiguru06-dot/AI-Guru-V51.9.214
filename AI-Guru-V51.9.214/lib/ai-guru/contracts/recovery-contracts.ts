import type { QAName, QAFailure, QAScope } from './qa-contracts';
import type { RecoveryRunId } from './ids';

export type RecoveryStatus = 'started' | 'repaired' | 'rechecked' | 'accepted' | 'failed' | 'escalated';

export interface RecoveryRequest {
  recoveryRunId: RecoveryRunId;
  sourceQA: QAName;
  failure: QAFailure;
  scope: QAScope;
  targetId: string;
  attempt: number;
  maxAttempts: number;
}

export interface RecoveryResult {
  recoveryRunId: RecoveryRunId;
  status: RecoveryStatus;
  sourceQA: QAName;
  scope: QAScope;
  targetId: string;
  changedIds: string[];
  message?: string;
}

/** Recovery must return to the originating QA before the repaired artifact is accepted. */
export interface RecoveryPolicy {
  maxAttempts: number;
  selectSmallestScope(failure: QAFailure): QAScope;
  originatingQA(failure: QAFailure): QAName;
}

export interface RecoveryHandler {
  action: string;
  repair(request: RecoveryRequest, artifact: unknown): Promise<unknown>;
}
