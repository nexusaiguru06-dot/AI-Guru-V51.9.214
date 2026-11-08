import type { GuruLanguage } from './scene-contracts';
import type { SpeechSynthesisResult, SpeechTimingEngine } from './audio-timing-adapter';

export type AIGuruTTSProviderId = 'sarvam' | 'google-cloud' | 'edge' | 'piper';

export interface AIGuruTTSRequest {
  text: string;
  language: GuruLanguage;
  sceneId: string;
  outputUri?: string;
}

export interface AIGuruTTSProvider extends SpeechTimingEngine {
  readonly id: AIGuruTTSProviderId;
  readonly displayName: string;
  supports(language: GuruLanguage): boolean;
  /** Optional lightweight health probe. Failure means the manager may try the next provider. */
  isAvailable?(): Promise<boolean>;
}

export interface TTSProviderOrderOptions {
  language: GuruLanguage;
  preferOffline?: boolean;
  preferredProvider?: AIGuruTTSProviderId;
}

export interface TTSManagerOptions {
  providers: AIGuruTTSProvider[];
  malayalamOrder?: AIGuruTTSProviderId[];
  englishOrder?: AIGuruTTSProviderId[];
  offlineEnglishOrder?: AIGuruTTSProviderId[];
  strictProviderFailure?: boolean;
}

export interface TTSSelectionTrace {
  requestedLanguage: GuruLanguage;
  attempted: AIGuruTTSProviderId[];
  selected?: AIGuruTTSProviderId;
}

export interface TTSManagerResult extends SpeechSynthesisResult {
  selection: TTSSelectionTrace;
}

export class AIGuruTTSManager implements SpeechTimingEngine {
  private readonly providers: Map<AIGuruTTSProviderId, AIGuruTTSProvider>;
  private readonly options: Required<Pick<TTSManagerOptions, 'malayalamOrder' | 'englishOrder' | 'offlineEnglishOrder'>> &
    Pick<TTSManagerOptions, 'strictProviderFailure'>;

  constructor(options: TTSManagerOptions) {
    this.providers = new Map(options.providers.map((provider) => [provider.id, provider]));
    this.options = {
      malayalamOrder: options.malayalamOrder ?? ['sarvam', 'google-cloud', 'edge'],
      englishOrder: options.englishOrder ?? ['sarvam', 'google-cloud', 'edge', 'piper'],
      offlineEnglishOrder: options.offlineEnglishOrder ?? ['piper', 'sarvam', 'google-cloud', 'edge'],
      strictProviderFailure: options.strictProviderFailure ?? false,
    };
  }

  getOrder(options: TTSProviderOrderOptions): AIGuruTTSProviderId[] {
    if (options.preferredProvider) {
      return [options.preferredProvider, ...this.baseOrder(options.language, options.preferOffline)
        .filter((id) => id !== options.preferredProvider)];
    }
    return this.baseOrder(options.language, options.preferOffline);
  }

  private baseOrder(language: GuruLanguage, preferOffline = false): AIGuruTTSProviderId[] {
    if (language === 'malayalam') return [...this.options.malayalamOrder];
    return [...(preferOffline ? this.options.offlineEnglishOrder : this.options.englishOrder)];
  }

  async synthesize(input: AIGuruTTSRequest): Promise<TTSManagerResult> {
    const order = this.getOrder({ language: input.language });
    return this.synthesizeWithOrder(input, order);
  }

  async synthesizeWithPreferences(input: AIGuruTTSRequest, options: Omit<TTSProviderOrderOptions, 'language'> = {}): Promise<TTSManagerResult> {
    return this.synthesizeWithOrder(input, this.getOrder({ ...options, language: input.language }));
  }

  private async synthesizeWithOrder(input: AIGuruTTSRequest, order: AIGuruTTSProviderId[]): Promise<TTSManagerResult> {
    const attempted: AIGuruTTSProviderId[] = [];
    const failures: string[] = [];

    for (const id of order) {
      const provider = this.providers.get(id);
      if (!provider || !provider.supports(input.language)) continue;
      attempted.push(id);
      try {
        if (provider.isAvailable && !(await provider.isAvailable())) {
          failures.push(`${id}: unavailable`);
          continue;
        }
        const result = await provider.synthesize(input);
        return {
          ...result,
          selection: { requestedLanguage: input.language, attempted, selected: id },
          metadata: {
            ...(result.metadata ?? {}),
            ttsSelectionOrder: attempted.join(','),
          },
        };
      } catch (error) {
        failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`);
        if (this.options.strictProviderFailure) throw error;
      }
    }

    throw new Error(`No TTS provider succeeded for ${input.language}. Attempts: ${failures.join(' | ') || 'none configured'}`);
  }
}
