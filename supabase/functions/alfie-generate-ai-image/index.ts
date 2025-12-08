import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { 
  SUPABASE_URL, 
  SUPABASE_SERVICE_ROLE_KEY,
  INTERNAL_FN_SECRET,
  LOVABLE_API_KEY 
} from '../_shared/env.ts';

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
// ✅ Brand Kit V2 - Interface enrichie
interface BrandKit {
  id?: string;
  name?: string;
  palette?: string[];
  logo_url?: string;
  fonts?: any;
  voice?: string;
  // V2 fields
  niche?: string;
  pitch?: string;
  adjectives?: string[];
  tagline?: string;
  tone_sliders?: {
    fun: number;
    accessible: number;
    energetic: number;
    direct: number;
  };
  person?: string;
  language_level?: string;
  visual_types?: string[];
  visual_mood?: string[];
  avoid_in_visuals?: string;
}

interface GenerateRequest {
  userId?: string;
  brandId?: string | null;
  orderId?: string | null;
  orderItemId?: string | null;
  requestId?: string | null;
  templateImageUrl?: string;
  uploadedSourceUrl?: string | null;
  brandKit?: BrandKit;
  prompt?: string;
  resolution?: string;
  slideIndex?: number;
  totalSlides?: number;
  overlayText?: string;
  carouselId?: string;
  backgroundOnly?: boolean;
  seed?: string;
  negativePrompt?: string;
  useBrandKit?: boolean;
  userPlan?: string; // ✅ AJOUT : Plan utilisateur pour sélection du modèle IA
}

/* --------------------------- Small helpers -------------------------- */
const clampRes = (res?: string) => {
  // formats acceptés ; fallback en 1080x1350
  const ok = ["1080x1350", "1080x1080", "1920x1080", "1080x1920"];
  return ok.includes(String(res)) ? String(res) : "1080x1350";
};

const short = (s?: string, n = 300) => (s || "").slice(0, n);

import { paletteToDescriptions } from '../_shared/colorContrast.ts';

function buildBackgroundOnlyPrompt(brand?: BrandKit) {
  const colorDesc = paletteToDescriptions(brand?.palette);
  return `Abstract background composition.
Style: ${brand?.voice || "modern, professional"}
Color palette: ${colorDesc}

CRITICAL RULES:
- NO TEXT whatsoever
- NO LETTERS, NO WORDS, NO TYPOGRAPHY
- Pure visual: gradients, shapes, geometric patterns, textures
- Clean, minimal, suitable as background layer
- Leave center area lighter for text overlay
- NEVER display hex codes or color values in the image`;
}

