import type { HttpClient } from './http.js';
import { toQueryParams } from './http.js';

export class TokensModule {
  constructor(private readonly http: HttpClient) {}

  fetchTokensDB(params: { dataSource: number; search?: string; limit?: number; offset?: number }) {
    const query = toQueryParams(params as Record<string, unknown>);
    return this.http.get<Array<Record<string, unknown>>>('/fetchTokensDB', query ? { query } : {});
  }

  fetchTransactionsDB(params: { dataSource: number; limit: number; startTime?: string; endTime?: string; params?: string; search?: string }) {
    const query = toQueryParams(params as Record<string, unknown>);
    return this.http.get<Array<Record<string, unknown>>>('/fetchTransactionsDB', query ? { query } : {});
  }

  fetchNFTsDB(params: { dataSource: number; search?: string; limit?: number }) {
    const query = toQueryParams(params as Record<string, unknown>);
    return this.http.get<Array<Record<string, unknown>>>('/fetchNFTsDB', query ? { query } : {});
  }

  getTokenInfoJson(params: { chain: string; address: string }) {
    const query = toQueryParams(params as Record<string, unknown>);
    return this.http.get<Record<string, unknown>>('/getTokenInfoJson', query ? { query } : {});
  }

  getTokenPricesWithHistoryAllRanges() {
    return this.http.get<Record<string, unknown>>('/fetchTokenPricesWithHistoryAllRanges');
  }

  getTokenProfile(address: string, params: { chain?: string } = {}) {
    const query = toQueryParams(params as Record<string, unknown>);
    return this.http.get<Record<string, unknown>>(`/token/${encodeURIComponent(address)}`, query ? { query } : {});
  }

  async getTokenStories(address: string, params: { chain?: string } = {}) {
    const profile = await this.getTokenProfile(address, params);
    return (profile.stories as Array<Record<string, unknown>>) || [];
  }

  async getTokenTheses(address: string, params: { chain?: string } = {}) {
    const profile = await this.getTokenProfile(address, params);
    return (profile.theses as Array<Record<string, unknown>>) || [];
  }

  async getTokenNarrativeFlow(address: string, params: { chain?: string } = {}) {
    const profile = await this.getTokenProfile(address, params);
    return (profile.narrativeFlow as Record<string, unknown>) || null;
  }
}
