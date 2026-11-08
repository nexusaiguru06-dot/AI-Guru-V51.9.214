import { AIGuruTTSManager } from './tts-provider';
import { NativeEdgeTTSProvider, NativeGoogleCloudTTSProvider, NativePiperTTSProvider, NativeSarvamTTSProvider } from './native-tts-adapter';

/**
 * Unified AI Guru TTS manager. It reuses the application's existing server-side
 * TTS implementations instead of creating a second TTS stack.
 */
export function createAIGuruTTSManagerFromEnv(): AIGuruTTSManager {
  return new AIGuruTTSManager({
    providers: [
      new NativeSarvamTTSProvider(),
      new NativeGoogleCloudTTSProvider(),
      new NativeEdgeTTSProvider(),
      new NativePiperTTSProvider(),
    ],
    malayalamOrder: ['sarvam', 'google-cloud', 'edge'],
    englishOrder: ['sarvam', 'google-cloud', 'edge', 'piper'],
    offlineEnglishOrder: ['piper', 'sarvam', 'google-cloud', 'edge'],
  });
}
