import { EdgeTTSClient } from './EdgeTTSClient';
export function createEdgeTTSFromEnv():EdgeTTSClient {
  return new EdgeTTSClient({
    baseUrl:process.env.AI_GURU_EDGE_TTS_BASE_URL ?? 'http://127.0.0.1:8796/',
    apiKey:process.env.AI_GURU_EDGE_TTS_API_KEY,
    timeoutMs:Number(process.env.AI_GURU_EDGE_TTS_TIMEOUT_MS ?? 120000),
    voices:{english:process.env.AI_GURU_EDGE_TTS_EN_VOICE ?? '',malayalam:process.env.AI_GURU_EDGE_TTS_ML_VOICE ?? ''},
  });
}
