import { SarvamTTSClient } from './SarvamTTSClient';
export function createSarvamTTSFromEnv():SarvamTTSClient{return new SarvamTTSClient({baseUrl:process.env.AI_GURU_SARVAM_TTS_BASE_URL??'http://127.0.0.1:8795/',apiKey:process.env.SARVAM_API_KEY,timeoutMs:Number(process.env.AI_GURU_SARVAM_TTS_TIMEOUT_MS??120000),speaker:process.env.AI_GURU_SARVAM_TTS_SPEAKER});}
