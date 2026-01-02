import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY } from '../_shared/env.ts';
import { corsHeaders } from "../_shared/cors.ts";
import { LOVABLE_MODELS } from "../_shared/aiModels.ts";

/* ------------------------------- CORS ------------------------------- */
function jsonRes(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    ...init,
  });
}

/* ------------------------------ Types ------------------------------ */
type ToolType = 'inpainting' | 'outpainting' | 'remove-background' | 'upscale';

interface ToolRequest {
  userId: string;
  brandId?: string;
  tool: ToolType;
  imageUrl: string;
  // Inpainting specific
  maskDescription?: string; // Description of area to edit (e.g., "the sky", "the person's shirt")
  editPrompt?: string;      // What to change it to
  // Outpainting specific
  direction?: 'left' | 'right' | 'up' | 'down' | 'all';
  extendPrompt?: string;    // What to add in extended area
  // Upscale specific
  scaleFactor?: 2 | 4;
}

/* ------------------------------ Prompts ------------------------------ */
function buildInpaintingPrompt(maskDescription: string, editPrompt: string): string {
  return `INPAINTING TASK:
Target area to edit: "${maskDescription}"
Desired change: "${editPrompt}"

INSTRUCTIONS:
1. Identify the area described as "${maskDescription}" in the image
2. Replace/modify ONLY that area with: ${editPrompt}
3. Keep ALL other parts of the image EXACTLY as they are
4. Ensure seamless blending between edited and original areas
5. Match lighting, perspective, and style of the original image

CRITICAL: Only modify the specified area. Everything else must remain unchanged.`;
}

function buildOutpaintingPrompt(direction: string, extendPrompt?: string): string {
  const directionMap: Record<string, string> = {
    'left': 'to the LEFT',
    'right': 'to the RIGHT',
    'up': 'UPWARD (above)',
    'down': 'DOWNWARD (below)',
    'all': 'in ALL directions',
  };
  
  return `OUTPAINTING TASK:
Extend the image ${directionMap[direction] || 'in all directions'}.

INSTRUCTIONS:
1. Analyze the existing image content, style, lighting, and perspective
2. Extend the canvas ${directionMap[direction] || 'outward'}
3. ${extendPrompt ? `Add in extended area: ${extendPrompt}` : 'Continue the scene naturally'}
4. Ensure PERFECT continuity - no visible seams or style changes
5. Match colors, lighting, texture, and artistic style exactly

CRITICAL: The extended area must feel like a natural continuation of the original image.`;
}

function buildRemoveBackgroundPrompt(): string {
  return `BACKGROUND REMOVAL TASK:

INSTRUCTIONS:
1. Identify the MAIN SUBJECT(s) in the image (person, product, object, character)
2. REMOVE the entire background
3. Replace background with PURE TRANSPARENCY or solid white
4. Keep the subject with CLEAN, PRECISE edges
5. Preserve ALL details of the subject including fine edges like hair, fur, or intricate shapes

OUTPUT: Subject on transparent/white background, ready for use in marketing materials.`;
}

function buildUpscalePrompt(scaleFactor: number): string {
  return `IMAGE UPSCALING / ENHANCEMENT TASK:

INSTRUCTIONS:
1. Enhance this image to ${scaleFactor}x higher resolution
2. Add fine details and sharpness while maintaining the original style
3. Reduce any noise or artifacts
4. Enhance textures and edges for a crisp, professional look
5. Preserve the original colors, composition, and artistic intent

OUTPUT: High-resolution, enhanced version of the original image suitable for large-format printing and high-DPI displays.`;
}

