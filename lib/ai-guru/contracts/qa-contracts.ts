import type { AgentName } from './agent-contracts';
import type { QARunId } from './ids';

export type QAName = 'content' | 'lesson' | 'visual-step' | 'classroom' | 'math-verification' | 'teaching-strategy';
export type QAScope = 'lesson' | 'paragraph' | 'problem' | 'visual-step' | 'classroom';
export type QAStatus = 'passed' | 'failed' | 'not-run' | 'blocked';
export type QASeverity = 'error' | 'warning' | 'info';

export interface QAFailure {
  id: string;
  code: string;
  message: string;
  severity: QASeverity;
  scope: QAScope;
  lessonId?: string;
  paragraphId?: string;
  problemId?: string;
  visualStepId?: string;
  recoverable: boolean;
  recoveryAction?: string;
}

export interface QAResult {
  qaRunId: QARunId;
  qa: QAName;
  status: QAStatus;
  scope: QAScope;
  targetId: string;
  failures: QAFailure[];
  checkedAt: string;
  rulesVersion: string;
  agent?: AgentName;
}

export interface QARunner<TInput = unknown> {
  readonly name: QAName;
  run(input: TInput, targetId: string): Promise<QAResult>;
}
