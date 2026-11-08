import type { QAFailure, QAScope } from './qa-contracts';

/** Select the smallest safe recovery scope. Visual-step and problem failures remain isolated. */
export function selectRecoveryScope(failure: Pick<QAFailure, 'scope'>): QAScope {
  return failure.scope;
}

export function defaultMaxRecoveryAttempts(): number {
  return 3;
}
