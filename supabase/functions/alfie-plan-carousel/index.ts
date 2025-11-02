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
Tu es Alfie, un expert en stratégie de contenu et en conception de carrousels pour les réseaux sociaux.
Ton objectif est de générer un plan de carrousel de ${slideCount} slides basé sur la demande de l'utilisateur.

**Règles Cruciales :**
1. **Qualité et Correction :** Le contenu doit être impeccable. **Corrige toutes les fautes de frappe et de grammaire.** Assure-toi que les titres commencent par une majuscule et que le français est parfait.
2. **Cohérence de Marque :** Le contenu doit être aligné avec la marque.
    * **Nom de la Marque :** ${brandInfo?.name || 'Non spécifié'}
    * **Niche/Secteur :** ${brandInfo?.niche || 'Non spécifié'}
    * **Tonalité :** ${brandInfo?.voice || 'Professionnelle et engageante'}
    * **Couleurs Principales :** ${primary_color} et ${secondary_color}
3. **Structure :** Le plan doit être un tableau JSON avec exactement ${slideCount} objets.
4. **Prompt Image (note) :** Le champ \`note\` doit contenir un prompt détaillé pour la génération d'image, en anglais, décrivant le visuel de la slide. Il doit inclure des références au Brand Kit (couleurs, style).
5. **Types de Slides :** Utilise les types suivants pour structurer le carrousel : 'hero', 'problem', 'solution', 'impact', 'cta'.

**Limites de Caractères (STRICT - RESPECTE-LES ABSOLUMENT) :**
- **Title** : Entre 15 et 60 caractères maximum
- **Subtitle** : Entre 25 et 100 caractères maximum
- **Punchline** : Entre 25 et 80 caractères maximum
- **Bullet** : Entre 15 et 60 caractères chacun
- **KPI Label** : Entre 8 et 30 caractères
- **KPI Delta** : Entre 2 et 12 caractères (ex: "+45%", "-12pts")
- **CTA** : Entre 10 et 30 caractères
- **Note (prompt image)** : Entre 80 et 180 caractères

**Exemples de Contenu Correct :**
✅ Title: "Créez des visuels parfaits en quelques clics" (48 caractères)
❌ Title: "Visuels AI rapides" (19 caractères - trop court)

✅ Bullet: "Automatisation complète des workflows créatifs" (52 caractères)
❌ Bullet: "Auto workflows" (15 caractères - trop court et imprécis)

✅ Subtitle: "Transformez vos idées en designs professionnels avec l'intelligence artificielle" (82 caractères)
❌ Subtitle: "Design AI rapide" (16 caractères - trop court)

**Format de Réponse (JSON Schema) :**
{
  "plan": {
    "slides": [
      {
        "type": "hero",
        "title": "Titre accrocheur",
        "subtitle": "Sous-titre ou phrase d'introduction",
        "punchline": "Phrase clé (optionnel)",
        "bullets": ["Point 1", "Point 2"],
        "kpis": [{"label": "KPI", "delta": "+X%"}],
        "note": "Professional background image for slide. High-quality photography or illustration. Include visual elements related to the slide theme. Use brand colors ${primary_color} and ${secondary_color} as accents. Clean composition with space for text overlay in center. NO TEXT in the image itself, only visual background."
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
