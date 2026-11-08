/**
 * The address the hosting platform saw, which a client cannot choose (used for the sign-in lockout and request limits).
 *
 * V51.9.176 (security fix): the Netlify header is trusted ONLY on Netlify. Before, it was read on every platform, so on
 * Google Cloud Run anyone could send a different `x-nf-client-connection-ip` with each request and get fresh tries.
 *
 * - Netlify (AI_GURU_PLATFORM=netlify, or Netlify's own NETLIFY_BLOBS_CONTEXT is present): Netlify's edge sets
 *   x-nf-client-connection-ip itself and replaces anything a client sent.
 * - Google Cloud Run (K_SERVICE is set): Google adds the caller's address at the END of X-Forwarded-For; anything a
 *   client sent itself comes before it. With a load balancer in front, set AI_GURU_PROXY_HOPS=2.
 * - Anything else (localhost): every header is whatever the client typed, so all are ignored.
 */
export type Platform = 'netlify' | 'cloud-run' | 'other';

export function platform(env: NodeJS.ProcessEnv = process.env): Platform {
  if (env.K_SERVICE) return 'cloud-run'; // Cloud Run first: never trust a Netlify header there
  if (env.AI_GURU_PLATFORM === 'netlify' || env.NETLIFY_BLOBS_CONTEXT || env.NETLIFY === 'true') return 'netlify';
  return 'other';
}

export function clientIp(req: { headers: Headers }, env: NodeJS.ProcessEnv = process.env): string {
  const where = platform(env);
  if (where === 'netlify') {
    const nf = req.headers.get('x-nf-client-connection-ip');
    if (nf) return nf.trim();
  }
  const hops = Number(env.AI_GURU_PROXY_HOPS || (where === 'cloud-run' ? 1 : 0));
  if (hops > 0) {
    const xs = (req.headers.get('x-forwarded-for') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    const ip = xs[xs.length - hops];
    if (ip) return ip;
  }
  return 'local';
}
