import { ImageResponse } from 'next/og';
import { lessonBySlug } from '@/lib/ai-guru/public/lessons';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'AI Guru sample lesson';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const l = lessonBySlug((await params).slug);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 80px', background: 'linear-gradient(160deg,#0b1b33,#05101d)', color: '#fff' }}>
        <div style={{ display: 'flex', fontSize: 36, fontWeight: 800, color: '#22d3ee', letterSpacing: 4 }}>AI GURU · {l ? `CLASS ${l.cls} ${l.subject.toUpperCase()}` : 'LESSON'}</div>
        <div style={{ display: 'flex', fontSize: 76, fontWeight: 800, marginTop: 24, lineHeight: 1.1 }}>{l?.title.en ?? 'Sample lesson'}</div>
        <div style={{ display: 'flex', fontSize: 34, marginTop: 36, color: '#fde68a' }}>Free lesson in Malayalam and English · Try the quiz</div>
      </div>
    ),
    size,
  );
}
