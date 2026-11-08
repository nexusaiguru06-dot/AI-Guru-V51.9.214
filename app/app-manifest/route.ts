import { appManifest } from '@/lib/ai-guru/pwa/manifest';

export const dynamic = 'force-dynamic';

/** V51.9.197 — the app manifest (/app-manifest, or /app-manifest?ref=CODE from a friend's invite). */
export function GET(req: Request) {
  const ref = new URL(req.url).searchParams.get('ref');
  return new Response(JSON.stringify(appManifest(ref)), { headers: { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
