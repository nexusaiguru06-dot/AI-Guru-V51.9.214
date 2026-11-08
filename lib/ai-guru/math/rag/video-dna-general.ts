import 'server-only';
import type { MathRagHit } from './types';
import { selectLessonVideoDna } from './video-dna-selector';

/**
 * Backward-compatible Video-DNA retrieval API.
 *
 * The old implementation performed lexical overlap and immediately returned
 * up to three archetypes. It now uses the hierarchical semantic-style
 * selector/reranker while preserving the same return type and ID format.
 */
export async function retrieveGeneralVideoDna(query: string, topK = 2): Promise<MathRagHit[]> {
  const selected = await selectLessonVideoDna({ question: query });
  return selected.selections.slice(0, Math.max(1, Math.min(topK, 3))).map(item => item.hit);
}
