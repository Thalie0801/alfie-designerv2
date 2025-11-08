import { CLOUDINARY_CLOUD_NAME } from "./env.ts";

const CLOUDINARY_URL_REGEX = /^(https?:\/\/res\.cloudinary\.com\/)([^/]+)(\/image\/upload\/)(.+)$/i;

export function extractCloudName(url?: string | null): string | undefined {
  if (!url) return CLOUDINARY_CLOUD_NAME || undefined;
  const match = url.match(/https?:\/\/res\.cloudinary\.com\/([^/]+)/i);
  if (match?.[1]) return match[1];
  return CLOUDINARY_CLOUD_NAME || undefined;
}

interface ThumbnailOptions {
  secureUrl?: string | null;
  publicId: string;
  format?: string | null;
  width?: number;
  height?: number;
  crop?: string;
  quality?: string;
  cloudName?: string | null;
}

export function buildImageThumbnailUrl(options: ThumbnailOptions): string {
  const {
    secureUrl,
    publicId,
    format,
    width = 400,
    height = 400,
    crop = "fill",
    quality = "auto",
    cloudName,
  } = options;

  const normalizedPublicId = publicId.replace(/^\/+/, "");

  if (secureUrl) {
    const match = secureUrl.match(CLOUDINARY_URL_REGEX);
    if (match) {
      const [, prefix, , , rest] = match;
      return `${prefix}${extractCloudName(secureUrl)}/image/upload/c_${crop},w_${width},h_${height},q_${quality},f_auto/${rest}`;
    }
  }

  const resolvedCloud = cloudName || extractCloudName(secureUrl) || CLOUDINARY_CLOUD_NAME;
  if (!resolvedCloud) {
    return secureUrl || normalizedPublicId;
  }

  const extension = format ? `.${format.replace(/^\./, "")}` : "";
  return `https://res.cloudinary.com/${resolvedCloud}/image/upload/c_${crop},w_${width},h_${height},q_${quality},f_auto/${normalizedPublicId}${extension}`;
}
