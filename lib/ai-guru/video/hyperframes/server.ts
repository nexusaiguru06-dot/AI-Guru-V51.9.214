import { HyperFramesAdapter } from './HyperFramesAdapter';
import { HttpHyperFramesClient } from './HyperFramesClient';

export function createHyperFramesAdapterFromEnv(): HyperFramesAdapter {
  const baseUrl = process.env.AI_GURU_HYPERFRAMES_BASE_URL;
  if (!baseUrl) throw new Error('AI_GURU_HYPERFRAMES_BASE_URL is required');

  return new HyperFramesAdapter(new HttpHyperFramesClient({
    baseUrl,
    apiKey: process.env.AI_GURU_HYPERFRAMES_API_KEY,
    timeoutMs: Number(process.env.AI_GURU_HYPERFRAMES_TIMEOUT_MS ?? 120_000),
  }));
}
