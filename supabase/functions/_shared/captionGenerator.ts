interface CarouselPlan {
  slides: Array<{
    title: string;
    subtitle?: string;
  }>;
  globals?: {
    locale?: string;
  };
}

export function generateCarouselCaption(
  plan: CarouselPlan,
  brandName: string
): string {
  const slideCount = plan.slides.length;
  const mainTheme = plan.slides[0]?.title || 'Nouveau contenu';
  
  // Extract first 3 slide titles
  const topSlides = plan.slides
    .slice(0, 3)
    .map((s, i) => `${i + 1}. ${s.title}`)
    .join('\n');

  const locale = plan.globals?.locale?.split('-')[0]?.toUpperCase() || 'FR';
  
  const caption = `
📊 ${mainTheme} — ${slideCount} slides

${topSlides}

✨ Créé avec Alfie Designer
🎨 Brand: ${brandName}

#${locale} #Design #Branding #SocialMedia #Carrousel
`.trim();
  
  return caption;
}
