import { edgeHandler } from '../_shared/edgeHandler.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { enrichPromptWithBrandKit } from '../_shared/aiOrchestrator.ts';

export default {
  async fetch(req: Request) {
    return edgeHandler(req, async ({ jwt, input }) => {
      if (!jwt) throw new Error('MISSING_AUTH');

        const { 
        provider, 
        prompt, 
        format = '1024x1024', 
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
        backgroundStyle = 'gradient',
        textContrast = 'dark',
        globalStyle // ✅ NOUVEAU: style global pour cohérence
      } = input;

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: `Bearer ${jwt}` } } }
      );

      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
      if (userError || !user) throw new Error('INVALID_TOKEN');

      // 1. Vérifier quota
      const { data: checkData, error: checkError } = await supabaseAuth.functions.invoke('alfie-check-quota', {
        body: { cost_woofs, brand_id },
      });

      if (checkError || !checkData?.ok || !checkData.data?.ok) {
        console.error('Quota check failed:', checkError, checkData);
        throw new Error('INSUFFICIENT_QUOTA');
      }

      // 2. Débiter (via RPC)
      const { error: consumeError } = await supabaseAdmin.rpc('consume_woofs', { 
        user_id_param: user.id, 
        woofs_amount: cost_woofs 
      });

      if (consumeError) {
        console.error('Failed to consume woofs:', consumeError);
        throw new Error('DEBIT_FAILED');
      }

      try {
        // 3. Récupérer le Brand Kit si nécessaire (avant de construire les prompts)
        let brandKitData = null;
        let brandColors: string[] = [];
        
        if (brand_id) {
          const { data: brand } = await supabaseAdmin
            .from('brands')
            .select('name, palette, fonts, voice, niche')
            .eq('id', brand_id)
            .single();
            
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

        // 4. Génération IA
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY_MISSING');

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
        if (typeof slideIndex === 'number' && totalSlides) {
          systemPrompt += `\n\nCARROUSEL CONTEXT:
- This is slide ${slideIndex + 1}/${totalSlides} of a cohesive carousel.
- Each slide is independent but must maintain visual consistency across the set.
- DO NOT create grids, tiles, or multi-frame layouts.
- Keep composition rhythm and spacing consistent.`;
        }

        // Mode "fond" (pas de texte)
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
            
            console.log('[Render] Brand Kit auto-injected:', {
              originalPromptLength: prompt.length,
              enrichedPromptLength: enrichedPrompt.length,
              brandColors: brandColors.slice(0, 2)
            });
        }

        // ✅ NOUVEAU: Préfixer avec le style global si fourni
        let finalPrompt = globalStyle 
          ? `Style: ${globalStyle}\n\nScene: ${enrichedPrompt}`
          : enrichedPrompt;

        // Ajouter le format si résolution fournie
        const targetFormat = resolution || format;
        if (targetFormat && targetFormat !== '1024x1024') {
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

        console.log('[Render] Generating image with carousel context:', {
          slideIndex,
          totalSlides,
          backgroundOnly,
          hasOverlayText: !!overlayText,
          hasTemplate: !!templateImageUrl
        });

        // Construire les messages
        const messages: any[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: finalPrompt }
        ];

        // Si image de référence fournie, l'ajouter en multimodal
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

        console.log('[Render] AI Payload:', JSON.stringify(aiPayload, null, 2));

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
          console.error('AI Gateway error:', response.status, errorText);
          throw new Error(`AI_GATEWAY_ERROR: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        
        if (!imageUrl) {
          console.error('No image in response:', JSON.stringify(data));
          throw new Error('NO_IMAGE_GENERATED');
        }

        // 4. Stocker la génération
        const { data: generation, error: insertError } = await supabaseAdmin
          .from('media_generations')
          .insert({
            user_id: user.id,
            brand_id: brand_id || null,
            type: 'image',
            modality: 'image',
            provider_id: provider || 'gemini_image',
            prompt,
            output_url: imageUrl,
            render_url: imageUrl,
            status: 'completed',
            cost_woofs,
            params_json: { format },
          })
          .select()
          .single();

        if (insertError) {
          console.error('Failed to insert generation:', insertError);
        } else {
          console.log('[Render] Generation stored:', {
            generation_id: generation?.id,
            slideIndex,
            totalSlides,
            backgroundOnly,
            hasOverlayText: !!overlayText,
            hasTemplate: !!templateImageUrl
          });
        }

        // ✅ NOUVEAU : Incrémenter le compteur visuals si brand_id présent
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
            console.error('[Render] Failed to increment visuals counter:', counterError);
            // Ne pas bloquer la réponse
          } else {
            console.log('[Render] Incremented visuals counter for brand', brand_id);
          }
        }

        return {
          image_urls: [imageUrl],
          generation_id: generation?.id,
          meta: { provider: provider || 'gemini_image', format, cost: cost_woofs },
        };
      } catch (genError: any) {
        // 5. REMBOURSEMENT en cas d'échec
        console.error('[Render] Generation failed, refunding woofs:', genError);
        
        const { error: refundError } = await supabaseAdmin.rpc('refund_woofs', { 
          user_id_param: user.id, 
          woofs_amount: cost_woofs 
        });

        if (refundError) {
          console.error('Failed to refund woofs:', refundError);
        }

        throw genError;
      }
    });
  }
};
