import type { HttpClient } from './http.js';

export class DiscoveryModule {
  constructor(private readonly http: HttpClient) {}

  getOpenApi() {
    return this.http.get<Record<string, unknown>>('/openapi', { raw: true });
  }

  getRate() {
    return this.http.get<{ rate: number }>('/rate');
  }

  getNewsletter() {
    return this.http.get<string>('/getNewsletter', { raw: true });
  }
}
