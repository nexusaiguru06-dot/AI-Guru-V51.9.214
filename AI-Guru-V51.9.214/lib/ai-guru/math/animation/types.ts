import type { MathVisualNode, MathVisualEvent, UniversalMathScene } from '../universal/types';
import type { AIGuruTeachingLesson, AnimationIntent, TeachingBeat } from '../teaching/types';

export interface CompiledAnimationEvent extends MathVisualEvent {
  sourceBeatId: string;
  semanticAction: AnimationIntent['type'];
}

export interface AnimationSceneGraph {
  schemaVersion: '1.1';
  objects: Map<string, MathVisualNode>;
  persistentIds: Set<string>;
}

export interface AnimationCompilerOptions {
  id?: string;
  defaultBeatDurationMs?: number;
  transitionMs?: number;
  pauseMs?: number;
  teachingLanguage?: UniversalMathScene['teachingLanguage'];
}

export interface CompiledTeachingLesson {
  scene: UniversalMathScene;
  beats: TeachingBeat[];
  events: CompiledAnimationEvent[];
  sceneGraph: AnimationSceneGraph;
  warnings: string[];
}

export interface AnimationCompiler {
  compile(lesson: AIGuruTeachingLesson, options?: AnimationCompilerOptions): CompiledTeachingLesson;
}
