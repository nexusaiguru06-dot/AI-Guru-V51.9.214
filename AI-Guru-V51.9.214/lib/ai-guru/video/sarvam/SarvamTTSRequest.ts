import type { GuruLanguage } from '../scene-contracts';
export interface SarvamTTSRequest { text:string; language:GuruLanguage; speaker?:string; outputFormat?:'wav'|'mp3'; }
export interface SarvamWordTimestamp { word:string; startMs:number; endMs:number; tokenIndex?:number; }
export interface SarvamTTSResponse { audioUri:string; durationMs:number; wordTimings:SarvamWordTimestamp[]; requestId?:string; }
