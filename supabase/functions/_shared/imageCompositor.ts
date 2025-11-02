// Phase 5: Compositeur d'images via Cloudinary (Deno Deploy compatible)

// Helper pour générer une signature Cloudinary (pour les requêtes API authentifiées)
async function generateCloudinarySignature(paramsToSign: Record<string, string>, apiSecret: string): Promise<string> {
  const sortedKeys = Object.keys(paramsToSign).sort();
  const stringToSign = sortedKeys.map(key => `${key}=${paramsToSign[key]}`).join('&') + apiSecret;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(stringToSign);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function compositeSlide(
  backgroundUrl: string,
  svgTextLayer: string,
  jobSetId?: string,
  brandId?: string,
  options?: {
    primaryColor?: string;
    secondaryColor?: string;
    tintStrength?: number;
  }
): Promise<{ url: string; bgPublicId: string; svgPublicId: string }> {
  console.log('🎨 [imageCompositor] Starting Cloudinary composition...');
  console.log('📥 Background URL:', backgroundUrl);
  console.log('📝 SVG layer size:', svgTextLayer.length, 'chars');
  
  const CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME')?.trim();
  const API_KEY = Deno.env.get('CLOUDINARY_API_KEY');
  const API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET');
  
  if (!CLOUD_NAME) {
    throw new Error('Missing Cloudinary cloud name');
  }
  
  // 🔒 SECURITY: Require API credentials for signed uploads
  if (!API_KEY || !API_SECRET) {
    throw new Error('Missing Cloudinary API credentials (CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET required)');
  }
  
  const cloudName = CLOUD_NAME.toLowerCase();
  console.log('🌩️ Cloudinary cloud:', cloudName);
  const uploadEndpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const deleteEndpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`;
  console.log('🔗 Upload endpoint:', uploadEndpoint);
  
  try {
    // 1. Upload background image to Cloudinary with signed authentication
    console.log('⬇️ Uploading background to Cloudinary...');
    
    const bgPublicId = `alfie/${brandId || 'temp'}/${jobSetId || 'temp'}/background_${Date.now()}`;
    const bgTimestamp = Math.floor(Date.now() / 1000);
    
    const bgFormData = new FormData();
    bgFormData.append('file', backgroundUrl);
    bgFormData.append('public_id', bgPublicId);
    bgFormData.append('api_key', API_KEY);
    bgFormData.append('timestamp', bgTimestamp.toString());
    
    const bgSignature = await generateCloudinarySignature(
      { public_id: bgPublicId, timestamp: bgTimestamp.toString() },
      API_SECRET
    );
    bgFormData.append('signature', bgSignature);
    
    const bgController = new AbortController();
    const bgTimeout = setTimeout(() => bgController.abort(), 60000);
    
    let bgUploadedPublicId: string;
    let bgDeleteToken: string | undefined;
    try {
      const bgUploadResponse = await fetch(
        uploadEndpoint,
        {
          method: 'POST',
          body: bgFormData,
          signal: bgController.signal
        }
      );
      
      clearTimeout(bgTimeout);
      
      if (!bgUploadResponse.ok) {
        const errorText = await bgUploadResponse.text();
        console.error('❌ Background upload failed:', errorText);
        throw new Error(`Background upload failed (${bgUploadResponse.status}): ${errorText}`);
      }
      
      const bgData = await bgUploadResponse.json();
      bgUploadedPublicId = bgData.public_id;
      bgDeleteToken = bgData.delete_token;
      console.log('✅ Background uploaded:', bgUploadedPublicId);
    } catch (err) {
      clearTimeout(bgTimeout);
      console.error('❌ Background upload timeout or error:', err);
      throw new Error(`Background upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    
    // 2. Convert SVG string to Blob
    console.log('🔄 Converting SVG to Blob...');
    const svgBlob = new Blob([svgTextLayer], { type: 'image/svg+xml' });
    
    // 3. Upload SVG overlay to Cloudinary with signed authentication
    console.log('⬆️ Uploading SVG overlay...');
    
    const svgPublicId = `alfie/${brandId || 'temp'}/${jobSetId || 'temp'}/overlay_${Date.now()}`;
    const svgTimestamp = Math.floor(Date.now() / 1000);
    
    const svgFormData = new FormData();
    svgFormData.append('file', svgBlob, 'overlay.svg');
    svgFormData.append('public_id', svgPublicId);
    svgFormData.append('api_key', API_KEY);
    svgFormData.append('timestamp', svgTimestamp.toString());
    
    const svgSignature = await generateCloudinarySignature(
      { public_id: svgPublicId, timestamp: svgTimestamp.toString() },
      API_SECRET
    );
    svgFormData.append('signature', svgSignature);
    console.log('🛡️ Using signed SVG upload with public_id:', svgPublicId);
    
    const svgController = new AbortController();
    const svgTimeout = setTimeout(() => svgController.abort(), 60000);
    
    let svgUploadedPublicId: string;
    let svgDeleteToken: string | undefined;
    try {
      const svgUploadResponse = await fetch(
        uploadEndpoint,
        {
          method: 'POST',
          body: svgFormData,
          signal: svgController.signal
        }
      );
      
      clearTimeout(svgTimeout);
      
      if (!svgUploadResponse.ok) {
        const errorText = await svgUploadResponse.text();
        console.error('❌ SVG upload failed:', errorText);
        throw new Error(`SVG upload failed (${svgUploadResponse.status}): ${errorText}`);
      }
      
      const svgData = await svgUploadResponse.json();
      svgUploadedPublicId = svgData.public_id;
      svgDeleteToken = svgData.delete_token;
      console.log('✅ SVG uploaded:', svgUploadedPublicId);
    } catch (err) {
      clearTimeout(svgTimeout);
      console.error('❌ SVG upload timeout or error:', err);
      throw new Error(`SVG upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    
    // 4. Generate composed image URL with overlay transformation + optional tint
    console.log('🎭 Generating composed URL...');
    
    // Build transformation pipeline with brand color tint if provided
    let transformations = '';
    if (options?.primaryColor && options?.secondaryColor) {
      const tintStrength = options.tintStrength || 60;
      // Convert hex colors to RGB for Cloudinary
      const primary = options.primaryColor.replace('#', '');
      const secondary = options.secondaryColor.replace('#', '');
      
      // Apply subtle tint to ensure color consistency across slides
      transformations = `e_grayscale:40/e_tint:${tintStrength}:co_rgb:${primary}:co_rgb:${secondary}/`;
      console.log(`🎨 [imageCompositor] Applying brand tint: ${transformations}`);
    }
    
    const composedUrl = `https://res.cloudinary.com/${cloudName}/image/upload/` +
      transformations +
      `l_${svgUploadedPublicId.replace(/\//g, ':')},fl_layer_apply,g_center/` +
      `${bgUploadedPublicId}.png`;
    
    console.log('✅ Composition complete:', composedUrl);
    
    // 4.5 🔍 VERIFY: Wait for composed image to be available before cleanup
    console.log('🔍 Verifying composed image availability...');
    const verifyController = new AbortController();
    const verifyTimeout = setTimeout(() => verifyController.abort(), 30000);
    
    try {
      const verifyResponse = await fetch(composedUrl, { 
        method: 'HEAD',
        signal: verifyController.signal 
      });
      clearTimeout(verifyTimeout);
      
      if (!verifyResponse.ok) {
        console.warn(`⚠️ Composed image not yet available (${verifyResponse.status}), retrying with GET...`);
        // Cloudinary may need a GET to generate the image on first request
        const getResponse = await fetch(composedUrl);
        if (!getResponse.ok) {
          throw new Error(`Composed image not accessible: ${getResponse.status}`);
        }
      }
      console.log('✅ Composed image verified and accessible');
    } catch (err) {
      clearTimeout(verifyTimeout);
      console.error('❌ Failed to verify composed image:', err);
      throw new Error(`Composed image verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    
    // 5. Return composed info and let caller handle cleanup after upload
    return { url: composedUrl, bgPublicId: bgUploadedPublicId, svgPublicId: svgUploadedPublicId };
    
  } catch (error) {
    console.error('❌ [imageCompositor] Cloudinary composition failed:', error);
    if (error instanceof Error) {
      console.error('📍 Error message:', error.message);
      console.error('📍 Error stack:', error.stack);
    }
    throw error;
  }
}

// Cleanup helper to delete temporary Cloudinary resources AFTER upload is complete
export async function cleanupCloudinaryResources({
  bgPublicId,
  svgPublicId,
}: { bgPublicId?: string; svgPublicId?: string }) {
  const CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME')?.trim();
  const API_KEY = Deno.env.get('CLOUDINARY_API_KEY');
  const API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET');
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) return; // silently skip if missing
  const cloudName = CLOUD_NAME.toLowerCase();
  const deleteEndpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`;

  const doDelete = async (publicId?: string) => {
    if (!publicId) return;
    const ts = Math.floor(Date.now() / 1000);
    const form = new FormData();
    form.append('public_id', publicId);
    form.append('api_key', API_KEY);
    form.append('timestamp', ts.toString());
    const sig = await generateCloudinarySignature({ public_id: publicId, timestamp: ts.toString() }, API_SECRET);
    form.append('signature', sig);
    try {
      const resp = await fetch(deleteEndpoint, { method: 'POST', body: form });
      if (resp.ok) console.log('🧹 Deleted Cloudinary asset:', publicId);
      else console.warn('⚠️ Failed to delete Cloudinary asset:', publicId);
    } catch (e: any) {
      console.warn('⚠️ Cleanup error for', publicId, e?.message);
    }
  };

  await Promise.all([doDelete(bgPublicId), doDelete(svgPublicId)]);
}
