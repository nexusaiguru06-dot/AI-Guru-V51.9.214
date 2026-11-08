import type { LTXExtendRequest, LTXJobResult, LTXRequest, LTXRetakeRequest } from './LTXRequest';

export interface LTXClientConfig {
  /** URL of the AI Guru LTX-2 bridge, not a hard-coded vendor endpoint. */
  baseUrl: string;
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface LTXClient {
  submit(request: LTXRequest): Promise<LTXJobResult>;
  retake(request: LTXRetakeRequest): Promise<LTXJobResult>;
  extend(request: LTXExtendRequest): Promise<LTXJobResult>;
}

export class HttpLTX2Client implements LTXClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly config: LTXClientConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 120_000;
  }

  submit(request: LTXRequest): Promise<LTXJobResult> {
    return this.post('/generate', request);
  }

  retake(request: LTXRetakeRequest): Promise<LTXJobResult> {
    return this.post('/retake', request);
  }

  extend(request: LTXExtendRequest): Promise<LTXJobResult> {
    return this.post('/extend', request);
  }

  private async post(path: string, request: LTXRequest): Promise<LTXJobResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(new URL(path.replace(/^\//, ''), ensureTrailingSlash(this.config.baseUrl)), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({ ...request, model: request.model ?? this.config.model }),
        signal: controller.signal,
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`LTX-2 bridge ${response.status}: ${body?.error ?? response.statusText}`);
      }

      if (!body?.jobId || !body?.status) {
        throw new Error('Invalid LTX-2 bridge response: expected jobId and status');
      }

      return body as LTXJobResult;
    } finally {
      clearTimeout(timer);
    }
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
