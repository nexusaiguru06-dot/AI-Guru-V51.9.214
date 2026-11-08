import type { GuruLanguage } from '../scene-contracts';
export interface GoogleCloudTTSRequest { text:string; language:GuruLanguage; voice?:string; speakingRate?:number; outputUri?:string; sceneId?:string; }
export interface GoogleCloudTimepoint { markName:string; timeSeconds:number; }
export interface GoogleCloudTTSResponse { audioContent:string; timepoints?:GoogleCloudTimepoint[]; requestId?:string; }
