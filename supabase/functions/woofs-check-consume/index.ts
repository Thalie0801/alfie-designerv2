import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { WOOF_COSTS } from "../_shared/woofsCosts.ts";
import { corsHeaders } from "../_shared/cors.ts";

const admin = createClient(
  SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const { brand_id, cost_woofs, reason, metadata } = await req.json();

    if (!brand_id || !cost_woofs || !reason) {
      throw new Error("Missing required fields: brand_id, cost_woofs, reason");
    }

    console.log(`[woofs-check-consume] Checking ${cost_woofs} Woofs for brand ${brand_id} (reason: ${reason})`);

    // 1. Récupérer les quotas de la brand
    const { data: brand, error: brandError } = await admin
      .from("brands")
      .select("quota_woofs, plan")
      .eq("id", brand_id)
      .single();

    if (brandError || !brand) {
      throw new Error(`Brand not found: ${brandError?.message}`);
    }

    const woofs_limit = brand.quota_woofs || 150;

    // 2. Récupérer la période courante (YYYYMM)
    const now = new Date();
    const period = parseInt(
      now.getFullYear().toString() + 
      (now.getMonth() + 1).toString().padStart(2, '0')
    );

    // 3. Récupérer les compteurs mensuels
    const { data: counters, error: countersError } = await admin
      .from("counters_monthly")
      .select("woofs_used")
      .eq("brand_id", brand_id)
      .eq("period_yyyymm", period)
      .maybeSingle();

    if (countersError) {
      console.error("[woofs-check-consume] Error fetching counters:", countersError);
      throw countersError;
    }

    const woofs_used = counters?.woofs_used || 0;
    const remaining = woofs_limit - woofs_used;

    console.log(`[woofs-check-consume] Current usage: ${woofs_used}/${woofs_limit} Woofs (remaining: ${remaining})`);

    // 4. Vérifier si suffisamment de Woofs
    if (woofs_used + cost_woofs > woofs_limit) {
      console.warn(`[woofs-check-consume] INSUFFICIENT_WOOFS: need ${cost_woofs}, have ${remaining}`);
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "INSUFFICIENT_WOOFS",
            message: "Tu n'as plus assez de Woofs pour cette génération.",
            remaining: remaining,
            required: cost_woofs,
          },
        }),
        { 
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // 5. Consommer les Woofs de manière atomique
    const { error: incrementError } = await admin.rpc("increment_monthly_counters", {
      p_brand_id: brand_id,
      p_period_yyyymm: period,
      p_images: 0,
      p_reels: 0,
      p_woofs: cost_woofs,
    });

    if (incrementError) {
      console.error("[woofs-check-consume] Error incrementing counters:", incrementError);
      throw incrementError;
    }

    const new_woofs_used = woofs_used + cost_woofs;
    const new_remaining = woofs_limit - new_woofs_used;
    const threshold_80 = (new_woofs_used / woofs_limit) >= 0.8;

    // 6. Logger l'événement d'usage
    await admin.from("usage_event").insert({
      brand_id: brand_id,
      kind: reason,
      meta: {
        cost_woofs,
        ...metadata,
      },
    });

    console.log(`[woofs-check-consume] ✅ Consumed ${cost_woofs} Woofs. New usage: ${new_woofs_used}/${woofs_limit}`);

    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          remaining_woofs: new_remaining,
          woofs_limit: woofs_limit,
          woofs_used: new_woofs_used,
          threshold_80: threshold_80,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[woofs-check-consume] Error:", error);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: { 
          code: "INTERNAL_ERROR",
          message: error?.message || "Unknown error"
        } 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
