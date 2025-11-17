import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase credentials are not configured");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CANVA_TOKEN_URL = "https://www.canva.com/apps/oauth2/token";
const CANVA_CLIENT_ID = process.env.CANVA_CLIENT_ID;
const CANVA_CLIENT_SECRET = process.env.CANVA_CLIENT_SECRET;
const CANVA_REDIRECT_URI = process.env.CANVA_REDIRECT_URI;

if (!CANVA_CLIENT_ID || !CANVA_CLIENT_SECRET || !CANVA_REDIRECT_URI) {
  throw new Error("Canva OAuth environment variables are missing");
}

type CanvaTokenPayload = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string | string[];
  user?: { id?: string } | null;
  user_id?: string;
};

const buildRedirectUrl = (status: "success" | "error", reason?: string) => {
  const params = new URLSearchParams({ canva: status });
  if (reason) {
    params.set("reason", reason);
  }
  return `/integrations?${params.toString()}`;
};

const getQueryValue = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
};

async function exchangeCodeForToken(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: CANVA_REDIRECT_URI,
    client_id: CANVA_CLIENT_ID,
    client_secret: CANVA_CLIENT_SECRET,
  });

  const response = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`token_exchange_failed_${response.status}`);
  }

  const payload = (await response.json()) as CanvaTokenPayload;
  if (!payload?.access_token) {
    throw new Error("token_exchange_missing_access_token");
  }

  return payload;
}

async function resolveUserIdFromState(state: string) {
  const { data, error } = await supabaseAdmin
    .from("canva_oauth_states")
    .select("user_id")
    .eq("state", state)
    .maybeSingle();

  if (error || !data?.user_id) {
    return null;
  }

  return data.user_id;
}

async function saveConnection(userId: string, payload: CanvaTokenPayload) {
  const expiresAt = typeof payload.expires_in === "number"
    ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
    : null;

  const canvaUserId = payload.user?.id ?? payload.user_id ?? null;
  const normalizedScope = Array.isArray(payload.scope)
    ? payload.scope.join(" ")
    : payload.scope ?? null;

  const { error } = await supabaseAdmin
    .from("canva_connections")
    .upsert(
      {
        user_id: userId,
        canva_user_id: canvaUserId,
        access_token: payload.access_token,
        refresh_token: payload.refresh_token ?? null,
        scope: normalizedScope,
        expires_at: expiresAt,
      },
      { onConflict: "user_id" }
    );

  if (error) {
    throw new Error(`connection_upsert_failed_${error.message}`);
  }
}

async function cleanupState(state: string) {
  await supabaseAdmin
    .from("canva_oauth_states")
    .delete()
    .eq("state", state);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const errorParam = getQueryValue(req.query.error);
  if (errorParam) {
    return res.redirect(buildRedirectUrl("error", errorParam));
  }

  const code = getQueryValue(req.query.code);
  const state = getQueryValue(req.query.state);

  if (!code || !state) {
    return res.redirect(buildRedirectUrl("error", "missing_code_or_state"));
  }

  try {
    const userId = await resolveUserIdFromState(state);
    if (!userId) {
      return res.redirect(buildRedirectUrl("error", "invalid_state"));
    }

    const tokenPayload = await exchangeCodeForToken(code);
    await saveConnection(userId, tokenPayload);
    await cleanupState(state);

    return res.redirect(buildRedirectUrl("success"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("[canva-oauth-redirect] OAuth flow failed", message);
    return res.redirect(buildRedirectUrl("error", "token_exchange_failed"));
  }
}
