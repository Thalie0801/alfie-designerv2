// Phase 5: Compositeur d'images via Cloudinary (Deno Deploy compatible)

export async function compositeSlide(
  backgroundUrl: string,
  svgTextLayer: string
): Promise<string> {
  console.log('🎨 [imageCompositor] Starting Cloudinary composition...');
  console.log('📥 Background URL:', backgroundUrl);
  console.log('📝 SVG layer size:', svgTextLayer.length, 'chars');
  
  const CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const API_KEY = Deno.env.get('CLOUDINARY_API_KEY');
  const API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET');
  
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    throw new Error('Missing Cloudinary credentials');
  }
  
  try {
    // 1. Upload background image to Cloudinary
    console.log('⬇️ Uploading background to Cloudinary...');
    
    const bgFormData = new FormData();
    bgFormData.append('file', backgroundUrl);
    bgFormData.append('upload_preset', 'ml_default');
    
    const bgUploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: bgFormData
      }
    );
    
    if (!bgUploadResponse.ok) {
      throw new Error(`Background upload failed: ${await bgUploadResponse.text()}`);
    }
    
    const bgData = await bgUploadResponse.json();
    const bgPublicId = bgData.public_id;
    console.log('✅ Background uploaded:', bgPublicId);
    
    // 2. Convert SVG to base64 data URI
    console.log('🔄 Converting SVG to base64...');
    const svgBase64 = btoa(svgTextLayer);
    const svgDataUri = `data:image/svg+xml;base64,${svgBase64}`;
    
    // 3. Upload SVG overlay to Cloudinary
    console.log('⬆️ Uploading SVG overlay...');
    
    const svgFormData = new FormData();
    svgFormData.append('file', svgDataUri);
    svgFormData.append('upload_preset', 'ml_default');
    
    const svgUploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: svgFormData
      }
    );
    
    if (!svgUploadResponse.ok) {
      throw new Error(`SVG upload failed: ${await svgUploadResponse.text()}`);
    }
    
    const svgData = await svgUploadResponse.json();
    const svgPublicId = svgData.public_id;
    console.log('✅ SVG uploaded:', svgPublicId);
    
    // 4. Generate composed image URL with overlay transformation
    console.log('🎭 Generating composed URL...');
    const composedUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/` +
      `l_${svgPublicId.replace(/\//g, ':')},fl_layer_apply,g_center/` +
      `${bgPublicId}.png`;
    
    console.log('✅ Composition complete:', composedUrl);
    return composedUrl;
    
  } catch (error) {
    console.error('❌ [imageCompositor] Cloudinary composition failed:', error);
    throw error;
  }
}
