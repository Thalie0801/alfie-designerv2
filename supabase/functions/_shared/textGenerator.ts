// Génération de textes structurés pour images et carrousels

import { callAIWithFallback } from './aiOrchestrator.ts';

export interface ImageText {
  headline: string;
  body: string;
  cta: string;
  alt: string;
}

export interface SlideText {
  title: string;
  subtitle: string;
  bullets?: string[];
}

export interface CarouselTextPlan {
  slides: SlideText[];
  theme: string;
}

export async function generateImageTexts(
  brief: any,
  brandKit: any,
  count: number = 1
): Promise<ImageText[]> {
  const systemMessage = `Tu es un concepteur-rédacteur expert en marketing digital.
Tu crées des textes impactants pour des visuels social media.

Contraintes strictes:
- Headline: max 45 caractères
- Body: max 180 caractères
- CTA: 1-2 mots maximum
- Alt-text: max 1 phrase descriptive

Style: ${brandKit?.voice || 'Professionnel et engageant'}
Palette: ${brandKit?.palette?.map((c: any) => c.color).join(', ') || 'Neutre'}`;

  const userMessage = `Génère ${count} variante(s) de texte pour cette image.

Brief:
- Objectif: ${brief.objective}
- Format: ${brief.format}
- Style: ${brief.style || 'Moderne'}
- CTA souhaité: ${brief.cta || 'En savoir plus'}

Retourne un tableau JSON strict:
[
  {
    "headline": "...",
    "body": "...",
    "cta": "...",
    "alt": "..."
  }
]`;

  try {
    const messages = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage }
    ];

    const context = {
      brandKit,
      userMessage
    };

    const response = await callAIWithFallback(messages, context);
    const content = response.choices[0]?.message?.content || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.slice(0, count);
    }

    // Fallback
    return Array.from({ length: count }, (_, i) => ({
      headline: `${brief.objective} - Variante ${i + 1}`,
      body: `Découvrez notre solution innovante qui répond à vos besoins.`,
      cta: brief.cta || 'Découvrir',
      alt: `Image promotionnelle pour ${brief.objective}`
    }));
  } catch (error) {
    console.error('[textGenerator] Image text generation error:', error);
    throw error;
  }
}

export async function generateCarouselTexts(
  brief: any,
  brandKit: any
): Promise<CarouselTextPlan> {
  const numSlides = parseInt(brief.numSlides) || 5;
  
  const systemMessage = `Tu es un expert en storytelling pour carrousels Instagram/LinkedIn.
Tu crées des carrousels engageants qui convertissent.

Structure recommandée:
- Slide 1: Hook accrocheur
- Slides 2-N-1: Contenu de valeur (problème → solution → preuves)
- Slide N: CTA fort

Contraintes strictes:
- Title: max 40 caractères
- Subtitle: max 80 caractères
- Bullets: max 3 par slide, max 16 caractères chacun

Style: ${brandKit?.voice || 'Professionnel et engageant'}`;

  const userMessage = `Génère un plan de carrousel de ${numSlides} slides.

Brief:
- Sujet: ${brief.topic}
- Angle: ${brief.angle}
- Format: ${brief.format || '4:5'}

Retourne un JSON strict:
{
  "theme": "Titre du carrousel",
  "slides": [
    {
      "title": "...",
      "subtitle": "...",
      "bullets": ["point 1", "point 2"]
    }
  ]
}`;

  try {
    const messages = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage }
    ];

    const context = {
      brandKit,
      userMessage
    };

    const response = await callAIWithFallback(messages, context);
    const content = response.choices[0]?.message?.content || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        theme: parsed.theme || brief.topic,
        slides: parsed.slides.slice(0, numSlides)
      };
    }

    // Fallback
    return {
      theme: brief.topic,
      slides: Array.from({ length: numSlides }, (_, i) => ({
        title: i === 0 ? `${brief.topic}` : `Point ${i}`,
        subtitle: i === 0 ? 'Découvrez comment' : `Détail du point ${i}`,
        bullets: i === numSlides - 1 ? [] : [`Bénéfice ${i + 1}`]
      }))
    };
  } catch (error) {
    console.error('[textGenerator] Carousel text generation error:', error);
    throw error;
  }
}
