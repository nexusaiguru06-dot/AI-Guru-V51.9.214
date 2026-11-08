import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function GET() {
  const fixturePath = path.join(process.cwd(), 'fixtures/ai-guru/pages10-11-full-v33.json');
  try {
    const raw = await fs.readFile(fixturePath, 'utf8');
    const fixture = JSON.parse(raw);
    return NextResponse.json({
      ok: true,
      benchmark: 'Page 10–11',
      pages: fixture.benchmarkPages ?? [10, 11],
      paragraphCount: fixture.paragraphs?.length ?? 0,
      runtime: 'AI Guru application'
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Benchmark unavailable'
    }, { status: 500 });
  }
}
