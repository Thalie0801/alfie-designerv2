import { CONTROL_CHARS_REGEX } from '@/lib/safeRender';

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
 * - Emojis and variation selectors
 * - Special unicode characters
 * Then clamps to max length
 */
export function cleanText(s?: string, max = 220): string {
  if (!s) return '';
  
  let out = s
    // 1) Remove control characters, NBSP, BOM
    .replace(CONTROL_CHARS_REGEX, '')
    // 2) Remove all emojis AND variation selectors (FE00-FE0F)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    // 3) Replace curly apostrophes with straight apostrophes
    .replace(/[\u2018\u2019]/g, "'")
    // 4) Replace curly quotes with straight quotes
    .replace(/[\u201C\u201D]/g, '"')
    // 5) Replace ellipsis with three dots
    .replace(/\u2026/g, '...')
    // 6) Remove zero-width characters
    .replace(/[\u200B-\u200F\u202A-\u202E]/g, '')
    // 7) Remove any remaining non-ASCII that could cause issues
    .replace(/[^\x20-\x7E\u00C0-\u017F]/g, '');
  
  return clamp(out.trim(), max);
}
