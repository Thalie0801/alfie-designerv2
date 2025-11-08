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
  const v = (maybeUrlOrId ?? "").trim();
  if (!v) throw new Error("publicId manquant");
  if (!/^https?:\/\//i.test(v)) return v; // déjà un id

  // Exemples d’URL:
  // https://res.cloudinary.com/<cloud>/image/upload/v1720000/folder/img_xyz.png
  // https://res.cloudinary.com/<cloud>/image/upload/w_1080/v1720000/folder/a.b.c
  const m = v.match(/\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?([^.?&#]+)(?:\.[a-z0-9]+)?/i);
  if (!m) throw new Error("URL Cloudinary invalide, impossible d’extraire le publicId");
  return m[1]; // ex: folder/img_xyz
}

/** Dimensions en px par ratio */
function dims(ar?: AspectRatio) {
  if (ar === "9:16") return { w: 1080, h: 1920 };
  if (ar === "16:9") return { w: 1920, h: 1080 };
  if (ar === "1:1") return { w: 1080, h: 1080 };
  return { w: 1080, h: 1350 }; // 4:5
}

const enc = (s: string) => encodeURIComponent(s);

const MAX_TITLE_LEN = 120;
const MAX_SUBTITLE_LEN = 220;
const MAX_BULLET_LEN = 80;
const MAX_CTA_LEN = 60;

function prepareOverlayText(value: string | undefined, maxLen: number): string | null {
  const cleaned = cleanText(value ?? "", maxLen);
  if (!cleaned) return null;

  const encoded = encodeOverlayText(cleaned);
  return encoded && encoded.trim() ? encoded : null;
}

function sanitizeColor(hex: string | undefined, fallback: string): string {
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

/**
 * Génère une URL Cloudinary AVEC overlays texte.
 * Le texte vient des champs du payload (title/subtitle/bullets/cta) – pas de “intent”.
 */
export function slideUrl(publicId: string, o: SlideUrlOptions = {}): string {
  const cloudName = o.cloudName ?? (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined);
  if (!cloudName) throw new Error("cloudName manquant");

  const { w, h } = dims(o.aspectRatio);
  publicId = extractPublicId(publicId);

  const base = `w_${w},h_${h},c_fill,f_png`; // on force PNG pour la netteté des textes
  const overlays: string[] = [];

  const color = sanitizeColor(o.textColorHex, "FFFFFF");
  const subColor = sanitizeColor(o.subTextColorHex, "E5E7EB");
  const font = sanitizeFont(o.fontFamily);

  const titleSize = o.aspectRatio === "9:16" ? 80 : o.aspectRatio === "16:9" ? 64 : 72;
  const subtitleSize = o.aspectRatio === "9:16" ? 52 : o.aspectRatio === "16:9" ? 38 : 42;
  const bulletSize = o.aspectRatio === "16:9" ? 32 : 36;
  const ctaSize = o.aspectRatio === "16:9" ? 44 : 48;

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

  const tf = overlays.length ? `/${overlays.join("/")}` : "";
  return `https://res.cloudinary.com/${enc(cloudName)}/image/upload/${base}${tf}/${enc(publicId)}.png`;
}

/**
 * Génère une URL Cloudinary basique (sans overlay)
 */
export function imageUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    quality?: number | "auto";
    format?: "png" | "webp" | "jpg" | "auto";
    cloudName?: string;
    crop?: "fill" | "fit" | "pad" | "scale";
  } = {},
): string {
  const cloudName = options.cloudName ?? (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined);
  if (!cloudName) throw new Error("cloudName manquant");

  publicId = extractPublicId(publicId);

  const parts: string[] = [];
  if (options.width) parts.push(`w_${options.width}`);
  if (options.height) parts.push(`h_${options.height}`);
  parts.push(`c_${options.crop ?? "fill"}`);
  if (options.quality) parts.push(`q_${options.quality}`);
  parts.push(options.format && options.format !== "auto" ? `f_${options.format}` : "f_auto");

  const tf = parts.join(",");
  return `https://res.cloudinary.com/${enc(cloudName)}/image/upload/${tf}/${enc(publicId)}.png`;
}
