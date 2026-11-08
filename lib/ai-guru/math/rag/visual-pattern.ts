import type { MathRagHit, VisualOperation, VisualPattern } from './types';
const rules:[RegExp,VisualOperation][]=[
 [/move|shift|slide|translate|transfer|carry|borrow/i,'move-token'],
 [/fade|disappear|remove|erase|cancel/i,'fade-token'],
 [/transform|becomes|rewrite|simplif|equivalent/i,'transform'],
 [/highlight|emphasis|focus/i,'highlight'],
 [/circle|encircle/i,'circle'],
 [/underline/i,'underline'],
 [/write|appear|draw text/i,'write'],
 [/triangle|circle|geometry|construct|angle|parallel/i,'draw-geometry'],
 [/graph|plot|curve|function/i,'plot'],
 [/arrow|therefore|because|show that/i,'arrow'],
 [/pause|hold|emphasis/i,'pause'],
];
export function normalizeVisualPattern(h:MathRagHit):VisualPattern{
  const operations=[...new Set(rules.filter(([r])=>r.test(`${h.file_path} ${h.text}`)).map(([,o])=>o))] as VisualOperation[];
  if(!operations.length) operations.push('write','transform');
  const concepts=[...new Set((h.topics??[]).concat((h.text.match(/\b(algebra|geometry|calculus|trigonometry|probability|statistics|equation|fraction|graph|matrix|vector)\b/gi)??[])).map(x=>x.toLowerCase()))].slice(0,12);
  return {id:`pattern:${h.source}:${h.id}`,source:h.source,title:h.file_path.split('/').pop()||h.id,concepts,operations,teachingPurpose:operations.includes('move-token')?'Show a spatial mathematical transformation':'Use the retrieved example as visual teaching grammar',evidence:h.text.slice(0,1800),score:h.score,filePath:h.file_path};
}
