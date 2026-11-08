'use client';

/**
 * AI Guru secondary BYOK providers.
 *
 * Provider order is intentionally fixed:
 *   OpenAI (when configured) -> Gemini key pool (V51.9.158: then the student's OpenRouter key) -> Agnes AI -> Sarvam AI
 *
 * Keys are kept in browser localStorage, matching the existing Gemini BYOK
 * design. They are sent directly to the provider and never persisted by AI Guru.
 */

import { openRouter } from '@/lib/ai-guru/openrouter';
import { logAi, maskKey, shortReason } from '@/lib/ai-guru/ai-log';

export type FallbackProvider = 'openai' | 'agnes' | 'sarvam';
export type ProviderState = {
  provider: FallbackProvider;
  key: string;
  addedAt: number;
  validatedAt?: number;
  invalid?: boolean;
  cooldownUntil?: number;
  lastError?: string;
  validationModel?: string;
};

const STORAGE = 'ai_guru_fallback_byok_v1';
const AGNES_BASE = 'https://apihub.agnes-ai.com/v1';
const SARVAM_BASE = 'https://api.sarvam.ai/v1';

const defaults: Record<FallbackProvider, { label: string; model: string; base: string }> = {
  openai: { label: 'OpenAI', model: 'gpt-4.1-mini', base: 'https://api.openai.com/v1' },
  agnes: { label: 'Agnes AI', model: 'agnes-3.0-flash', base: AGNES_BASE },
  sarvam: { label: 'Sarvam AI', model: 'sarvam-105b', base: SARVAM_BASE },
};

function read(): Partial<Record<FallbackProvider, ProviderState>> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}
function write(v: Partial<Record<FallbackProvider, ProviderState>>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE, JSON.stringify(v));
  window.dispatchEvent(new CustomEvent('ai-guru-byok-providers-changed'));
}
function validKey(key: string) { return key.trim().length >= 12; }
function usable(s?: ProviderState) { return !!s?.key && !s.invalid && (!s.cooldownUntil || s.cooldownUntil <= Date.now()); }

export function getFallbackProviders() { return { ...defaults }; }
export function getProvider(provider: FallbackProvider) { return read()[provider] || null; }
export function getProviders() { return read(); }
export function hasUsableFallbackProvider(): boolean {
  return openRouter.hasUsable() || (['openai','agnes','sarvam'] as FallbackProvider[]).some((provider) => usable(read()[provider])); // V51.9.158: OpenRouter (behind the Gemini keys) counts
}
export function activeFallbackProviders(): FallbackProvider[] {
  return (['openai','agnes','sarvam'] as FallbackProvider[]).filter((provider) => usable(read()[provider]));
}
export function saveProviderKey(provider: FallbackProvider, key: string) {
  const clean = key.trim();
  if (!validKey(clean)) throw new Error(`Enter a valid ${defaults[provider].label} API key.`);
  const all = read();
  all[provider] = { provider, key: clean, addedAt: all[provider]?.addedAt || Date.now(), invalid: false };
  write(all);
}
export function removeProviderKey(provider: FallbackProvider) {
  const all = read();
  delete all[provider];
  write(all);
}
export function maskProviderKey(key?: string) {
  if (!key) return '';
  return `${key.slice(0, 5)}${'•'.repeat(Math.max(5, key.length - 9))}${key.slice(-4)}`;
}
export function providerStatus(provider: FallbackProvider) {
  const s = getProvider(provider);
  if (!s) return 'not-configured';
  if (s.invalid) return 'invalid';
  if (s.cooldownUntil && s.cooldownUntil > Date.now()) return 'cooldown';
  return 'ready';
}
function markFailure(provider: FallbackProvider, error: unknown) {
  const all = read(); const s = all[provider]; if (!s) return;
  const msg = error instanceof Error ? error.message : String(error);
  s.lastError = msg.slice(0, 500);
  if (/401|403|invalid.*key|unauthorized|forbidden/i.test(msg)) s.invalid = true;
  else s.cooldownUntil = Date.now() + 60_000;
  write(all);
}
function markSuccess(provider: FallbackProvider, model: string) {
  const all = read(); const s = all[provider]; if (!s) return;
  s.invalid = false; delete s.cooldownUntil; delete s.lastError; s.validatedAt = Date.now(); s.validationModel = model;
  write(all);
}

