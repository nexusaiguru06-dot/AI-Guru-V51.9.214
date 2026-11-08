import { describe, expect, it } from 'vitest';
import { runVisualStepQA } from './visual-step-qa';
import type { Lesson } from '../../contracts';

const lesson = { schemaVersion:'2.0', id:'lesson_x', courseId:'course_x', bookId:'book_x', chapterId:'chapter_x', title:'x', language:{source:'english',target:'malayalam'}, teachingMode:'two-pass', paragraphs:[{id:'paragraph_x',index:0,source:{bookId:'book_x',chapterId:'chapter_x',pageNumber:1,pageImage:'p',text:'x'},teachingIntent:'x',explanation:{english:'Explain',malayalam:'വിശദീകരിക്കുക'},visualSteps:[],audioCues:[],checkpoints:[],problems:[],state:'idle',qa:{content:'passed',lesson:'passed',visual:'pending',classroom:'pending'}}]} as unknown as Lesson;
describe('visual step QA', () => {
  it('fails only the requested paragraph', () => {
    const r = runVisualStepQA(lesson, { paragraphId:'paragraph_x' });
    expect(r.scope).toBe('paragraph');
    expect(r.status).toBe('failed');
    expect(r.failures.every(f => f.paragraphId === 'paragraph_x')).toBe(true);
  });
});
