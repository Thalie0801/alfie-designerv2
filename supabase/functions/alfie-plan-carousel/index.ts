import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BrandKit {
  name?: string;
  palette?: string[];
  voice?: string;
  niche?: string;
}

interface CarouselSlide {
  type: 'hero' | 'problem' | 'solution' | 'impact' | 'cta';
  title: string;
  subtitle?: string;
  punchline?: string;
  bullets?: string[];
  kpis?: { label: string; delta: string }[];
  note: string; // Prompt image en anglais
  slideNumber: string; // "1/7", "2/7", etc.
  backgroundStyle: 'solid' | 'gradient' | 'illustration' | 'photo';
  textContrast: 'light' | 'dark';
}

interface CarouselPlan {
  slides: CarouselSlide[];
}

serve(async (req) => {
  console.log('[alfie-plan-carousel] v1.0.0 - Function invoked');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, slideCount, brandKit } = await req.json();

    if (!prompt || !slideCount) {
      throw new Error('Missing prompt or slideCount');
    }

    const brandInfo = brandKit as BrandKit;
    
    // Extraire les couleurs de la palette
    const primary_color = brandInfo?.palette?.[0] || 'Non spécifié';
    const secondary_color = brandInfo?.palette?.[1] || 'Non spécifié';
    
    // Construire le prompt système
    const systemPrompt = `
Tu es Alfie, un expert en stratégie de contenu pour réseaux sociaux.

**STRUCTURE OBLIGATOIRE DU CARROUSEL :**

Slide 1 (COVER) - Type 'hero' :
- Titre accrocheur et court (20-40 caractères)
- Indication du nombre de slides : "1/${slideCount}"
- Badge ou punchline qui promet la valeur
- Design qui attire l'œil immédiatement

Slides 2 à ${slideCount - 1} (CONTENU) - Types 'problem', 'solution', 'impact' :
- UN SEUL point/conseil/info par slide
- Titre clair (15-40 caractères)
- Maximum 3 bullets courts (15-44 caractères chacun)
- Cohérence visuelle entre toutes les slides

Slide ${slideCount} (CONCLUSION) - Type 'cta' :
- Titre récapitulatif ou conclusion
- Call-to-action clair (ex: "Sauvegarde ce post", "Partage à ton réseau")
- Note/résumé final (optionnel)

**RÈGLES VISUELLES CRITIQUES :**
- Chaque slide doit avoir un numéro visible : "1/${slideCount}", "2/${slideCount}", etc.
- Arrière-plans recommandés (par ordre de préférence) :
  1. Couleurs unies avec dégradé subtil (meilleur contraste) → backgroundStyle: 'solid'
  2. Dégradés doux (moderne et élégant) → backgroundStyle: 'gradient'
  3. Illustrations légères (ne pas écraser le texte) → backgroundStyle: 'illustration'
  4. Photos avec overlay sombre (garantir contraste) → backgroundStyle: 'photo'
- Palette cohérente : 2-3 couleurs max de ${primary_color} et ${secondary_color}
- Éviter absolument : arrière-plans trop chargés, photos sans overlay

**PROMPT IMAGE (note) - INSTRUCTIONS STRICTES :**
Le champ \`note\` doit être un prompt en anglais pour générer le FOND UNIQUEMENT (sans texte).
Format : "Clean [type] background with [style]. Use [colors] palette. High contrast area in center for text overlay. No text, no typography."

Exemples :
- Slide 1 (hero) : "Clean gradient background with vibrant ${primary_color} to ${secondary_color}. Modern abstract shapes. High contrast center area. No text."
- Slide 2-N (contenu) : "Minimalist solid color background ${primary_color}. Subtle geometric patterns. Clean and professional. No text."
- Slide ${slideCount} (cta) : "Energetic gradient background with ${primary_color}. Call-to-action mood. High contrast. No text."

**BRAND KIT :**
- Nom: ${brandInfo?.name || 'Non spécifié'}
- Niche: ${brandInfo?.niche || 'Non spécifié'}
- Tonalité: ${brandInfo?.voice || 'Professionnelle et engageante'}
- Couleurs: ${primary_color} et ${secondary_color}

**Limites de Caractères (STRICT) :**
- **Title** : 15-60 caractères
- **Subtitle** : 25-100 caractères
- **Punchline** : 25-80 caractères
- **Bullet** : 15-60 caractères
- **Note** : 80-180 caractères

**Format de Réponse (JSON Schema) :**
{
  "plan": {
    "slides": [
      {
        "type": "hero",
        "title": "Titre accrocheur",
        "subtitle": "Sous-titre",
        "punchline": "Phrase clé (optionnel)",
        "bullets": ["Point 1", "Point 2"],
        "note": "Clean gradient background...",
        "slideNumber": "1/${slideCount}",
        "backgroundStyle": "gradient",
        "textContrast": "dark"
      }
    ]
  }
}
`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Appeler l'IA via Lovable AI Gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[alfie-plan-carousel] AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const jsonResponse = data.choices?.[0]?.message?.content;
    
    if (!jsonResponse) {
      throw new Error('AI returned an empty response');
    }

    const parsed = JSON.parse(jsonResponse);
    
    // Accepter deux formats : { plan: { slides: [...] } } OU directement un tableau de slides
    let slides: CarouselSlide[];
    
    if (parsed.plan?.slides) {
      // Format attendu : { plan: { slides: [...] } }
      slides = parsed.plan.slides;
    } else if (Array.isArray(parsed.slides)) {
      // Format alternatif : { slides: [...] }
      slides = parsed.slides;
    } else if (Array.isArray(parsed)) {
      // Format direct : [{slide1}, {slide2}, ...]
      slides = parsed;
    } else {
      console.error('[alfie-plan-carousel] Invalid plan structure:', parsed);
      throw new Error('AI returned an invalid plan structure');
    }

    // Validation du nombre de slides
    if (!Array.isArray(slides) || slides.length !== slideCount) {
      console.error(`[alfie-plan-carousel] Expected ${slideCount} slides, got ${slides?.length || 0}`);
      throw new Error(`AI returned incorrect slide count: expected ${slideCount}, got ${slides?.length || 0}`);
    }
    
    // Ajuster le nombre de slides (pad/truncate)
    if (slides.length > slideCount) {
      slides.length = slideCount;
      console.warn(`[Plan Carousel] Truncated to ${slideCount} slides`);
    } else if (slides.length < slideCount) {
      while (slides.length < slideCount) {
        const missingIndex = slides.length + 1;
        slides.push({
          type: 'impact',
          title: `Point ${missingIndex}`,
          subtitle: '',
          bullets: [],
          note: 'Minimalist solid background, high-contrast, NO TEXT',
          slideNumber: `${missingIndex}/${slideCount}`,
          backgroundStyle: 'solid',
          textContrast: 'dark'
        });
      }
      console.warn(`[Plan Carousel] Padded to ${slideCount} slides`);
    }

    // Auto-fill metadata manquantes
    for (let i = 0; i < slides.length; i++) {
      if (!slides[i].slideNumber) {
        slides[i].slideNumber = `${i + 1}/${slideCount}`;
      }
      if (!slides[i].backgroundStyle) {
        slides[i].backgroundStyle = i === 0 ? 'gradient' : 'solid';
      }
      if (!slides[i].textContrast) {
        slides[i].textContrast = 'dark';
      }
      if (i === 0) slides[i].type = 'hero';
      if (i === slides.length - 1) slides[i].type = 'cta';
    }
    
    const plan = { plan: { slides } };

    // Validation des limites de caractères
    const LIMITS = {
      title: { min: 15, max: 60 },
      subtitle: { min: 25, max: 100 },
      punchline: { min: 25, max: 80 },
      bullet: { min: 15, max: 60 },
    };

    for (const slide of plan.plan.slides) {
      // Valider title
      if (slide.title.length < LIMITS.title.min || slide.title.length > LIMITS.title.max) {
        console.warn(`[alfie-plan-carousel] ⚠️ Title length violation: ${slide.title.length} chars - "${slide.title}"`);
      }
      
      // Valider subtitle
      if (slide.subtitle && (slide.subtitle.length < LIMITS.subtitle.min || slide.subtitle.length > LIMITS.subtitle.max)) {
        console.warn(`[alfie-plan-carousel] ⚠️ Subtitle length violation: ${slide.subtitle.length} chars - "${slide.subtitle}"`);
      }
      
      // Valider punchline
      if (slide.punchline && (slide.punchline.length < LIMITS.punchline.min || slide.punchline.length > LIMITS.punchline.max)) {
        console.warn(`[alfie-plan-carousel] ⚠️ Punchline length violation: ${slide.punchline.length} chars - "${slide.punchline}"`);
      }
      
      // Valider bullets
      if (slide.bullets) {
        for (const bullet of slide.bullets) {
          if (bullet.length < LIMITS.bullet.min || bullet.length > LIMITS.bullet.max) {
            console.warn(`[alfie-plan-carousel] ⚠️ Bullet length violation: ${bullet.length} chars - "${bullet}"`);
          }
        }
      }
    }

    console.log('[alfie-plan-carousel] Plan generated successfully with', plan.plan.slides.length, 'slides');

    return new Response(JSON.stringify(plan), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[alfie-plan-carousel] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
