import type { GenerativeVisualPlan, SceneAssetRef } from '../scene-contracts';
import type { VideoDNASelection } from '../video-dna-v2';
import type { LTXAssetInput } from './LTXRequest';

export interface LTXReferenceBundle {
  images: LTXAssetInput[];
  videos: LTXAssetInput[];
}

function assetRefToLTX(asset: SceneAssetRef): LTXAssetInput | null {
  if (asset.type !== 'image' && asset.type !== 'video') return null;
  return { id: asset.id, uri: asset.uri, type: asset.type };
}

export function collectLTXReferences(
  plan: GenerativeVisualPlan,
  selection?: VideoDNASelection,
): LTXReferenceBundle {
  const images: LTXAssetInput[] = [];
  const videos: LTXAssetInput[] = [];
  const seen = new Set<string>();

  const add = (asset: SceneAssetRef | undefined) => {
    if (!asset || seen.has(asset.id)) return;
    const mapped = assetRefToLTX(asset);
    if (!mapped) return;
    seen.add(asset.id);
    (mapped.type === 'video' ? videos : images).push(mapped);
  };

  for (const condition of plan.conditions) {
    if (condition.type === 'reference-image' || condition.type === 'reference-video' || condition.type === 'keyframe') {
      add(condition.asset);
    }
  }

  if (selection?.primary.sourceAsset) {
    const uri = selection.primary.sourceAsset;
    add({
      id: `vdna:${selection.primary.id}`,
      uri,
      type: /\.(mp4|webm|mov)$/i.test(uri) ? 'video' : 'image',
      source: 'asset',
    });
  }

  return { images, videos };
}
