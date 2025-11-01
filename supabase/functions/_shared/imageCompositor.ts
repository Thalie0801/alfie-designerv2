// Phase 5: Compositeur d'images (background IA + SVG texte)
import { createCanvas, loadImage } from 'https://deno.land/x/canvas@v1.4.1/mod.ts';

export async function compositeSlide(
  backgroundUrl: string,
  svgTextLayer: string
): Promise<Uint8Array> {
  console.log('🎨 [imageCompositor] Starting composition...');
  console.log('📥 Background URL:', backgroundUrl);
  console.log('📝 SVG layer size:', svgTextLayer.length, 'chars');
  
  try {
    // 1. Charger le background
    console.log('⬇️ Loading background image...');
    const bgImage = await loadImage(backgroundUrl);
    const width = bgImage.width();
    const height = bgImage.height();
    console.log('✅ Background loaded:', width, 'x', height);
    
    // 2. Créer canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // 3. Dessiner le background
    console.log('🖼️ Drawing background...');
    ctx.drawImage(bgImage, 0, 0);
    
    // 4. Convertir SVG en data URL et le charger
    console.log('🔄 Converting SVG to image...');
    const svgDataUrl = `data:image/svg+xml;base64,${btoa(svgTextLayer)}`;
    const svgImage = await loadImage(svgDataUrl);
    console.log('✅ SVG converted to image');
    
    // 5. Superposer le SVG
    console.log('🎭 Compositing SVG overlay...');
    ctx.drawImage(svgImage, 0, 0);
    
    // 6. Exporter en PNG
    console.log('💾 Exporting to PNG buffer...');
    const buffer = canvas.toBuffer('image/png');
    console.log('✅ Composition complete:', buffer.length, 'bytes');
    
    return new Uint8Array(buffer);
    
  } catch (error) {
    console.error('❌ [imageCompositor] Composition failed:', error);
    throw error;
  }
}
