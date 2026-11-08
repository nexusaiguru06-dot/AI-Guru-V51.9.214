import { describe, expect, it } from 'vitest';
import { advanceParagraph } from './state-machine';
import type { Paragraph } from '../contracts';

const p = { id:'paragraph_x', index:0, source:{bookId:'book_x',chapterId:'chapter_x',pageNumber:1,pageImage:'p',text:'x'}, teachingIntent:'x', explanation:{english:'x',malayalam:'x'}, visualSteps:[], audioCues:[], checkpoints:[], problems:[], state:'idle', qa:{content:'pending',lesson:'pending',visual:'pending',classroom:'pending'} } as unknown as Paragraph;
describe('paragraph state machine', () => {
  it('enforces deterministic paragraph progression', () => {
    let x = advanceParagraph(p, 'START');
    x = advanceParagraph(x, 'SOURCE_READY');
    x = advanceParagraph(x, 'EXPLANATION_READY');
    x = advanceParagraph(x, 'VISUALS_READY');
    expect(x.state).toBe('check');
  });
  it('rejects illegal transitions', () => expect(() => advanceParagraph(p, 'MASTERED')).toThrow());
});
