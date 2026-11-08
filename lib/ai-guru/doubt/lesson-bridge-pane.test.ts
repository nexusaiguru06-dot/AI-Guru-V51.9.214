import { describe, expect, it } from 'vitest';
import { lessonBridge } from './lesson-bridge';

describe('V51.9.166: the class waits until the doubt pane is closed', () => {
  it('ignores release() while the pane is open and carries on only when it closes', () => {
    const log: string[] = [];
    lessonBridge.set({ context: () => ({}) as never, snapshot: () => null, hold: () => log.push('hold'), release: () => log.push('release'), playMicro: async () => ({}) as never });
    lessonBridge.openPane();
    expect(log).toEqual(['hold']);
    lessonBridge.get()?.release(); // an answer finished
    lessonBridge.get()?.release(); // a part of the pane closed
    expect(log).toEqual(['hold']);
    expect(lessonBridge.isPaneOpen()).toBe(true);
    lessonBridge.closePane();
    expect(log).toEqual(['hold', 'release']);
    lessonBridge.closePane(); // closing twice does nothing more
    expect(log).toEqual(['hold', 'release']);
    lessonBridge.get()?.release(); // without the pane, release works as before
    expect(log).toEqual(['hold', 'release', 'release']);
    lessonBridge.set(null);
  });
});
