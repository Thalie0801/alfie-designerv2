import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../_shared/env.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_ANON_KEY!,
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

    const { source_url, add_seconds = 20, provider } = await req.json();

    // Phase 2 stub - will regenerate with extended duration
    console.log("[Alfie Video Extend] Stubbed for Phase 2", {
      source_url,
      add_seconds,
      provider,
    });

    // For now, return source URL (no actual extend)
    const extendedUrl = source_url; // TODO: actual extend

    // Insert into media_generations with parent reference
    const { data: mediaGen, error: insertError } = await supabase
      .from("media_generations")
      .insert({
        user_id: user.id,
        type: "video",
        modality: "video",
        provider_id: provider || "extend-stub",
        input_url: source_url,
        output_url: extendedUrl,
        params_json: { extend: true, add_seconds },
        status: "completed"
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
    }

    return new Response(
      JSON.stringify({
        video_url: extendedUrl,
        meta: { add_seconds, media_gen_id: mediaGen?.id }
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
