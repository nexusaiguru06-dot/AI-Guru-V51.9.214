import type { SpeechSynthesisResult } from '../audio-timing-adapter';
import type { GuruLanguage } from '../scene-contracts';
import type { AIGuruTTSProvider } from '../tts-provider';
import type { EdgeTTSRequest, EdgeTTSResponse } from './EdgeTTSRequest';

export interface EdgeTTSClientOptions { baseUrl:string; apiKey?:string; timeoutMs?:number; voices?:Partial<Record<GuruLanguage,string>>; }

export class EdgeTTSClient implements AIGuruTTSProvider {
  readonly id = 'edge' as const;
  readonly displayName = 'Microsoft Edge TTS';
  constructor(private readonly options:EdgeTTSClientOptions) {}
  supports(_language:GuruLanguage):boolean { return true; }
  async isAvailable():Promise<boolean> { try { const r=await fetch(new URL('/health',this.options.baseUrl)); return r.ok; } catch { return false; } }
  async synthesize(input:{text:string;language:GuruLanguage;sceneId:string;outputUri?:string}):Promise<SpeechSynthesisResult> {
    const request:EdgeTTSRequest={text:input.text,language:input.language,voice:this.options.voices?.[input.language],outputUri:input.outputUri,sceneId:input.sceneId};
    return this.post(request);
  }
  private async post(request:EdgeTTSRequest):Promise<SpeechSynthesisResult> {
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),this.options.timeoutMs??120000);
    try {
      const response=await fetch(new URL('/synthesize',this.options.baseUrl),{method:'POST',headers:{'content-type':'application/json',...(this.options.apiKey?{authorization:`Bearer ${this.options.apiKey}`}:{})},body:JSON.stringify(request),signal:controller.signal});
      if(!response.ok) throw new Error(`Edge TTS HTTP ${response.status}`);
      const data=(await response.json()) as EdgeTTSResponse;
      return {assetUri:data.audioUri,durationMs:data.durationMs,language:request.language,wordTimings:data.wordTimings,provider:'edge',metadata:data.requestId?{requestId:data.requestId}:undefined};
    } finally { clearTimeout(timer); }
  }
}
