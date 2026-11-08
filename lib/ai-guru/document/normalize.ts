import type { DocumentArtifact } from '../../document/types';
import type { ParagraphSource } from '../lesson/types';

export function documentToParagraphSources(artifact: DocumentArtifact, bookId: string): ParagraphSource[] {
  return artifact.blocks
    .filter(block => (block.type === 'text' || block.type === 'markdown') && block.text?.trim())
    .map((block, index) => ({
      bookId,
      chapterIndex: Number(block.metadata?.chapterIndex ?? 0),
      sectionIndex: block.metadata?.sectionIndex == null ? undefined : Number(block.metadata.sectionIndex),
      paragraphIndex: index,
      pageNumber: block.pageNumber ?? 1,
      text: block.text!.trim(),
      pageImage: String(block.metadata?.pageImage ?? ''),
      boundingBox: block.bbox,
      formulas: [],
      assetIds: [],
    }));
}
