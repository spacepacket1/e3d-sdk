import { createHttpError, createNetworkError } from './errors.js';
import { normalizeValue } from './normalize.js';
import type { E3DClientOptions, QueryParams, RequestOptions } from './types.js';

function joinBaseUrl(baseUrl: string, path: string): string {
  const cleanBase = String(baseUrl || '').replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

export function toQueryParams(input: Record<string, unknown> | undefined): QueryParams | undefined {
  if (!input) return undefined;
  const out: QueryParams = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    out[key] = value as QueryParams[string];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function buildQueryString(query?: QueryParams): string {
  if (!query) return '';
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) continue;
        params.append(key, String(item));
      }
      continue;
    }
    params.set(key, String(value));
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly apiKeyHeader: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string | undefined;

  constructor(options: E3DClientOptions = {}) {
    this.baseUrl = String(options.baseUrl || process.env.E3D_BASE_URL || 'https://e3d.ai/api').replace(/\/+$/, '');
    this.apiKey = options.apiKey || process.env.E3D_API_KEY;
    this.apiKeyHeader = String(options.apiKeyHeader || process.env.E3D_API_KEY_HEADER || 'x-api-key');
    this.timeoutMs = options.timeoutMs || Number(process.env.E3D_TIMEOUT_MS || 0) || 0;
    this.fetchImpl = options.fetchImpl || globalThis.fetch.bind(globalThis);
    this.userAgent = options.userAgent || 'e3d-sdk/0.1.0';
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${joinBaseUrl(this.baseUrl, path)}${buildQueryString(options.query)}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(this.userAgent ? { 'User-Agent': this.userAgent } : {}),
      ...(this.apiKey ? { [this.apiKeyHeader]: this.apiKey } : {}),
      ...(options.headers || {}),
    };

    let body: BodyInit | null | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    const controller = options.signal ? null : new AbortController();
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const timer = controller && timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const init: RequestInit = { method, headers };
      if (body !== undefined) init.body = body;
      if (options.signal) {
        init.signal = options.signal;
      } else if (controller) {
        init.signal = controller.signal;
      }

      const response = await this.fetchImpl(url, init);

      const payload = await readResponseBody(response);

      if (!response.ok) {
        const status = response.status;
        const message = typeof payload === 'string'
          ? payload
          : (payload && typeof payload === 'object' && 'message' in payload && typeof (payload as { message?: unknown }).message === 'string')
            ? String((payload as { message?: unknown }).message)
            : `Request failed with status ${status}`;
        throw createHttpError(status, message, path, payload);
      }

      if (payload === null || payload === undefined) {
        return null as T;
      }

      if (options.raw) {
        return payload as T;
      }

      return normalizeValue(payload) as T;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && (error as { name?: string }).name === 'E3DError') {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw createNetworkError(`Request timed out after ${timeoutMs}ms`, path, error.message);
      }

      const message = error instanceof Error ? error.message : String(error);
      throw createNetworkError(message, path, error);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, options);
  }

  put<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PUT', path, options);
  }

  delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }
}

export { buildQueryString, joinBaseUrl, readResponseBody };
