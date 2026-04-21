export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | QueryValue[]>;

export interface E3DClientOptions {
  baseUrl?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  userAgent?: string;
}

export interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  raw?: boolean;
}

export interface ApiResponseMeta {
  status: number;
  url: string;
  contentType: string;
}

export interface ApiResult<T> {
  data: T;
  meta: ApiResponseMeta;
}

export interface E3DTokenRef {
  symbol: string;
  address: string;
  decimals: number;
  name?: string;
  logo?: string;
  isNative?: boolean;
}

export interface SwapQuoteInput {
  inputToken?: E3DTokenRef | string;
  outputToken?: E3DTokenRef | string;
  amountIn: string | number | bigint;
  expectedAmountOut?: string | number | bigint;
  slippageBps?: number;
  deadlineMinutes?: number;
  routerVersion?: 2 | 3;
}

export interface E3DProviderLike {
  getSigner?: () => E3DSignerLike;
  getBalance?: (address: string) => Promise<unknown>;
  estimateGas?: (tx: Record<string, unknown>) => Promise<unknown>;
  getFeeData?: () => Promise<Record<string, unknown>>;
  waitForTransaction?: (txHash: string) => Promise<unknown>;
}

export interface E3DSignerLike {
  getAddress?: () => Promise<string>;
}

export interface SwapExecutionContext {
  provider: E3DProviderLike;
  walletAddress: string;
  signer?: E3DSignerLike;
}
