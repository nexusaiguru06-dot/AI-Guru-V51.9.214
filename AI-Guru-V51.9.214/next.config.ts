import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // V51.9.173: the Docker image for Google Cloud Run builds a small self-contained server (AI_GURU_STANDALONE=1).
  // On a laptop `npm run dev` / `npm start` work as before.
  ...(process.env.AI_GURU_STANDALONE === '1' ? {
    output: 'standalone' as const,
    // files the server opens by path at run time (Next.js cannot see these imports)
    outputFileTracingIncludes: {
      '/api/**': [
        './node_modules/pdfjs-dist/legacy/build/**',
        './node_modules/pdfjs-dist/build/**',
        './node_modules/pdfjs-dist/standard_fonts/**',
        './node_modules/pdfjs-dist/cmaps/**',
        './node_modules/@napi-rs/canvas*/**',
      ],
    },
  } : {}),
  // This distribution is a pnpm workspace. Pin Turbopack to the application
  // root so Next.js does not walk up to a user's parent package-lock.json.
  turbopack: {
    root: __dirname,
  },
  // Server-side PDF page rendering (app/api/ai-guru/material-studio/page-image)
  // must load these from node_modules at runtime instead of bundling them.
  // Bundled, pdfjs looks for ./pdf.worker.mjs next to the compiled chunk
  // ("Setting up fake worker failed: Cannot find module .../chunks/pdf.worker.mjs")
  // and @napi-rs/canvas' native binding cannot be resolved (DOMMatrix/Path2D
  // polyfill warnings) - every page-image request then answered 500.
  serverExternalPackages: ['pdfjs-dist', '@napi-rs/canvas', 'pg', '@google-cloud/storage', '@faiss-node/native'],
  // V51.9.173 (security): no "X-Powered-By: Next.js", and safe defaults on every page.
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
        // V51.9.196 (security check): HTTPS only once a browser has seen the site over HTTPS (ignored on http://localhost),
        // and a content policy that blocks plugins, other sites framing us, a changed <base> and forms posting elsewhere.
        // (Scripts are not restricted here: Next.js and the theme switch use inline scripts.)
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'Content-Security-Policy', value: "object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'" },
      ],
    }];
  },
};

export default nextConfig;
