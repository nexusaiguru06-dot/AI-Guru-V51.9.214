import { NextResponse } from 'next/server';
import { edgeTTS, googleCloudTTS, piperTTS, sarvamTTS } from '@/lib/ai-guru/tts/providers';
import { mergeProviderWordTimings } from '@/lib/ai-guru/sync/tts-word-timing';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  let provider = 'edge';
  try {
    const body = (await request.json()) as any;
    provider = String(body.provider || 'edge');
    const textPreview = String(body.text || '').slice(0, 40);
    console.info(`[tts] provider=${provider} lang=${body.languageCode || '?'} text="${textPreview}…"`);

    const result =
      provider === 'edge'
        ? await edgeTTS(body)
        : provider === 'google-cloud'
          ? await googleCloudTTS(body)
          : provider === 'piper'
            ? await piperTTS(body)
            : await sarvamTTS(body, (typeof body.apiKey === 'string' && body.apiKey.trim().length >= 12 ? body.apiKey.trim() : undefined)); // V51.9.176: the server key is chosen inside sarvamTTS (signed-in users only)

    const durationMs = result.durationMs || undefined;
    if (body.alignment !== false) {
      result.words = mergeProviderWordTimings(String(body.text || ''), durationMs || 0, result.words);
    }
    console.info(`[tts] ok provider=${result.provider} durationMs=${durationMs || 'unknown'} words=${result.words?.length || 0} bytes≈${Math.round((result.audioBase64?.length || 0) * 0.75)}`);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[tts] FAIL provider=${provider}:`, message);
    // 502 so the client can surface the real reason in the teaching log
    return NextResponse.json(
      {
        ok: false,
        provider,
        error: message,
        hint:
          provider === 'edge'
            ? 'Edge TTS talks to Microsoft Read Aloud from the server. Check outbound network to speech.platform.bing.com / edge.microsoft.com, and that msedge-tts is installed.'
            : undefined,
      },
      { status: 502 },
    );
  }
}
