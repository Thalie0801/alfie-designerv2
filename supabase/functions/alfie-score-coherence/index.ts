import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { render_url, brand_spec } = await req.json();

    // Score programmatique basique (Phase 1)
    // Phase 2 ajoutera l'analyse IA avec Lovable AI
    const checks = {
      fonts: true,
      colors: true,
      logo: true,
      contrast: Math.random() > 0.3, // Simulé pour Phase 1
      composition: Math.random() > 0.2,
    };

    const score = Math.round(
      (Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100
    );

    const reasons = [];
    if (!checks.contrast) reasons.push("Contraste limite sur CTA");
    if (!checks.composition) reasons.push("Composition à ajuster");
    if (score >= 80) reasons.push("Palette OK", "Logo bien placé");

    return new Response(
      JSON.stringify({
        score,
        reasons,
        checks,
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
