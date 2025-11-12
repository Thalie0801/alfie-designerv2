import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { posterFromVideoUrl } from "@/lib/cloudinary/videoSimple";

interface MediaCardProps {
  type: "image" | "video";
  url: string;
  alt: string;
  caption?: string;
  onDownload?: () => void;

  /** Optionnel: impose un ratio d’affichage (stabilise la mise en page) */
  aspect?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "4:5";

  /** Optionnel: poster explicite pour la vidéo.
   * Si absent et url Cloudinary, on génère un poster automatiquement. */
  posterUrl?: string;

  /** Masquer les contrôles natifs (ex: pour une preview click-to-play custom) */
  hideControls?: boolean;

  /** Classe externe optionnelle */
  className?: string;
}

const ASPECT_CLASS: Record<NonNullable<MediaCardProps["aspect"]>, string> = {
  "1:1": "aspect-square",
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
  "4:3": "aspect-[4/3]",
  "3:4": "aspect-[3/4]",
  "4:5": "aspect-[4/5]",
};

function isCloudinaryVideo(url: string) {
  return /res\.cloudinary\.com\/[^/]+\/video\/upload\//i.test(url);
}

export function MediaCard({
  type,
  url,
  alt,
  caption,
  onDownload,
  aspect,
  posterUrl,
  hideControls,
  className,
}: MediaCardProps) {
  const [imgError, setImgError] = useState(false);
  const [vidError, setVidError] = useState(false);

  const computedPoster = useMemo(() => {
    if (posterUrl) return posterUrl;
    if (type === "video" && isCloudinaryVideo(url)) {
      // vignette à 1s par défaut (modifiable)
      return posterFromVideoUrl(url, 1);
    }
    return undefined;
  }, [posterUrl, type, url]);

  const wrapperAspect = aspect ? ASPECT_CLASS[aspect] : undefined;

  const handleDownloadFallback = async () => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Download failed");
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = type === "video" ? "alfie-video.mp4" : "alfie-image.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Download error:", e);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
        <div className={cn("relative w-full", wrapperAspect)}>
          {/* Media */}
          {type === "image" ? (
            <>
              {!imgError ? (
                <img
                  src={url}
                  alt={alt}
                  loading="lazy"
                  className={cn("h-full w-full object-cover", wrapperAspect ? "absolute inset-0" : "")}
                  onError={() => setImgError(true)}
                />
              ) : (
                <div
                  className={cn(
                    "flex h-48 w-full items-center justify-center gap-2 text-slate-500",
                    wrapperAspect ? "absolute inset-0" : "",
                  )}
                >
                  <ImageOff className="h-5 w-5" />
                  <span className="text-sm">Impossible d’afficher l’image</span>
                </div>
              )}
            </>
          ) : (
            <>
              {!vidError ? (
                <video
                  src={url}
                  className={cn("h-full w-full", wrapperAspect ? "absolute inset-0 object-cover" : "")}
                  controls={!hideControls}
                  playsInline
                  preload="metadata"
                  poster={computedPoster}
                  onError={() => setVidError(true)}
                />
              ) : (
                <div
                  className={cn(
                    "flex h-48 w-full items-center justify-center gap-2 text-slate-500",
                    wrapperAspect ? "absolute inset-0" : "",
                  )}
                >
                  <ImageOff className="h-5 w-5" />
                  <span className="text-sm">Impossible de lire la vidéo</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {caption ? <p className="text-sm text-slate-500">{caption}</p> : <span />}

        <Button
          variant="outline"
          size="sm"
          className="rounded-full border-slate-200 text-slate-700 hover:bg-slate-100"
          onClick={onDownload ?? handleDownloadFallback}
        >
          <Download className="mr-2 h-4 w-4" /> Télécharger
        </Button>
      </div>
    </div>
  );
}
