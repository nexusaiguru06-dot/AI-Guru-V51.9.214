import { NextResponse } from 'next/server';

type Provider = 'openai' | 'agnes' | 'sarvam';
const CONFIG = {
  openai: { base: 'https://api.openai.com/v1', defaultModel: 'gpt-4.1-mini' },
  agnes: { base: 'https://apihub.agnes-ai.com/v1', defaultModel: 'agnes-3.0-flash' },
  sarvam: { base: 'https://api.sarvam.ai/v1', defaultModel: 'sarvam-105b' },
} as const;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const provider = body?.provider as Provider;
    if (provider !== 'openai' && provider !== 'agnes' && provider !== 'sarvam') return NextResponse.json({ error: 'Unsupported fallback provider.' }, { status: 400 });
    const apiKey = String(body?.apiKey || '').trim();
    const system = String(body?.system || '').trim();
    const userContent = String(body?.userContent || '').trim();
    if (!apiKey || !userContent) return NextResponse.json({ error: 'API key and prompt are required.' }, { status: 400 });
    const model = String(body?.model || CONFIG[provider].defaultModel);
    const headers: Record<string,string> = { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` };
    if (provider === 'sarvam') headers['api-subscription-key'] = apiKey;
    const payload: any = {
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }],
      temperature: 0.2,
      // Sarvam 105B has reasoning enabled by default. For short validation
      // calls, reasoning can consume the entire max_tokens budget and leave
      // message.content empty. Disable reasoning explicitly for this adapter.
      ...(provider === 'sarvam' ? { reasoning_effort: null } : {}),
      max_tokens: Math.max(32, Math.min(Number(body?.maxOutputTokens || 4096), provider === 'openai' ? 12000 : 4096)),
      stream: false,
    };
    if (body?.json && (provider === 'sarvam' || provider === 'openai')) payload.response_format = { type: 'json_object' };
    console.info(`[AI Guru BYOK] calling ${provider} ${model}`);
    const upstream = await fetch(`${CONFIG[provider].base}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(payload), cache: 'no-store' });
    const raw = await upstream.text();
    let data: any = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { /* retain raw */ }
    if (!upstream.ok) {
      const message = data?.error?.message || data?.message || raw || `${provider} returned HTTP ${upstream.status}`;
      console.warn(`[AI Guru BYOK] ${provider} upstream ${upstream.status}: ${message}`);
      return NextResponse.json({ error: message, provider, upstreamStatus: upstream.status }, { status: upstream.status });
    }
    const text = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? '';
    if (!String(text).trim()) return NextResponse.json({ error: `${provider} returned an empty response.` }, { status: 502 });
    return NextResponse.json({ ok: true, provider, model, text: String(text) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
