import { describe, expect, it } from 'vitest';
import { AIGuruClassroomController } from './classroom-controller';
import type { ParagraphTeachingUnit } from '../lesson/types';

describe('teaching checkpoints', () => {
  it('emits a language-specific line checkpoint without changing the lesson visual contract', () => {
    const events: any[] = [];
    const port: any = { showReference() {}, playActions: async () => {}, pause() {}, resume() {}, resetVisuals() {} };
    const controller = new AIGuruClassroomController(port, { onCheckpoint: c => events.push(c) });
    const p = { id: 'p1', english: { text: '', visuals: [] }, malayalam: { text: '', visuals: [] }, source: {} } as unknown as ParagraphTeachingUnit;
    controller.checkpoint(p, 'malayalam', 2, 'eq-3', 'ഇത് മൂന്നാമത്തെ ഘട്ടമാണ്.');
    expect(events[0]).toMatchObject({ paragraphId: 'p1', language: 'malayalam', lineIndex: 2, lineId: 'eq-3' });
  });
});
