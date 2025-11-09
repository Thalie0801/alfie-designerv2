export async function fetchJSON<T>(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number },
) {
  const timeoutMs = init?.timeoutMs ?? 60_000;
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: ctrl.signal });
    const ct = res.headers.get("content-type") || "";
    const isJSON = ct.includes("application/json");
    const data = isJSON ? await res.json() : await res.text();

    if (!res.ok) {
      const message = isJSON ? (data?.message || res.statusText) : res.statusText;
      const details = isJSON ? (data?.details || "") : (typeof data === "string" ? data : "");
      const brief = typeof details === "string" ? details.slice(0, 200) : "";
      const error = new Error(`${res.status} ${message}${brief ? " — " + brief : ""}`);
      (error as Error & { status?: number; details?: unknown }).status = res.status;
      (error as Error & { status?: number; details?: unknown }).details = details;
      throw error;
    }
    return data as T;
  } finally {
    clearTimeout(id);
  }
}
