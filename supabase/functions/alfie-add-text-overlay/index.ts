import { edgeHandler } from '../_shared/edgeHandler.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

interface TextOverlayInput {
  imageUrl: string;
  overlayText: string;
  brand_id?: string;
  slideIndex?: number;
  totalSlides?: number;
  textPosition?: 'top' | 'center' | 'bottom';
  fontSize?: number;
}

export default {
  async fetch(req: Request) {
    return edgeHandler(req, async ({ jwt, input }) => {
      if (!jwt) throw new Error('MISSING_AUTH');

      const { 
        imageUrl, 
        overlayText, 
        brand_id,
        slideIndex,
        totalSlides,
        textPosition = 'center',
        fontSize = 48
      } = input as TextOverlayInput;

      if (!imageUrl || !overlayText) {
        throw new Error('MISSING_PARAMS: imageUrl and overlayText required');
      }

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

      // Récupérer les données de brand si fourni
      let brandColors = { primary: '#000000', secondary: '#FFFFFF' };
      let brandFont = 'Inter';

      if (brand_id) {
        const { data: brand } = await supabaseAdmin
          .from('brands')
          .select('palette, fonts')
          .eq('id', brand_id)
          .single();
          
        if (brand) {
          if (brand.palette && brand.palette.length > 0) {
            brandColors.primary = brand.palette[0];
            if (brand.palette.length > 1) {
              brandColors.secondary = brand.palette[1];
            }
          }
          if (brand.fonts && brand.fonts.length > 0) {
            brandFont = brand.fonts[0];
          }
        }
      }

      console.log('[Text Overlay] Processing:', {
        slideIndex,
        totalSlides,
        textLength: overlayText.length,
        brandFont,
        brandColors
      });

      // Utiliser l'IA pour composer l'image avec le texte
      // On utilise le modèle d'édition d'image de Gemini
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY_MISSING');

      const systemPrompt = `You are a professional text compositor for social media images.
CRITICAL RULES:
- Add the provided text overlay to the image with PERFECT French spelling
- Use high contrast for maximum readability (WCAG AA compliant)
- Maintain clean typography with proper spacing
- Position text at "${textPosition}" of the image
- Use font size ${fontSize}px with proper line height
- Apply subtle shadow or background for text legibility
- DO NOT alter the background image composition
- DO NOT change, add, or remove any other text`;

      const userPrompt = `Add this text overlay to the image with perfect French spelling and typography:

---
${overlayText}
---

Brand colors available:
- Primary: ${brandColors.primary}
- Secondary: ${brandColors.secondary}

Use these colors for text and ensure high contrast with the background.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            },
            {
              type: 'text',
              text: userPrompt
            }
          ]
        }
      ];

      const aiPayload = {
        model: 'google/gemini-2.5-flash-image',
        messages,
        modalities: ['image', 'text'],
      };

      console.log('[Text Overlay] Calling AI for text composition');

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
        console.error('[Text Overlay] AI Gateway error:', response.status, errorText);
        throw new Error(`TEXT_OVERLAY_FAILED: ${response.status}`);
      }

      const data = await response.json();
      const finalImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (!finalImageUrl) {
        console.error('[Text Overlay] No image in response');
        throw new Error('NO_IMAGE_GENERATED');
      }

      console.log('[Text Overlay] Success:', {
        slideIndex,
        totalSlides,
        outputUrl: finalImageUrl.substring(0, 100) + '...'
      });

      return {
        image_url: finalImageUrl,
        meta: {
          slideIndex,
          totalSlides,
          textLength: overlayText.length,
          brandFont,
          brandColors
        }
      };
    });
  }
};
