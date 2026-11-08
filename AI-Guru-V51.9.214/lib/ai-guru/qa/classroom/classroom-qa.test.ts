import { describe, expect, it } from 'vitest';
import { runClassroomQA } from './classroom-qa';
import type { Lesson } from '../../contracts';

const base = (): Lesson => ({ schemaVersion: '2.0', id: 'lesson:q', courseId: 'course:q', bookId: 'book:q', chapterId: 'chapter:q', title: 'Q', language: {source:'english',target:'malayalam'}, teachingMode:'two-pass', paragraphs:[{ id:'p:q', index:0, source:{bookId:'book:q',chapterId:'chapter:q',pageNumber:1,pageImage:'img',text:'a'}, teachingIntent:'x', explanation:{english:'hello',malayalam:'ഹലോ'}, visualSteps:[], audioCues:[], checkpoints:[], problems:[], state:'idle', qa:{content:'passed',lesson:'passed',visual:'passed',classroom:'pending'} }]});

describe('classroom QA', () => { it('passes a structurally valid classroom package', () => expect(runClassroomQA(base()).status).toBe('passed')); });
