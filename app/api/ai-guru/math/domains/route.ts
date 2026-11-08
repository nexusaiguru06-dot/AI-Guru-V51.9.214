import { NextResponse } from 'next/server';
import { MATH_DOMAIN_PROFILES } from '@/lib/ai-guru/math/domains';

export async function GET() {
  return NextResponse.json({
    ok: true,
    version: 'V49',
    count: MATH_DOMAIN_PROFILES.length,
    domains: MATH_DOMAIN_PROFILES.map(profile => ({
      id: profile.id,
      label: profile.label,
      description: profile.description,
      defaultVisualMode: profile.defaultVisualMode,
      visualObjects: profile.visualObjects,
    })),
  });
}
