import type { Metadata } from 'next';
import { Lab3D } from '@/components/ai-guru/three-d/Lab3D';

export const metadata: Metadata = { title: '3D Lab: solids, atoms and the solar system', description: 'Turn solids, slice them and see volume and surface area; build atoms and molecules; watch the planets orbit. Free, in English and Malayalam.', alternates: { canonical: '/ai-guru/lab3d' } };
export default function Lab3DPage() { return <Lab3D />; }
