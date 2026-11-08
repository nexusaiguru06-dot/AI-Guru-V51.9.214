/**
 * V51.9.158 — test settings: the "@/…" import paths used across the app (see tsconfig.json "paths") work in tests too.
 * Without this, any module that imported "@/lib/…" could not be loaded by a test.
 */
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: {
    '@': fileURLToPath(new URL('.', import.meta.url)),
    // tests run on the server side: 'server-only' is the empty module there (as Next.js does for server code)
    'server-only': fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)),
  } },
  // V51.9.173: the tests send X-Forwarded-For like a hosting platform would; trust one hop as on Cloud Run.
  test: { env: { AI_GURU_PROXY_HOPS: '1' }, exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**'] },
});
