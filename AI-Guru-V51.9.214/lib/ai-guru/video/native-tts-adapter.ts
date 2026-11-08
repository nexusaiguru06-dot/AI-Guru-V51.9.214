import { edgeTTS, googleCloudTTS, piperTTS, sarvamTTS } from '@/lib/ai-guru/tts/providers';
import { mergeProviderWordTimings } from '@/lib/ai-guru/sync/tts-word-timing';
import type { SpeechSynthesisResult } from './audio-timing-adapter';
import type { GuruLanguage } from './scene-contracts';
import type { AIGuruTTSProvider } from './tts-provider';

function languageCode(language: GuruLanguage): string {
  return language === 'malayalam' ? 'ml-IN' : 'en-IN';
}

function toResult(input: { text: string; language: GuruLanguage; sceneId: string }, result: Awaited<ReturnType<typeof edgeTTS>>): SpeechSynthesisResult {
  const words = mergeProviderWordTimings(input.text, result.durationMs ?? 0, result.words);
  const audioMime = result.format === 'wav' ? 'audio/wav' : 'audio/mpeg';
  return {
    assetUri: `data:${audioMime};base64,${result.audioBase64}`,
    durationMs: result.durationMs ?? 0,
    language: input.language,
    wordTimings: words.map(({ word, startMs, endMs }) => ({ word, startMs, endMs })),
    provider: result.provider,
    metadata: { sceneId: input.sceneId, timingSource: result.words?.length ? 'provider' : 'measured-audio' },
  };
}

abstract class NativeProvider implements AIGuruTTSProvider {
  abstract readonly id: 'sarvam' | 'google-cloud' | 'edge' | 'piper';
  abstract readonly displayName: string;
  supports(language: GuruLanguage): boolean { return this.id !== 'piper' || language === 'english'; }
  abstract isAvailable(): Promise<boolean>;
  abstract synthesize(input: { text: string; language: GuruLanguage; sceneId: string }): Promise<SpeechSynthesisResult>;
}

export class NativeSarvamTTSProvider extends NativeProvider {
  readonly id = 'sarvam' as const;
  readonly displayName = 'Sarvam TTS';
  async isAvailable() { return Boolean(process.env.SARVAM_API_KEY); }
  async synthesize(input: { text: string; language: GuruLanguage; sceneId: string }) {
    return toResult(input, await sarvamTTS({ text: input.text, languageCode: languageCode(input.language) }));
  }
}

export class NativeGoogleCloudTTSProvider extends NativeProvider {
  readonly id = 'google-cloud' as const;
  readonly displayName = 'Google Cloud TTS';
  async isAvailable() {
    return Boolean(process.env.GOOGLE_CLOUD_TTS_API_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT);
  }
  async synthesize(input: { text: string; language: GuruLanguage; sceneId: string }) {
    return toResult(input, await googleCloudTTS({ text: input.text, languageCode: languageCode(input.language) }));
  }
}

export class NativeEdgeTTSProvider extends NativeProvider {
  readonly id = 'edge' as const;
  readonly displayName = 'Microsoft Edge TTS';
  async isAvailable() { return true; }
  async synthesize(input: { text: string; language: GuruLanguage; sceneId: string }) {
    return toResult(input, await edgeTTS({ text: input.text, languageCode: languageCode(input.language) }));
  }
}

export class NativePiperTTSProvider extends NativeProvider {
  readonly id = 'piper' as const;
  readonly displayName = 'Piper TTS';
  async isAvailable() { return true; }
  async synthesize(input: { text: string; language: GuruLanguage; sceneId: string }) {
    return toResult(input, await piperTTS({ text: input.text, languageCode: languageCode(input.language) }));
  }
}
