import { FLAGS } from '@/config/flags';

type SentryDsnParts = {
  protocol: string;
  host: string;
  projectId: string;
  publicKey: string;
};

type CaptureContext = {
  brandId?: string | null;
  jobId?: string | null;
  extra?: Record<string, unknown>;
};

let cachedDsn: SentryDsnParts | null = null;
let environmentTags: CaptureContext = {};

const release = import.meta.env.VITE_APP_VERSION || import.meta.env.VITE_GIT_SHA || 'dev';
const environment = import.meta.env.VITE_RUNTIME_ENV || import.meta.env.MODE || 'development';

function parseDsn(raw?: string | null): SentryDsnParts | null {
  if (!raw) return null;
  if (cachedDsn) return cachedDsn;
  try {
    const url = new URL(raw);
    const projectId = url.pathname.replace(/^\//, '');
    if (!url.username || !projectId) return null;
    cachedDsn = {
      protocol: url.protocol.replace(':', ''),
      host: url.host,
      projectId,
      publicKey: url.username,
    };
    return cachedDsn;
  } catch (error) {
    console.warn('[Sentry] Invalid DSN', error);
    return null;
  }
}

const SENTRY_DSN = parseDsn(import.meta.env.VITE_SENTRY_DSN);

export function initSentry(): void {
  if (!SENTRY_DSN) {
    console.info('[Sentry] disabled (missing DSN)');
    return;
  }
  console.info('[Sentry] initialized', { environment, release, flags: FLAGS });
}

function buildAuthHeader(parts: SentryDsnParts): string {
  const timestamp = Math.floor(Date.now() / 1000);
  return [
    'Sentry sentry_version=7',
    'sentry_client=alfie-designer/1.0',
    `sentry_key=${parts.publicKey}`,
    `sentry_timestamp=${timestamp}`,
  ].join(', ');
}

function normalizeStack(stack?: string | null) {
  if (!stack) return undefined;
  return stack
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 50);
}

export async function captureException(error: unknown, context: CaptureContext = {}): Promise<void> {
  if (!SENTRY_DSN) return;

  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
  const stack = normalizeStack(err.stack);
  const eventId = crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(16).slice(2);

  const payload = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    release,
    environment,
    exception: {
      values: [
        {
          type: err.name || 'Error',
          value: err.message || String(err),
          stacktrace: stack
            ? {
                frames: stack.map((line) => ({ filename: line, function: '?', lineno: 0, colno: 0 })),
              }
            : undefined,
        },
      ],
    },
    tags: {
      brand_id: context.brandId ?? environmentTags.brandId ?? 'unknown',
      job_id: context.jobId ?? environmentTags.jobId ?? 'unknown',
    },
    extra: {
      ...environmentTags.extra,
      ...context.extra,
      flags: FLAGS,
    },
  };

  try {
    const response = await fetch(`${SENTRY_DSN.protocol}://${SENTRY_DSN.host}/api/${SENTRY_DSN.projectId}/store/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': buildAuthHeader(SENTRY_DSN),
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    if (!response.ok) {
      console.warn('[Sentry] Failed to report error', await response.text());
    }
  } catch (sendError) {
    console.warn('[Sentry] Transport failed', sendError);
  }
}

export function setBrandContext(brandId: string | null | undefined): void {
  environmentTags = { ...environmentTags, brandId: brandId ?? null };
}

export function setJobContext(jobId: string | null | undefined): void {
  environmentTags = { ...environmentTags, jobId: jobId ?? null };
}

export function addSentryExtra(extra: Record<string, unknown>): void {
  environmentTags = { ...environmentTags, extra: { ...environmentTags.extra, ...extra } };
}
