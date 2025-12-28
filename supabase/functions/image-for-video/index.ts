/**
 * Edge Function: image-for-video
 * Génère une image de référence pour le pipeline "Image First → Video"
 * Utilise Nano Banana Pro (Gemini 3 Pro Image) via Lovable AI Gateway
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const CLOUDINARY_CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME")!;
const CLOUDINARY_API_KEY = Deno.env.get("CLOUDINARY_API_KEY")!;
const CLOUDINARY_API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET")!;
const INTERNAL_FN_SECRET = Deno.env.get("INTERNAL_FN_SECRET");

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface ImageForVideoRequest {
  renderId?: string;
  prompt: string;
  aspectRatio?: string;
  brandId?: string;
  useBrandKit?: boolean;
  userId?: string;
  overlayLines?: string[]; // ✅ Texte à afficher directement sur l'image (Nano Banana)
}

/**
 * Traduit un prompt FR en prompt EN optimisé pour image
 * Si overlayLines fourni, inclut le texte dans le prompt au lieu de l'interdire
 */
async function translatePromptToEnglish(frenchPrompt: string, overlayLines?: string[]): Promise<string> {
  // ✅ Déterminer l'instruction texte selon overlayLines
  const hasTextToDisplay = overlayLines && overlayLines.length > 0 && overlayLines.some(l => l.trim());
  
  let textInstruction: string;
  if (hasTextToDisplay) {
    const textToDisplay = overlayLines!.filter(l => l.trim()).join(" | ");
    textInstruction = `IMPORTANT: Display this text prominently on the image, large bold readable font, centered, white text with subtle shadow for mobile readability: "${textToDisplay}". Maximum 2 lines.`;
    console.log("[image-for-video] 📝 Text overlay requested:", textToDisplay);
  } else {
    textInstruction = "VISUAL ONLY, no text, no letters, no words visible.";
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate the following French image description to English. 
Keep it concise and visual. Output ONLY the English translation, nothing else.
${hasTextToDisplay ? 'Do NOT add any "no text" instruction.' : 'Add "VISUAL ONLY, no text, no letters, no words visible" at the end.'}`,
          },
          { role: "user", content: frenchPrompt },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.warn("[image-for-video] Translation failed, using original prompt");
      return `${frenchPrompt}. ${textInstruction}`;
    }

    const data = await response.json();
    let translated = data.choices?.[0]?.message?.content?.trim() || frenchPrompt;
    
    // ✅ Ajouter l'instruction texte appropriée
    return `${translated}. ${textInstruction}`;
  } catch (error) {
    console.error("[image-for-video] Translation error:", error);
    return `${frenchPrompt}. ${textInstruction}`;
  }
}

/**
 * Génère une image via Gemini 2.5 Flash Image
 */
async function generateImageWithGemini(prompt: string): Promise<string | null> {
  console.log("[image-for-video] 🎨 Generating image with Nano Banana Pro...");
  
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-pro-image-preview",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[image-for-video] ❌ Gemini error:", response.status, errText);
    return null;
  }

  const data = await response.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  
  if (!imageUrl) {
    console.warn("[image-for-video] ⚠️ No image in Gemini response");
    return null;
  }

  console.log("[image-for-video] ✅ Image generated successfully");
  return imageUrl;
}

/**
 * Upload base64 image vers Cloudinary
 */
async function uploadToCloudinary(base64Data: string, folder: string): Promise<{ url: string; publicId: string } | null> {
  console.log("[image-for-video] 📤 Uploading to Cloudinary...");
  
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  
  // Generate signature
  const encoder = new TextEncoder();
  const data = encoder.encode(paramsToSign + CLOUDINARY_API_SECRET);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const signature = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const formData = new FormData();
  formData.append("file", base64Data);
  formData.append("api_key", CLOUDINARY_API_KEY);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("[image-for-video] ❌ Cloudinary upload failed:", errText);
    return null;
  }

  const result = await response.json();
  console.log("[image-for-video] ✅ Uploaded to Cloudinary:", result.public_id);
  
  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

/**
 * Charge le brand kit pour enrichir le prompt
 */
async function loadBrandKit(brandId: string, supabase: any): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from("brands")
      .select("name, niche, pitch, palette, visual_mood, adjectives")
      .eq("id", brandId)
      .maybeSingle();
    
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ImageForVideoRequest = await req.json();
    const { renderId, prompt, aspectRatio = "9:16", brandId, useBrandKit = true, userId, overlayLines } = body;
    
    console.log("[image-for-video] 📋 Request:", { 
      hasOverlayLines: !!(overlayLines?.length), 
      overlayLinesPreview: overlayLines?.slice(0, 2),
      promptPreview: prompt?.slice(0, 50) 
    });

    if (!prompt) {
      return jsonResponse({ error: "Missing prompt" }, 400);
    }

    // Auth check
    const internalSecret = req.headers.get("x-internal-secret");
    const isInternalCall = internalSecret === INTERNAL_FN_SECRET;
    
    let effectiveUserId = userId;
    if (!isInternalCall) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      const supabaseUser = createClient(SUPABASE_URL, authHeader.replace("Bearer ", ""));
      const { data: { user } } = await supabaseUser.auth.getUser();
      effectiveUserId = user?.id;
    }

    if (!effectiveUserId) {
      return jsonResponse({ error: "Missing userId" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("[image-for-video] 🚀 START", {
      renderId,
      promptPreview: prompt.slice(0, 50),
      aspectRatio,
      brandId,
      useBrandKit,
    });

    // Update render status if renderId provided
    if (renderId) {
      await supabase
        .from("video_renders")
        .update({ status: "image_generating" })
        .eq("id", renderId);
    }

    // 1. Enrich prompt with brand kit
    let enrichedPrompt = prompt;
    if (useBrandKit && brandId) {
      const brand = await loadBrandKit(brandId, supabase);
      if (brand) {
        const enrichments: string[] = [];
        if (brand.niche) enrichments.push(`Industry: ${brand.niche}`);
        if (brand.palette?.length) enrichments.push(`Brand colors: ${brand.palette.slice(0, 3).join(", ")}`);
        if (brand.visual_mood?.length) enrichments.push(`Visual mood: ${brand.visual_mood.join(", ")}`);
        if (enrichments.length > 0) {
          enrichedPrompt = `${prompt}. ${enrichments.join(". ")}.`;
        }
        console.log("[image-for-video] 🎨 Brand kit enrichment:", enrichments);
      }
    }

    // 2. Translate FR → EN (avec support overlayLines)
    const englishPrompt = await translatePromptToEnglish(enrichedPrompt, overlayLines);
    console.log("[image-for-video] 🌐 English prompt:", englishPrompt.slice(0, 150));

    // 3. Add aspect ratio hint
    const aspectHint = aspectRatio === "9:16" 
      ? "Vertical portrait format (9:16 aspect ratio)." 
      : aspectRatio === "16:9" 
        ? "Horizontal landscape format (16:9 aspect ratio)."
        : "Square format (1:1 aspect ratio).";
    
    const finalPrompt = `${englishPrompt} ${aspectHint} Ultra high quality, photorealistic, cinematic lighting.`;

    // 4. Generate image with Gemini
    const base64Image = await generateImageWithGemini(finalPrompt);
    if (!base64Image) {
      if (renderId) {
        await supabase
          .from("video_renders")
          .update({ status: "failed", error: "Image generation failed", error_step: "image_generating" })
          .eq("id", renderId);
      }
      return jsonResponse({ error: "Image generation failed" }, 500);
    }

    // 5. Upload to Cloudinary
    const folder = `video-refs/${effectiveUserId}`;
    const cloudinaryResult = await uploadToCloudinary(base64Image, folder);
    if (!cloudinaryResult) {
      if (renderId) {
        await supabase
          .from("video_renders")
          .update({ status: "failed", error: "Cloudinary upload failed", error_step: "image_generating" })
          .eq("id", renderId);
      }
      return jsonResponse({ error: "Cloudinary upload failed" }, 500);
    }

    // 6. Update render status if renderId provided
    if (renderId) {
      await supabase
        .from("video_renders")
        .update({
          status: "image_done",
          reference_image_url: cloudinaryResult.url,
          reference_cloudinary_id: cloudinaryResult.publicId,
          visual_prompt_en: englishPrompt,
        })
        .eq("id", renderId);
    }

    console.log("[image-for-video] ✅ SUCCESS", {
      imageUrl: cloudinaryResult.url.slice(0, 60),
      publicId: cloudinaryResult.publicId,
    });

    return jsonResponse({
      success: true,
      imageUrl: cloudinaryResult.url,
      publicId: cloudinaryResult.publicId,
      promptEn: englishPrompt,
    });

  } catch (error: unknown) {
    console.error("[image-for-video] ❌ Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
