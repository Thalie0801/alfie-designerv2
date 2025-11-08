import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FolderOpen, Copy, PlayCircle, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { downloadUrl } from "@/lib/download";

interface AssetMessageProps {
  assetId: string;
  type: "image" | "video";
  outputUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  woofsConsumed?: number;
  engine?: string;
  expiresAt: string;
  onOpenInLibrary?: () => void;
  aspectRatioHint?: "4:5" | "1:1" | "9:16" | "16:9";
}

export function AssetMessage(props: AssetMessageProps) {
  const {
    assetId,
    type,
    outputUrl,
    thumbnailUrl,
    duration,
    width,
    height,
    woofsConsumed,
    engine,
    expiresAt,
    onOpenInLibrary,
    aspectRatioHint,
  } = props;

  const [imageError, setImageError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const aspectClass = useMemo(() => {
    const byHint = {
      "4:5": "aspect-[4/5]",
      "1:1": "aspect-square",
      "9:16": "aspect-[9/16]",
      "16:9": "aspect-video",
    } as const;

    if (aspectRatioHint) return byHint[aspectRatioHint];
    if (width && height) {
      const r = Number((width / height).toFixed(2));
      if (Math.abs(r - 1) < 0.05) return "aspect-square";
      if (Math.abs(r - 4 / 5) < 0.05) return "aspect-[4/5]";
      if (Math.abs(r - 9 / 16) < 0.05) return "aspect-[9/16]";
      if (Math.abs(r - 16 / 9) < 0.05) return "aspect-video";
    }
    return "aspect-[4/5]";
  }, [aspectRatioHint, width, height]);

  const daysLeft = useMemo(() => {
    const now = Date.now();
    const expiry = new Date(expiresAt).getTime();
    const days = Math.ceil((expiry - now) / 86400000);
    return days;
  }, [expiresAt]);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      await downloadUrl(outputUrl, `alfie-${type}-${assetId}`);
      toast.success("Téléchargement démarré");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Erreur lors du téléchargement");
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(outputUrl);
      toast.success("URL copiée");
    } catch {
      toast.error("Impossible de copier l’URL");
    }
  };

  const onTogglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onEnded = () => setIsPlaying(false);
    v.addEventListener("ended", onEnded);
    return () => v.removeEventListener("ended", onEnded);
  }, []);

  const poster = useMemo(() => {
    if (thumbnailUrl && !imageError) return thumbnailUrl;
    if (type === "video" && /res\.cloudinary\.com/.test(outputUrl)) {
      const m = outputUrl.match(
        /(https?:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload)\/(.+?)\/([^/]+)\.(mp4|mov|webm)/i,
      );
      if (m) {
        const [, root, path, pid] = m;
        return `${root}/so_1/${path}/${pid}.jpg`;
      }
    }
    return undefined;
  }, [thumbnailUrl, imageError, outputUrl, type]);

  return (
    <Card className="max-w-md">
      <CardContent className="p-0">
        <div className={cn("relative overflow-hidden rounded-t-lg bg-muted", aspectClass)}>
          {type === "video" ? (
            <div className="relative w-full h-full">
              <video
                ref={videoRef}
                src={outputUrl}
                poster={poster}
                className="absolute inset-0 w-full h-full object-cover"
                controls={false}
                playsInline
              />
              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={isPlaying ? "Mettre en pause la vidéo" : "Lire la vidéo"}
                className={cn(
                  "absolute inset-0 grid place-items-center transition",
                  isPlaying ? "bg-black/0" : "bg-black/35 hover:bg-black/45",
                )}
              >
                {!isPlaying && <PlayCircle className="h-16 w-16 text-white drop-shadow" />}
              </button>

              {typeof duration === "number" && (
                <Badge className="absolute bottom-2 left-2 bg-black/70 text-white">
                  <PlayCircle className="h-3 w-3 mr-1" />
                  {Math.round(duration)}s
                </Badge>
              )}
            </div>
          ) : (
            <>
              {outputUrl && !imageError ? (
                <div className="relative group w-full h-full">
                  <img
                    src={outputUrl}
                    alt="Generated content"
                    className="absolute inset-0 w-full h-full object-cover transition"
                    onError={() => setImageError(true)}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                    <button
                      onClick={handleDownload}
                      className="bg-white rounded-full p-3 shadow-lg hover:scale-110 transition-transform"
                      aria-label="Télécharger l'image"
                      disabled={downloading}
                    >
                      <Download className="h-6 w-6 text-slate-900" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full grid place-items-center bg-gradient-to-br from-primary/10 to-secondary/10">
                  <ImageIcon className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
            </>
          )}

          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {engine && (
              <Badge variant="secondary" className="text-xs">
                {engine}
              </Badge>
            )}
            {woofsConsumed !== undefined && woofsConsumed > 0 && (
              <Badge className="bg-purple-500 text-white text-xs">−{woofsConsumed} 🐕</Badge>
            )}
          </div>
        </div>

        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{type === "video" ? "🎬 Vidéo" : "🖼️ Image"} prête ✅</span>
            {width && height && (
              <span className="text-muted-foreground text-xs">
                {width}×{height}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {daysLeft >= 0 ? <span>Expire : J+{daysLeft}</span> : <span className="text-destructive">Expiré</span>}
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-3 pt-0 flex gap-2">
        <Button size="sm" onClick={handleDownload} className="flex-1" disabled={downloading}>
          <Download className="h-4 w-4 mr-2" />
          Télécharger
        </Button>

        {onOpenInLibrary && (
          <Button size="sm" variant="outline" onClick={onOpenInLibrary}>
            <FolderOpen className="h-4 w-4 mr-2" />
            Bibliothèque
          </Button>
        )}

        <Button size="sm" variant="ghost" onClick={handleCopyUrl}>
          <Copy className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
