import { createClient } from "npm:@supabase/supabase-js@2";

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

    const { cost_woofs, meta = {} } = await req.json();

    // Appeler la fonction existante consume_woofs
    const { error: consumeError } = await supabaseClient.rpc("consume_woofs", {
      user_id_param: user.id,
      woofs_amount: cost_woofs,
    });

    if (consumeError) throw consumeError;

    // Logger la transaction
    await supabaseClient.from("transactions").insert({
      user_id: user.id,
      delta_woofs: -cost_woofs,
      reason: "render",
      meta,
    });

    // Récupérer nouveau solde
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("quota_videos, woofs_consumed_this_month")
      .eq("id", user.id)
      .single();

    const newBalance = (profile?.quota_videos || 0) - (profile?.woofs_consumed_this_month || 0);

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
