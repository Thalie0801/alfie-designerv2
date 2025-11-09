import React from "react";
import { Download, ExternalLink, Film } from "lucide-react";
import { cn } from "@/lib/utils";

type Asset = {
  id: string;
  type: "image" | "carousel" | "video" | string;
  url?: string | null;
  coverUrl?: string | null;
  slideUrls?: string[] | null;
  ratio?: "1:1" | "9:16" | "16:9" | "3:4" | string;
  title?: string | null;
  created_at?: string | null;
  meta?: Record<string, unknown> | null;
};

type AssetCardProps = {
  asset: Asset;
  className?: string;
  onEnqueueVideo?: (asset: Asset) => void;
};

export function AssetCard({ asset, className, onEnqueueVideo }: AssetCardProps) {
  const hasUrl = Boolean(asset?.url);
  const openHref = hasUrl ? String(asset.url) : undefined;
  const downloadHref =
    hasUrl ? `${asset!.url!}${asset!.url!.includes("?") ? "&" : "?"}fl_attachment` : undefined;

  const isCarousel = asset.type === "carousel";
  const isVideo = asset.type === "video";
  const isImage = asset.type === "image";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white/70 shadow-sm p-4 flex flex-col gap-3",
        "dark:bg-neutral-900/70 dark:border-neutral-800",
        className
      )}
    >
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
        {isCarousel && asset.coverUrl ? (
          <img
            src={asset.coverUrl}
            alt={asset.title ?? `Carousel ${asset.id}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : hasUrl ? (
          <img
            src={asset.url!}
            alt={asset.title ?? `Asset ${asset.id}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full grid place-items-center text-neutral-400">
            Aucun aperçu
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {asset.title ?? (isCarousel ? "Carrousel" : isVideo ? "Vidéo" : "Image")}
          </div>
          <div className="text-xs text-neutral-500 truncate">
            {asset.ratio ? `Format ${asset.ratio}` : "Format inconnu"}
            {asset.created_at ? ` • ${new Date(asset.created_at).toLocaleString()}` : ""}
          </div>
        </div>
        <div className="text-xs px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800">
          {asset.type}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <a
          href={openHref}
          target="_blank"
          rel="noopener"
          className={cn(
            "inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-sm",
            hasUrl ? "hover:bg-neutral-50 dark:hover:bg-neutral-800" : "pointer-events-none opacity-50"
          )}
          aria-disabled={!hasUrl}
        >
          <ExternalLink size={16} />
          Ouvrir l’asset
        </a>

        <a
          href={downloadHref}
          download
          className={cn(
            "inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-sm",
            hasUrl ? "hover:bg-neutral-50 dark:hover:bg-neutral-800" : "pointer-events-none opacity-50"
          )}
          aria-disabled={!hasUrl}
        >
          <Download size={16} />
          Télécharger
        </a>

        {isCarousel && typeof onEnqueueVideo === "function" && (
          <button
            type="button"
            onClick={() => onEnqueueVideo(asset)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <Film size={16} />
            Transformer en vidéo
          </button>
        )}
      </div>
    </div>
  );
}

export default AssetCard;
