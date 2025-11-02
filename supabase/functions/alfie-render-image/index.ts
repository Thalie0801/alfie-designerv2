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
        resolution
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
        // 3. Génération IA
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY_MISSING');

        // System prompt de base (orthographe FR, 1 seule image)
        let systemPrompt = `You are a professional image generator for social media content.
CRITICAL RULES:
- Generate EXACTLY ONE single image (no grid, no collage, no multiple frames).
- Use perfect French spelling with proper accents: é, è, ê, à, ç, ù.
- Maintain high visual hierarchy and readability.`;

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
          systemPrompt += `\n\nBACKGROUND MODE:
- Generate a clean background composition with NO TEXT.
- Keep center area lighter for readability of future overlay text.
- Strong edges for framing, minimal distractions.`;
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

        if (brand_id) {
          const { data: brand } = await supabaseAdmin
            .from('brands')
            .select('name, palette, fonts, voice, niche')
            .eq('id', brand_id)
            .single();
            
          if (brand) {
            const brandKitData = {
              name: brand.name,
              colors: brand.palette || [],
              fonts: brand.fonts || [],
              voice: brand.voice,
              style: brand.voice || 'modern professional',
              niche: brand.niche
            };
            
            enrichedPrompt = enrichPromptWithBrandKit(prompt, brandKitData);
            
            console.log('[Render] Brand Kit auto-injected:', {
              originalPromptLength: prompt.length,
              enrichedPromptLength: enrichedPrompt.length,
              brandColors: brandKitData.colors.slice(0, 2)
            });
          }
        }

        // Construire le prompt utilisateur final
        let finalPrompt = enrichedPrompt;

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
          finalPrompt += `\n\nCRITICAL: Generate a background composition with NO TEXT, NO TYPOGRAPHY, NO LETTERS.`;
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
          model: 'google/gemini-2.5-flash-image',
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
