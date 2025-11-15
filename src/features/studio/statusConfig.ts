import type { BadgeProps } from "@/components/ui/badge";

export type StudioAssetStatus = "pending" | "processing" | "completed" | "failed";
export type StudioAssetType = "image" | "carousel" | "video";

export const mediaTypeLabels: Record<StudioAssetType, string> = {
  image: "Image",
  carousel: "Carrousel",
  video: "Vidéo",
};

export const statusLabels: Record<StudioAssetStatus, string> = {
  pending: "En attente",
  processing: "En cours",
  completed: "Terminé",
  failed: "Échec",
};

export const statusColors: Record<StudioAssetStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-800",
};

export const statusConfig: Record<
  StudioAssetStatus,
  { label: string; variant: BadgeProps["variant"]; className?: string }
> = {
  pending: {
    label: "En attente",
    variant: "outline",
    className: "text-muted-foreground border-muted-foreground/40",
  },
  processing: {
    label: "En cours",
    variant: "secondary",
  },
  completed: {
    label: "Terminé",
    variant: "default",
  },
  failed: {
    label: "Échec",
    variant: "destructive",
  },
};
