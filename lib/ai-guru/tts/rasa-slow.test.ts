// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { ttsProviderOrder, rasaOnDevice } from './provider-order';

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(), key: () => null, length: 0,
} as Storage;
afterEach(() => store.clear());

describe('V51.9.162: on-device Malayalam voice steps aside on a slow device', () => {
  it('V51.9.165: Edge reads Malayalam first; the on-device voice is next (first only with "Local Piper first")', () => {
    store.set('ai-guru-rasa-voice', 'on');
    expect(rasaOnDevice()).toBe(true);
    expect(ttsProviderOrder('malayalam', 'auto').slice(0, 2)).toEqual(['edge', 'rasa']);
    expect(ttsProviderOrder('malayalam', 'local-piper')[0]).toBe('rasa');
  });
  it('Edge reads Malayalam while the device is marked too slow, and the on-device voice comes back afterwards', () => {
    const now = 1_000_000;
    store.set('ai-guru-rasa-voice', 'on');
    store.set('ai-guru-rasa-slow-until', String(now + 60_000));
    expect(rasaOnDevice(now)).toBe(false);
    expect(ttsProviderOrder('malayalam', 'auto', now, rasaOnDevice(now))[0]).toBe('edge');
    expect(rasaOnDevice(now + 61_000)).toBe(true);
  });
  it('never for English', () => {
    store.set('ai-guru-rasa-voice', 'on');
    expect(ttsProviderOrder('english', 'auto')).not.toContain('rasa');
  });
});
