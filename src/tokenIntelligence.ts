import type { HttpClient } from './http.js';
import { toQueryParams } from './http.js';

export class TokenIntelligenceModule {
  constructor(private readonly http: HttpClient) {}

  getCategoryTokensLastHour(params: { category?: string } = {}) {
    const query = toQueryParams(params.category ? { category: params.category } : undefined);
    return this.http.get<Array<Record<string, unknown>>>('/categoryTokensLastHour', query ? { query } : {});
  }

  getTokenCounterparties(params: { token: string; startTime?: string; endTime?: string; limit?: number }) {
    const query = toQueryParams(params);
    return this.http.get<Array<Record<string, unknown>>>('/tokenCounterparties', query ? { query } : {});
  }

  getAddressCounterparties(params: { address: string; startTime?: string; endTime?: string; limit?: number }) {
    const query = toQueryParams(params);
    return this.http.get<Array<Record<string, unknown>>>('/addressCounterparties', query ? { query } : {});
  }

  getAddressMetaBatch(params: { addresses: string[] }) {
    return this.http.post<Record<string, unknown>>('/addressMetaBatch', { body: params });
  }
}
