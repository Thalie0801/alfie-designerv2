import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { IS_LOVABLE_PREVIEW, CAN_USE_PROXY, EDGE_BASE } from "@/lib/env";
import type {
  Database,
  SupabaseIntegration,
  ConnectSupabasePayload,
  LovableResult,
} from "./types";

function ok<T>(data: T, status = 200): LovableResult<T> {
  return { ok: true, status, data };
}

function fail<T = never>(msg: string, status = 409): LovableResult<T> {
  return { ok: false, status, error: msg };
}

async function fetchJSON<T>(input: RequestInfo, init?: RequestInit): Promise<LovableResult<T>> {
  try {
    const res = await fetch(input, init);
    const isJSON = (res.headers.get("content-type") || "").includes("application/json");
    const payload = isJSON ? await res.json() : await res.text();

    if (!res.ok) {
      return fail(
        typeof payload === "string" ? payload : payload?.error || res.statusText,
        res.status,
      );
    }
    return ok(payload as T, res.status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail(msg, 0);
  }
}

export async function getSupabaseIntegration(projectId: string) {
  if (!projectId) throw new Error("projectId requis");

  if (IS_LOVABLE_PREVIEW) {
    return ok({
      projectId,
      url: "",
      connected: false,
      updatedAt: new Date().toISOString(),
    });
  }

  if (CAN_USE_PROXY) {
    const url = `${EDGE_BASE}/lovable-proxy/projects/${encodeURIComponent(
      projectId,
    )}/integrations/supabase`;

    return fetchJSON<SupabaseIntegration>(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
  }

  return fail(
    "Proxy non configuré (VITE_EDGE_BASE_URL absent) — preview Lovable OK, activer proxy pour prod/staging",
    501,
  );
}

export async function connectSupabaseIntegration(
  projectId: string,
  payload: ConnectSupabasePayload,
) {
  if (!projectId) throw new Error("projectId requis");

  if (IS_LOVABLE_PREVIEW) {
    return fail(
      "Connexion gérée automatiquement par Lovable en preview. Utilise l’onglet Intégrations Lovable.",
      409,
    );
  }

  if (CAN_USE_PROXY) {
    const url = `${EDGE_BASE}/lovable-proxy/projects/${encodeURIComponent(
      projectId,
    )}/integrations/supabase`;

    return fetchJSON<SupabaseIntegration>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  return fail(
    "Proxy non configuré (VITE_EDGE_BASE_URL absent) — preview Lovable OK, activer proxy pour prod/staging",
    501,
  );
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
