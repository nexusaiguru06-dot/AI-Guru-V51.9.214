/**
 * V51.9.91: the invite picture (1200 x 630) that WhatsApp, Telegram, Facebook and X show for a /j/CODE link: the code in big
 * letters and where to type it. English letters only: the picture's font cannot shape Malayalam, so Malayalam stays in the text.
 */
import { ImageResponse } from 'next/og';
import { cleanCode, spacedCode } from '@/lib/ai-guru/share/join-code';
import { cardGroup } from '@/lib/ai-guru/share/invite-preview';
import { inviteInfo, publicOrigin } from '@/lib/ai-guru/share/invite-lookup';

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const info = await inviteInfo(cleanCode((await ctx.params).code));
  const host = new URL(publicOrigin(req)).host;
  const group = cardGroup(info.group);
  const head = !info.code ? 'Learn in Malayalam and English' : group ? `Join ${group}` : 'You’re invited!';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 72px', background: 'linear-gradient(160deg,#0b1b33,#05101d)', color: '#fff' }}>
        <div style={{ display: 'flex', fontSize: 36, fontWeight: 800, color: '#22d3ee', letterSpacing: 4 }}>AI GURU</div>
        <div style={{ display: 'flex', fontSize: 70, fontWeight: 800, marginTop: 18, lineHeight: 1.1 }}>{head}</div>
        {info.code ? (
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 34 }}>
            <div style={{ display: 'flex', fontSize: info.code.length > 8 ? 60 : 84, fontWeight: 800, letterSpacing: info.code.length > 8 ? 4 : 8, color: '#fde68a', border: '5px dashed #22d3ee', borderRadius: 24, padding: '6px 30px', whiteSpace: 'nowrap', flexShrink: 0 }}>{spacedCode(info.code)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 36, fontSize: 30, color: '#cbd5e1' }}>
              <div style={{ display: 'flex' }}>Tap the link, or type</div>
              <div style={{ display: 'flex' }}>the code at <span style={{ color: '#22d3ee', marginLeft: 10, fontWeight: 800 }}>{host}/j</span></div>
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', fontSize: 32, marginTop: 40, color: '#fde68a' }}>{info.offer ? `${info.offer} · ` : ''}Animated lessons · Quizzes with toffees</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'cache-control': 'public, max-age=86400' } },
  );
}
