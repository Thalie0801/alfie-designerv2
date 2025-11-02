interface SlideContent {
  title: string;
  subtitle?: string;
  bullets?: string[];
}

export function generateAltText(
  slide: SlideContent,
  index: number,
  brandName: string
): string {
  const parts: string[] = [`Slide ${index + 1} of carousel`];
  
  if (slide.title) {
    parts.push(`— ${slide.title}`);
  }
  
  if (slide.subtitle) {
    parts.push(`(${slide.subtitle})`);
  }
  
  if (slide.bullets && slide.bullets.length > 0) {
    parts.push(`with ${slide.bullets.length} key points`);
  }
  
  parts.push(`by ${brandName}`);
  
  return parts.join(' ');
}
