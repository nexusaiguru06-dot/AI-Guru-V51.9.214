import { describe, expect, it } from 'vitest';
import fixture from '@/fixtures/ai-guru/one-paragraph.json';
import { validateAIGuruLesson } from '@/lib/ai-guru/qa/validator';
import { alignCuesToWords, buildWordCues } from '@/lib/ai-guru/cues/engine';
import type { AIGuruLesson } from '@/lib/ai-guru/lesson/types';
describe('AI Guru V2 all-seven contract',()=>{it('validates the teaching fixture',()=>{const items=validateAIGuruLesson(fixture as AIGuruLesson);expect(items.filter(x=>x.severity==='error')).toHaveLength(0);});it('aligns a visual cue to a word',()=>{const words=buildWordCues('Now factor x',[{word:'Now',startMs:0,endMs:200},{word:'factor',startMs:200,endMs:500},{word:'x',startMs:500,endMs:650}]);const cues=alignCuesToWords([{id:'c',paragraphId:'p',track:'english',startMs:0,trigger:'word',triggerText:'factor',action:{type:'highlight',id:'h',targetId:'x'}}],words);expect(cues[0].startMs).toBe(200);});});
