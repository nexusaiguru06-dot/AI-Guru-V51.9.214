import type { LanguageTrack, TeachingTrack, VisualAction } from './types';

export interface LanguagePass {
  language: LanguageTrack;
  track: TeachingTrack;
  visualSequence: VisualAction[];
  captionByVisualId: Record<string, string>;
}

export function createLanguagePass(language: LanguageTrack, track: TeachingTrack, captions: Record<string,string>): LanguagePass {
  return { language, track, visualSequence: track.visuals, captionByVisualId: captions };
}

export function createTwoPassSequence(english: LanguagePass, malayalam: LanguagePass): LanguagePass[] {
  return [english, malayalam];
}
