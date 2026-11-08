import type { Paragraph, ParagraphState } from '../contracts';

export type ParagraphEvent =
  | 'START' | 'SOURCE_READY' | 'EXPLANATION_READY' | 'VISUALS_READY'
  | 'CHECKPOINT' | 'STUDENT_RESPONSE' | 'REMEDIATE' | 'MASTERED'
  | 'COMPLETE' | 'ERROR' | 'RESET';

const transitions: Record<ParagraphState, Partial<Record<ParagraphEvent, ParagraphState>>> = {
  idle: { START: 'source', RESET: 'idle' },
  source: { SOURCE_READY: 'explain', ERROR: 'error', RESET: 'idle' },
  explain: { EXPLANATION_READY: 'visualize', ERROR: 'error', RESET: 'idle' },
  visualize: { VISUALS_READY: 'check', ERROR: 'error', RESET: 'idle' },
  check: { CHECKPOINT: 'student_response', STUDENT_RESPONSE: 'student_response', MASTERED: 'mastered', ERROR: 'error', RESET: 'idle' },
  student_response: { MASTERED: 'mastered', REMEDIATE: 'remediate', ERROR: 'error', RESET: 'idle' },
  remediate: { VISUALS_READY: 'check', MASTERED: 'mastered', ERROR: 'error', RESET: 'idle' },
  mastered: { COMPLETE: 'complete', RESET: 'idle' },
  complete: { RESET: 'idle' },
  error: { RESET: 'idle', START: 'source' },
};

export interface ParagraphTransition { from: ParagraphState; event: ParagraphEvent; to: ParagraphState; }

export function transitionParagraph(state: ParagraphState, event: ParagraphEvent): ParagraphTransition {
  const to = transitions[state]?.[event];
  if (!to) throw new Error(`Invalid paragraph transition: ${state} + ${event}`);
  return { from: state, event, to };
}

export function advanceParagraph(paragraph: Paragraph, event: ParagraphEvent): Paragraph {
  const { to } = transitionParagraph(paragraph.state, event);
  return { ...paragraph, state: to };
}

export class ParagraphStateMachine {
  constructor(private paragraph: Paragraph) {}
  get state(): ParagraphState { return this.paragraph.state; }
  get value(): Paragraph { return this.paragraph; }
  dispatch(event: ParagraphEvent): Paragraph {
    this.paragraph = advanceParagraph(this.paragraph, event);
    return this.paragraph;
  }
  reset(): Paragraph { return this.dispatch('RESET'); }
}
