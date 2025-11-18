import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { woofsForVideo } from "../_shared/woofs.ts";

import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    } else if (modality === "video") {
      cost = woofsForVideo(duration_s);
    } else {
      cost = 0;
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
