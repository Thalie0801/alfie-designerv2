import { supabase } from "@/lib/supabaseClient";

async function fetchJSON<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 60000, ...rest } = init;
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: ctrl.signal });
    const isJSON = (res.headers.get("content-type") || "").includes("application/json");
    const data = isJSON ? await res.json() : await res.text();
    if (!res.ok) {
      const msg = isJSON ? (data?.message || res.statusText) : res.statusText;
      const details = isJSON ? data?.details || "" : typeof data === "string" ? data : "";
      throw new Error(`${res.status} ${msg}${details ? " — " + JSON.stringify(details).slice(0, 200) : ""}`);
    }
    return data as T;
  } finally {
    clearTimeout(id);
  }
}

type SyncResp = { imageUrl: string };
type AsyncResp = { jobId: string };

export async function generateImage(payload: {
  prompt: string;
  brandId: string;
  ratio: "1:1" | "9:16" | "16:9" | "3:4";
  mode: "image" | "video";
  imageUrl?: string;
  imageBase64?: string;
}) {
  const { data, error } = await supabase.functions.invoke<SyncResp | AsyncResp>("alfie-generate", {
    body: payload,
    headers: { "content-type": "application/json" },
  });
  if (error) throw new Error(error.message || "Edge Function error");

  if ((data as SyncResp | undefined)?.imageUrl) {
    return (data as SyncResp).imageUrl;
  }

  if ((data as AsyncResp | undefined)?.jobId) {
    const started = Date.now();
    while (Date.now() - started < 90_000) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const job = await fetchJSON<{ status: string; imageUrl?: string; error?: string }>(
        `/api/jobs/${(data as AsyncResp).jobId}`,
        { method: "GET", timeoutMs: 15_000 },
      );
      if (job.status === "done" && job.imageUrl) return job.imageUrl;
      if (job.status === "error") throw new Error(job.error || "Génération échouée");
    }
    throw new Error("Timeout: la génération prend trop de temps");
  }

  throw new Error("Réponse inattendue de alfie-generate (ni imageUrl ni jobId).");
}
