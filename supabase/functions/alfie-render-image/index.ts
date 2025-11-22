import { edgeHandler } from '../_shared/edgeHandler.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { enrichPromptWithBrandKit } from '../_shared/aiOrchestrator.ts';
import { uploadWithRichMetadata, type RichMetadata } from '../_shared/cloudinaryUploader.ts';
import { 
  SUPABASE_URL, 
  SUPABASE_ANON_KEY, 
  SUPABASE_SERVICE_ROLE_KEY,
  INTERNAL_FN_SECRET,
  LOVABLE_API_KEY 
} from '../_shared/env.ts';

export default {
  async fetch(req: Request) {
    return edgeHandler(req, async ({ jwt, input }) => {
      // ✅ Check internal secret FIRST (before JWT)
      const internalSecret = req.headers.get('x-internal-secret');
      const isInternalCall = internalSecret && internalSecret === INTERNAL_FN_SECRET;
      
      // JWT required ONLY if not internal call
      if (!isInternalCall && !jwt) {
        console.error('[alfie-render-image] ❌ Missing authentication');
        throw new Error('MISSING_AUTH');
      }

      const { 
        provider, 
        prompt, 
        format = '1024x1024', 
        brand_id, 
        cost_woofs = 1,
        // Params carrousel (optionnels)
        backgroundOnly = false,
        slideIndex,
        totalSlides,
        overlayText,
        negativePrompt,
        templateImageUrl,
        resolution,
        backgroundStyle = 'gradient',
        textContrast = 'dark',
        globalStyle // Style global pour cohérence
      } = input;

      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
        console.error('[alfie-render-image] ❌ Missing Supabase credentials');
        throw new Error('MISSING_ENV');
      }

      const supabaseAdmin = createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY
      );

      // 🔐 Auth utilisateur (nécessaire pour savoir qui génère)
      let userId: string;
      let supabaseAuth: any;

      if (isInternalCall) {
        // Internal call: userId MUST be in input
        if (!input.userId) {
          console.error('[alfie-render-image] ❌ Missing userId in internal call');
          throw new Error('MISSING_USER_ID_IN_INTERNAL_CALL');
        }
        userId = input.userId;
        console.log('[alfie-render-image] ✅ Internal call authenticated, userId:', userId);
      } else {
        // External call: authenticate via JWT
        supabaseAuth = createClient(
          SUPABASE_URL,
          SUPABASE_ANON_KEY,
          { global: { headers: { Authorization: `Bearer ${jwt}` } } }
        );
        
        const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
        if (userError || !user) {
          console.error('[alfie-render-image] ❌ Invalid JWT token', userError);
          throw new Error('INVALID_TOKEN');
        }
        userId = user.id;
        console.log('[alfie-render-image] ✅ External call authenticated, userId:', userId);
      }

      // ⚠️  QUOTAS DÉSACTIVÉS TEMPORAIREMENT
      // Pas de check alfie-check-quota, pas de consume_woofs, pas de refund_woofs.
      console.log('[alfie-render-image] ⚠️ Quota system temporarily disabled (no check, no debit).', {
        userId,
        isInternalCall,
        cost_woofs
      });
        console.log("[alfie-render-image] ✅ External call authenticated, userId:", userId);
      }

      const isAdminUser = ADMIN_USER_IDS.includes(userId);

      console.log("[alfie-render-image] Quota system temporarily disabled");

      try {
        // 1. Récupérer le Brand Kit si nécessaire
        let brandKitData: any = null;
        let brandColors: string[] = [];
        
        if (brand_id) {
          const { data: brand, error: brandError } = await supabaseAdmin
            .from('brands')
            .select('name, palette, fonts, voice, niche')
            .eq('id', brand_id)
            .single();
            
          if (brandError) {
            console.error('[alfie-render-image] Failed to fetch brand kit:', brandError);
          }

          if (brand) {
            brandKitData = {
              name: brand.name,
              colors: brand.palette || [],
              fonts: brand.fonts || [],
              voice: brand.voice,
              style: brand.voice || 'modern professional',
              niche: brand.niche
            };
            brandColors = brand.palette || [];
          }
        }

        // 2. Génération IA : préparation du system prompt
        if (!LOVABLE_API_KEY) {
          console.error('[alfie-render-image] ❌ Missing LOVABLE_API_KEY');
          throw new Error('LOVABLE_API_KEY_MISSING');
        }

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

        // Contexte carrousel
        if (typeof slideIndex === 'number' && totalSlides) {
          systemPrompt += `\n\nCARROUSEL CONTEXT:
- This is slide ${slideIndex + 1}/${totalSlides} of a cohesive carousel.
- Each slide is independent but must maintain visual consistency across the set.
- DO NOT create grids, tiles, or multi-frame layouts.
- Keep composition rhythm and spacing consistent.`;
        }

        // Mode "fond" (backgroundOnly)
        if (backgroundOnly) {
          systemPrompt += `\n\nBACKGROUND GENERATION RULES:
- PRIORITY: ${backgroundStyle === 'solid' ? 'Solid colors or subtle gradients' : backgroundStyle === 'gradient' ? 'Smooth gradients' : backgroundStyle === 'illustration' ? 'Light illustrations' : 'Photos with dark overlay'} (best readability)
- Center area MUST be 20% ${textContrast === 'light' ? 'darker' : 'lighter'} than edges for text contrast
- Safe zones: Keep 80px margins on all sides clear
- NO decorative elements in center 60% of composition
- Use brand colors: ${brandColors[0] || 'vibrant'}, ${brandColors[1] || 'accent'}
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
- Background contrast mode: ${textContrast} text (generate ${textContrast === 'light' ? 'dark' : 'light'} background)
- Ensure WCAG AA compliance (4.5:1 contrast ratio minimum)`;
        }

        // Mode texte intégré
        if (overlayText && !backgroundOnly) {
          systemPrompt += `\n\nTEXT OVERLAY:
The following text MUST be integrated into the image with high contrast and readability:
---
${overlayText}
---
Ensure strong typographic hierarchy, ample margins, and WCAG AA contrast.`;
        }

        // Image de référence
        if (templateImageUrl) {
          systemPrompt += `\n\nREFERENCE IMAGE:
A reference image is provided. Mirror its composition rhythm, spacing, and text placement to maintain visual consistency across slides.`;
        }

        // 3. Enrichir le prompt avec le Brand Kit
        let enrichedPrompt = prompt;

        if (brandKitData) {
          enrichedPrompt = enrichPromptWithBrandKit(prompt, brandKitData);
          
          console.log('[alfie-render-image] Brand Kit auto-injected:', {
            originalPromptLength: prompt?.length ?? 0,
            enrichedPromptLength: enrichedPrompt?.length ?? 0,
            brandColors: brandColors.slice(0, 2)
          });
        }

        // Style global optionnel
        let finalPrompt = globalStyle 
          ? `Style: ${globalStyle}\n\nScene: ${enrichedPrompt}`
          : enrichedPrompt;

        // Format / aspect ratio
        const targetFormat = resolution || format;
        if (targetFormat && targetFormat !== '1024x1024') {
          finalPrompt += `\nAspect ratio: ${targetFormat}.`;
        }

        // Negative prompt
        if (negativePrompt) {
          finalPrompt += `\n\nAVOID: ${negativePrompt}`;
        }

        // Renforcer le mode "backgroundOnly"
        if (backgroundOnly) {
          finalPrompt += `\n\nBackground style: ${backgroundStyle}`;
          finalPrompt += `\n\nText contrast mode: ${textContrast}`;
          finalPrompt += `\n\nABSOLUTE CRITICAL: Generate a PURE BACKGROUND with NO TEXT, NO TYPOGRAPHY, NO LETTERS, NO VISIBLE WORDS, NO HEX CODES, NO FONT NAMES. Text will be added separately by overlay system.`;
        }

        console.log('[alfie-render-image] Generating image (carousel mode may be active).');

        // 4. Construire les messages pour le modèle
        const messages: any[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: finalPrompt }
        ];

        if (templateImageUrl) {
          messages.push({
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: templateImageUrl }
              },
              {
                type: 'text',
                text: 'Use this image as a composition reference for visual consistency.'
              }
            ]
          });
        }

        const aiPayload = {
          model: 'google/gemini-2.5-flash-image-preview',
          messages,
          modalities: ['image', 'text'],
        };

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(aiPayload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[alfie-render-image] AI Gateway error:', response.status, errorText);
          throw new Error(`AI_GATEWAY_ERROR: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        
        if (!imageUrl) {
          console.error('[alfie-render-image] No image in response:', JSON.stringify(data));
          throw new Error('NO_IMAGE_GENERATED');
        }

        // 5. Upload Cloudinary (optionnel)
        let finalImageUrl = imageUrl;
        
        if (brand_id && typeof slideIndex === 'number') {
          try {
            const metadata: RichMetadata = {
              brandId: brand_id,
              campaign: `order_${Date.now()}`,
              orderId: brand_id,
              assetId: crypto.randomUUID(),
              type: 'carousel_slide',
              format: format || '1024x1024',
              language: 'fr',
              alt: prompt.substring(0, 100),
              slideIndex,
              renderVersion: 1,
              textVersion: 1,
              textPublicId: overlayText ? `text_${slideIndex}` : undefined
            };
            
            const uploadResult = await uploadWithRichMetadata(imageUrl, metadata);
            finalImageUrl = uploadResult.secureUrl;
            
            console.log('[alfie-render-image] Uploaded to Cloudinary with metadata:', uploadResult.publicId);
          } catch (uploadError) {
            console.error('[alfie-render-image] Cloudinary upload failed, using original URL:', uploadError);
          }
        }
        
        // 6. Stocker la génération
        const { data: generation, error: insertError } = await supabaseAdmin
          .from('media_generations')
          .insert({
            user_id: userId,
            brand_id: brand_id || null,
            type: 'image',
            modality: 'image',
            provider_id: provider || 'gemini_image',
            prompt,
            output_url: finalImageUrl,
            render_url: finalImageUrl,
            status: 'completed',
            cost_woofs,
            params_json: { format },
          })
          .select()
          .single();

        if (insertError) {
          console.error('[alfie-render-image] Failed to insert generation:', insertError);
        } else {
          console.log('[alfie-render-image] Generation stored:', {
            generation_id: generation?.id,
            slideIndex,
            totalSlides,
            backgroundOnly,
            hasOverlayText: !!overlayText,
            hasTemplate: !!templateImageUrl
          });
        }

        // 7. Incrémenter le compteur mensuel par brand (non bloquant)
        if (brand_id) {
          const now = new Date();
          const periodYYYYMM = parseInt(
            now.getFullYear().toString() + 
            (now.getMonth() + 1).toString().padStart(2, '0')
          );
          
          const { error: counterError } = await supabaseAdmin.rpc('increment_monthly_counters', {
            p_brand_id: brand_id,
            p_period_yyyymm: periodYYYYMM,
            p_images: 1,
            p_reels: 0,
            p_woofs: 0
          });
          
          if (counterError) {
            console.error('[alfie-render-image] Failed to increment visuals counter:', counterError);
          } else {
            console.log('[alfie-render-image] Incremented visuals counter for brand', brand_id);
          }
        }

        return {
          image_urls: [finalImageUrl],
          generation_id: generation?.id,
          meta: { provider: provider || 'gemini_image', format, cost: cost_woofs },
        };
      } catch (genError: any) {
        console.error('[alfie-render-image] Generation failed:', genError);
        // Pas de remboursement woofs car le système de quotas est désactivé
        console.error("[Render] Generation failed:", genError);
        console.log("[alfie-render-image] Quota system temporarily disabled");
        throw genError;
      }
    });
  }
};
