import type { GuruLanguage } from '../scene-contracts';
export interface PiperTTSRequest { text:string; language:GuruLanguage; voice?:string; outputUri?:string; sceneId?:string; }
export interface PiperWordTiming { word:string; startMs:number; endMs:number; tokenIndex?:number; }
export interface PiperTTSResponse { audioUri:string; durationMs:number; wordTimings:PiperWordTiming[]; requestId?:string; }
