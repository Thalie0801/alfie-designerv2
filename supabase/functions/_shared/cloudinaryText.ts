import { encode as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";

import { stripControlChars } from "../../../src/lib/regex.ts";

const EXTRA_INVISIBLE_RE = new RegExp("[\\x7F\\u00A0\\uFEFF]", "g");

function sanitizeSurrogates(input: string): string {
  return input
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

function normalizeSpaces(input: string): string {
  return stripControlChars(input).replace(EXTRA_INVISIBLE_RE, "").replace(/\s+/g, " ").trim();
}

export function cleanOverlayText(value?: string): string {
  if (!value) return "";
  const sanitized = sanitizeSurrogates(String(value ?? ""))
    .replace(/\r\n/g, "\n");

  return normalizeSpaces(sanitized);
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
