import type { Metadata } from 'next';
import { SettingsPage } from '@/components/ai-guru/admin/SettingsPage';

export const metadata: Metadata = { title: 'Settings · AI Guru office', robots: { index: false } };

/** V51.9.189 — ⚙ Settings: every office setting on one page (school office only). */
export default function Page() { return <SettingsPage />; }
