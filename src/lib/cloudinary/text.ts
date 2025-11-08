function encodeBase64(cleaned: string): string {
  const normalized = cleaned.normalize('NFC');
  const encoder = new TextEncoder();
  const bytes = encoder.encode(normalized);

  if (typeof (globalThis as any).Buffer?.from === 'function') {
    return (globalThis as any).Buffer.from(bytes).toString('base64');
  }

  if (typeof globalThis.btoa === 'function') {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return globalThis.btoa(binary);
  }

  // Fallback: attempt using Uint8Array -> string conversion
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(binary);
  }

  throw new Error('No base64 encoder available');
}

/**
 * Encode overlay text for Cloudinary using base64 (UTF-8 safe)
 */
export function encodeOverlayText(value?: string): string {
  const cleaned = sanitize(value ?? '');
  if (!cleaned) return '';

  try {
    return `b64:${encodeBase64(cleaned)}`;
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[cloudinary/text] Falling back to URL encoding', error);
    }
    return encodeURIComponent(cleaned);
  }
}

/**
 * Provide overlay text with an optional fallback if the source is empty.
 */
export function overlayText(source?: string, fallback?: string): string {
  const candidate = source && source.trim().length > 0 ? source : fallback ?? '';
  return encodeOverlayText(candidate);
}

const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

function sanitize(input: string): string {
  let value = input.replace(CONTROL_CHAR_REGEX, '');
  value = value.normalize('NFC').replace(/[ \t\f\v]+/g, ' ').trim();
  return value;
}
