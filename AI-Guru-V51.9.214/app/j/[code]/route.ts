/**
 * Short invite link: /j/ANJAK7Q2 → the sign-up page with the friend's code filled in. Short enough to read out in a video or type from a poster.
 * Only a well-formed code is passed on; anything else lands on the plain sign-up page. A typed "anja-k7q2" or "ANJA K7Q2" also works.
 * V51.9.91: link-preview robots (WhatsApp, Telegram, Facebook, X…) get a page with Open Graph tags and an invite picture
 * instead of the redirect, so the pasted link shows as a card with the code. People are redirected exactly as before.
 */
import { cleanCode, isCode } from '@/lib/ai-guru/share/join-code';
import { invitePreviewHtml, isPreviewBot, previewText } from '@/lib/ai-guru/share/invite-preview';
import { inviteInfo, publicOrigin } from '@/lib/ai-guru/share/invite-lookup';

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const raw = (await ctx.params).code;
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch { /* malformed %-escape: use as is (it will be refused) */ }
  const code = cleanCode(decoded);
  const to = new URL('/ai-guru/student/signup', req.url);
  if (isCode(code)) to.searchParams.set('ref', code);
  if (isPreviewBot(req.headers.get('user-agent'))) {
    const origin = publicOrigin(req);
    const info = await inviteInfo(code);
    const page = info.code ? `${origin}/j/${info.code}` : `${origin}/ai-guru/student/signup`;
    const html = invitePreviewHtml({
      pageUrl: page,
      image: `${origin}/j/${info.code || 'AIGURU'}/card`,
      to: `${origin}${to.pathname}${to.search}`,
      text: previewText(info),
    });
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600', vary: 'User-Agent' } });
  }
  // V51.9.182 (newcomer review): a relative address, so the link stays on the address it was opened on (behind a proxy or
  // in a standalone build, req.url can name another host — the test sent 127.0.0.1 to localhost, splitting the sign-in)
  return new Response(null, { status: 307, headers: { location: `${to.pathname}${to.search}`, vary: 'User-Agent', 'cache-control': 'no-store' } });
}
