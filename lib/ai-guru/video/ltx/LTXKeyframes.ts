import type { GuruScene } from '../scene-contracts';
import type { VideoDNASelection } from '../video-dna-v2';
import type { LTXKeyframeInput, LTXAssetInput } from './LTXRequest';

/**
 * Builds LTX keyframes from the selected DNA. A DNA keyframe is only converted
 * when an actual image/video asset is available; the adapter never fabricates
 * mathematical frames.
 */
export function buildLTXKeyframes(scene: GuruScene, selection?: VideoDNASelection): LTXKeyframeInput[] {
  if (!selection) return [];

  const reference = selection.primary.sourceAsset;
  if (!reference) return [];

  const type: LTXAssetInput['type'] = /\.(mp4|webm|mov)$/i.test(reference) ? 'video' : 'image';
  const asset: LTXAssetInput = {
    id: `vdna:${selection.primary.id}`,
    uri: reference,
    type,
  };

  return selection.keyframes
    .filter((keyframe) => keyframe.atMs >= 0 && keyframe.atMs <= scene.durationMs)
    .map((keyframe) => ({
      id: keyframe.id,
      atMs: keyframe.atMs,
      asset,
      purpose: keyframe.purpose,
    }));
}
