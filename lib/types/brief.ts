export type BriefDeliverable = "image" | "carousel" | "video";

export type BriefRatio = "9:16" | "1:1" | "4:5" | "16:9";

export interface Brief {
  deliverable: BriefDeliverable;
  ratio: BriefRatio;
  resolution: string;
  slides?: number;
  duration?: number;
  useBrandKit: true;
  brandId: string;
  tone?: string;
  ambiance?: string;
  constraints?: string;
  presetId?: string;
}
