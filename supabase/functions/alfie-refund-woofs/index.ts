import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } from "../_shared/env.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const supabaseClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const supabaseAuth = createClient(
      SUPABASE_URL!,
      SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader! } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Non authentifié" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { amount, reason = "refund", metadata = {} } = await req.json();

    // Récupérer le brand_id actif de l'utilisateur
    const { data: userProfile } = await supabaseClient
      .from("profiles")
      .select("active_brand_id")
      .eq("id", user.id)
      .single();

    if (!userProfile?.active_brand_id) {
      throw new Error("No active brand found");
    }

    // Décrémenter les Woofs dans counters_monthly
    const currentPeriod = parseInt(new Date().toISOString().slice(0, 7).replace("-", ""));
    const { error: decrementError } = await supabaseClient.rpc("decrement_monthly_counters", {
      p_brand_id: userProfile.active_brand_id,
      p_period_yyyymm: currentPeriod,
      p_woofs: amount,
    });

    if (decrementError) throw decrementError;

    // Logger dans generation_logs
    await supabaseClient.from("generation_logs").insert({
      user_id: user.id,
      brand_id: userProfile.active_brand_id,
      type: "refund",
      status: "completed",
      woofs_cost: -amount,
      metadata: { reason, ...metadata },
    });

    // Récupérer nouveau solde depuis counters_monthly
    const { data: counter } = await supabaseClient
      .from("counters_monthly")
      .select("woofs_used")
      .eq("brand_id", userProfile.active_brand_id)
      .eq("period_yyyymm", currentPeriod)
      .single();

    const { data: brand } = await supabaseClient
      .from("brands")
      .select("quota_woofs")
      .eq("id", userProfile.active_brand_id)
      .single();

    const newBalance = (brand?.quota_woofs || 0) - (counter?.woofs_used || 0);

    return new Response(
      JSON.stringify({ ok: true, new_balance: newBalance }),
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
