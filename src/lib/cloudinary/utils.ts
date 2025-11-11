/**
 * Extract Cloudinary cloud name from a full Cloudinary URL
 * @example extractCloudNameFromUrl('https://res.cloudinary.com/dcuvvilto/...') // 'dcuvvilto'
 */
export function extractCloudNameFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/https?:\/\/res\.cloudinary\.com\/([^/]+)\//i);
  return match?.[1];
}

/**
 * Clamp a string to a maximum length
 */
export function clamp(s: string, max = 220): string {
  return s.length > max ? s.slice(0, max).trim() : s;
}

/**
 * Clean text for Cloudinary overlays by removing:
 * - ASCII control characters (0x00-0x1F, 0x7F)
 * - Non-breaking spaces (NBSP)
 * - Byte Order Mark (BOM)
 * - Emojis
 * Then clamps to max length
 */
export function cleanText(s?: string, max = 220): string {
  if (!s) return '';
  
  // 1) Remove control characters, NBSP, BOM
  let out = s.replace(/[\u0000-\u001F\u007F\u00A0\uFEFF]/g, '');
  
  // 2) Remove emojis - try Extended_Pictographic first, fallback to ranges
  try {
    out = out.replace(/\p{Extended_Pictographic}/gu, '');
  } catch {
    // Fallback for runtimes that don't support \p{}
    out = out.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '');
  }
  
  // 3) Trim and clamp
  return clamp(out.trim(), max);
}
