/* AI Guru service worker v51.6.8
 * Safe caching rules:
 * - API/TTS/dynamic requests are always network-only.
 * - Development (localhost) is network-only to avoid stale Fast Refresh assets.
 * - Production caches only successful same-origin static GET assets.
 * - Response is cloned before cache.put() consumes the clone.
 */
const CACHE_NAME = 'ai-guru-static-v51.6.8';
const STATIC_EXT = /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|svg|gif|ico)$/i;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isDynamic(url) {
  return url.pathname.startsWith('/api/') ||
    url.pathname.includes('/tts') ||
    url.pathname.includes('/speech') ||
    url.pathname.includes('/audio');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache AI, TTS, streaming, or other dynamic API responses.
  if (isDynamic(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Dev must remain network-only so Next Fast Refresh never receives stale assets.
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    event.respondWith(fetch(request));
    return;
  }

  // Do not cache page navigations; Next.js pages can contain dynamic state.
  if (request.mode === 'navigate' || !STATIC_EXT.test(url.pathname)) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      // IMPORTANT: clone immediately, before either body is consumed.
      const cacheCopy = response.clone();
      event.waitUntil(
        caches.open(CACHE_NAME)
          .then((cache) => cache.put(request, cacheCopy))
          .catch(() => undefined)
      );
    }
    return response;
  })());
});
