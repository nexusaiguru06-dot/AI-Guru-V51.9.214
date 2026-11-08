import type { CompositionJobResult, CompositionSceneRequest } from '../composition-engine';

export interface HyperFramesClient {
  submit(request: CompositionSceneRequest): Promise<CompositionJobResult>;
}

export interface HttpHyperFramesClientOptions {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class HttpHyperFramesClient implements HyperFramesClient {
  constructor(private readonly options: HttpHyperFramesClientOptions) {}

  async submit(request: CompositionSceneRequest): Promise<CompositionJobResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 120_000);

    try {
      const response = await fetch(new URL('/compose', this.options.baseUrl).toString(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      const raw = await response.text();
      let payload: Partial<CompositionJobResult> & { message?: string } = {};
      try { payload = raw ? JSON.parse(raw) : {}; } catch { /* bridge may return an empty body on failure */ }

      if (!response.ok) {
        throw new Error(payload.error ?? payload.message ?? `HyperFrames bridge returned HTTP ${response.status}`);
      }
      if (!payload.jobId) throw new Error('HyperFrames bridge response is missing jobId');

      return {
        status: payload.status ?? 'queued',
        jobId: payload.jobId,
        assetUri: payload.assetUri,
        previewUri: payload.previewUri,
        error: payload.error,
        metadata: payload.metadata,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
