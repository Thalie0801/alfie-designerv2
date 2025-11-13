import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, context } = await req.json();

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const systemPrompt = `Tu es Alfie, l'assistant créatif d'Alfie Designer. Tu aides les utilisateurs à créer du contenu visuel pour les réseaux sociaux.

Ton rôle :
- Comprendre les besoins créatifs (format, plateforme, message)
- Suggérer des structures de contenu adaptées
- Donner des conseils en direction artistique
- Être concis, actionnable et enthousiaste

Formats disponibles : image, carousel, video
Plateformes : Instagram, TikTok, LinkedIn, Pinterest, YouTube
Ratios : 1:1, 4:5, 9:16, 16:9, 3:4, 4:3

Réponds toujours en français, de manière courte (max 3-4 phrases) et concrète.`;

    const userContext = context
      ? `\n\nContexte actuel:\n- Format: ${context.contentType || "non défini"}\n- Plateforme: ${context.platform || "non définie"}\n- Brief: ${JSON.stringify(context.brief || {})}`
      : "";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message + userContext },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content || "Je peux t'aider à créer ce contenu !";

    return new Response(JSON.stringify({ message: aiMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Chat AI error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Erreur lors de la génération de réponse" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
