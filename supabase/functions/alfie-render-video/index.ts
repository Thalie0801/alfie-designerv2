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

    const { provider, prompt, assets = [], params } = await req.json();
    const { duration = 10, resolution = "1080x1920", style = "standard" } = params || {};

    // Map provider to backend endpoint
    let videoUrl: string;
    let storyboard: any[] = [];

    // Simple stub for Phase 2 - will be extended with actual provider APIs
    if (provider === "flux-lite" || provider === "veo3" || provider === "sora2" || provider === "cinema-xl") {
      // Call generate-video or chat-generate-video
      const { data: videoData, error: videoError } = await supabase.functions.invoke("generate-video", {
        body: {
          prompt,
          duration_seconds: duration,
          style,
          ratio: resolution.includes("1920") ? "9:16" : "16:9"
        }
      });

      if (videoError) throw new Error(videoError.message);
      videoUrl = videoData?.video_url || "";
    } else {
      throw new Error(`Provider ${provider} not supported`);
    }

    // Insert into media_generations
    const { data: mediaGen, error: insertError } = await supabase
      .from("media_generations")
      .insert({
        user_id: user.id,
        type: "video",
        modality: "video",
        provider_id: provider,
        prompt,
        output_url: videoUrl,
        params_json: { duration, resolution, style, assets },
        status: "completed"
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
    }

    return new Response(
      JSON.stringify({
        video_url: videoUrl,
        storyboard,
        meta: {
          provider,
          duration,
          resolution,
          media_gen_id: mediaGen?.id
        }
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