/* ------------------------------ AI Call ------------------------------ */
async function callImageTool(opts: {
  apiKey: string;
  imageUrl: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<{ imageUrl: string; error?: string }> {
  const { apiKey, imageUrl, systemPrompt, userPrompt } = opts;
  
  console.log(`🔧 [ai-image-tools] Calling Lovable AI - Model: ${LOVABLE_MODELS.image_premium}`);
  
  const userContent: any[] = [
    { type: "text", text: userPrompt },
    { type: "image_url", image_url: { url: imageUrl } }
  ];
  
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LOVABLE_MODELS.image_premium,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      modalities: ["image", "text"],
    }),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error(`[ai-image-tools] AI Gateway error ${resp.status}: ${errorText}`);
    if (resp.status === 429) {
      return { imageUrl: '', error: 'Rate limit exceeded. Please try again later.' };
    }
    if (resp.status === 402) {
      return { imageUrl: '', error: 'Insufficient credits. Please add funds.' };
    }
    return { imageUrl: '', error: `AI service error: ${resp.status}` };
  }

  const data = await resp.json();
  const generatedImageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  
  if (!generatedImageUrl) {
    console.error(`[ai-image-tools] No image in response:`, JSON.stringify(data).slice(0, 500));
    return { imageUrl: '', error: 'No image generated. Please try with a different prompt.' };
  }

  return { imageUrl: generatedImageUrl };
}

/* ------------------------------ Main Handler ------------------------------ */
Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ToolRequest = await req.json();
    const { userId, brandId, tool, imageUrl, maskDescription, editPrompt, direction, extendPrompt, scaleFactor } = body;

    console.log(`🔧 [ai-image-tools] Tool: ${tool}, User: ${userId?.slice(0,8)}`);

    // Validate required fields
    if (!userId || !tool || !imageUrl) {
      return jsonRes({ error: "Missing required fields: userId, tool, imageUrl" }, { status: 400 });
    }

    if (!LOVABLE_API_KEY) {
      console.error("[ai-image-tools] LOVABLE_API_KEY not configured");
      return jsonRes({ error: "AI service not configured" }, { status: 500 });
    }

    // Build prompts based on tool type
    let systemPrompt = `You are a professional image editor specialized in ${tool}. 
You MUST output a modified version of the input image as an image.
Always produce exactly ONE high-quality image in message.images[0].`;

    let userPrompt: string;

    switch (tool) {
      case 'inpainting':
        if (!maskDescription || !editPrompt) {
          return jsonRes({ error: "Inpainting requires maskDescription and editPrompt" }, { status: 400 });
        }
        userPrompt = buildInpaintingPrompt(maskDescription, editPrompt);
        break;

      case 'outpainting':
        userPrompt = buildOutpaintingPrompt(direction || 'all', extendPrompt);
        break;

      case 'remove-background':
        userPrompt = buildRemoveBackgroundPrompt();
        break;

      case 'upscale':
        userPrompt = buildUpscalePrompt(scaleFactor || 2);
        break;

      default:
        return jsonRes({ error: `Unknown tool: ${tool}` }, { status: 400 });
    }

    // Call AI
    const result = await callImageTool({
      apiKey: LOVABLE_API_KEY,
      imageUrl,
      systemPrompt,
      userPrompt,
    });

    if (result.error) {
      return jsonRes({ error: result.error }, { status: 500 });
    }

    // Store in media_generations for history
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const { data: generation, error: insertError } = await supabase
      .from('media_generations')
      .insert({
        user_id: userId,
        brand_id: brandId || null,
        type: 'image',
        prompt: `[${tool}] ${editPrompt || extendPrompt || tool}`,
        output_url: result.imageUrl,
        input_url: imageUrl,
        status: 'completed',
        metadata: { tool, direction, scaleFactor },
      })
      .select('id')
      .single();

    if (insertError) {
      console.warn(`[ai-image-tools] Failed to save generation:`, insertError);
    }

    console.log(`✅ [ai-image-tools] ${tool} completed successfully`);

    return jsonRes({
      success: true,
      imageUrl: result.imageUrl,
      generationId: generation?.id,
      tool,
    });

  } catch (error) {
    console.error("[ai-image-tools] Error:", error);
    return jsonRes({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
});
