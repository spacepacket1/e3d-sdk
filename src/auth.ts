import type { HttpClient } from './http.js';

export class AuthModule {
  constructor(private readonly http: HttpClient) {}

  listApiKeys() {
    return this.http.get<Record<string, unknown>>('/keys');
  }

  createApiKey(body: Record<string, unknown> = {}) {
    return this.http.post<Record<string, unknown>>('/keys', { body });
  }

  revokeApiKey(id: string) {
    return this.http.post<Record<string, unknown>>(`/keys/${encodeURIComponent(id)}/revoke`);
  }
}
