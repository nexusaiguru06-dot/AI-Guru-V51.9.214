import { NextResponse } from 'next/server';
import { listAgentDefinitions } from '@/lib/ai-guru/runtime/agent-registry';
import { listModels } from '@/lib/ai-guru/model/registry';
import { readRecentAIGuruAudit } from '@/lib/ai-guru/runtime/audit-trail';

export const runtime='nodejs';
export async function GET(request:Request){
  const url=new URL(request.url); const limit=Number(url.searchParams.get('limit')??'50');
  return NextResponse.json({ok:true,agents:listAgentDefinitions(),models:listModels(),audit:readRecentAIGuruAudit(Number.isFinite(limit)?limit:50)});
}