async function parseResponse(res: Response, label: string) {
  const body = await res.text();
  let data: any = {};
  try { data = body ? JSON.parse(body) : {}; } catch { /* keep text */ }
  const msg = data?.error?.message || data?.message || body || `${label} HTTP ${res.status}`;
  if (!res.ok) throw new Error(`${label}: ${res.status} ${msg}`);
  return data;
}

function extractOpenAIText(data: any) {
  const text = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Provider returned an empty response.');
  return text;
}

export async function callFallbackProvider(
  provider: FallbackProvider,
  system: string,
  userContent: string,
  options: { json?: boolean; maxOutputTokens?: number; model?: string; task?: string } = {},
): Promise<string> {
  const cfg = defaults[provider];
  const saved = getProvider(provider);
  if (!saved || !usable(saved)) throw new Error(`${cfg.label} BYOK is not active.`);
  const model = options.model || cfg.model;
  const t0 = Date.now();
  try {
  // Route through AI Guru's transient server proxy. This avoids browser CORS
    // differences between provider accounts while keeping the key out of the
    // AI Guru database; the route does not persist request bodies.
    const res = await fetch('/api/ai-guru/byok/fallback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey: saved.key, model, system, userContent, json: Boolean(options.json), maxOutputTokens: options.maxOutputTokens ?? 30000 }),
    });
    const data = await parseResponse(res, cfg.label);
    const text = typeof data?.text === 'string' ? data.text : '';
    if (!text.trim()) throw new Error(`${cfg.label} returned an empty response.`);
    markSuccess(provider, model);
    logAi({ provider, model, key: maskKey(saved.key), task: options.task, ok: true, ms: Date.now() - t0 });
    return text;
  } catch (error) {
    markFailure(provider, error);
    logAi({ provider, model, key: maskKey(saved.key), task: options.task, ok: false, ms: Date.now() - t0, error: shortReason(error) });
    throw error;
  }
}

export async function validateFallbackProvider(provider: FallbackProvider, key: string) {
  saveProviderKey(provider, key);
  try {
    const text = await callFallbackProvider(provider, 'Reply with OK only. Do not add any other text.', 'OK', { maxOutputTokens: 64, model: defaults[provider].model });
    if (!text.trim()) throw new Error('Provider returned an empty validation response.');
    return { ok: true as const, model: defaults[provider].model };
  } catch (error) {
    removeProviderKey(provider);
    throw error;
  }
}

export async function callAiGuruText(
  system: string,
  userContent: string,
  options: { json?: boolean; maxOutputTokens?: number; geminiKey?: string; task?: string } = {},
): Promise<{ text: string; provider: 'gemini' | FallbackProvider }> {
  // Dynamic import prevents this browser-only fallback module from changing the
  // existing Gemini key-pool implementation and keeps provider selection local.
  const { callGeminiClient } = await import('@/lib/student-key');
  const openai = getProvider('openai');
  if (openai && usable(openai)) {
    try {
      const text = await callFallbackProvider('openai', system, userContent, options);
      console.info('[AI Guru BYOK] openai selected provider succeeded');
      return { text, provider: 'openai' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[AI Guru BYOK] openai primary provider failed; trying Gemini', message);
    }
  }
  try {
    const text = await callGeminiClient(system, userContent, options.geminiKey, { json: options.json, maxOutputTokens: options.maxOutputTokens, task: options.task });
    return { text, provider: 'gemini' };
  } catch (geminiError) {
    const errors: string[] = [geminiError instanceof Error ? geminiError.message : String(geminiError)];
    for (const provider of ['openai', 'agnes', 'sarvam'] as FallbackProvider[]) {
      try {
        const text = await callFallbackProvider(provider, system, userContent, options);
        console.info(`[AI Guru BYOK] ${provider} fallback succeeded`);
        return { text, provider };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[AI Guru BYOK] ${provider} fallback failed`, message);
        errors.push(`${defaults[provider].label}: ${message}`);
      }
    }
    throw new Error(`Gemini and fallback AI providers failed. ${errors.join(' | ')}`);
  }
}
