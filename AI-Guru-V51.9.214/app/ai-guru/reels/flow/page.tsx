import type { Metadata } from 'next';
import GoogleFlowGuide from '@/components/ai-guru/reels/GoogleFlowGuide';

export const metadata: Metadata = { title: 'Modify with Google Flow · Reel Studio', description: 'Turn your whiteboard video into a beautiful one with Google Flow: steps and a ready prompt to copy.' };

/** V51.9.151 — Reel Studio › Modify with Google Flow (?topic= fills the prompt's topic). */
export default async function FlowPage({ searchParams }: { searchParams: Promise<{ topic?: string | string[] }> }) {
  const sp = await searchParams;
  const topic = (Array.isArray(sp.topic) ? sp.topic[0] : sp.topic) ?? '';
  return <GoogleFlowGuide initialTopic={topic.slice(0, 120)} />;
}
