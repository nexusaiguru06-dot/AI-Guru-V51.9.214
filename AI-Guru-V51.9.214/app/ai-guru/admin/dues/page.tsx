import type { Metadata } from 'next';
import { RegisterPage } from '@/components/ai-guru/admin/RegisterPage';

export const metadata: Metadata = { title: 'Students management · Fees due', robots: { index: false } };

/** V51.9.185 — Students management: students who owe money now (school office only). */
export default function Page() { return <RegisterPage sheet="dues" />; }
