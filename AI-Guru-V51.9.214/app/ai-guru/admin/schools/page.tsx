import type { Metadata } from 'next';
import { SchoolsPage } from '@/components/ai-guru/admin/SchoolsPage';

export const metadata: Metadata = { title: 'Schools · AI Guru office', robots: { index: false } };

/** V51.9.193 — contracted schools, their teachers, students and commission account (school office only). */
export default function Page() { return <SchoolsPage />; }
