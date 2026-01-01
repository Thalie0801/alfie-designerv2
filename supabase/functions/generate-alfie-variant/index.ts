import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { variant } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompts: Record<string, string> = {
      'drawing': 'A cute golden retriever puppy with sunglasses, holding a paintbrush and painting on a canvas, professional 3D render, white background, cheerful expression',
      'idea': 'A cute golden retriever puppy with sunglasses, with a glowing lightbulb above its head, excited expression, professional 3D render, white background',
      'thumbs-up': 'A cute golden retriever puppy with sunglasses, giving a thumbs up with its paw, happy and encouraging expression, professional 3D render, white background',
      'phone': 'A cute golden retriever puppy with sunglasses, holding a smartphone in its paws, looking at the screen, professional 3D render, white background',
      'rocket': 'A cute golden retriever puppy with sunglasses, sitting on a small rocket ship taking off, excited expression, professional 3D render, white background'
    };

    const prompt = prompts[variant] || prompts['drawing'];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error('No image generated');
    }

    return new Response(
      JSON.stringify({ imageUrl }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-alfie-variant:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
