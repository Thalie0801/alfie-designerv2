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

    // Phase 2: Analyse IA avec Lovable AI (Gemini 2.5 Flash)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const analysisPrompt = brand_spec 
      ? `Analyse cette image par rapport aux guidelines de marque suivantes:\n${brand_spec}\n\nÉvalue la cohérence de marque (couleurs, typographie, logo, ton) et donne un score de 0 à 100.`
      : "Analyse cette image et évalue sa qualité visuelle globale (composition, couleurs, contraste) de 0 à 100.";

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: analysisPrompt },
            { type: "image_url", image_url: { url: render_url } }
          ]
        }],
        max_tokens: 300
      })
    });

    if (!aiResponse.ok) {
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiText = aiData.choices?.[0]?.message?.content || "";

    // Extract score from AI response (simple regex)
    const scoreMatch = aiText.match(/(\d{1,3})\s*\/?\s*100/);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 70;

    // Extract reasons (simple split on newlines)
    const reasons = aiText
      .split("\n")
      .filter((line: string) => line.trim().length > 10 && line.length < 100)
      .slice(0, 3);

    const checks = {
      fonts: score >= 70,
      colors: score >= 60,
      logo: score >= 50,
      contrast: score >= 80,
      composition: score >= 70,
    };

    return new Response(
      JSON.stringify({
        score: Math.min(100, Math.max(0, score)),
        reasons,
        checks,
        ai_analysis: aiText.slice(0, 500)
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
