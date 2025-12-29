import JSZip from 'jszip';

export interface DownloadAsset {
  title: string;
  url: string;
}

export async function downloadAssetsAsZip(assets: DownloadAsset[], zipName = 'alfie-pack.zip'): Promise<void> {
  const zip = new JSZip();
  
  // Download each image and add to zip
  for (const asset of assets) {
    try {
      // Skip placeholder or base64 URLs that are too short
      if (!asset.url || asset.url.startsWith('/images/')) {
        console.warn(`Skipping placeholder asset: ${asset.title}`);
        continue;
      }
      
      let blob: Blob;
      
      if (asset.url.startsWith('data:')) {
        // Handle base64 data URL
        const base64Data = asset.url.split(',')[1];
        const byteString = atob(base64Data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        blob = new Blob([ab], { type: 'image/png' });
      } else {
        // Fetch from URL
        const response = await fetch(asset.url);
        if (!response.ok) {
          console.error(`Failed to fetch ${asset.title}: ${response.status}`);
          continue;
        }
        blob = await response.blob();
      }
      
      // Sanitize filename
      const safeName = asset.title.replace(/[^a-zA-Z0-9-_]/g, '_');
      const extension = blob.type.includes('png') ? 'png' : 'jpg';
      zip.file(`${safeName}.${extension}`, blob);
    } catch (error) {
      console.error(`Error processing ${asset.title}:`, error);
    }
  }
  
  // Generate and download zip
  const content = await zip.generateAsync({ type: 'blob' });
  
  // Create download link
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = zipName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
