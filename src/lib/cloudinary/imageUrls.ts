import { encodeOverlayText } from "./text";
import { cleanText } from "./utils";

/** Ratios pris en charge */
export type AspectRatio = "4:5" | "1:1" | "9:16" | "16:9";

export type SlideUrlOptions = {
  cloudName?: string; // sinon VITE_CLOUDINARY_CLOUD_NAME
  title?: string;
  subtitle?: string;
  bulletPoints?: string[];
  cta?: string;
  aspectRatio?: AspectRatio; // défaut 4:5
  textColorHex?: string; // défaut FFFFFF
  subTextColorHex?: string; // défaut E5E7EB
  fontFamily?: string; // défaut Nunito
};

/** Extrait le publicId d’une URL Cloudinary ou retourne tel quel si déjà un id. */
function extractPublicId(maybeUrlOrId: string): string {
  const value = (maybeUrlOrId ?? "").trim();
  if (!value) throw new Error("publicId manquant");
  if (!/^https?:\/\//i.test(value)) return value;

  const match = value.match(/\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?([^.?&#]+)(?:\.[a-z0-9]+)?/i);
  if (!match) {
    throw new Error("URL Cloudinary invalide, impossible d’extraire le publicId");
  }
  return match[1];
}

/** Dimensions en px par ratio */
function dims(ar?: AspectRatio) {
  if (ar === "9:16") return { w: 1080, h: 1920 };
  if (ar === "16:9") return { w: 1920, h: 1080 };
  if (ar === "1:1") return { w: 1080, h: 1080 };
  return { w: 1080, h: 1350 };
}

const enc = (s: string) => encodeURIComponent(s);

const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
const MAX_TITLE_LEN = 120;
const MAX_SUBTITLE_LEN = 220;
const MAX_BULLET_LEN = 80;
const MAX_CTA_LEN = 60;

function sanitizeText(value: string | undefined, maxLen: number): string {
  let sanitized = (value ?? "").replace(CONTROL_CHAR_REGEX, "");
  sanitized = sanitized.normalize("NFC").replace(/[ \t\f\v]+/g, " ").trim();
  if (!sanitized) return "";
  if (sanitized.length > maxLen) {
    sanitized = `${sanitized.slice(0, maxLen - 1).trimEnd()}…`;
  }
  return sanitized;
}

function encodeText(value: string | undefined, maxLen: number): string | null {
  const cleaned = sanitizeText(value, maxLen);
const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

function cleanOverlay(value: string | undefined, maxLen: number): string {
  let s = (value ?? "").toString();
  s = s.replace(CONTROL_CHAR_REGEX, "");
  s = s
    .normalize("NFC")
    .replace(/[ \t\f\v]+/g, " ")
    .trim();
  if (!s) return "";
  if (s.length > maxLen) {
    s = `${s.slice(0, maxLen - 1).trimEnd()}…`;
  }
  return s;
}

function prepareOverlayText(value: string | undefined, maxLen: number): string | null {
  const cleaned = cleanOverlay(value, maxLen);
function prepareOverlayText(value: string | undefined, maxLen: number): string | null {
  const cleaned = cleanText(value ?? "", maxLen);
  if (!cleaned) return null;

  const encoded = encodeOverlayText(cleaned);
  return encoded && encoded.trim() ? encoded : null;
}

function sanitizeColor(hex: string | undefined, fallback: string): string {
  const trimmed = (hex ?? fallback).trim().replace(/^#/, "");
  return trimmed.length ? trimmed : fallback;
}

function sanitizeFont(font: string | undefined): string {
  return (font ?? "Nunito").trim().replace(/\s+/g, "%20");
  const value = (hex ?? fallback).trim().replace(/^#/, "");
  return value.length ? value : fallback;
}

function sanitizeFont(font: string | undefined): string {
  const value = (font ?? "Nunito").trim();
  return value.replace(/\s+/g, "%20");
}

function overlayWidth(totalWidth: number, ratio: AspectRatio | undefined, kind: "title" | "subtitle" | "bullets" | "cta"): number {
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

const buildTextOverlay = (options: {
  font: string;
  size: number;
  encodedText: string | null;
  color: string;
  gravity: "north" | "center" | "south";
  y: number;
  width: number;
  bold?: boolean;
}) => {
  if (!options.encodedText) return null;
  const weight = options.bold ? `_bold` : "";
  return `l_text:${options.font}_${options.size}${weight}:${options.encodedText},co_rgb:${options.color},g_${options.gravity},y_${options.y},w_${options.width},c_fit`;
};

/**
 * Génère une URL Cloudinary AVEC overlays texte.
 * Le texte vient des champs du payload (title/subtitle/bullets/cta) – pas de “intent”.
 */
export const slideUrl = (publicId: string, o: SlideUrlOptions = {}): string => {
  const cloudName = o.cloudName ?? (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined);
  if (!cloudName) throw new Error("cloudName manquant");

  const { w, h } = dims(o.aspectRatio);
  const resolvedPublicId = extractPublicId(publicId);

  const baseTransform = `w_${w},h_${h},c_fill,f_png`;
  const overlays: string[] = [];

  const font = sanitizeFont(o.fontFamily);
  const color = sanitizeColor(o.textColorHex, "FFFFFF");
  const subColor = sanitizeColor(o.subTextColorHex, "E5E7EB");
  const color = sanitizeColor(o.textColorHex, "FFFFFF");
  const subColor = sanitizeColor(o.subTextColorHex, "E5E7EB");

  const titleSize = o.aspectRatio === "9:16" ? 80 : o.aspectRatio === "16:9" ? 64 : 72;
  const subtitleSize = o.aspectRatio === "9:16" ? 52 : o.aspectRatio === "16:9" ? 38 : 42;
  const bulletSize = o.aspectRatio === "16:9" ? 32 : 36;
  const ctaSize = o.aspectRatio === "16:9" ? 44 : 48;

  const titleOverlay = buildTextOverlay({
    font,
    size: titleSize,
    encodedText: encodeText(o.title, MAX_TITLE_LEN),
    color,
    gravity: "north",
    y: o.aspectRatio === "9:16" ? 140 : 120,
    width: overlayWidth(w, o.aspectRatio, "title"),
    bold: true,
  });
  if (titleOverlay) overlays.push(titleOverlay);

  const subtitleOverlay = buildTextOverlay({
    font,
    size: subtitleSize,
    encodedText: encodeText(o.subtitle, MAX_SUBTITLE_LEN),
    color: subColor,
    gravity: "north",
    y: o.aspectRatio === "9:16" ? 220 : 140,
    width: overlayWidth(w, o.aspectRatio, "subtitle"),
  });
  if (subtitleOverlay) overlays.push(subtitleOverlay);

  const bulletTexts = (o.bulletPoints ?? [])
    .map((bullet) => sanitizeText(bullet, MAX_BULLET_LEN))
    .filter((bullet): bullet is string => bullet.length > 0)
    .slice(0, 6);

  const bulletStartY = o.aspectRatio === "9:16" ? 380 : 300;
  const bulletStep = o.aspectRatio === "16:9" ? 54 : 60;
  bulletTexts.forEach((bullet, index) => {
    const overlay = buildTextOverlay({
      font,
      size: bulletSize,
      encodedText: encodeText(`• ${bullet}`, MAX_BULLET_LEN + 2),
      color,
      gravity: "center",
      y: bulletStartY + index * bulletStep,
      width: overlayWidth(w, o.aspectRatio, "bullets"),
    });
    if (overlay) overlays.push(overlay);
  });

  const ctaOverlay = buildTextOverlay({
    font,
    size: ctaSize,
    encodedText: encodeText(o.cta, MAX_CTA_LEN),
    color,
    gravity: "south",
    y: o.aspectRatio === "9:16" ? 120 : 80,
    width: overlayWidth(w, o.aspectRatio, "cta"),
    bold: true,
  });
  if (ctaOverlay) overlays.push(ctaOverlay);
  const titleY = o.aspectRatio === "9:16" ? 140 : 120;
  const subtitleY = o.aspectRatio === "9:16" ? 220 : 140;
  const bulletStartY = o.aspectRatio === "9:16" ? 380 : 300;
  const bulletStep = o.aspectRatio === "16:9" ? 54 : 60;
  const ctaY = o.aspectRatio === "9:16" ? 120 : 80;

  const encodedTitle = prepareOverlayText(o.title, MAX_TITLE_LEN);
  if (encodedTitle) {
    overlays.push(
      `l_text:${font}_${titleSize}_bold:${encodedTitle},co_rgb:${color},g_north,y_${titleY},w_${overlayWidth(w, o.aspectRatio, "title")},c_fit`,
    );
  }

  const encodedSubtitle = prepareOverlayText(o.subtitle, MAX_SUBTITLE_LEN);
  if (encodedSubtitle) {
    overlays.push(
      `l_text:${font}_${subtitleSize}:${encodedSubtitle},co_rgb:${subColor},g_north,y_${subtitleY},w_${overlayWidth(w, o.aspectRatio, "subtitle")},c_fit`,
    );
  }

  const bulletTexts = (o.bulletPoints ?? [])
    .map((b) => cleanOverlay(b, MAX_BULLET_LEN))
    .map((b) => cleanText(b ?? "", MAX_BULLET_LEN))
    .filter((b): b is string => Boolean(b))
    .slice(0, 6);

  bulletTexts.forEach((bullet, index) => {
    const encodedBullet = prepareOverlayText(`• ${bullet}`, MAX_BULLET_LEN + 2);
    if (!encodedBullet) return;
    overlays.push(
      `l_text:${font}_${bulletSize}:${encodedBullet},co_rgb:${color},g_center,y_${bulletStartY + index * bulletStep},w_${overlayWidth(
        w,
        o.aspectRatio,
        "bullets",
      )},c_fit`,
    );
  });

  const encodedCta = prepareOverlayText(o.cta, MAX_CTA_LEN);
  if (encodedCta) {
    overlays.push(
      `l_text:${font}_${ctaSize}_bold:${encodedCta},co_rgb:${color},g_south,y_${ctaY},w_${overlayWidth(w, o.aspectRatio, "cta")},c_fit`,
    );
  }

  const textTransforms = overlays.length ? `/${overlays.join("/")}` : "";
  return `https://res.cloudinary.com/${enc(cloudName)}/image/upload/${baseTransform}${textTransforms}/${enc(resolvedPublicId)}.png`;
};
}

/**
 * Génère une URL Cloudinary basique (sans overlay)
 */
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
}

declare const module: NodeJS.Module | undefined;

if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
  module.exports = { slideUrl, imageUrl } as const;
}