function buildMainPrompt(input: GenerateRequest): string {
  const {
    prompt,
    brandKit,
    backgroundOnly,
    overlayText,
    templateImageUrl,
    slideIndex,
    totalSlides,
    resolution,
    seed,
    negativePrompt,
    useBrandKit,
  } = input;

  const res = clampRes(resolution);
  const shouldApplyBrand = useBrandKit !== false; // Default true, explicit false = disable

  let fullPrompt = prompt || "Create a high-quality marketing visual based on the description";

  // Mode background pur
  if (backgroundOnly) {
    fullPrompt = buildBackgroundOnlyPrompt(shouldApplyBrand ? brandKit : undefined);
  } else {
    // Mode normal : intégration native du texte par Gemini 3 Pro
    if (overlayText) {
      fullPrompt += `\n\n--- TEXTE À INTÉGRER NATIVEMENT DANS L'IMAGE ---`;
      fullPrompt += `\nIntègre ce texte français EXACTEMENT tel quel dans l'image :`;
      fullPrompt += `\n« ${overlayText} »`;
      fullPrompt += `\n\nRÈGLES D'INTÉGRATION TEXTE MARKETING :`;
      fullPrompt += `\n- Le TITRE principal doit être en gros, centré ou légèrement en haut`;
      fullPrompt += `\n- Le BODY (texte secondaire) plus petit sous le titre`;
      fullPrompt += `\n- Le CTA (appel à l'action) en style bouton ou zone distincte en bas`;
      fullPrompt += `\n- CONTRASTE ÉLEVÉ obligatoire : texte clair sur fond sombre OU texte sombre sur fond clair`;
      fullPrompt += `\n- Ajoute une ombre portée ou un contour pour garantir la lisibilité`;
      fullPrompt += `\n- Typographie professionnelle, moderne, adaptée à la marque`;
      fullPrompt += `\n- Le texte fait PARTIE INTÉGRANTE du design graphique`;
      fullPrompt += `\n--- FIN INSTRUCTIONS TEXTE ---`;
    }
  }

  // Contexte carrousel (UNE SEULE slide)
  if (typeof slideIndex === "number" && typeof totalSlides === "number" && totalSlides > 1) {
    fullPrompt += `\n\nIMPORTANT: This is slide ${slideIndex + 1} of ${totalSlides} in a carousel.`;
    fullPrompt += `\nGenerate ONLY slide ${slideIndex + 1} of ${totalSlides}. Create ONE SINGLE standalone image, NOT a collage or grid of multiple slides.`;
    fullPrompt += `\nEach slide should be a complete, independent visual that works on its own.`;
    if (templateImageUrl) {
      fullPrompt += `\nKeep the same visual style as the reference image (colors, typography vibe, spacing, text placement).`;
      fullPrompt += `\nMaintain visual coherence with the first slide while adapting the content.`;
    }
  }

  // ✅ Brand Kit V2 - Application conditionnée par useBrandKit
  if (!backgroundOnly && shouldApplyBrand && brandKit) {
    // V1: Couleurs - convertir en descriptions naturelles
    if (brandKit.palette?.length) {
      const colorDesc = paletteToDescriptions(brandKit.palette);
      fullPrompt += `\n\nBrand Color Palette (use these colors): ${colorDesc}`;
      fullPrompt += `\nNEVER display hex codes or color values as text in the image.`;
    }
    
    // V2: Secteur d'activité
    if (brandKit.niche) {
      fullPrompt += `\nIndustry/Niche: ${brandKit.niche}`;
    }
    
    // V2: Pitch de marque
    if (brandKit.pitch) {
      fullPrompt += `\nBrand essence: ${brandKit.pitch}`;
    }
    
    // V2: Adjectifs de personnalité
    if (brandKit.adjectives?.length) {
      fullPrompt += `\nBrand personality: ${brandKit.adjectives.join(', ')}`;
    }
    
    // V1: Voice
    if (brandKit.voice) {
      fullPrompt += `\nBrand Voice/Style: ${brandKit.voice}`;
    }
    
    // V2: Ton de communication (sliders)
    if (brandKit.tone_sliders) {
      const tone = brandKit.tone_sliders;
      const toneDesc: string[] = [];
      if (tone.fun !== undefined) toneDesc.push(tone.fun > 5 ? 'fun/playful' : 'serious/professional');
      if (tone.accessible !== undefined) toneDesc.push(tone.accessible > 5 ? 'approachable' : 'corporate');
      if (tone.energetic !== undefined) toneDesc.push(tone.energetic > 5 ? 'energetic' : 'calm');
      if (tone.direct !== undefined) toneDesc.push(tone.direct > 5 ? 'direct' : 'nuanced');
      if (toneDesc.length) fullPrompt += `\nCommunication style: ${toneDesc.join(', ')}`;
    }
    
    // V2: Niveau de langage
    if (brandKit.language_level) {
      const levels: Record<string, string> = { familier: 'casual', courant: 'standard', soutenu: 'formal' };
      fullPrompt += `\nLanguage style: ${levels[brandKit.language_level] || 'professional'}`;
    }
    
    // V2: Style visuel préféré
    if (brandKit.visual_types?.length) {
      const typeLabels: Record<string, string> = {
        illustrations_2d: '2D illustrations', illustrations_3d: '3D renders',
        photos: 'photography', mockups: 'product mockups',
        doodle: 'hand-drawn style', corporate: 'corporate/professional'
      };
      fullPrompt += `\nPreferred visual style: ${brandKit.visual_types.map(t => typeLabels[t] || t).join(', ')}`;
    }
    
    // V2: Ambiance visuelle
    if (brandKit.visual_mood?.length) {
      fullPrompt += `\nVisual mood: ${brandKit.visual_mood.join(', ')}`;
    }
    
    // V2: Éléments à éviter (CRITIQUE)
    if (brandKit.avoid_in_visuals) {
      fullPrompt += `\nCRITICAL - AVOID in visuals: ${brandKit.avoid_in_visuals}`;
    }
    
    // V2: Tagline de référence
    if (brandKit.tagline) {
      fullPrompt += `\nReference tagline: "${brandKit.tagline}"`;
    }
  } else if (!backgroundOnly) {
    // Style neutre si Brand Kit désactivé
    fullPrompt += `\n\nStyle: Professional, modern, clean design with neutral color palette.`;
  }

  // Infos tech libres
  if (seed) fullPrompt += `\nSeed (hint): ${seed}`;
  if (!backgroundOnly && negativePrompt) {
    fullPrompt += `\nNegative prompt (constraints): ${negativePrompt}`;
  }

  fullPrompt += `\n\nTarget resolution: ${res}`;

  return fullPrompt;
}

