export type E3DErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID'
  | 'NOT_FOUND'
  | 'RATE_LIMIT'
  | 'BAD_REQUEST'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'SWAP_ERROR';

export class E3DError extends Error {
  code: E3DErrorCode;
  status?: number;
  endpoint?: string;
  details?: unknown;

  constructor(message: string, code: E3DErrorCode, options: { status?: number; endpoint?: string; details?: unknown } = {}) {
    super(message);
    this.name = 'E3DError';
    this.code = code;
    if (options.status !== undefined) this.status = options.status;
    if (options.endpoint !== undefined) this.endpoint = options.endpoint;
    if (options.details !== undefined) this.details = options.details;
  }
}

function mapStatusToCode(status: number): E3DErrorCode {
  if (status === 401) return 'AUTH_INVALID';
  if (status === 403) return 'AUTH_REQUIRED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMIT';
  if (status >= 400 && status < 500) return 'BAD_REQUEST';
  if (status >= 500) return 'SERVER_ERROR';
  return 'NETWORK_ERROR';
}

export function createHttpError(status: number, message: string, endpoint?: string, details?: unknown): E3DError {
  const options: { status?: number; endpoint?: string; details?: unknown } = { status };
  if (endpoint !== undefined) options.endpoint = endpoint;
  if (details !== undefined) options.details = details;
  return new E3DError(message, mapStatusToCode(status), options);
}

export function createNetworkError(message: string, endpoint?: string, details?: unknown): E3DError {
  const options: { endpoint?: string; details?: unknown } = {};
  if (endpoint !== undefined) options.endpoint = endpoint;
  if (details !== undefined) options.details = details;
  return new E3DError(message, 'NETWORK_ERROR', options);
}

export function isE3DError(error: unknown): error is E3DError {
  return error instanceof E3DError;
}
