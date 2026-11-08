'use client';

import type { ParagraphSource } from '../lesson/types';

export interface ExtractedLessonDocument {
  text: string;
  images: string[];
  layout?: Array<{ page: number; type: string; content: string; position?: { x:number;y:number;width:number;height:number } }>;
  metadata?: { fileName?: string; pageCount?: number; parser?: string; imageMapping?: Record<string,string> };
}

export async function extractCourseMaterial(file: File, providerId?: string): Promise<ExtractedLessonDocument> {
  const form = new FormData();
  form.append('file', file);
  if (providerId) form.append('providerId', providerId);
  const response = await fetch('/api/extract-document', { method: 'POST', body: form });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || payload?.message || 'Document extraction failed');
  return (payload?.data ?? payload) as ExtractedLessonDocument;
}

export function extractedDocumentToSources(doc: ExtractedLessonDocument, bookId: string): ParagraphSource[] {
  const blocks = doc.layout?.filter(b => (b.type === 'text' || b.type === 'title') && b.content.trim()) ?? [];
  if (blocks.length) {
    return blocks.map((b, i) => ({
      bookId, chapterIndex: 0, paragraphIndex: i, pageNumber: Math.max(1, b.page || 1),
      text: b.content.trim(), pageImage: '', boundingBox: b.position,
    }));
  }
  return doc.text.split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean).map((text, i) => ({
    bookId, chapterIndex: 0, paragraphIndex: i, pageNumber: 1, text, pageImage: '',
  }));
}
