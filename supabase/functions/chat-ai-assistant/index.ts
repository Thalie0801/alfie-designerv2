import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatAIRequest = {
  message?: string;
  context?: {
    contentType?: string;
    platform?: string;
    brief?: Record<string, unknown>;
    brandKit?: Record<string, unknown>;
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let body: ChatAIRequest;
    try {
      body = await req.json();
    } catch (error) {
      console.warn("chat-ai-assistant: invalid JSON payload", error);
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message, context } = body ?? {};

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      console.warn("chat-ai-assistant: missing message", body);
      return new Response(JSON.stringify({ ok: false, error: "missing_message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.error("chat-ai-assistant: missing OPENAI_API_KEY env");
      return new Response(JSON.stringify({ ok: false, error: "missing_openai_key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Tu es Alfie, l'assistant créatif d'Alfie Designer. Tu aides les utilisateurs à créer du contenu visuel
 pour les réseaux sociaux.

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
      ? `\n\nContexte actuel:\n- Format: ${context.contentType || "non défini"}\n- Plateforme: ${context.platform || "non défini"}\n- Brief: ${JSON.stringify(context.brief || {})}`
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
      const errorPayload = await response.text();
      console.error("chat-ai-assistant: provider error", errorPayload);
      return new Response(JSON.stringify({ ok: false, error: "provider_error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content || "Je peux t'aider à créer ce contenu !";

    return new Response(JSON.stringify({ ok: true, data: { message: aiMessage } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("chat-ai-assistant: unexpected error", error);
    return new Response(JSON.stringify({ ok: false, error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
