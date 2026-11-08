import { beforeEach, describe, expect, it } from 'vitest';
import { clearTtsProviderDown, markTtsProviderDown, ttsProviderOrder } from './provider-order';

beforeEach(() => clearTtsProviderDown());

describe('ttsProviderOrder', () => {
  it('uses Edge first for Malayalam by default (Piper was first before)', () => {
    expect(ttsProviderOrder('malayalam', 'auto')[0]).toBe('edge');
    expect(ttsProviderOrder('malayalam', null)[0]).toBe('edge');
  });
  it('keeps Edge first for English and honours an explicit Edge preference', () => {
    expect(ttsProviderOrder('english', 'auto')[0]).toBe('edge');
    expect(ttsProviderOrder('malayalam', 'edge')[0]).toBe('edge');
  });
  it('puts Piper first only when the student chose Local Piper', () => {
    expect(ttsProviderOrder('malayalam', 'local-piper').slice(0, 2)).toEqual(['piper', 'edge']);
  });
  it('keeps Piper as the next voice after Edge, never browser speech', () => {
    const order = ttsProviderOrder('malayalam', 'auto');
    expect(order.slice(0, 2)).toEqual(['edge', 'piper']);
    expect(order).not.toContain('browser' as never);
  });
  it('demotes a provider that just failed, then lets it back after five minutes', () => {
    const t0 = 1_000_000;
    markTtsProviderDown('edge', t0);
    expect(ttsProviderOrder('malayalam', 'auto', t0 + 1000)).toEqual(['piper', 'google-cloud', 'sarvam', 'edge']);
    expect(ttsProviderOrder('malayalam', 'auto', t0 + 5 * 60 * 1000 + 1)[0]).toBe('edge');
  });
});
