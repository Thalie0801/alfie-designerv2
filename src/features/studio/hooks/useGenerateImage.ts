import { z } from "zod";

function createTimeoutAbort(signal?: AbortSignal, timeoutMs?: number) {
  const controller = new AbortController();
  const timeout = timeoutMs ?? 60000;
  const timerId = setTimeout(() => controller.abort(), timeout);

  let abortListener: (() => void) | undefined;
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      abortListener = () => controller.abort();
      signal.addEventListener("abort", abortListener);
    }
  }

  const cleanup = () => {
    clearTimeout(timerId);
    if (signal && abortListener) {
      signal.removeEventListener("abort", abortListener);
    }
  };

  return { controller, cleanup };
}

export function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit & { timeoutMs?: number } = {},
) {
  const { timeoutMs = 60000, signal, ...rest } = init;
  const { controller, cleanup } = createTimeoutAbort(signal, timeoutMs);

  return fetch(input, { ...rest, signal: controller.signal }).finally(cleanup);
}

const SyncSchema = z.object({
  imageUrl: z.string().url(),
  assetId: z.string().optional(),
  meta: z.any().optional(),
});

const AsyncSchema = z.object({
  jobId: z.string(),
});

const JobSchema = z.object({
  status: z.enum(["queued", "running", "done", "error"]),
  imageUrl: z.string().url().optional(),
  error: z.string().optional(),
});

export async function generateImage(payload: {
  prompt: string;
  imageUrl?: string;
  brandId?: string;
}) {
  const res = await fetchWithTimeout("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    timeoutMs: 60000,
  });

  if (res.status === 200) {
    const data = await res.json();
    const parsed = SyncSchema.safeParse(data);
    if (!parsed.success) throw new Error("Réponse invalide: pas d'imageUrl");
    return parsed.data.imageUrl;
  }

  if (res.status === 202) {
    const { jobId } = AsyncSchema.parse(await res.json());
    const started = Date.now();
    const POLL_EVERY = 1500;
    const POLL_TIMEOUT = 90_000;

    while (Date.now() - started < POLL_TIMEOUT) {
      await new Promise((resolve) => setTimeout(resolve, POLL_EVERY));
      const jobResponse = await fetchWithTimeout(`/api/jobs/${jobId}`, {
        method: "GET",
        timeoutMs: 60000,
      });
      const job = JobSchema.parse(await jobResponse.json());
      if (job.status === "done" && job.imageUrl) return job.imageUrl;
      if (job.status === "error") throw new Error(job.error ?? "Génération échouée");
    }
    throw new Error("Timeout: génération trop longue");
  }

  const text = await res.text().catch(() => "");
  throw new Error(`Génération a échoué: ${res.status} ${res.statusText} — ${text}`);
}
