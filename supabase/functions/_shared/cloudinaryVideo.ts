import { cleanOverlayText, encodeOverlayText } from "./cloudinaryText.ts";

export type Aspect = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "4:5";

const ASPECT_DIM: Record<Aspect, string> = {
  "1:1": "w_1080,h_1080",
  "16:9": "w_1920,h_1080",
  "9:16": "w_1080,h_1920",
  "4:3": "w_1440,h_1080",
  "3:4": "w_1080,h_1440",
  "4:5": "w_1080,h_1350",
};

type SpliceItem =
  | { type: "image"; publicId: string; durationSec?: number }
  | { type: "video"; publicId: string; trimStartSec?: number; trimEndSec?: number };

function clampOverlay(value: string | undefined, max: number): string {
  const cleaned = cleanOverlayText(value ?? "");
  if (!cleaned) return "";
  return cleaned.slice(0, max).trim();
}

function encodeOverlay(value: string | undefined, max: number): string | null {
  const clamped = clampOverlay(value, max);
  if (!clamped) return null;
  return encodeOverlayText(clamped);
}

function encodePublicId(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "%20");
}

export function buildSpliceVideoUrl(params: {
  cloudName: string;
  items: SpliceItem[];
  aspect?: Aspect;
  title?: string;
  subtitle?: string;
  cta?: string;
  audioPublicId?: string | null;
}): string {
  const { cloudName, items, aspect = "4:5", title, subtitle, cta, audioPublicId } = params;

  const dimension = ASPECT_DIM[aspect] || ASPECT_DIM["4:5"];
  const segments: string[] = [`https://res.cloudinary.com/${cloudName}/video/upload/${dimension},c_fill,f_mp4`];

  const overlays: string[] = [];
  const titleOverlay = encodeOverlay(title, 80);
  if (titleOverlay) overlays.push(`l_text:Arial_70_bold:${titleOverlay},co_rgb:FFFFFF,g_north,y_200`);
  const subtitleOverlay = encodeOverlay(subtitle, 100);
  if (subtitleOverlay) overlays.push(`l_text:Arial_44:${subtitleOverlay},co_rgb:E5E7EB,g_center,y_50`);
  const ctaOverlay = encodeOverlay(cta, 50);
  if (ctaOverlay) overlays.push(`l_text:Arial_56_bold:${ctaOverlay},co_rgb:FFFFFF,g_south,y_160`);

  if (overlays.length) {
    segments.push("/" + overlays.join("/"));
  }

  items.forEach((item) => {
    if (item.type === "image") {
      const duration = Math.max(1, Math.round(item.durationSec ?? 2));
      segments.push(`/l_image:${encodePublicId(item.publicId)},du_${duration},fl_splice`);
    } else {
      const trims: string[] = [];
      if (typeof item.trimStartSec === "number") trims.push(`so_${Math.max(0, item.trimStartSec)}`);
      if (typeof item.trimEndSec === "number") trims.push(`eo_${Math.max(0, item.trimEndSec)}`);
      const trimSegment = trims.length ? `,${trims.join(",")}` : "";
      segments.push(`/l_video:${encodePublicId(item.publicId)}${trimSegment},fl_splice`);
    }
  });

  if (audioPublicId) {
    segments.push(`/l_audio:${encodePublicId(audioPublicId)}`);
  }

  return segments.join("");
}

export function posterFromVideoUrl(videoUrl: string, second = 1): string {
  return videoUrl
    .replace("/video/upload/", `/video/upload/so_${Math.max(0, second)}/`)
    .replace(/\.mp4(\?.*)?$/i, ".jpg");
}
