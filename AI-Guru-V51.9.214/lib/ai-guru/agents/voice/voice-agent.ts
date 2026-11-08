import { ids, type AgentRequest, type AgentResult, type Language, type Lesson, type Paragraph, type VoiceArtifact } from '../../contracts';
import { alignCuesToWords, buildWordCues } from '../../cues/engine';
import type { TTSRequest, TTSResult } from '../../tts/providers';

export interface VoiceProvider { synthesize(input: TTSRequest): Promise<TTSResult>; }
export interface VoiceAgentInput { lesson: Lesson; paragraphId?: string; synthesize?: boolean; providers?: Partial<Record<Language, VoiceProvider>>; }
export interface VoiceAgentOutput { lesson: Lesson; paragraphIds: string[]; }

/** Voice is paragraph-scoped. It never invents word timings: alignment is marked pending
 * unless the configured provider/aligner returns actual word boundaries. */
export class VoiceAgent {
  readonly name = 'voice' as const;

  async execute(request: AgentRequest<VoiceAgentInput>): Promise<AgentResult<VoiceAgentOutput>> {
    const target = request.input.paragraphId;
    const paragraphs: Paragraph[] = [];
    for (const p of request.input.lesson.paragraphs) {
      if (target && p.id !== target) { paragraphs.push(p); continue; }
      paragraphs.push(await this.processParagraph(p, request.input));
    }
    return { ok: true, agent: 'voice', runId: request.context.runId, output: { lesson: { ...request.input.lesson, paragraphs }, paragraphIds: paragraphs.filter(p => !target || p.id === target).map(p => p.id) } };
  }

  private async processParagraph(p: Paragraph, input: VoiceAgentInput): Promise<Paragraph> {
    let voice = { ...(p.voice ?? {}) };
    for (const language of ['english', 'malayalam'] as const) {
      const provider = input.providers?.[language];
      if (input.synthesize && provider) {
        const result = await provider.synthesize({ text: p.explanation[language], languageCode: language === 'english' ? 'en-IN' : 'ml-IN' });
        voice[language] = artifactFromResult(language, result);
      } else if (!voice[language]) {
        voice[language] = { provider: 'pending', language, alignment: 'pending' };
      }
    }
    const cues = p.audioCues.map(c => ({ ...c }));
    for (const language of ['english', 'malayalam'] as const) {
      const artifact = voice[language];
      if (artifact?.words?.length) {
        const aligned = alignCuesToWords(cues.filter(c => c.language === language), artifact.words);
        for (const cue of aligned) {
          const idx = cues.findIndex(c => c.id === cue.id);
          if (idx >= 0) cues[idx] = cue;
        }
      }
    }
    return { ...p, voice, audioCues: cues };
  }
}

function artifactFromResult(language: Language, result: TTSResult): VoiceArtifact {
  const words = result.words?.length ? buildWordCues('', result.words.map(w => ({ word: w.word, startMs: w.startMs, endMs: w.endMs }))) : undefined;
  return { provider: result.provider, language, audioId: undefined, durationMs: result.durationMs, words, alignment: words?.length ? 'word' : 'pending' };
}
