import type { SpeechSynthesisResult } from '../audio-timing-adapter';
import type { GuruLanguage } from '../scene-contracts';
import type { AIGuruTTSProvider } from '../tts-provider';
import type { SarvamTTSRequest, SarvamTTSResponse } from './SarvamTTSRequest';
export interface SarvamTTSClientOptions { baseUrl:string; apiKey?:string; timeoutMs?:number; speaker?:string; }
export class SarvamTTSClient implements AIGuruTTSProvider {
 readonly id='sarvam' as const;
 readonly displayName='Sarvam TTS';
 constructor(private readonly options:SarvamTTSClientOptions){}
 supports(_language:GuruLanguage):boolean { return true; }
 async isAvailable():Promise<boolean> { return Boolean(this.options.apiKey); }
 async synthesize(input:{text:string;language:GuruLanguage;sceneId:string;outputUri?:string}):Promise<SpeechSynthesisResult>{
  const request:SarvamTTSRequest={text:input.text,language:input.language,speaker:this.options.speaker,outputFormat:'wav'};
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),this.options.timeoutMs??120000);
  try { const response=await fetch(new URL('/synthesize',this.options.baseUrl),{method:'POST',headers:{'content-type':'application/json',...(this.options.apiKey?{authorization:`Bearer ${this.options.apiKey}`}:{})},body:JSON.stringify({...request,sceneId:input.sceneId,outputUri:input.outputUri}),signal:controller.signal});
   if(!response.ok) throw new Error(`Sarvam TTS HTTP ${response.status}`); const data=(await response.json()) as SarvamTTSResponse;
   return {assetUri:data.audioUri,durationMs:data.durationMs,language:input.language,wordTimings:data.wordTimings,provider:'sarvam',metadata:data.requestId?{requestId:data.requestId}:undefined};
  } finally {clearTimeout(timer);}
 }
}
