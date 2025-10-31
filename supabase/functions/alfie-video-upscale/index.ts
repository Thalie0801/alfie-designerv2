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

    const { source_url, target_resolution = "3840x2160", provider } = await req.json();

    // Phase 2 stub - will be implemented with Higgsfield/Kling upscale API
    console.log("[Alfie Video Upscale] Stubbed for Phase 2", {
      source_url,
      target_resolution,
      provider,
    });

    // For now, return source URL (no actual upscale)
    const upscaledUrl = source_url; // TODO: actual upscale

    // Insert into media_generations with parent reference
    const { data: mediaGen, error: insertError } = await supabase
      .from("media_generations")
      .insert({
        user_id: user.id,
        type: "video",
        modality: "video",
        provider_id: provider || "upscale-stub",
        input_url: source_url,
        output_url: upscaledUrl,
        params_json: { upscale: true, target_resolution },
        status: "completed"
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
    }

    return new Response(
      JSON.stringify({
        video_url: upscaledUrl,
        meta: { target_resolution, media_gen_id: mediaGen?.id }
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
