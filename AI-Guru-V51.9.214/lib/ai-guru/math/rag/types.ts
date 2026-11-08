export type MathRagSource = 'golden_set'|'3b1b_manim'|'3b1b_videos';
export type VisualOperation = 'write'|'erase'|'transform'|'highlight'|'circle'|'underline'|'move-token'|'fade-token'|'draw-geometry'|'plot'|'table'|'arrow'|'pause';
export interface MathRagChunk {
  id:string; source:MathRagSource|string; file_path:string; text:string; topics:string[];
  priority:number; full_length?:number; token_count?:number; chunk_index?:number;
  visualOperations?:VisualOperation[]; visualPurpose?:string;
}
export interface MathRagHit extends MathRagChunk { score:number; matchReasons:string[]; }
export interface VisualPattern {
  id:string; source:MathRagSource|string; title:string; concepts:string[];
  operations:VisualOperation[]; teachingPurpose:string; evidence:string;
  score:number; filePath:string;
}
export interface MathRagContext {
  query:string; hits:MathRagHit[]; patterns:VisualPattern[];
  formattedBlock:string; degraded:boolean; retrievalMode:'faiss'|'lexical'|'hybrid';
}
export interface MathRagRetrieveOptions {
  topK?:number; lexicalOnly?:boolean; sources?:MathRagSource[]; topics?:string[];
  maxContextChars?:number; useFaiss?:boolean;
}
