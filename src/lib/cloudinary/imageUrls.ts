import { encodeOverlayText } from "./text";
import { cleanText } from "./utils";

export type AspectRatio = "4:5" | "1:1" | "9:16" | "16:9";

export type SlideUrlOptions = {
  cloudName?: string;
  title?: string;
  subtitle?: string;
  bulletPoints?: string[];
  cta?: string;
  aspectRatio?: AspectRatio;
  textColorHex?: string;
  subTextColorHex?: string;
  fontFamily?: string;
};

function extractPublicId(maybeUrlOrId: string): string {
  const value = (maybeUrlOrId ?? "").trim();
  if (!value) throw new Error("publicId manquant");
  if (!/^https?:\/\//i.test(value)) return value;

  const match = value.match(/\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?([^.?&#]+)(?:\.[a-z0-9]+)?/i);
  if (!match) {
    throw new Error("URL Cloudinary invalide, impossible d'extraire le publicId");
  }
  return match[1];
}

function dims(ratio?: AspectRatio) {
  switch (ratio) {
    case "9:16":
      return { w: 1080, h: 1920 };
    case "16:9":
      return { w: 1920, h: 1080 };
    case "1:1":
      return { w: 1080, h: 1080 };
    default:
      return { w: 1080, h: 1350 };
  }
}

const enc = (value: string) => encodeURIComponent(value);

const MAX_TITLE_LEN = 120;
const MAX_SUBTITLE_LEN = 220;
const MAX_BULLET_LEN = 80;
const MAX_CTA_LEN = 60;

function sanitizeColor(hex: string | undefined, fallback: string): string {
  const trimmed = (hex ?? fallback).trim().replace(/^#/, "");
  return trimmed.length ? trimmed : fallback;
}

function sanitizeFont(font: string | undefined): string {
  return (font ?? "Nunito").trim().replace(/\s+/g, "%20");
}

function overlayWidth(
  totalWidth: number,
  ratio: AspectRatio | undefined,
  kind: "title" | "subtitle" | "bullets" | "cta",
): number {
  const multiplier = (() => {
    switch (kind) {
      case "title":
        return 0.9;
      case "subtitle":
        return ratio === "9:16" ? 0.86 : 0.84;
      case "bullets":
        return 0.8;
      case "cta":
        return ratio === "16:9" ? 0.6 : 0.72;
      default:
        return 0.84;
    }
  })();

  return Math.round(totalWidth * multiplier);
}

function prepareText(value: string | undefined, maxLen: number): string {
  if (!value) return "";
  const cleaned = cleanText(value, maxLen);
  return cleaned.normalize("NFC");
}

function encodeText(value: string | undefined, maxLen: number): string | null {
  const prepared = prepareText(value, maxLen);
  if (!prepared) return null;
  const encoded = encodeOverlayText(prepared);
  return encoded && encoded.trim() ? encoded : null;
}

type OverlayConfig = {
  text: string | undefined;
  maxLength: number;
  font: string;
  size: number;
  color: string;
  gravity: "north" | "center" | "south";
  y: number;
  width: number;
  bold?: boolean;
};

function buildTextOverlay(config: OverlayConfig): string | null {
  const encodedText = encodeText(config.text, config.maxLength);
  if (!encodedText) return null;
  const weight = config.bold ? "_bold" : "";
  return `l_text:${config.font}_${config.size}${weight}:${encodedText},co_rgb:${config.color},g_${config.gravity},y_${config.y},w_${config.width},c_fit`;
}

export const slideUrl = (publicId: string, options: SlideUrlOptions = {}): string => {
  const cloudName = options.cloudName ?? (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined);
  if (!cloudName) throw new Error("cloudName manquant");

  const { w, h } = dims(options.aspectRatio);
  const resolvedPublicId = extractPublicId(publicId);

  const baseTransform = `w_${w},h_${h},c_fill,f_png`;
  const overlays: string[] = [];

  const font = sanitizeFont(options.fontFamily);
  const color = sanitizeColor(options.textColorHex, "FFFFFF");
  const subColor = sanitizeColor(options.subTextColorHex, "E5E7EB");

  const titleSize = options.aspectRatio === "9:16" ? 80 : options.aspectRatio === "16:9" ? 64 : 72;
  const subtitleSize = options.aspectRatio === "9:16" ? 52 : options.aspectRatio === "16:9" ? 38 : 42;
  const bulletSize = options.aspectRatio === "16:9" ? 32 : 36;
  const ctaSize = options.aspectRatio === "16:9" ? 44 : 48;

  const titleOverlay = buildTextOverlay({
    text: options.title,
    maxLength: MAX_TITLE_LEN,
    font,
    size: titleSize,
    color,
    gravity: "north",
    y: options.aspectRatio === "9:16" ? 140 : 120,
    width: overlayWidth(w, options.aspectRatio, "title"),
    bold: true,
  });
  if (titleOverlay) overlays.push(titleOverlay);

  const subtitleOverlay = buildTextOverlay({
    text: options.subtitle,
    maxLength: MAX_SUBTITLE_LEN,
    font,
    size: subtitleSize,
    color: subColor,
    gravity: "north",
    y: options.aspectRatio === "9:16" ? 220 : 140,
    width: overlayWidth(w, options.aspectRatio, "subtitle"),
  });
  if (subtitleOverlay) overlays.push(subtitleOverlay);

  const bulletTexts = (options.bulletPoints ?? [])
    .map((bullet) => prepareText(bullet, MAX_BULLET_LEN))
    .filter((bullet): bullet is string => bullet.length > 0)
    .slice(0, 6);

  const bulletStartY = options.aspectRatio === "9:16" ? 380 : 300;
  const bulletStep = options.aspectRatio === "16:9" ? 54 : 60;
  bulletTexts.forEach((bullet, index) => {
    const overlay = buildTextOverlay({
      text: `• ${bullet}`,
      maxLength: MAX_BULLET_LEN + 2,
      font,
      size: bulletSize,
      color,
      gravity: "center",
      y: bulletStartY + index * bulletStep,
      width: overlayWidth(w, options.aspectRatio, "bullets"),
    });
    if (overlay) overlays.push(overlay);
  });

  const ctaOverlay = buildTextOverlay({
    text: options.cta,
    maxLength: MAX_CTA_LEN,
    font,
    size: ctaSize,
    color,
    gravity: "south",
    y: options.aspectRatio === "9:16" ? 120 : 80,
    width: overlayWidth(w, options.aspectRatio, "cta"),
    bold: true,
  });
  if (ctaOverlay) overlays.push(ctaOverlay);

  const textTransforms = overlays.length ? `/${overlays.join("/")}` : "";
  return `https://res.cloudinary.com/${enc(cloudName)}/image/upload/${baseTransform}${textTransforms}/${enc(resolvedPublicId)}.png`;
};

export const imageUrl = (
  publicId: string,
  options: {
    width?: number;
    height?: number;
    quality?: number | "auto";
    format?: "png" | "webp" | "jpg" | "auto";
    cloudName?: string;
    crop?: "fill" | "fit" | "pad" | "scale";
  } = {},
): string => {
  const cloudName = options.cloudName ?? (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined);
  if (!cloudName) throw new Error("cloudName manquant");

  const resolvedPublicId = extractPublicId(publicId);

  const parts: string[] = [];
  if (options.width) parts.push(`w_${options.width}`);
  if (options.height) parts.push(`h_${options.height}`);
  parts.push(`c_${options.crop ?? "fill"}`);
  if (options.quality) parts.push(`q_${options.quality}`);
  parts.push(options.format && options.format !== "auto" ? `f_${options.format}` : "f_auto");

  const transform = parts.join(",");
  return `https://res.cloudinary.com/${enc(cloudName)}/image/upload/${transform}/${enc(resolvedPublicId)}.png`;
};

declare const module: NodeJS.Module | undefined;

if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
  module.exports = { slideUrl, imageUrl } as const;
}
