import type { SpeechSynthesisResult } from '../audio-timing-adapter';
import type { GuruLanguage } from '../scene-contracts';
import type { AIGuruTTSProvider } from '../tts-provider';
import type { PiperTTSRequest, PiperTTSResponse } from './PiperTTSRequest';

export interface PiperTTSClientOptions { baseUrl:string; apiKey?:string; timeoutMs?:number; voices?:Partial<Record<GuruLanguage,string>>; supportedLanguages?:GuruLanguage[]; }
export class PiperTTSClient implements AIGuruTTSProvider {
  readonly id='piper' as const;
  readonly displayName='Piper TTS';
  constructor(private readonly options:PiperTTSClientOptions){ }
  supports(language:GuruLanguage):boolean { return (this.options.supportedLanguages ?? ['english']).includes(language); }
  async isAvailable():Promise<boolean> { try { const r=await fetch(new URL('/health',this.options.baseUrl)); return r.ok; } catch { return false; } }
  async synthesize(input:{text:string;language:GuruLanguage;sceneId:string;outputUri?:string}):Promise<SpeechSynthesisResult> {
    if(!this.supports(input.language)) throw new Error(`Piper does not support ${input.language}`);
    const request:PiperTTSRequest={text:input.text,language:input.language,voice:this.options.voices?.[input.language],outputUri:input.outputUri,sceneId:input.sceneId};
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),this.options.timeoutMs??120000);
    try {
      const response=await fetch(new URL('/synthesize',this.options.baseUrl),{method:'POST',headers:{'content-type':'application/json',...(this.options.apiKey?{authorization:`Bearer ${this.options.apiKey}`}:{})},body:JSON.stringify(request),signal:controller.signal});
      if(!response.ok) throw new Error(`Piper TTS HTTP ${response.status}`);
      const data=(await response.json()) as PiperTTSResponse;
      return {assetUri:data.audioUri,durationMs:data.durationMs,language:input.language,wordTimings:data.wordTimings,provider:'piper',metadata:data.requestId?{requestId:data.requestId}:undefined};
    } finally { clearTimeout(timer); }
  }
}
