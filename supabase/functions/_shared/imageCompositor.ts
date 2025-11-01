// Phase 5: Compositeur d'images via Cloudinary (Deno Deploy compatible)

export async function compositeSlide(
  backgroundUrl: string,
  svgTextLayer: string
): Promise<string> {
  console.log('🎨 [imageCompositor] Starting Cloudinary composition...');
  console.log('📥 Background URL:', backgroundUrl);
  console.log('📝 SVG layer size:', svgTextLayer.length, 'chars');
  
  const CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME')?.trim();
  const API_KEY = Deno.env.get('CLOUDINARY_API_KEY'); // optional for signed
  const API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET'); // optional for signed
  
  if (!CLOUD_NAME) {
    throw new Error('Missing Cloudinary cloud name');
  }
  const cloudName = CLOUD_NAME.toLowerCase();
  console.log('🌩️ Cloudinary cloud:', cloudName);
  const uploadEndpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  console.log('🔗 Upload endpoint:', uploadEndpoint);
  
  try {
    // 1. Upload background image to Cloudinary with 60s timeout
    console.log('⬇️ Uploading background to Cloudinary...');
    
    const bgFormData = new FormData();
    bgFormData.append('file', backgroundUrl);
    bgFormData.append('upload_preset', 'ml_default');
    
    const bgController = new AbortController();
    const bgTimeout = setTimeout(() => bgController.abort(), 60000);
    
    let bgPublicId: string;
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
      bgPublicId = bgData.public_id;
      console.log('✅ Background uploaded:', bgPublicId);
    } catch (err) {
      clearTimeout(bgTimeout);
      console.error('❌ Background upload timeout or error:', err);
      throw new Error(`Background upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    
    // 2. Convert SVG string to Blob
    console.log('🔄 Converting SVG to Blob...');
    const svgBlob = new Blob([svgTextLayer], { type: 'image/svg+xml' });
    
    // 3. Upload SVG overlay to Cloudinary with signed authentication and timeout
    console.log('⬆️ Uploading SVG overlay...');
    
    const svgFormData = new FormData();
    svgFormData.append('file', svgBlob, 'overlay.svg');
    
    // Use signed upload if API credentials are available
    if (API_KEY && API_SECRET) {
      console.log('🛡️ Using signed SVG upload');
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Generate signature: SHA-1 of "timestamp=TIMESTAMP" + API_SECRET
      const stringToSign = `timestamp=${timestamp}${API_SECRET}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(stringToSign);
      const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      svgFormData.append('api_key', API_KEY);
      svgFormData.append('timestamp', timestamp.toString());
      svgFormData.append('signature', signature);
      console.log('📝 Signature generated at timestamp:', timestamp);
    } else {
      console.warn('⚠️ No API credentials, using unsigned upload (may fail for SVG)');
      svgFormData.append('upload_preset', 'ml_default');
    }
    
    const svgController = new AbortController();
    const svgTimeout = setTimeout(() => svgController.abort(), 60000);
    
    let svgPublicId: string;
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
      svgPublicId = svgData.public_id;
      console.log('✅ SVG uploaded:', svgPublicId);
    } catch (err) {
      clearTimeout(svgTimeout);
      console.error('❌ SVG upload timeout or error:', err);
      throw new Error(`SVG upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    
    // 4. Generate composed image URL with overlay transformation
    console.log('🎭 Generating composed URL...');
    const composedUrl = `https://res.cloudinary.com/${cloudName}/image/upload/` +
      `l_${svgPublicId.replace(/\//g, ':')},fl_layer_apply,g_center/` +
      `${bgPublicId}.png`;
    
    console.log('✅ Composition complete:', composedUrl);
    return composedUrl;
    
  } catch (error) {
    console.error('❌ [imageCompositor] Cloudinary composition failed:', error);
    if (error instanceof Error) {
      console.error('📍 Error message:', error.message);
      console.error('📍 Error stack:', error.stack);
    }
    throw error;
  }
}
