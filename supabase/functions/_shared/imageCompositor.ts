// Phase 5: Compositeur d'images (background IA + SVG texte)

export async function compositeSlide(
  backgroundUrl: string,
  svgTextLayer: string
): Promise<Uint8Array> {
  // Pour l'instant, utiliser une approche simple via Canvas/fetch
  // Dans un environnement Deno, on peut utiliser des libs comme:
  // - https://esm.sh/sharp (si disponible)
  // - Canvas API (si disponible)
  // - Appeler un service externe
  
  // Pour MVP : convertir SVG en PNG et le superposer via fetch + Canvas
  
  try {
    // 1. Télécharger le background
    const bgResponse = await fetch(backgroundUrl);
    if (!bgResponse.ok) {
      throw new Error(`Failed to fetch background: ${bgResponse.status}`);
    }
    const bgBlob = await bgResponse.blob();
    const bgArrayBuffer = await bgBlob.arrayBuffer();
    
    // 2. Pour le MVP, on retourne le background tel quel
    // Dans une implémentation complète, on utiliserait sharp ou Canvas pour composer
    // const composited = await composeWithSharp(bgArrayBuffer, svgTextLayer);
    
    // TODO: Implémenter la composition réelle avec sharp ou Canvas
    console.log('[imageCompositor] SVG overlay:', svgTextLayer.slice(0, 100) + '...');
    console.log('[imageCompositor] Background size:', bgArrayBuffer.byteLength);
    
    // Pour l'instant, retourner le background
    // La vraie implémentation nécessiterait:
    // 1. Convertir SVG en PNG via resvg ou similar
    // 2. Composer avec sharp: background.composite([{ input: svgPng }])
    
    return new Uint8Array(bgArrayBuffer);
    
  } catch (error) {
    console.error('[imageCompositor] Composition failed:', error);
    throw error;
  }
}

// Future implementation avec sharp:
/*
export async function compositeSlideWithSharp(
  backgroundUrl: string,
  svgTextLayer: string
): Promise<Uint8Array> {
  const sharp = (await import('https://esm.sh/sharp@0.33.0')).default;
  
  // 1. Télécharger le background
  const bgResponse = await fetch(backgroundUrl);
  const bgBuffer = new Uint8Array(await bgResponse.arrayBuffer());
  
  // 2. Convertir SVG en buffer
  const svgBuffer = Buffer.from(svgTextLayer);
  
  // 3. Composer : background + SVG text layer
  const composited = await sharp(bgBuffer)
    .composite([
      { input: svgBuffer, top: 0, left: 0, blend: 'over' }
    ])
    .png({ quality: 95 })
    .toBuffer();
  
  return new Uint8Array(composited);
}
*/
