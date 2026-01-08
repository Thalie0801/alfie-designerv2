// Charge dynamiquement des Google Fonts dans le document
const loadedFonts = new Set<string>();

export function loadGoogleFonts(fonts: string[]): void {
  const fontsToLoad = fonts.filter(font => !loadedFonts.has(font));
  
  if (fontsToLoad.length === 0) return;
  
  // Build Google Fonts URL with all fonts
  const familiesParam = fontsToLoad
    .map(font => font.replace(/ /g, '+') + ':wght@400;700')
    .join('&family=');
  
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${familiesParam}&display=swap`;
  link.setAttribute('data-google-fonts', 'true');
  document.head.appendChild(link);
  
  fontsToLoad.forEach(font => loadedFonts.add(font));
}

export function isFontLoaded(font: string): boolean {
  return loadedFonts.has(font);
}
