'use client';

/**
 * V51.9.160 — the classroom's voice request. Exactly `fetch('/api/ai-guru/tts', init)`, except that the on-device
 * Malayalam voice ('rasa') is answered right here in the browser with the same JSON shape, so the voice loops need
 * no other change. A sentence the on-device voice cannot read comes back as an error and the loop tries the next voice.
 */
export async function ttsFetch(url: string, init: RequestInit & { body?: string }): Promise<Response> {
  let provider = '';
  let text = '';
  try { const b = JSON.parse(String(init.body ?? '{}')); provider = b.provider; text = b.text ?? ''; } catch { /* not ours */ }
  if (provider !== 'rasa') return fetch(url, init);
  try {
    const { rasaTtsResponse } = await import('./rasa-voice');
    if (init.signal?.aborted) throw new DOMException('cancelled', 'AbortError');
    return new Response(JSON.stringify(await rasaTtsResponse(text)), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    console.warn(`[AI Guru voice] on-device Malayalam voice stepped aside: ${e instanceof Error ? e.message : String(e)}`);
    return new Response(JSON.stringify({ ok: false, error: `On-device Malayalam voice: ${e instanceof Error ? e.message : String(e)}` }), { status: 502, headers: { 'content-type': 'application/json' } });
  }
}
