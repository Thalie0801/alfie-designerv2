import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { provider, use_case, format, reward, success } = await req.json();

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Phase 2: Upsert provider_metrics (bandit UCB)
    console.log("[Alfie Metrics Update]", {
      provider,
      use_case,
      format,
      reward,
      success,
      timestamp: new Date().toISOString(),
    });

    // Get existing metrics
    const { data: existing } = await supabase
      .from('provider_metrics')
      .select('*')
      .eq('provider_id', provider)
      .eq('use_case', use_case)
      .eq('format', format)
      .single();

    const trials = (existing?.trials || 0) + 1;
    const successes = (existing?.successes || 0) + (success ? 1 : 0);
    const totalReward = (existing?.total_reward || 0) + (reward || 0);

    // Upsert metrics
    const { error: upsertError } = await supabase
      .from('provider_metrics')
      .upsert({
        provider_id: provider,
        use_case,
        format,
        trials,
        successes,
        total_reward: totalReward,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'provider_id,use_case,format'
      });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      throw upsertError;
    }

    return new Response(
      JSON.stringify({ ok: true, trials, successes, avg_reward: totalReward / trials }),
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
