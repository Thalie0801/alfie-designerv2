/**
 * Robust download helper for Alfie Designer
 * Handles Supabase Storage, Cloudinary, and generic URLs
 */

export async function downloadUrl(url: string, suggestedName?: string): Promise<void> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();

  let name = suggestedName || 'alfie-asset';
  
  // Try to extract filename from Content-Disposition header
  const cd = res.headers.get('Content-Disposition');
  if (cd) {
    const m = cd.match(/filename\*?=(?:UTF-8'')?("?)([^";]+)\1/i);
    if (m?.[2]) name = decodeURIComponent(m[2]);
  } else if (!/\.[a-z0-9]+(\?|$)/i.test(url)) {
    // If no extension in URL, infer from MIME type
    const mime = blob.type || "";
    const ext = mime.includes("png") ? "png"
      : mime.includes("jpeg") ? "jpg"
      : mime.includes("webp") ? "webp"
      : mime.includes("mp4") ? "mp4"
      : "bin";
    name = `${name}.${ext}`;
  }

  // Create download link and trigger
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

/**
 * Safe preview URL for images
 * Avoids re-transforming already transformed Cloudinary URLs
 */
export function safePreviewUrl(url: string): string {
  if (!url) return '';
  
  // If it's a Cloudinary URL without transformations, add f_auto,q_auto
  if (url.includes("/image/upload/") && !url.includes("/upload/f_")) {
    return url.replace("/upload/", "/upload/f_auto,q_auto/");
  }
  
  return url;
}
