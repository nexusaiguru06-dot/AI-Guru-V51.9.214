import { PiperTTSClient } from './PiperTTSClient';
export function createPiperTTSFromEnv():PiperTTSClient {
  return new PiperTTSClient({
    baseUrl:process.env.AI_GURU_PIPER_TTS_BASE_URL ?? 'http://127.0.0.1:8797/',
    apiKey:process.env.AI_GURU_PIPER_TTS_API_KEY,
    timeoutMs:Number(process.env.AI_GURU_PIPER_TTS_TIMEOUT_MS ?? 120000),
    voices:{english:process.env.AI_GURU_PIPER_EN_VOICE ?? '',malayalam:process.env.AI_GURU_PIPER_ML_VOICE ?? ''},
    supportedLanguages:(process.env.AI_GURU_PIPER_LANGUAGES ?? 'english').split(',').map((v)=>v.trim()).filter(Boolean) as Array<'english'|'malayalam'>,
  });
}
