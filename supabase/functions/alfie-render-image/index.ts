import { edgeHandler } from "../_shared/edgeHandler.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { enrichPromptWithBrandKit } from "../_shared/aiOrchestrator.ts";
import { uploadWithRichMetadata, type RichMetadata } from "../_shared/cloudinaryUploader.ts";
import { getUserRoles, isAdminUser } from "../_shared/auth.ts";
import { WOOF_COSTS } from "../_shared/woofsCosts.ts";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  INTERNAL_FN_SECRET,
  LOVABLE_API_KEY,
} from "../_shared/env.ts";

export default {
  async fetch(req: Request) {
    return edgeHandler(req, async ({ jwt, input }) => {
      // ✅ Check internal secret FIRST (before JWT)
      const internalSecret = req.headers.get("x-internal-secret");
      const isInternalCall = internalSecret && internalSecret === INTERNAL_FN_SECRET;

      // JWT required ONLY if not internal call
      if (!isInternalCall && !jwt) {
        console.error("[alfie-render-image] ❌ Missing authentication");
        throw new Error("MISSING_AUTH");
      }

      const {
        provider,
        prompt,
        format = "1024x1024",
        brand_id,
        cost_woofs = 1,
        // Nouveaux params carrousel (optionnels)
        backgroundOnly = false,
        slideIndex,
        totalSlides,
        overlayText,
        negativePrompt,
        templateImageUrl,
        resolution,
        backgroundStyle = "gradient",
        textContrast = "dark",
        globalStyle, // ✅ NOUVEAU: style global pour cohérence
      } = input;

      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
        console.error("[alfie-render-image] ❌ Missing Supabase credentials");
        throw new Error("MISSING_ENV");
      }

      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // ✅ Conditional user authentication
      let userId: string;
      let supabaseAuth: any;
      let userEmail: string | null = null;
      const isAdminHint = input.isAdmin === true || input.is_admin === true;

      if (isInternalCall) {
        // Internal call: userId MUST be in input
        if (!input.userId) {
          console.error("[alfie-render-image] ❌ Missing userId in internal call");
          throw new Error("MISSING_USER_ID_IN_INTERNAL_CALL");
        }
        userId = input.userId;
        console.log("[alfie-render-image] ✅ Internal call authenticated, userId:", userId);

        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
        userEmail = authUser?.user?.email?.toLowerCase() ?? null;
      } else {
        // External call: authenticate via JWT
        supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${jwt}` } },
        });

        const {
          data: { user },
          error: userError,
        } = await supabaseAuth.auth.getUser();
        if (userError || !user) {
          console.error("[alfie-render-image] ❌ Invalid JWT token");
          throw new Error("INVALID_TOKEN");
        }
        userId = user.id;
        userEmail = user.email?.toLowerCase() ?? null;
        console.log("[alfie-render-image] ✅ External call authenticated, userId:", userId);
      }

      const roleRows = await getUserRoles(supabaseAdmin, userId);
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("plan, granted_by_admin")
        .eq("id", userId)
        .maybeSingle();

      let isAdmin = isAdminUser(userEmail, roleRows, {
        plan: profile?.plan ?? undefined,
        grantedByAdmin: profile?.granted_by_admin ?? undefined,
        logContext: "quota",
        isAdminFlag: isAdminHint,
      });

      // 1. Vérifier et consommer les Woofs (skip for internal calls or admin)
      if (!isInternalCall && brand_id && !isAdmin) {
        try {
          const { data: woofsData, error: woofsError } = await supabaseAdmin.functions.invoke(
            "woofs-check-consume",
            {
              body: {
                brand_id,
                cost_woofs: WOOF_COSTS.image,
                reason: "image",
                metadata: { prompt: prompt?.substring(0, 100) },
              },
            }
          );

          if (woofsError || !woofsData?.ok) {
            const errorCode = woofsData?.error?.code || "QUOTA_ERROR";
            if (errorCode === "INSUFFICIENT_WOOFS") {
              console.error("[alfie-render-image] Insufficient Woofs:", woofsData?.error);
              throw new Error("INSUFFICIENT_WOOFS");
            }
            console.error("[alfie-render-image] Woofs consumption failed:", woofsError);
            throw new Error("WOOFS_CONSUMPTION_FAILED");
          }

          console.log("[alfie-render-image] ✅ Consumed 1 Woof, remaining:", woofsData.data.remaining_woofs);
        } catch (woofsCheckError) {
          console.error("[alfie-render-image] Exception during woofs-check-consume:", woofsCheckError);
          throw woofsCheckError;
        }
      } else {
        console.log("[alfie-render-image] ⏭️ Skipping Woofs check", {
          isInternalCall,
          hasBrand: !!brand_id,
          isAdmin,
        });
      }

      try {
        // 3. Récupérer le Brand Kit si nécessaire (avant de construire les prompts)
        let brandKitData = null;
        let brandColors: string[] = [];

        if (brand_id) {
          const { data: brand } = await supabaseAdmin
            .from("brands")
            .select("name, palette, fonts, voice, niche")
            .eq("id", brand_id)
            .single();

          if (brand) {
            brandKitData = {
              name: brand.name,
              colors: brand.palette || [],
              fonts: brand.fonts || [],
              voice: brand.voice,
              style: brand.voice || "modern professional",
              niche: brand.niche,
            };
            brandColors = brand.palette || [];
          }
        }

        // 4. Génération IA
        if (!LOVABLE_API_KEY) {
          console.error("[alfie-render-image] ❌ Missing LOVABLE_API_KEY");
          throw new Error("LOVABLE_API_KEY_MISSING");
        }

        // System prompt de base (orthographe FR, 1 seule image)
        let systemPrompt = `You are a professional image generator for social media content.
CRITICAL RULES:
- Generate EXACTLY ONE single image (no grid, no collage, no multiple frames).
- Use perfect French spelling with proper accents: é, è, ê, à, ç, ù.
- Maintain high visual hierarchy and readability.

CRITICAL FRENCH TYPOGRAPHY RULES:
- DO NOT include any visible text in the image unless explicitly requested
- If text must appear, use ONLY correct French spelling:
  • "Découvrez" (not Decouvrez, not Découvrez with wrong accent)
  • "Créer" (not Creer)
  • "Télécharger" (not Telecharger)
  • "Qualité" (not Qualite)
  • "Élégant" (not Elegant)
- NEVER render styling metadata as visible text (no hex codes, no font names, no color codes)
- Better: Generate pure backgrounds with NO TEXT AT ALL when backgroundOnly is true`;

        // Enrichissement si carrousel
        if (typeof slideIndex === "number" && totalSlides) {
          systemPrompt += `\n\nCARROUSEL CONTEXT:
- This is slide ${slideIndex + 1}/${totalSlides} of a cohesive carousel.
- Each slide is independent but must maintain visual consistency across the set.
- DO NOT create grids, tiles, or multi-frame layouts.
- Keep composition rhythm and spacing consistent.`;
        }

        // Mode "fond" (pas de texte)
        if (backgroundOnly) {
          systemPrompt += `\n\nBACKGROUND GENERATION RULES:
- PRIORITY: ${backgroundStyle === "solid" ? "Solid colors or subtle gradients" : backgroundStyle === "gradient" ? "Smooth gradients" : backgroundStyle === "illustration" ? "Light illustrations" : "Photos with dark overlay"} (best readability)
- Center area MUST be 20% ${textContrast === "light" ? "darker" : "lighter"} than edges for text contrast
- Safe zones: Keep 80px margins on all sides clear
- NO decorative elements in center 60% of composition
- Use brand colors: ${brandColors[0] || "vibrant"}, ${brandColors[1] || "accent"}
- Style: ${backgroundStyle}

ABSOLUTE CRITICAL: NO TEXT AT ALL
- NO TEXT, NO TYPOGRAPHY, NO LETTERS anywhere in the image
- NO VISIBLE WORDS of any kind
- NO HEX COLOR CODES (like #90E3C2, #B58EE5)
- NO FONT NAMES (like Arial, Helvetica)
- NO STYLING METADATA visible in the image
- Generate a PURE BACKGROUND with NO TEXT ELEMENTS
- Text will be added separately by Cloudinary overlay system

CONTRAST REQUIREMENTS:
- Background contrast mode: ${textContrast} text (generate ${textContrast === "light" ? "dark" : "light"} background)
- Ensure WCAG AA compliance (4.5:1 contrast ratio minimum)`;
        }

        // Mode typographique (avec texte exact)
        if (overlayText && !backgroundOnly) {
          systemPrompt += `\n\nTEXT OVERLAY:
The following text MUST be integrated into the image with high contrast and readability:
---
${overlayText}
---
Ensure strong typographic hierarchy, ample margins, and WCAG AA contrast.`;
        }

        // Cohérence avec image de référence
        if (templateImageUrl) {
          systemPrompt += `\n\nREFERENCE IMAGE:
A reference image is provided. Mirror its composition rhythm, spacing, and text placement to maintain visual consistency across slides.`;
        }

        // Récupérer le Brand Kit et enrichir le prompt automatiquement
        let enrichedPrompt = prompt;

        if (brandKitData) {
          enrichedPrompt = enrichPromptWithBrandKit(prompt, brandKitData);

          console.log("[Render] Brand Kit auto-injected:", {
            originalPromptLength: prompt.length,
            enrichedPromptLength: enrichedPrompt.length,
            brandColors: brandColors.slice(0, 2),
          });
        }

        // ✅ NOUVEAU: Préfixer avec le style global si fourni
        let finalPrompt = globalStyle ? `Style: ${globalStyle}\n\nScene: ${enrichedPrompt}` : enrichedPrompt;

        // Ajouter le format si résolution fournie
        const targetFormat = resolution || format;
        if (targetFormat && targetFormat !== "1024x1024") {
          finalPrompt += `\nAspect ratio: ${targetFormat}.`;
        }

        // Ajouter negative prompt si fourni
        if (negativePrompt) {
          finalPrompt += `\n\nAVOID: ${negativePrompt}`;
        }

        // Si backgroundOnly, forcer l'instruction "NO TEXT"
        if (backgroundOnly) {
          finalPrompt += `\n\nBackground style: ${backgroundStyle}`;
          finalPrompt += `\n\nText contrast mode: ${textContrast}`;
          finalPrompt += `\n\nABSOLUTE CRITICAL: Generate a PURE BACKGROUND with NO TEXT, NO TYPOGRAPHY, NO LETTERS, NO VISIBLE WORDS, NO HEX CODES, NO FONT NAMES. Text will be added separately by overlay system.`;
        }

        // Removed detailed carousel logging for security
        console.log("[Render] Generating carousel image");

        // Construire les messages
        const messages: any[] = [
          { role: "system", content: systemPrompt },
          { role: "user", content: finalPrompt },
        ];

        // Si image de référence fournie, l'ajouter en multimodal
        if (templateImageUrl) {
          messages.push({
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: templateImageUrl },
              },
              {
                type: "text",
                text: "Use this image as a composition reference for visual consistency.",
              },
            ],
          });
        }

        const aiPayload = {
          model: "google/gemini-2.5-flash-image-preview",
          messages,
          modalities: ["image", "text"],
        };

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(aiPayload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("AI Gateway error:", response.status, errorText);
          throw new Error(`AI_GATEWAY_ERROR: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!imageUrl) {
          console.error("No image in response:", JSON.stringify(data));
          throw new Error("NO_IMAGE_GENERATED");
        }

        // 4. Upload with rich metadata to Cloudinary (if brand_id present)
        let finalImageUrl = imageUrl;

        if (brand_id && typeof slideIndex === "number") {
          try {
            const metadata: RichMetadata = {
              brandId: brand_id,
              campaign: `order_${Date.now()}`,
              orderId: brand_id,
              assetId: crypto.randomUUID(),
              type: "carousel_slide",
              format: format || "1024x1024",
              language: "fr",
              alt: prompt.substring(0, 100),
              slideIndex,
              renderVersion: 1,
              textVersion: 1,
              textPublicId: overlayText ? `text_${slideIndex}` : undefined,
            };

            const uploadResult = await uploadWithRichMetadata(imageUrl, metadata);
            finalImageUrl = uploadResult.secureUrl;

            console.log("[Render] Uploaded to Cloudinary with metadata:", uploadResult.publicId);
          } catch (uploadError) {
            console.error("[Render] Cloudinary upload failed, using original URL:", uploadError);
          }
        }

        // ⚠️ SECURITY: NEVER store base64 URLs in database (saturation prevention)
        if (finalImageUrl.startsWith('data:')) {
          console.error('[alfie-render-image] 🚨 BLOCKED: base64 URL forbidden in library_assets');
          throw new Error('SECURITY: base64 URLs are forbidden in database. Use Cloudinary URLs only.');
        }

        // 5. Stocker la génération
        const { data: generation, error: insertError } = await supabaseAdmin
          .from("media_generations")
          .insert({
            user_id: userId,
            brand_id: brand_id || null,
            type: "image",
            modality: "image",
            provider_id: provider || "gemini_image",
            prompt,
            output_url: finalImageUrl,
            render_url: finalImageUrl,
            status: "completed",
            cost_woofs,
            params_json: { format },
          })
          .select()
          .single();

        if (insertError) {
          console.error("Failed to insert generation:", insertError);
        } else {
          console.log("[Render] Generation stored:", {
            generation_id: generation?.id,
            slideIndex,
            totalSlides,
            backgroundOnly,
            hasOverlayText: !!overlayText,
            hasTemplate: !!templateImageUrl,
          });
        }

        // Note: counters_monthly déjà incrémenté par woofs-check-consume

        return {
          image_urls: [finalImageUrl],
          generation_id: generation?.id,
          meta: { provider: provider || "gemini_image", format, cost: cost_woofs },
        };
      } catch (genError: any) {
        // 5. REMBOURSEMENT en cas d'échec (via décrémentation counters_monthly)
        console.error("[Render] Generation failed, refunding Woofs:", genError);

        if (brand_id && !isAdmin) {
          const now = new Date();
          const periodYYYYMM = parseInt(
            now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, "0")
          );

          const { error: refundError } = await supabaseAdmin.rpc("decrement_monthly_counters", {
            p_brand_id: brand_id,
            p_period_yyyymm: periodYYYYMM,
            p_images: 0,
            p_reels: 0,
            p_woofs: WOOF_COSTS.image,
          });

          if (refundError) {
            console.error("[Render] Failed to refund Woofs:", refundError);
          } else {
            console.log("[Render] ✅ Refunded 1 Woof");
          }
        }

        throw genError;
      }
    });
  },
};
