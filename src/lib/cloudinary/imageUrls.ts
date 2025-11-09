// src/lib/cloudinary/imageUrls.ts

import { stripControlChars } from "@/lib/regex";

const EXTRA_INVISIBLE_RE = new RegExp("[\\x7F\\u00A0\\uFEFF]", "g");

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

/* ----------------------------- utilitaires ----------------------------- */

function normalizeSpaces(s: string): string {
  return stripControlChars(s)
    .replace(EXTRA_INVISIBLE_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nettoie et tronque pour l’affichage (pas pour l’encodage). */
function cleanText(input: string, maxLen?: number): string {
  let s = normalizeSpaces((input ?? "").toString());
  s = s.normalize("NFC");
  if (maxLen && s.length > maxLen) s = s.slice(0, maxLen - 1).trimEnd() + "…";
  return s;
}

/** Encodage base64 UTF-8 compatible navigateur pour Cloudinary `l_text:...:b64:` */
function encodeOverlayText(text: string): string {
  const bytes = new TextEncoder().encode(text.normalize("NFC"));
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return `b64:${b64}`;
}

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

/* ------------------------------- builders ------------------------------ */

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

  const title = cleanText(o.title ?? "", 120);
  const subtitle = cleanText(o.subtitle ?? "", 220);
  const bullets = (o.bulletPoints ?? []).map((b) => cleanText(b, 80)).slice(0, 6);
  const cta = cleanText(o.cta ?? "", 60);

  const color = (o.textColorHex ?? "FFFFFF").replace(/^#/, "");
  const subColor = (o.subTextColorHex ?? "E5E7EB").replace(/^#/, "");
  const font = o.fontFamily ?? "Nunito";

  // Tailles/offsets selon ratio
  const titleSize = o.aspectRatio === "9:16" ? 80 : o.aspectRatio === "16:9" ? 64 : 72;
  const titleY = o.aspectRatio === "9:16" ? 140 : 120;

  const subSize = o.aspectRatio === "9:16" ? 52 : o.aspectRatio === "16:9" ? 38 : 42;
  const subY = o.aspectRatio === "9:16" ? 220 : 140;

  const bulletSize = o.aspectRatio === "16:9" ? 32 : 36;
  const bulletStartY = o.aspectRatio === "9:16" ? 380 : 300;

  const ctaSize = o.aspectRatio === "16:9" ? 44 : 48;

  // Titre (haut)
  if (title) {
    overlays.push(
      `l_text:${font}_${titleSize}_bold:${encodeOverlayText(title)},co_rgb:${color},g_north,y_${titleY},w_${Math.round(
        w * 0.9,
      )},c_fit`,
    );
  }

  // Sous-titre (bas)
  if (subtitle) {
    overlays.push(
      `l_text:${font}_${subSize}:${encodeOverlayText(
        subtitle,
      )},co_rgb:${subColor},g_south,y_${subY},w_${Math.round(w * 0.84)},c_fit`,
    );
  }

  // Puces (centre)
  bullets.forEach((b, i) => {
    overlays.push(
      `l_text:${font}_${bulletSize}:${encodeOverlayText(
        "• " + b,
      )},co_rgb:${color},g_center,y_${bulletStartY + i * 60},w_${Math.round(w * 0.8)},c_fit`,
    );
  });

  // CTA (bas)
  if (cta) {
    overlays.push(`l_text:${font}_${ctaSize}_bold:${encodeOverlayText(cta)},co_rgb:${color},g_south,y_80`);
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
