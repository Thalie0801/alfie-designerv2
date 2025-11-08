import { encode as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const CONTROL_CHARS_REGEX = /[\u0000-\u001f\u007f]/g;

function sanitizeSurrogates(input: string): string {
  return input
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

export function cleanOverlayText(value?: string): string {
  if (!value) return "";
  const sanitized = sanitizeSurrogates(String(value ?? ""))
    .replace(/\r\n/g, "\n")
    .replace(CONTROL_CHARS_REGEX, "");

  return sanitized.trim();
}

export function encodeOverlayText(value: string): string {
  const cleaned = cleanOverlayText(value);
  if (!cleaned) return "";

  try {
    const normalized = cleaned.normalize("NFC");
    const bytes = new TextEncoder().encode(normalized);
    return `b64:${base64Encode(bytes)}`;
  } catch (error) {
    console.warn("[cloudinaryText] Falling back to URL encoding", error);
    return encodeURIComponent(cleaned);
  }
}

export const encodeCloudinaryText = encodeOverlayText;
