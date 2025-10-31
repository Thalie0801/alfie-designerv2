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

    const { cost_woofs, brand_id } = await req.json();

    // Appeler get-quota pour avoir la source de vérité unique
    const quotaResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/get-quota`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ brand_id }),
    });

    if (!quotaResponse.ok) {
      const errorData = await quotaResponse.json();
      return new Response(
        JSON.stringify({ error: errorData.error || 'Failed to check quota' }),
        { status: quotaResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const quota = await quotaResponse.json();

    const remaining = quota.woofs_remaining;
    const ok = remaining >= cost_woofs;

    return new Response(
      JSON.stringify({
        ok,
        remaining,
        quota_total: quota.woofs_quota,
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
