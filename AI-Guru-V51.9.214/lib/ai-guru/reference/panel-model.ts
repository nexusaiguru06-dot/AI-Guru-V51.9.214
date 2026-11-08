import type { ParagraphSource } from '../lesson/types';

export interface ReferencePanelModel { pageNumber: number; pageImage: string; spotlight?: ParagraphSource['boundingBox']; paragraphText: string; }

export function createReferencePanel(source: ParagraphSource): ReferencePanelModel {
  return { pageNumber: source.pageNumber, pageImage: source.pageImage, spotlight: source.boundingBox, paragraphText: source.text };
}
