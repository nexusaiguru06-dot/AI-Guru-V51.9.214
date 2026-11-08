import type { Metadata } from 'next';
import { RegisterPage } from '@/components/ai-guru/admin/RegisterPage';

export const metadata: Metadata = { title: 'Students management · Activities', robots: { index: false } };

/** V51.9.184 — Students management: the activities register (school office only). */
export default function Page() { return <RegisterPage sheet="activities" />; }
