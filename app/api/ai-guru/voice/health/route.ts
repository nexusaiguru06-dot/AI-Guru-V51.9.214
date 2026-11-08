import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const googleConfigured = Boolean(
    process.env.GOOGLE_CLOUD_TTS_API_KEY ||
    process.env.GOOGLE_CLOUD_TTS_USE_GEMINI_KEY === 'true' && process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
  const sarvamConfigured = Boolean(process.env.SARVAM_API_KEY);
  const piperConfigured = Boolean(process.env.PIPER_TTS_URL || (process.env.PIPER_BIN && process.env.PIPER_MODEL));

  return NextResponse.json({
    ok: true,
    providers: {
      edge: { configured: true, language: ['en-IN', 'ml-IN'], primary: true },
      googleCloud: { configured: googleConfigured, language: ['en-IN', 'ml-IN'], secondary: true },
      sarvam: { configured: sarvamConfigured, language: 'ml-IN' },
      piper: { configured: piperConfigured, language: 'ml-IN' },
      browser: { available: false, fallback: false },
    },
    recommendedOrder: ['edge', 'google-cloud', 'sarvam', 'piper'],
    checkedAt: new Date().toISOString(),
  });
}
