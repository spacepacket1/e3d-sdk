import type { HttpClient } from './http.js';

export class ThesesModule {
  constructor(private readonly http: HttpClient) {}

  list(params: { status?: string; limit?: number } = {}) {
    return this.http.get<{ theses: Array<Record<string, unknown>>; count?: number }>('/theses', { query: params });
  }

  getCandidates(params: Record<string, string | number | boolean | undefined> = {}) {
    return this.http.get<Array<Record<string, unknown>>>('/agent/candidates', { query: params });
  }

  getAnnotations(params: Record<string, string | number | boolean | undefined> = {}) {
    return this.http.get<Array<Record<string, unknown>>>('/thesis/annotations', { query: params });
  }
}
