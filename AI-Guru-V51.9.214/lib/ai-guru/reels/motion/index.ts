/**
 * AI Guru Motion Graphics Engine — public API.
 * See docs/MOTION-GRAPHICS-ENGINE.md for the motion grammar.
 */

export { ROLE, DUR, FONT, roleColor, type Role } from './grammar';
export {
  Motion,
  ease,
  evalItem,
  pointsAt,
  sceneStateAt,
  captionAt,
  withVoice,
  withStepPause,
  currentStepPause,
  STEP_PAUSE_MAX,
  type MotionScene,
  type Caption,
  type SfxEvent,
  type VoicePlan,
} from './engine';
export { drawMotionFrame, drawReelFrame, FORMAT_SIZE, type ReelFormat, type DrawOptions } from './draw';
export { say, STEP_LABEL, type Lang } from './captions';
export { renderSfx, SFX_RATE } from './sfx';
export { speakable, estimateSpeechMs } from './speech';
export { mixReelAudio, prepareClip, resample, clipMs, encodeWav, type VoiceClips } from './audio';
export { reelSubtitleCues, toSrt, toVtt, type SubtitleCue } from './subtitles';
export { setMeasurer, measure, tokenWidth } from './metrics';
export { buildAddition } from './recipes/addition';
export { buildSubtraction } from './recipes/subtraction';
export { buildMultiplication } from './recipes/multiplication';
export { buildDivision } from './recipes/division';
export { buildDerivation, type DerivationInput, type DerivLine, type Link } from './recipes/derivation';
export { buildIntro, type IntroInput, type IntroPoint } from './recipes/intro';
export { buildStory, buildStoryShot, CAST_KINDS, SETTINGS, PROPS, ACTIONS, SETTING_NAME, KIND_NAME as CAST_KIND_NAME, PROP_NAME, ACTION_NAME, lookOf, type StoryBoard, type Shot, type CastMember, type CastKind, type Setting, type Prop, type Action, type Bi } from './recipes/story';
export { BRANCH_EXAMPLES, BRANCH_CAPTIONS_ML, withCaptions, type BranchExample } from './recipes/branches';
export { CHAPTER_INTROS, type ChapterIntro } from './recipes/chapters';
export { verifyDerivation, evaluate, type Vars } from './verify';
export {
  buildReel,
  makeReel,
  parseArithmetic,
  arithmeticLimitError,
  reelPartAt,
  reelSfx,
  reelVoiceCues,
  unvoicedSteps,
  voiceScript,
  requestLang,
  type MotionReel,
  type ReelRequest,
  type BuildOptions,
  type VoiceCue,
} from './reel';
export { integratedLufs, normaliseLoudness, limitPeaks, levelClip, REEL_LUFS, VOICE_LUFS } from './loudness';
export { checkSummary, clock, type ReelCheck, type CheckProblem } from './self-check';
