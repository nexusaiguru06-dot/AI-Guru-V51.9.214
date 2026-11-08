import type { MathEngineClient } from './math-engine-adapter';

interface MathEngineServerResponse {
  render: MathEngineClient['render'];
}

export interface MathEngineHttpClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class HttpMathEngineClient implements MathEngineClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MathEngineHttpClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.AI_GURU_MATH_ENGINE_BASE_URL ?? 'http://127.0.0.1:8770/').replace(/\/$/, '');
    this.apiKey = options.apiKey ?? process.env.AI_GURU_MATH_ENGINE_API_KEY;
    this.timeoutMs = options.timeoutMs ?? Number(process.env.AI_GURU_MATH_ENGINE_TIMEOUT_MS ?? 120000);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async render(request: Parameters<MathEngineServerResponse['render']>[0]): ReturnType<MathEngineServerResponse['render']> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/render`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      const body = await response.json() as unknown;
      if (!response.ok) throw new Error(`Math Engine request failed (${response.status}): ${JSON.stringify(body)}`);
      return body as Awaited<ReturnType<MathEngineServerResponse['render']>>;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createMathEngineClientFromEnv(): HttpMathEngineClient {
  return new HttpMathEngineClient();
}
