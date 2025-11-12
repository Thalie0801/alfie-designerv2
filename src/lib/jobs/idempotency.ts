const HASH_PREFIX = "v1:";

function canonicalize(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
    return value;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));

    const normalized: Record<string, unknown> = {};
    for (const [key, val] of entries) {
      normalized[key] = canonicalize(val);
    }
    return normalized;
  }
  return value;
}

function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash >>> 0) * 0x01000193;
    hash >>>= 0;
  }
  return (hash >>> 0).toString(16);
}

export type JobKeyInput = {
  brandId?: string | null;
  orderId?: string | null;
  userId?: string | null;
  type: string;
  payload: unknown;
};

function deriveBrandId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const candidates = [
    obj.brandId,
    obj.brand_id,
    obj.brandID,
    obj.brand,
    (obj.brief as Record<string, unknown> | undefined)?.brandId,
    (obj.brief as Record<string, unknown> | undefined)?.brand_id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

export function buildJobIdempotencyKey(input: JobKeyInput): string {
  const brandId = input.brandId ?? deriveBrandId(input.payload);
  const orderId = input.orderId ?? (() => {
    if (!input.payload || typeof input.payload !== "object") return null;
    const obj = input.payload as Record<string, unknown>;
    const candidates = [obj.orderId, obj.order_id];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
    return null;
  })();

  const canonical = canonicalize({
    b: brandId ?? null,
    o: orderId ?? null,
    u: input.userId ?? null,
    t: input.type,
    p: canonicalize(input.payload),
  });

  const raw = JSON.stringify(canonical);
  return `${HASH_PREFIX}${hashString(raw)}`;
}

export function attachJobIdempotency<T extends { payload: unknown; type: string; order_id?: string | null; user_id?: string | null }>(
  job: T,
): T & { idempotency_key: string } {
  const idempotency_key = buildJobIdempotencyKey({
    brandId: deriveBrandId(job.payload),
    orderId: job.order_id ?? null,
    userId: job.user_id ?? null,
    type: job.type,
    payload: job.payload,
  });
  return { ...job, idempotency_key };
}
