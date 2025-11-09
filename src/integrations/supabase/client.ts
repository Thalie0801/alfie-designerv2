import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  SupabaseIntegration,
  ConnectSupabasePayload,
  LovableResult,
} from "./types";

// Renseigne cette var dans .env local et CI
// VITE_EDGE_BASE_URL=https://<YOUR-PROJECT-REF>.functions.supabase.co
const EDGE_BASE = import.meta.env.VITE_EDGE_BASE_URL;

function assertBase(): asserts EDGE_BASE is string {
  if (!EDGE_BASE) {
    throw new Error("VITE_EDGE_BASE_URL manquant (Edge Function base URL).");
  }
}

async function fetchJSON<T>(input: RequestInfo, init?: RequestInit): Promise<LovableResult<T>> {
  try {
    const res = await fetch(input, init);
    const isJSON = (res.headers.get("content-type") || "").includes("application/json");
    const payload = isJSON ? await res.json() : await res.text();

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof payload === "string" ? payload : payload?.error || res.statusText,
      };
    }
    return { ok: true, status: res.status, data: payload as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, error: msg };
  }
}

export async function getSupabaseIntegration(projectId: string) {
  assertBase();
  if (!projectId) throw new Error("projectId requis");

  const url = `${EDGE_BASE}/lovable-proxy/projects/${encodeURIComponent(
    projectId,
  )}/integrations/supabase`;

  return fetchJSON<SupabaseIntegration>(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
}

export async function connectSupabaseIntegration(
  projectId: string,
  payload: ConnectSupabasePayload,
) {
  assertBase();
  if (!projectId) throw new Error("projectId requis");

  const url = `${EDGE_BASE}/lovable-proxy/projects/${encodeURIComponent(
    projectId,
  )}/integrations/supabase`;

  return fetchJSON<SupabaseIntegration>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type DatabaseClient = SupabaseClient<Database>;

type GlobalWithSupabase = typeof globalThis & {
  __lovableSupabaseClient?: DatabaseClient;
};

function createSupabaseClient(): DatabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are missing.");
  }

  const authConfig =
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
      ? {
          storage: window.localStorage,
          persistSession: true,
          autoRefreshToken: true,
        }
      : undefined;

  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: authConfig,
  });
}

const globalForSupabase = globalThis as GlobalWithSupabase;

export const supabase: DatabaseClient =
  globalForSupabase.__lovableSupabaseClient ||
  (globalForSupabase.__lovableSupabaseClient = createSupabaseClient());
