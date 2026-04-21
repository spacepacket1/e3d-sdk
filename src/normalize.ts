function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}

function camelizeSegment(segment: string): string {
  return segment.replace(/_([a-z0-9])/gi, (_match, chr: string) => String(chr).toUpperCase());
}

export function camelizeKey(key: string): string {
  if (!key.includes('_')) return key;
  return camelizeSegment(key);
}

export function normalizeValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item)) as T;
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[camelizeKey(key)] = normalizeValue(item);
    }
    return out as T;
  }

  return value;
}

export function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) {
      out[key as keyof T] = item as T[keyof T];
    }
  }
  return out;
}

export { isPlainObject };
