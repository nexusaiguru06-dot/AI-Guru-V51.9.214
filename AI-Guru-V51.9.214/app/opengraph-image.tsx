import { ImageResponse } from 'next/og';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/ai-guru/site';

export const alt = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The picture that appears when any AI Guru link is pasted into WhatsApp, Facebook, Telegram or X. */
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 80px', background: 'linear-gradient(160deg,#0b1b33,#05101d)', color: '#fff' }}>
        <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, color: '#22d3ee', letterSpacing: 4 }}>AI GURU</div>
        <div style={{ display: 'flex', fontSize: 84, fontWeight: 800, marginTop: 24, lineHeight: 1.1 }}>{SITE_TAGLINE}</div>
        <div style={{ display: 'flex', fontSize: 34, marginTop: 36, color: '#fde68a' }}>Animated lessons · Quizzes with toffees · Reports for parents</div>
      </div>
    ),
    size,
  );
}
