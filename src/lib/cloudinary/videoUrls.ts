import { Cloudinary } from '@cloudinary/url-gen';
import { scale } from '@cloudinary/url-gen/actions/resize';
import { source } from '@cloudinary/url-gen/actions/overlay';
import { text } from '@cloudinary/url-gen/qualifiers/source';
import { TextStyle } from '@cloudinary/url-gen/qualifiers/textStyle';
import { Position } from '@cloudinary/url-gen/qualifiers/position';
import { compass } from '@cloudinary/url-gen/qualifiers/gravity';

const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dkad5vdyo';

const cld = new Cloudinary({
  cloud: {
    cloudName,
  },
});

export interface ReelUrlOptions {
  title?: string;
  subtitle?: string;
  start?: number; // Start time in seconds
  duration?: number; // Duration in seconds
  width?: number;
  height?: number;
  aspectRatio?: string; // e.g., "9:16", "16:9", "1:1"
  quality?: number | 'auto';
  format?: string;
}

/**
 * Generate a Cloudinary URL for a video reel with text overlays
 * Uses @cloudinary/url-gen SDK for proper transformation handling
 */
export function reelUrl(publicId: string, options: ReelUrlOptions = {}): string {
  const {
    title,
    subtitle,
    start,
    duration,
    width,
    height,
    aspectRatio = '9:16',
    quality = 'auto',
    format = 'mp4',
  } = options;

  // Start with base video
  let video = cld.video(publicId);

  // Apply aspect ratio or dimensions
  if (width && height) {
    video = video.resize(scale().width(width).height(height));
  } else if (aspectRatio) {
    // Common aspect ratios for videos
    const ratios: Record<string, { w: number; h: number }> = {
      '9:16': { w: 1080, h: 1920 }, // Instagram/TikTok vertical
      '16:9': { w: 1920, h: 1080 }, // YouTube landscape
      '1:1': { w: 1080, h: 1080 },  // Instagram square
      '4:5': { w: 1080, h: 1350 },  // Instagram portrait
    };
    const ratio = ratios[aspectRatio] || ratios['9:16'];
    video = video.resize(scale().width(ratio.w).height(ratio.h));
  }

  // Add title overlay if provided
  if (title) {
    const titleStyle = new TextStyle('Montserrat', 64)
      .fontWeight('bold')
      .textAlignment('center');

    video = video.overlay(
      source(
        text(title, titleStyle)
          .textColor('#FFFFFF')
          .backgroundColor('rgba(0,0,0,0.7)')
      ).position(
        new Position().gravity(compass('north')).offsetY(150)
      )
    );
  }

  // Add subtitle overlay if provided
  if (subtitle) {
    const subtitleStyle = new TextStyle('Montserrat', 42)
      .fontWeight('normal')
      .textAlignment('center');

    video = video.overlay(
      source(
        text(subtitle, subtitleStyle)
          .textColor('#FFFFFF')
          .backgroundColor('rgba(0,0,0,0.6)')
      ).position(
        new Position().gravity(compass('south')).offsetY(150)
      )
    );
  }

  // Note: The SDK doesn't directly support start/duration trimming in the URL builder
  // For now, we'll need to manually append these transformations
  let url = video.toURL();

  // Add start offset if provided (so_X.Xs in Cloudinary)
  if (start !== undefined && start > 0) {
    url = url.replace('/upload/', `/upload/so_${start}s/`);
  }

  // Add duration if provided (du_X.Xs in Cloudinary)
  if (duration !== undefined && duration > 0) {
    if (url.includes('/upload/so_')) {
      url = url.replace(/\/upload\/so_(\d+\.?\d*)s\//, `/upload/so_$1s,du_${duration}s/`);
    } else {
      url = url.replace('/upload/', `/upload/du_${duration}s/`);
    }
  }

  // Add quality if not auto
  if (quality !== 'auto') {
    url = url.replace('/upload/', `/upload/q_${quality}/`);
  }

  // Add format
  if (format && format !== 'mp4') {
    url = url.replace(/\.(mp4|mov|avi)$/, `.${format}`);
  }

  return url;
}

/**
 * Simple video URL without overlays
 */
export function videoUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    quality?: number | 'auto';
    format?: string;
  } = {}
): string {
  let video = cld.video(publicId);

  if (options.width && options.height) {
    video = video.resize(
      scale()
        .width(options.width)
        .height(options.height)
    );
  } else if (options.width) {
    video = video.resize(scale().width(options.width));
  } else if (options.height) {
    video = video.resize(scale().height(options.height));
  }

  return video.toURL();
}

/**
 * Get video thumbnail
 */
export function videoThumbnail(
  publicId: string,
  options: {
    time?: number; // Time in seconds to grab thumbnail from
    width?: number;
    height?: number;
  } = {}
): string {
  const { time = 0, width = 640, height = 360 } = options;

  // Get thumbnail as image at specific time
  let img = cld.image(publicId.replace(/\.(mp4|mov|avi)$/, ''));
  
  img = img.resize(scale().width(width).height(height));

  let url = img.toURL();
  
  // Add video thumbnail transformation (so_X.Xs for specific frame)
  if (time > 0) {
    url = url.replace('/image/upload/', `/image/upload/so_${time}s/`);
  }

  return url;
}
