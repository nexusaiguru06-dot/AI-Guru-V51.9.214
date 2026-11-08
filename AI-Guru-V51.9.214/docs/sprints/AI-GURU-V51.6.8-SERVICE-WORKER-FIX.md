# AI Guru V51.6.8 — Service Worker Response Clone Fix

- Replaced the broken/stale service-worker behavior with `public/sw.js` v51.6.8.
- Gemini/AI Guru API, TTS, speech and audio requests are network-only and are never cached.
- localhost/127.0.0.1 is entirely network-only to avoid Fast Refresh/stale-cache interference.
- Production caches only successful same-origin static assets.
- `Response.clone()` is performed before `cache.put()` consumes the cloned body.
- Cache name bumped to `ai-guru-static-v51.6.8`; activation deletes older caches.
- Added `ServiceWorkerRepair` to register/update `/sw.js` with `updateViaCache: 'none'`.

The `/demo/page-27.png preload not used` browser message is a performance warning, not a class-stopping error.
