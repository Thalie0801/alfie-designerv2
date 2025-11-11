import { edgeHandler } from '../_shared/edgeHandler.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

interface TextOverlayInput {
  imageUrl: string;
  overlayText: string;
  brand_id?: string;
  slideIndex?: number;
  totalSlides?: number;
  slideNumber?: string;
  textContrast?: 'light' | 'dark';
  isLastSlide?: boolean;
  textPosition?: 'top' | 'center' | 'bottom';
  fontSize?: number;
}

// Fonction pour convertir une data URL en ArrayBuffer
async function dataUrlToArrayBuffer(dataUrl: string): Promise<ArrayBuffer> {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Fonction pour créer une image avec texte en SVG overlay
function createSvgOverlay(width: number, height: number, text: string, textColor: string, position: 'top' | 'center' | 'bottom', fontSize: number): string {
  const lines = text.split('\n').filter(l => l.trim());
  const lineHeight = fontSize * 1.4;
  const totalHeight = lines.length * lineHeight;
  
  let yStart: number;
  if (position === 'top') {
    yStart = fontSize + 100;
  } else if (position === 'bottom') {
    yStart = height - totalHeight - 100;
  } else {
    yStart = (height - totalHeight) / 2 + fontSize;
  }

  const textElements = lines.map((line, i) => {
    const y = yStart + (i * lineHeight);
    return `
      <!-- Ombre portée pour contraste -->
      <text
        x="50%"
        y="${y + 3}"
        text-anchor="middle"
        font-family="Inter, Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="700"
        fill="#00000099"
        style="paint-order: stroke; stroke: #000000; stroke-width: 8px; stroke-linejoin: round;"
      >${escapeXml(line)}</text>
      <!-- Texte principal -->
      <text
        x="50%"
        y="${y}"
        text-anchor="middle"
        font-family="Inter, Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="700"
        fill="${textColor}"
        style="paint-order: stroke; stroke: ${textColor === '#FFFFFF' ? '#000000' : '#FFFFFF'}; stroke-width: 3px; stroke-linejoin: round;"
      >${escapeXml(line)}</text>
    `;
  }).join('');

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${textElements}
    </svg>
  `;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
        slideNumber,
        textContrast = 'dark',
        isLastSlide = false,
        textPosition = 'center',
        fontSize = 56
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

      // Déterminer la couleur du texte selon textContrast
      const textColor = textContrast === 'light' ? '#FFFFFF' : '#000000';

      console.log('[Text Overlay] Processing with Cloudinary overlay:', {
        slideIndex,
        totalSlides,
        slideNumber,
        textLength: overlayText.length,
        textColor,
        textContrast,
        isLastSlide,
        position: textPosition
      });

      try {
        // Pour les images générées par l'IA (data URLs), on va composer avec Cloudinary
        const CLOUDINARY_CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME');
        const CLOUDINARY_API_KEY = Deno.env.get('CLOUDINARY_API_KEY');
        const CLOUDINARY_API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET');

        if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
          throw new Error('CLOUDINARY_NOT_CONFIGURED');
        }

        // 1. Uploader l'image de fond sur Cloudinary
        const timestamp = Math.round(Date.now() / 1000);
        const uploadParams = `timestamp=${timestamp}`;
        const signature = await crypto.subtle.digest(
          'SHA-1',
          new TextEncoder().encode(uploadParams + CLOUDINARY_API_SECRET)
        );
        const signatureHex = Array.from(new Uint8Array(signature))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        const uploadFormData = new FormData();
        uploadFormData.append('file', imageUrl);
        uploadFormData.append('api_key', CLOUDINARY_API_KEY);
        uploadFormData.append('timestamp', timestamp.toString());
        uploadFormData.append('signature', signatureHex);

        const uploadResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
          {
            method: 'POST',
            body: uploadFormData
          }
        );

        if (!uploadResponse.ok) {
          throw new Error(`Cloudinary upload failed: ${uploadResponse.status}`);
        }

        const uploadResult = await uploadResponse.json();
        const publicId = uploadResult.public_id;

        console.log('[Text Overlay] Image uploaded to Cloudinary:', publicId);

        // 2. Parser le texte en titre/subtitle
        const lines = overlayText.split('\n').filter(l => l.trim());
        const title = lines[0] || '';
        const subtitle = lines.slice(1).join(' ') || '';
        
        // Convertir la couleur hex en format Cloudinary
        const cloudinaryColor = textColor.replace('#', '');
        const strokeColor = textContrast === 'light' ? '000000' : 'FFFFFF';
        
        // 3. Construire les overlays de texte avec Arial, wrapping, shadow
        const overlays = [];
        
        // Layer 1: Numéro de slide (coin supérieur droit)
        if (slideNumber) {
          const encodedNumber = encodeURIComponent(slideNumber);
          overlays.push(`l_text:Arial_40_bold:${encodedNumber},co_rgb:${cloudinaryColor},g_north_east,x_60,y_60,e_shadow:50,e_stroke:co_rgb:${strokeColor},e_stroke:inner:2`);
        }
        
        // Layer 2: Titre principal (centré avec wrapping)
        if (title) {
          const encodedTitle = encodeURIComponent(title);
          overlays.push(`l_text:Arial_72_bold:${encodedTitle},co_rgb:${cloudinaryColor},g_center,y_-100,w_900,c_fit,e_shadow:50,e_stroke:co_rgb:${strokeColor},e_stroke:inner:3`);
        }
        
        // Layer 3: Sous-titre (en dessous avec wrapping)
        if (subtitle) {
          const encodedSubtitle = encodeURIComponent(subtitle);
          overlays.push(`l_text:Arial_36:${encodedSubtitle},co_rgb:${cloudinaryColor},g_center,y_50,w_1100,c_fit,e_shadow:50,e_stroke:co_rgb:${strokeColor},e_stroke:inner:2`);
        }
        
        // Layer 4: Indicateur "Swipe →" (dernière slide)
        if (isLastSlide) {
          const swipeText = encodeURIComponent('Swipe →');
          overlays.push(`l_text:Arial_48_bold:${swipeText},co_rgb:${cloudinaryColor},g_south,y_100,e_shadow:50,e_stroke:co_rgb:${strokeColor},e_stroke:inner:2`);
        }
        
        const textOverlays = overlays.join('/');
        const finalUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${textOverlays}/${publicId}.png`;

        console.log('[Text Overlay] Success with Cloudinary:', {
          slideIndex,
          totalSlides,
          publicId,
          outputUrl: finalUrl.substring(0, 100) + '...'
        });

        return {
          image_url: finalUrl,
          meta: {
            slideIndex,
            totalSlides,
            textLength: overlayText.length,
            textColor,
            method: 'cloudinary'
          }
        };
      } catch (error: any) {
        console.error('[Text Overlay] Cloudinary failed:', error);
        console.log('[Text Overlay] Falling back to returning background only');
        
        // En cas d'erreur, retourner simplement l'image de fond
        return {
          image_url: imageUrl,
          meta: {
            slideIndex,
            totalSlides,
            textLength: overlayText.length,
            method: 'fallback_no_text',
            error: error?.message || 'Unknown error'
          }
        };
      }
    });
  }
};
