import type { GenerativeCondition, SceneAssetRef } from '../scene-contracts';
import type { LTXConditioningInput, LTXAssetInput } from './LTXRequest';

function toAsset(condition: SceneAssetRef): LTXAssetInput {
  if (condition.type !== 'image' && condition.type !== 'video') {
    throw new Error(`Unsupported generative asset type: ${condition.type}`);
  }
  return {
    id: condition.id,
    uri: condition.uri,
    type: condition.type,
  };
}

/** Maps the renderer-neutral Sprint-A conditions to the LTX-2 bridge contract. */
export function mapGenerativeConditions(conditions: GenerativeCondition[]): LTXConditioningInput[] {
  return conditions.map((condition): LTXConditioningInput => {
    switch (condition.type) {
      case 'reference-image':
        return { type: 'reference-image', asset: toAsset(condition.asset), strength: condition.strength };
      case 'reference-video':
        return {
          type: 'reference-video',
          asset: toAsset(condition.asset),
          strength: condition.strength,
          startMs: condition.startMs,
          endMs: condition.endMs,
        };
      case 'keyframe':
        return {
          type: 'keyframe',
          keyframe: {
            id: condition.asset.id,
            atMs: condition.atMs,
            asset: toAsset(condition.asset),
          },
        };
      case 'mask':
        return { type: 'mask', mask: { region: condition.region, targetObjectIds: condition.targetObjectIds } };
      case 'previous-state':
        return { type: 'previous-state', sceneId: condition.sceneId };
      case 'text':
        return { type: 'text', prompt: condition.prompt };
      default: {
        const exhaustive: never = condition;
        return exhaustive;
      }
    }
  });
}

export function dedupeConditions(conditions: LTXConditioningInput[]): LTXConditioningInput[] {
  const seen = new Set<string>();
  return conditions.filter((condition) => {
    const key = JSON.stringify(condition);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
