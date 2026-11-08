import 'server-only';

import { HttpLTX2Client } from './LTXClient';
import { LTX2Adapter } from './LTX2Adapter';

/** Creates the production adapter from environment configuration. */
export function createLTX2Adapter(): LTX2Adapter {
  const baseUrl = process.env.AI_GURU_LTX2_BASE_URL;
  if (!baseUrl) {
    throw new Error('AI_GURU_LTX2_BASE_URL is not configured');
  }

  return new LTX2Adapter(new HttpLTX2Client({
    baseUrl,
    apiKey: process.env.AI_GURU_LTX2_API_KEY,
    model: process.env.AI_GURU_LTX2_MODEL,
    timeoutMs: Number(process.env.AI_GURU_LTX2_TIMEOUT_MS ?? 120000),
  }));
}
