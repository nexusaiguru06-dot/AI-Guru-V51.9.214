import { NextResponse } from 'next/server';
import { selectVisualStyle, REFERENCE_STYLE_LIBRARY, getReferenceSegments } from '@/lib/ai-guru/math/universal';

export async function GET() {
  return NextResponse.json({ ok:true, styles:REFERENCE_STYLE_LIBRARY, segments: REFERENCE_STYLE_LIBRARY.flatMap(style => style.segmentCollectionId ? getReferenceSegments(style.segmentCollectionId) : []) });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const domain = String(body?.domain ?? 'general') as Parameters<typeof selectVisualStyle>[0]['domain'];
    const expression = String(body?.expression ?? '');
    const mode = (body?.mode ?? 'hybrid') as Parameters<typeof selectVisualStyle>[0]['mode'];
    const result = selectVisualStyle({ domain, expression, mode, grade: body?.grade, preferredStyle: body?.preferredStyle, bilingual: body?.bilingual !== false });
    return NextResponse.json({ ok:true, selection:result, referenceSegment: result.referenceSegment ?? null });
  } catch (error) {
    return NextResponse.json({ ok:false, error:error instanceof Error ? error.message : String(error) }, { status:400 });
  }
}
