import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader! } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Non authentifié" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { cost_woofs } = await req.json();

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("quota_videos, woofs_consumed_this_month")
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      return new Response(
        JSON.stringify({ error: "Profil non trouvé" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const quotaTotal = profile.quota_videos || 0;
    const consumed = profile.woofs_consumed_this_month || 0;
    const remaining = quotaTotal - consumed;
    const ok = remaining >= cost_woofs;

    return new Response(
      JSON.stringify({
        ok,
        remaining,
        quota_total: quotaTotal,
        new_balance_if_ok: ok ? remaining - cost_woofs : remaining,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
