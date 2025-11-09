// src/integrations/supabase/client.ts

import { IS_LOVABLE_PREVIEW, CAN_USE_PROXY, EDGE_BASE } from "@/lib/env";
import type {
  SupabaseIntegration,
  LovableResult,
  ConnectSupabasePayload,
} from "./types";

/** Helpers résultat typé */
function ok<T>(data: T, status = 200): LovableResult<T> {
  return { ok: true, status, data };
}
function fail<T = never>(msg: string, status = 409): LovableResult<T> {
  return { ok: false, status, error: msg };
}

/** Fetch JSON sûr (retourne toujours LovableResult) */
async function fetchJSON<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<LovableResult<T>> {
  try {
    const res = await fetch(input, init);
    const ct = res.headers.get("content-type") || "";
    const isJSON = ct.includes("application/json");
    const payload = isJSON ? await res.json() : await res.text();

    if (!res.ok) {
      const msg =
        typeof payload === "string"
          ? payload
          : (payload?.error as string) || res.statusText;
      return fail<T>(msg, res.status);
    }
    return ok<T>(payload as T, res.status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail<T>(msg, 0);
  }
}

/** Lecture de l’intégration Supabase (Lovable) */
export async function getSupabaseIntegration(
  projectId: string
): Promise<LovableResult<SupabaseIntegration>> {
  if (!projectId) return fail("projectId requis", 400);

  // En preview Lovable: pas d'appel réel (bypass propre)
  if (IS_LOVABLE_PREVIEW) {
    return ok({
      projectId,
      url: "",
      connected: false,
      updatedAt: new Date().toISOString(),
    });
  }

  // Hors preview: on utilise le proxy s’il est configuré
  if (CAN_USE_PROXY) {
    const url = `${EDGE_BASE}/lovable-proxy/projects/${encodeURIComponent(
      projectId
    )}/integrations/supabase`;
    return fetchJSON<SupabaseIntegration>(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
  }

  return fail(
    "Proxy non configuré (VITE_EDGE_BASE_URL absent) — preview Lovable OK, activer proxy pour prod/staging",
    501
  );
}

/** Connexion de l’intégration Supabase (Lovable) */
export async function connectSupabaseIntegration(
  projectId: string,
  payload: ConnectSupabasePayload
): Promise<LovableResult<SupabaseIntegration>> {
  if (!projectId) return fail("projectId requis", 400);

  // En preview Lovable: c’est géré par Lovable (évite CORS)
  if (IS_LOVABLE_PREVIEW) {
    return fail(
      "Connexion gérée automatiquement par Lovable en preview. Utilise l’onglet Intégrations Lovable.",
      409
    );
  }

  // Hors preview: passer par le proxy si dispo
  if (CAN_USE_PROXY) {
    const url = `${EDGE_BASE}/lovable-proxy/projects/${encodeURIComponent(
      projectId
    )}/integrations/supabase`;

    return fetchJSON<SupabaseIntegration>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  return fail(
    "Proxy non configuré (VITE_EDGE_BASE_URL absent) — preview Lovable OK, activer proxy pour prod/staging",
    501
  );
}
