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
    const { provider, modality, format, duration_s = 10, quality = "standard" } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: providerData, error } = await supabase
      .from("providers")
      .select("cost_json")
      .eq("id", provider)
      .single();

    if (error || !providerData) {
      return new Response(
        JSON.stringify({ error: "Provider non trouvé" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const costJson = providerData.cost_json;
    let cost = 0;

    if (modality === "image") {
      const base = costJson.base_per_image || 1;
      const hiRes = /3840x|4k|2048x/i.test(format) ? (costJson.hi_res_multiplier || 1.5) : 1;
      cost = Math.ceil(base * hiRes * (quality === "premium" ? 1.25 : 1));
    } else {
      const tier = /3840x|4k/i.test(format) ? "4k_per_5s" : "1080p_per_5s";
      const perChunk = costJson[tier] || costJson["1080p_per_5s"] || 2;
      cost = Math.ceil((duration_s / 5) * perChunk * (quality === "premium" ? 1.25 : 1));
    }

    return new Response(
      JSON.stringify({ cost_woofs: cost }),
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
