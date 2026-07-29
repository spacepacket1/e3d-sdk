import type { HttpClient } from './http.js';
import { toQueryParams } from './http.js';
import { stripUndefined } from './normalize.js';

export type WebhookEventType = 'story.created' | 'thesis.corroborated' | 'token.event';
export type WebhookSubscriptionStatus = 'active' | 'paused' | 'disabled';

export interface WebhookFilter {
  tokenAddresses?: string[];
  patternIds?: string[];
  thesisIds?: string[];
  minCorroborations?: number;
}

export interface CreateWebhookSubscriptionInput {
  url: string;
  events: WebhookEventType[];
  filter?: WebhookFilter;
  description?: string;
}

export interface UpdateWebhookSubscriptionInput {
  url?: string;
  events?: WebhookEventType[];
  filter?: WebhookFilter | null;
  description?: string | null;
  status?: WebhookSubscriptionStatus;
}

export interface WebhookSubscription {
  id: string;
  url: string;
  events: WebhookEventType[];
  filter?: WebhookFilter | null;
  status: WebhookSubscriptionStatus;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookSubscriptionResult {
  subscription: WebhookSubscription;
  signingSecret: string;
}

export interface RotateWebhookSecretResult {
  subscriptionId: string;
  signingSecret: string;
}

export interface ListWebhookSubscriptionsParams {
  cursor?: string;
  limit?: number;
  status?: WebhookSubscriptionStatus;
}

export interface ListWebhookSubscriptionsResult {
  data: WebhookSubscription[];
  nextCursor?: string | null;
}

export interface WebhookEvent<TType extends WebhookEventType, TData> {
  id: string;
  type: TType;
  createdAt: string;
  subscriptionId: string;
  deliveryAttempt: number;
  data: TData;
}

export interface StoryCreatedWebhookData {
  storyId: string;
  payload: Record<string, unknown>;
}

export interface ThesisCorroboratedWebhookData {
  thesisId: string;
  corroborationCount: number;
  payload: Record<string, unknown>;
}

export interface TokenEventWebhookData {
  tokenAddress: string;
  patternId: string;
  payload: Record<string, unknown>;
}

export type StoryCreatedWebhookEvent = WebhookEvent<'story.created', StoryCreatedWebhookData>;
export type ThesisCorroboratedWebhookEvent = WebhookEvent<'thesis.corroborated', ThesisCorroboratedWebhookData>;
export type TokenWebhookEvent = WebhookEvent<'token.event', TokenEventWebhookData>;
export type E3DWebhookEvent =
  | StoryCreatedWebhookEvent
  | ThesisCorroboratedWebhookEvent
  | TokenWebhookEvent;

export interface WebhookDeliveryHeaders {
  eventId: string;
  timestamp: string;
  signature: string;
  deliveryAttempt: string;
}

export const E3D_WEBHOOK_EVENT_ID_HEADER = 'e3d-event-id';
export const E3D_WEBHOOK_TIMESTAMP_HEADER = 'e3d-webhook-timestamp';
export const E3D_WEBHOOK_SIGNATURE_HEADER = 'e3d-webhook-signature';
export const E3D_WEBHOOK_DELIVERY_ATTEMPT_HEADER = 'e3d-delivery-attempt';

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer`);
  }
  if (value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function assertHttpsUrl(url: string, name = 'url'): void {
  if (typeof url !== 'string') {
    throw new TypeError(`${name} must be a string`);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new TypeError(`${name} must be a valid https URL`);
  }

  if (parsed.protocol !== 'https:') {
    throw new TypeError(`${name} must use https:`);
  }
}

function assertNonEmptyEvents(events: WebhookEventType[] | undefined, name = 'events'): void {
  if (!Array.isArray(events) || events.length === 0) {
    throw new TypeError(`${name} must be a non-empty array`);
  }
}

function serializeFilter(filter: WebhookFilter | null | undefined): Record<string, unknown> | null | undefined {
  if (filter === undefined) return undefined;
  if (filter === null) return null;

  if (filter.minCorroborations !== undefined) {
    assertPositiveInteger(filter.minCorroborations, 'filter.minCorroborations');
  }

  return stripUndefined({
    token_addresses: filter.tokenAddresses,
    pattern_ids: filter.patternIds,
    thesis_ids: filter.thesisIds,
    min_corroborations: filter.minCorroborations,
  });
}

function buildSubscriptionBody(input: CreateWebhookSubscriptionInput | UpdateWebhookSubscriptionInput): Record<string, unknown> {
  const body = stripUndefined({
    url: input.url,
    events: input.events,
    filter: serializeFilter(input.filter),
    description: input.description,
    status: 'status' in input ? input.status : undefined,
  });
  return body as Record<string, unknown>;
}

function encodeSubscriptionId(subscriptionId: string): string {
  return encodeURIComponent(subscriptionId);
}

export class WebhooksModule {
  constructor(private readonly http: HttpClient) {}

  create(input: CreateWebhookSubscriptionInput) {
    assertHttpsUrl(input.url);
    assertNonEmptyEvents(input.events);
    const body = buildSubscriptionBody(input);
    return this.http.post<CreateWebhookSubscriptionResult>('/webhooks/subscriptions', { body });
  }

  list(params: ListWebhookSubscriptionsParams = {}) {
    if (params.limit !== undefined) {
      assertPositiveInteger(params.limit, 'limit');
    }

    const query = toQueryParams({
      cursor: params.cursor,
      limit: params.limit,
      status: params.status,
    });

    return this.http.get<ListWebhookSubscriptionsResult>('/webhooks/subscriptions', query ? { query } : {});
  }

  getById(subscriptionId: string) {
    return this.http.get<WebhookSubscription>(`/webhooks/subscriptions/${encodeSubscriptionId(subscriptionId)}`);
  }

  update(subscriptionId: string, input: UpdateWebhookSubscriptionInput) {
    if (input.url !== undefined) {
      assertHttpsUrl(input.url);
    }
    if (input.events !== undefined) {
      assertNonEmptyEvents(input.events);
    }
    if (input.filter !== null && input.filter !== undefined && input.filter.minCorroborations !== undefined) {
      assertPositiveInteger(input.filter.minCorroborations, 'filter.minCorroborations');
    }

    const body = buildSubscriptionBody(input);
    return this.http.request<WebhookSubscription>('PATCH', `/webhooks/subscriptions/${encodeSubscriptionId(subscriptionId)}`, { body });
  }

  rotateSecret(subscriptionId: string) {
    return this.http.post<RotateWebhookSecretResult>(`/webhooks/subscriptions/${encodeSubscriptionId(subscriptionId)}/rotate-secret`);
  }

  async delete(subscriptionId: string): Promise<void> {
    await this.http.delete<void>(`/webhooks/subscriptions/${encodeSubscriptionId(subscriptionId)}`);
  }
}
