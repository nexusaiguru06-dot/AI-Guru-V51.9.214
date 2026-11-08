import type { TeachingBeat } from './types';

export interface BeatPlanInput {
  id: string;
  narration: string;
  targetObjects: string[];
  actions: TeachingBeat['actions'];
  visualIntent?: TeachingBeat['visualIntent'];
  cueWords?: string[];
  durationMs?: number;
}

export function createTeachingBeat(input: BeatPlanInput): TeachingBeat {
  return {
    id: input.id,
    narration: input.narration,
    cueWords: input.cueWords,
    durationMs: input.durationMs,
    visualIntent: input.visualIntent ?? 'draw',
    targetObjects: input.targetObjects,
    actions: input.actions,
  };
}