function buildSystemPrompt(resolution?: string) {
  const res = clampRes(resolution);
  return `You are a professional image generator specialized in creating stunning visuals for social media and marketing.

CRITICAL FRENCH SPELLING RULES:
- Use PERFECT French spelling with proper accents: é, è, ê, à, ç, ù, œ, etc.
- Common corrections to apply:
  * "CRÉATIVET" → "CRÉATIVITÉ"
  * "ENTRPRENEURS" → "ENTREPRENEURS"
  * "puisence" → "puissance"
  * "décupèle/décuplèe" → "décuplée"
  * "vidéos captatives" → "vidéos captivantes"
  * "Marktplace/Marketpace" → "Marketplace"
  * "libérze" → "libérez"
  * "automutéée" → "automatisée"
  * "integration" → "intégration"
  * "créativ" → "créatif/créative"
  * "visuals" → "visuels"
  * "captvatines" → "captivantes"
  * "artifécralle" → "artificielle"
  * "partranaire" → "partenaire"
  * "d'éeil" → "d'œil"
- If overlayText is provided, reproduce it EXACTLY as given - no modifications, no additions
- If a reference image is provided, maintain similar composition, style, color palette, typography vibe, and text placement
- Always produce exactly ONE high-quality image in message.images[0]
- For carousels: generate ONE slide at a time, not a grid or collage. One canvas, no tiles, no multiple frames
- Generate high-quality images suitable for ${res} resolution with good contrast and readability`;
}

function buildNegativePrompt(input: GenerateRequest) {
  if (input.backgroundOnly) {
    return "text, letters, words, typography, captions, labels, signs, writing, alphabet, characters, numbers";
  }
  return input.negativePrompt || "";
}

// ✅ LOVABLE AI - Génération d'images (moteur principal)
async function callLovableOnce(opts: { apiKey: string; system: string; userContent: any[]; userPlan?: string }) {
  const { apiKey, system, userContent } = opts;
  
  console.log(`🎨 [alfie-generate-ai-image] Lovable AI - Model: ${LOVABLE_MODELS.image_premium}`);
  
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LOVABLE_MODELS.image_premium,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      modalities: ["image", "text"],
    }),
  });

  return resp;
}

