import type { HttpClient } from './http.js';
import { toQueryParams } from './http.js';

export interface StoryListParams {
  type?: string;
  chain?: string;
  since?: string;
  search?: string;
  limit?: number;
}

export class StoriesModule {
  constructor(private readonly http: HttpClient) {}

  list(params: StoryListParams = {}) {
    const query = toQueryParams(params as Record<string, unknown>);
    return this.http.get<Array<Record<string, unknown>>>('/stories', query ? { query } : {});
  }

  listPublic(params: StoryListParams = {}) {
    return this.list(params);
  }

  getById(params: { storyId: string }) {
    const query = toQueryParams(params as Record<string, unknown>);
    return this.http.post<Record<string, unknown>>('/stories/byId', query ? { query } : {});
  }

  getByIds(params: { ids: string[] }) {
    return this.http.post<Array<Record<string, unknown>>>('/stories/byIds', { body: params });
  }

  getDerived(params: { sourceStoryId: string; limit?: number }) {
    const query = toQueryParams({ source_story_id: params.sourceStoryId, limit: params.limit });
    return this.http.get<Array<Record<string, unknown>>>('/stories/derived', query ? { query } : {});
  }

  getAddresses() {
    return this.http.get<Array<Record<string, unknown>>>('/stories/addresses');
  }

  getTransactions(params: { dataSource?: number; hours?: number } = {}) {
    const query = toQueryParams(params as Record<string, unknown>);
    return this.http.get<Array<Record<string, unknown>>>('/stories/transactions', query ? { query } : {});
  }

  getWatchlist(params: Record<string, string | number | boolean | undefined> = {}) {
    const query = toQueryParams(params);
    return this.http.get<Array<Record<string, unknown>>>('/stories/watchlist', query ? { query } : {});
  }

  getWhale(params: Record<string, string | number | boolean | undefined> = {}) {
    const query = toQueryParams(params);
    return this.http.get<Array<Record<string, unknown>>>('/stories/whale', query ? { query } : {});
  }
}
