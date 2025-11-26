import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
const CANVA_SCOPES = [
  "design:content:read",
  "design:content:write",
  "design:meta:read",
  "asset:read",
  "asset:write",
  "brandtemplate:meta:read",
  "brandtemplate:content:read",
  "profile:read",
].join(" ");

const AUTH_URL = "https://www.canva.com/apps/oauth2/authorize";

/**
 * Generates a cryptographically secure OAuth state token and stores it with the current user
 * so we can safely redirect the browser to Canva's authorization screen.
 */
function generateState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const clientId = Deno.env.get("CANVA_CLIENT_ID");
    const redirectUri = Deno.env.get("CANVA_REDIRECT_URI");
    
    if (!clientId || !redirectUri) {
      throw new Error("missing_canva_config");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = supabase;

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      console.warn("[canva-auth-start] Failed to authenticate user", userError?.message);
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const state = generateState();

    // Remove existing state tokens for this user to keep the table lean.
    await supabaseAdmin.from("canva_oauth_states").delete().eq("user_id", userData.user.id);

    const { error: insertError } = await supabaseAdmin.from("canva_oauth_states").insert({
      state,
      user_id: userData.user.id,
    });

    if (insertError) {
      console.error("[canva-auth-start] Failed to store state", insertError.message);
      return new Response(JSON.stringify({ error: "state_persistence_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authorizationUrl = new URL(AUTH_URL);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", clientId);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("scope", CANVA_SCOPES);
    authorizationUrl.searchParams.set("state", state);

    return new Response(JSON.stringify({ authorizationUrl: authorizationUrl.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("[canva-auth-start] Unexpected error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
