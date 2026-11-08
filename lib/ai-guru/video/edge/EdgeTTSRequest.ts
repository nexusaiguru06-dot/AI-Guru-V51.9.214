import type { GuruLanguage } from '../scene-contracts';
export interface EdgeTTSRequest { text:string; language:GuruLanguage; voice?:string; outputUri?:string; sceneId?:string; }
export interface EdgeWordTiming { word:string; startMs:number; endMs:number; tokenIndex?:number; }
export interface EdgeTTSResponse { audioUri:string; durationMs:number; wordTimings:EdgeWordTiming[]; requestId?:string; }
