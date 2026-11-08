import type { Metadata } from 'next';
import SubscribersPage from '@/components/ai-guru/subscribers/SubscribersPage';

export const metadata: Metadata = { title: 'My Subscribers · AI Guru', description: 'Your invite link, code and QR, and every student who joined AI Guru through you.' };

/** V51.9.155 — a student's subscribers (the top menu is drawn by the AI Guru shell). */
export default function Page() { return <SubscribersPage />; }
