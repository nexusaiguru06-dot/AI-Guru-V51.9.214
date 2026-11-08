/**
 * V51.9.177 — a plain Gemini text call for code that runs on the SERVER (study materials made "on the AI Guru cloud").
 *
 * The browser path (`callAiGuruText` in byok-providers.ts) is a 'use client' module: it reads the student's keys from
 * browser storage and rotates between them. On a server a production build turns any call into it into an error
 * ("Attempted to call callAiGuruText() from the server…"), so cloud jobs always failed. This sends the same request
 * with the one key the server was given (the school's cloud key or GEMINI_API_KEY).
 */
import { GEMINI_TEXT_MODEL } from '@/lib/student-key';

export interface ServerTextOptions { json?: boolean; maxOutputTokens?: number; geminiKey?: string; task?: string }

export async function geminiTextServer(system: string, userContent: string, o: ServerTextOptions = {}): Promise<string> {
  const key = o.geminiKey?.trim();
  if (!key) throw new Error('No Gemini key for this job (Study materials → Cloud settings, or GEMINI_API_KEY on the server).');
  const model = process.env.GEMINI_MATERIAL_MODEL || GEMINI_TEXT_MODEL;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: { maxOutputTokens: o.maxOutputTokens ?? 8192, temperature: 0.4, ...(o.json ? { responseMimeType: 'application/json' } : {}) },
    }),
    signal: AbortSignal.timeout(Number(process.env.AI_GURU_SERVER_AI_TIMEOUT_MS || 180_000)),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}${o.task ? ` (${o.task})` : ''}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  if (!text.trim()) throw new Error(`Gemini returned no text${o.task ? ` (${o.task})` : ''}.`);
  return text;
}
