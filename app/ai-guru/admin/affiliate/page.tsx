import type { Metadata } from 'next';
import { RegisterPage } from '@/components/ai-guru/admin/RegisterPage';

export const metadata: Metadata = { title: 'Students management · Affiliate', robots: { index: false } };

/** V51.9.184 — Students management: the affiliate register (school office only). */
export default function Page() { return <RegisterPage sheet="affiliate" />; }
