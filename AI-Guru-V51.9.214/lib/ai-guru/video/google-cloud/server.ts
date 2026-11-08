import { GoogleCloudTTSClient } from './GoogleCloudTTSClient';
export function createGoogleCloudTTSFromEnv():GoogleCloudTTSClient {
  const accessToken=process.env.AI_GURU_GOOGLE_TTS_ACCESS_TOKEN;
  return new GoogleCloudTTSClient({
    baseUrl:process.env.AI_GURU_GOOGLE_TTS_BASE_URL,
    apiKey:process.env.AI_GURU_GOOGLE_TTS_API_KEY,
    accessToken,
    timeoutMs:Number(process.env.AI_GURU_GOOGLE_TTS_TIMEOUT_MS ?? 120000),
    speakingRate:Number(process.env.AI_GURU_GOOGLE_TTS_SPEAKING_RATE ?? 1),
    voices:{english:process.env.AI_GURU_GOOGLE_TTS_EN_VOICE ?? '',malayalam:process.env.AI_GURU_GOOGLE_TTS_ML_VOICE ?? ''},
  });
}
