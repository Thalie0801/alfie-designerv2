import { Dict, Json } from './safe';

/**
 * Chat-related shared types and helpers.
 */

/**
 * Asset returned by library-related hooks.
 */
export interface LibraryAsset {
  id: string;
  url: string;
  publicId?: string;
  alt?: string;
  thumbnailUrl?: string;
  text?: {
    title?: string;
    subtitle?: string;
    bullets?: string[];
  };
  slideIndex: number;
  type: string;
  format?: string;
}

/**
 * Structure of assistant and user messages inside the chat thread.
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'image' | 'video' | 'carousel' | 'reasoning' | 'bulk-carousel';
  assetUrl?: string;
  assetId?: string;
  metadata?: (Dict<Json> & { assetUrls?: string[] }) | null;
  reasoning?: string;
  brandAlignment?: string;
  quickReplies?: string[];
  bulkCarouselData?: BulkCarouselData;
  orderId?: string | null;
  links?: Array<{ label: string; href: string }>;
  timestamp: Date;
}

/**
 * Data returned when the orchestrator prepares bulk carousels.
 */
export interface BulkCarouselData {
  carousels: Array<{
    carousel_index: number;
    slides: Array<{
      storage_url: string;
      cloudinary_url?: string;
      index: number;
      format?: string;
    }>;
    zip_url?: string;
  }>;
  totalCarousels: number;
  slidesPerCarousel: number;
}

/**
 * Response payload returned by the orchestrator edge function.
 */
export interface OrchestratorResponse {
  conversationId: string;
  orderId?: string;
  response: string;
  reasoning?: string;
  brandAlignment?: string;
  quickReplies?: string[];
  totalSlides?: number;
  bulkCarouselData?: BulkCarouselData;
  state?: ConversationState | string;
  context?: Dict<Json> | null;
}

/**
 * Props expected by quick reply button groups.
 */
export interface QuickRepliesProps {
  replies: string[];
  onSelect: (reply: string) => Promise<void>;
}

/**
 * Conversation lifecycle states handled by the chat experience.
 */
export type ConversationState = 'idle' | 'generating' | 'completed';

/**
 * Supported aspect formats for generated assets.
 */
export type AspectFormat = '4:5' | '9:16' | '16:9' | '1:1';

/**
 * Helper mapping aspect formats to Tailwind aspect ratio classes.
 */
export const getAspectClass = (format?: AspectFormat | string): string => {
  switch (format) {
    case '9:16':
      return 'aspect-[9/16]';
    case '16:9':
      return 'aspect-video';
    case '1:1':
      return 'aspect-square';
    case '5:4':
      return 'aspect-[5/4]';
    case '4:5':
    default:
      return 'aspect-[4/5]';
  }
};

export type Ratio = '1:1' | '9:16' | '16:9' | '3:4';

export interface Slide {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
}

export interface SendOptions {
  mode?: 'auto' | 'image' | 'video' | 'text';
  ratio?: Ratio;
  slides?: Slide[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}
