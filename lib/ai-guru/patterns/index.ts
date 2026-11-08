export { PATTERNS, getPattern, buildPattern, matchesSignals } from './catalog';
export { searchPatterns, tokenize } from './search';
export { verifyVisualActions, formatIssues, fitTiming, estimateSpeechMs } from './verify';
export { describePattern, libraryIndex, patternPromptContext } from './context';
export { developStepVisuals, developSectionVisuals, repairVisualActions, parseSearchReply } from './developer';
export { dryRunSectionVisuals } from './section-visuals';
export type { LlmFn } from './developer';
export { actionsToSvg } from './svg-preview';
export type { VisualPattern, PatternHit, VerifyIssue, VerifyResult, Params } from './types';
