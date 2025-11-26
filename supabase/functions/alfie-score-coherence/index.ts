import { corsHeaders } from "../_shared/cors.ts";
import { LOVABLE_API_KEY } from "../_shared/env.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { render_url, brand_spec } = await req.json();

    console.log("[Alfie Score Coherence] Starting analysis", { render_url, has_brand_spec: !!brand_spec });

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const analysisPrompt = brand_spec 
      ? `Analyse cette image par rapport aux guidelines de marque suivantes:\n${brand_spec}\n\nÉvalue la cohérence de marque (couleurs, typographie, logo, ton) et donne un score de 0 à 100. Sois précis et constructif.`
      : "Analyse cette image et évalue sa qualité visuelle globale (composition, couleurs, contraste) de 0 à 100. Sois précis et constructif.";

    // CRITICAL FIX: Use correct format for image analysis
    // The API expects content array with text and image_url objects
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
            { 
              type: "text", 
              text: analysisPrompt 
            },
            { 
              type: "image_url", 
              image_url: { 
                url: render_url 
              } 
            }
          ]
        }],
        max_tokens: 300
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[Alfie Score Coherence] AI Gateway error:", aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiText = aiData.choices?.[0]?.message?.content || "";

    console.log("[Alfie Score Coherence] AI analysis received", { text_length: aiText.length });

    // Extract score from AI response (regex)
    const scoreMatch = aiText.match(/(\d{1,3})\s*(?:\/100|%|\bpoints?\b)?/i);
    const score = scoreMatch ? Math.min(100, parseInt(scoreMatch[1], 10)) : 70;

    // Extract reasons (split on newlines, filter meaningful lines)
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

    console.log("[Alfie Score Coherence] Analysis complete", { score, reasons_count: reasons.length });

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
    console.error("[Alfie Score Coherence] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
