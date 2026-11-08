import { openRouter } from '@/lib/ai-guru/openrouter';
import { studentKey } from '@/lib/student-key';
import { callAiGuruText, getProvider, type FallbackProvider } from '@/lib/ai-guru/byok-providers';
import type { Llm } from '@/lib/ai-guru/motion-class/plan/ai';

/** Any saved AI key works (the classroom's own order: OpenAI, Gemini pool, Agnes, Sarvam). */
export function hasAnyAiKey(): boolean {
  if (studentKey.hasValidatedKey() || openRouter.hasUsable()) return true; // V51.9.158: an OpenRouter key alone works too
  return (['openai', 'agnes', 'sarvam'] as FallbackProvider[]).some((p) => { const s = getProvider(p); return !!s?.key && !s.invalid; });
}

export const aiLlm: Llm = async (system, user) => (await callAiGuruText(system, user, { json: true, maxOutputTokens: 12000 })).text;
