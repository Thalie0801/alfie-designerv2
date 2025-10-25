import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase environment configuration" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseClient = createClient(supabaseUrl, serviceKey);

  try {
    const url = new URL(req.url);
    const forceRun = url.searchParams.get("force") === "true";
    const today = new Date();

    if (!forceRun && today.getUTCDate() !== 30) {
      return new Response(
        JSON.stringify({ message: "Cleanup skipped (runs on 30th)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabaseClient.rpc("purge_inactive_profiles");

    if (error) {
      throw error;
    }

    const purgedCount = Array.isArray(data) ? data.length : 0;

    return new Response(
      JSON.stringify({ message: "Cleanup executed", purgedCount, affected: data ?? [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[cleanup-inactive-users]", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
