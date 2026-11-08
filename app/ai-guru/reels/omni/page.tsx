import type { Metadata } from 'next';
import GoogleFlowGuide from '@/components/ai-guru/reels/GoogleFlowGuide';

export const metadata: Metadata = { title: 'Make it with Google Omni 1.2 · Reel Studio', description: 'Turn your whiteboard video into a beautiful AI video with Google’s Omni 1.2 model: steps and a ready prompt to copy.' };

/** V51.9.213 — Reel Studio › Google Omni 1.2 (?topic= fills the prompt's topic; ?raw= brings a raw reel). */
export default async function OmniPage({ searchParams }: { searchParams: Promise<{ topic?: string | string[] }> }) {
  const sp = await searchParams;
  const topic = (Array.isArray(sp.topic) ? sp.topic[0] : sp.topic) ?? '';
  return <GoogleFlowGuide tool="omni" initialTopic={topic.slice(0, 120)} />;
}