/* ------------------------------- Handler ------------------------------ */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonRes({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // ✅ Lovable AI plus obligatoire si Vertex AI configuré
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase env not configured");
    }
    if (!INTERNAL_FN_SECRET) throw new Error("INTERNAL_FN_SECRET not configured");

    const body = (await req.json()) as GenerateRequest;

    const secret = req.headers.get("X-Internal-Secret");
    if (secret !== INTERNAL_FN_SECRET) {
      return jsonRes({ error: "Forbidden" }, { status: 403 });
    }

    const userId = typeof body.userId === "string" ? body.userId : null;
    const brandId = typeof body.brandId === "string" ? body.brandId : null;
    const orderId = typeof body.orderId === "string" ? body.orderId : null;
    const orderItemId = typeof body.orderItemId === "string" ? body.orderItemId : null;
    const requestId = typeof body.requestId === "string" ? body.requestId : null;

    if (!userId) {
      return jsonRes({ error: "Missing userId" }, { status: 400 });
    }
    if (!orderId) {
      console.warn("[alfie-generate-ai-image] Missing orderId in payload");
    }

    console.log('[alfie-generate-ai-image] Received request:', { userId, brandId, orderId, orderItemId });

    // Validation stricte du brandId
    if (!brandId) {
      console.error("[alfie-generate-ai-image] ❌ Missing brandId - cannot upload to Cloudinary");
      return jsonRes({ error: "Missing brandId - required for image generation" }, { status: 400 });
    }

    const sbService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Construire prompts & payload ---
    const systemPrompt = buildSystemPrompt(body.resolution);
    const fullPrompt = buildMainPrompt(body);
    const negative = buildNegativePrompt(body);

    const referenceImage =
      body.uploadedSourceUrl?.trim() || body.templateImageUrl?.trim() || null;
    const userContent: any[] = [{ type: "text", text: fullPrompt }];
    if (referenceImage) {
      userContent.push({ type: "image_url", image_url: { url: referenceImage } });
    }
    if (negative) {
      // On peut glisser le negative prompt explicitement dans le message
      userContent.push({ type: "text", text: `Negative prompt: ${negative}` });
    }

    // --- Génération via Lovable AI ---
    let generatedImageUrl: string | undefined;
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }
    
    console.log("🎨 [alfie-generate-ai-image] Generating with Lovable AI...");
    const resp = await callLovableOnce({
      apiKey: LOVABLE_API_KEY,
      system: systemPrompt,
      userContent,
      userPlan: body.userPlan,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("Lovable error:", resp.status, short(errText, 500));

      if (resp.status === 429)
        return jsonRes({ error: "Rate limit exceeded. Please try again later." }, { status: 429 });
      if (resp.status === 402)
        return jsonRes({ error: "Insufficient credits. Please add credits to your workspace." }, { status: 402 });

      throw new Error(`AI gateway error: ${resp.status}`);
    }

    const data = await resp.json();
    generatedImageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    // --- Retry unique si pas d'image ---
    if (!generatedImageUrl) {
      const retryPrompt =
        fullPrompt +
        "\n\nIMPORTANT: You MUST return an image. Generate a single canvas, no tiles, no grids, no multiple frames. One composition.";
      const retryContent = [{ type: "text", text: retryPrompt }] as any[];
      if (referenceImage) {
        retryContent.push({ type: "image_url", image_url: { url: referenceImage } });
      }
      if (negative) retryContent.push({ type: "text", text: `Negative prompt: ${negative}` });

      const retry = await callLovableOnce({
        apiKey: LOVABLE_API_KEY,
        system:
          "You are a professional image generator. Always produce exactly ONE high-quality image in message.images[0]. Use PERFECT French spelling with proper accents.",
        userContent: retryContent,
        userPlan: body.userPlan,
      });

      const retryJson = await retry.json().catch(() => null);
      generatedImageUrl = retryJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    }

    if (!generatedImageUrl) throw new Error("No image generated by Lovable AI");

    // --- Upload sur Cloudinary pour stockage permanent ---
    let cloudinaryPublicId: string | null = null;
    
    if (generatedImageUrl) {
      const isBase64 = generatedImageUrl.startsWith('data:');
      const isCloudinary = generatedImageUrl.includes('cloudinary.com');
      
      // Upload uniquement si ce n'est pas déjà une URL Cloudinary
      if (!isCloudinary) {
        console.log(`[alfie-generate-ai-image] Uploading ${isBase64 ? 'base64' : 'HTTP URL'} to Cloudinary via SDK...`);
        
        if (!brandId) {
          console.warn('[alfie-generate-ai-image] ⚠️ Missing brandId, using "unknown" folder');
        }
        
        try {
          // ✅ ALIGNED WITH CAROUSELS: Use official Cloudinary SDK via edge function
          const { data: cloudinaryResult, error: uploadErr } = await sbService.functions.invoke("cloudinary", {
            body: {
              action: "upload",
              params: {
                file: generatedImageUrl,  // ← Accepts base64 OR HTTP URL
                folder: orderId 
                  ? `alfie/${brandId}/orders/${orderId}` 
                  : `alfie/${brandId}/images`,
                public_id: orderId 
                  ? `img_${Date.now()}`
                  : `img_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                resource_type: "image",
                tags: [userId, 'generated', 'alfie'].filter(Boolean),
              },
            },
          });

          if (uploadErr || !cloudinaryResult) {
            throw new Error(`Cloudinary upload failed: ${uploadErr?.message || 'Unknown error'}`);
          }

          // ✅ Le SDK Cloudinary retourne TOUJOURS le public_id complet avec folder
          cloudinaryPublicId = cloudinaryResult.public_id;  // ← "alfie/.../img_1234"
          generatedImageUrl = cloudinaryResult.secure_url;  // ← URL complète
          
          // Logs détaillés du résultat d'upload
          console.log('[alfie-generate-ai-image] ✅ Cloudinary SDK upload result:', {
            secure_url: cloudinaryResult.secure_url,
            public_id: cloudinaryResult.public_id,
            publicId_includes_folder: cloudinaryResult.public_id?.includes('/'),
            publicId_starts_with_alfie: cloudinaryResult.public_id?.startsWith('alfie/'),
            expected_format: `alfie/${brandId}/orders/${orderId}/img_...`,
          });
          
          console.log('[alfie-generate-ai-image] Full publicId from Cloudinary SDK:', cloudinaryResult.public_id);

          // ✅ CRITICAL: Verify image exists on Cloudinary before continuing
          const verifyUrl = cloudinaryResult.secure_url;
          console.log('[alfie-generate-ai-image] Verifying image exists:', verifyUrl);
          
          const verifyResponse = await fetch(verifyUrl, { method: "HEAD" });
          if (!verifyResponse.ok) {
            const errorMsg = `Image verification failed: ${verifyResponse.status} ${verifyResponse.statusText}`;
            console.error('[alfie-generate-ai-image] ❌', errorMsg, { url: verifyUrl });
            throw new Error(errorMsg);
          }
          
          console.log('[alfie-generate-ai-image] ✅ Image verified on Cloudinary');
        } catch (cloudinaryError) {
          console.error('[alfie-generate-ai-image] Cloudinary upload failed:', cloudinaryError);
          throw new Error(`Failed to upload to Cloudinary: ${cloudinaryError instanceof Error ? cloudinaryError.message : 'Unknown error'}`);
        }
      } else {
        console.log('[alfie-generate-ai-image] ✅ Already a Cloudinary URL, no upload needed');
        // Extraire le publicId depuis l'URL Cloudinary existante
        const match = generatedImageUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
        if (match) {
          cloudinaryPublicId = match[1].replace(/\.[^.]+$/, '');
        }
      }
    }

    // --- Sauvegarde bibliothèque ---
    let saved = false;
    let errorDetail: string | null = null;

    try {
      const brandIdForMetadata = brandId ?? (typeof body.brandKit?.id === "string" ? body.brandKit.id : null);
      const slideIdx = typeof body.slideIndex === "number" ? body.slideIndex : null;
      const totalSlides = typeof body.totalSlides === "number" ? body.totalSlides : null;

      const insertPayload = {
        user_id: userId,
        brand_id: brandIdForMetadata,
        type: "image" as const,
        status: "completed" as const,
        // On log uniquement un résumé court pour conformité
        prompt: short(fullPrompt, 500),
        output_url: generatedImageUrl!,
        thumbnail_url: generatedImageUrl!,
        woofs: 1,
        metadata: {
          resolution: clampRes(body.resolution),
          brandName: body.brandKit?.name ?? null,
          slideIndex: slideIdx,
          totalSlides,
          carouselId: body.carouselId ?? null,
          overlayText: body.overlayText ?? null,
          backgroundOnly: !!body.backgroundOnly,
          seed: body.seed ?? null,
          negativePrompt: body.negativePrompt ?? null,
          generatedAt: new Date().toISOString(),
          engine: "gemini-2.5-flash-image-preview",
          orderId,
          orderItemId,
          requestId,
          referenceImageUrl: referenceImage ?? null,
        },
      };

      const { data: inserted, error: insertError } = await sbService
        .from("media_generations")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertError) {
        console.error("Save error:", insertError);
        errorDetail = insertError.message ?? "insert error";
      } else {
        console.log(`Saved media id=${inserted?.id} user=${userId} brand=${brandIdForMetadata ?? "null"}`);
        saved = true;
      }
    } catch (e: any) {
      console.error("Save exception:", e?.message || e);
      errorDetail = String(e?.message || e);
    }

    return jsonRes({
      imageUrl: generatedImageUrl,
      cloudinaryPublicId: cloudinaryPublicId || null,
      message: "Image générée avec succès",
      saved,
      errorDetail,
    });
  } catch (error) {
    console.error("Error in alfie-generate-ai-image:", error);
    return jsonRes({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
});
