import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Trash2, PlayCircle, Image as ImageIcon, AlertCircle, ExternalLink } from "lucide-react";
import { CanvaButton } from "@/components/ui/CanvaButton";
import { LibraryAsset } from "@/hooks/useLibraryAssets";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { posterFromVideoUrl } from "@/lib/cloudinary/videoSimple";

interface AssetCardProps {
  asset: LibraryAsset;
  selected: boolean;
  onSelect: () => void;
  onDownload: () => void;
  onDelete: () => void;
  daysUntilExpiry: number;
}

function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} Mo`;
}

function formatDuration(seconds?: number) {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function safeTimeAgo(dateISO?: string | null) {
  if (!dateISO) return "";
  const d = new Date(dateISO);
  if (isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true, locale: fr });
}

export function AssetCard({ asset, selected, onSelect, onDownload, onDelete, daysUntilExpiry }: AssetCardProps) {
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // Reset des états d'erreur si les URLs changent
  useEffect(() => {
    setImageError(false);
    setVideoError(false);
  }, [asset.output_url, asset.thumbnail_url, asset.type]);

  const handleVideoError = () => {
    console.info("[AssetCard] Video preview unavailable", asset.id);
    setVideoError(true);
  };

  const handleImageError = () => {
    console.info("[AssetCard] Image preview unavailable", asset.id);
    setImageError(true);
  };

  const expiryBadge = useMemo(() => {
    // ✅ Vidéos permanentes (Cloudinary) : pas de badge d'expiration
    if (daysUntilExpiry > 365) return null;
    
    if (daysUntilExpiry < 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          EXPIRÉ
        </Badge>
      );
    }
    if (daysUntilExpiry <= 3) {
      return (
        <Badge variant="destructive" className="text-xs">
          J-{daysUntilExpiry}
        </Badge>
      );
    }
    if (daysUntilExpiry <= 7) {
      return <Badge className="bg-orange-500 text-white text-xs">J-{daysUntilExpiry}</Badge>;
    }
    return (
      <Badge variant="secondary" className="text-xs">
        J-{daysUntilExpiry}
      </Badge>
    );
  }, [daysUntilExpiry]);

  const createdAgo = safeTimeAgo(asset.created_at);
  const duration = formatDuration(asset.duration_seconds as any);
  const fileSize = formatFileSize((asset as any).file_size_bytes);
  const engine = (asset.engine || "").toString();

  // ✅ Helper pour obtenir une URL vidéo valide
  const getVideoSrc = (): string => {
    // 1) Priorité à output_url si c'est une vraie URL
    if (asset.output_url && asset.output_url.startsWith("http")) {
      return asset.output_url;
    }
    // 2) Sinon thumbnail_url si c'est une vraie URL (pour fallback sur image)
    if (asset.thumbnail_url && asset.thumbnail_url.startsWith("http")) {
      return asset.thumbnail_url;
    }
    // 3) Aucune URL valide
    return "";
  };

  const videoSrc = asset.type === "video" ? getVideoSrc() : "";

  // ✅ Générer un thumbnail à partir de l'URL vidéo Cloudinary
  const getVideoThumbnail = (): string => {
    // Pour les vidéos Cloudinary, générer un thumbnail dynamique
    if (asset.output_url && asset.output_url.includes("res.cloudinary.com") && asset.output_url.includes("/video/upload/")) {
      return posterFromVideoUrl(asset.output_url, 1);
    }
    // Pour les vidéos Replicate, pas de transformation possible
    if (asset.output_url && asset.output_url.includes("replicate.delivery")) {
      return "";
    }
    // Fallback : thumbnail_url si c'est une vraie image
    if (asset.thumbnail_url && !asset.thumbnail_url.endsWith(".mp4")) {
      return asset.thumbnail_url;
    }
    return "";
  };

  const videoThumbnail = asset.type === "video" ? getVideoThumbnail() : "";

  return (
    <Card className={`group hover:shadow-lg transition-all ${selected ? "ring-2 ring-primary" : ""}`}>
      <CardContent className="p-0 relative">
        {/* Checkbox de sélection */}
        <div className="absolute top-2 left-2 z-10">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onSelect()}
            aria-label={selected ? "Désélectionner" : "Sélectionner"}
            className="bg-background/90 backdrop-blur border-2"
          />
        </div>

        {/* Badges en haut à droite */}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
          {expiryBadge}
          {asset.is_source_upload && (
            <Badge variant="outline" className="bg-background/90 backdrop-blur text-xs">
              Source
            </Badge>
          )}
          {asset.type === "video" && engine.toLowerCase().includes("veo") && (
            <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px]">
              Premium
            </Badge>
          )}
          {asset.woofs > 0 && <Badge className="bg-purple-500 text-white text-xs">{asset.woofs} 🐕</Badge>}
        </div>

        {/* Preview - Container avec dimensions fixes pour éviter CLS */}
        <div className="relative aspect-[4/5] bg-muted overflow-hidden rounded-t-lg">
          {/* ✅ VIDÉO avec aperçu thumbnail + overlay play */}
          {asset.type === "video" ? (
            <>
              {(videoThumbnail || videoSrc) && !videoError ? (
                <div className="relative w-full h-full group/video">
                  {/* Image thumbnail en arrière-plan */}
                  {videoThumbnail && (
                    <img
                      src={videoThumbnail}
                      alt="Aperçu vidéo"
                      className="w-full h-full object-cover absolute inset-0"
                      width={400}
                      height={500}
                      loading="lazy"
                      onError={handleImageError}
                    />
                  )}
                  {/* Vidéo qui se charge au hover */}
                  {videoSrc && (
                    <video
                      src={videoSrc}
                      className="w-full h-full object-cover relative z-10 opacity-0 group-hover/video:opacity-100 transition-opacity"
                      poster={videoThumbnail || undefined}
                      preload="metadata"
                      controls
                      muted
                      loop
                      playsInline
                      onError={handleVideoError}
                      aria-label="Aperçu vidéo"
                    />
                  )}
                  {/* Overlay play indicator */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-100 group-hover/video:opacity-0 transition-opacity pointer-events-none z-20">
                    <PlayCircle className="h-12 w-12 text-white drop-shadow-lg" />
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                  <PlayCircle className="h-16 w-16 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground text-center px-4">
                    {asset.status === "processing" ? "⏳ Génération IA en cours…" : "Aperçu indisponible"}
                  </p>
                </div>
              )}
              {/* Badge durée */}
              {duration && (
                <div className="absolute bottom-2 left-2 z-30">
                  <Badge className="bg-black/70 text-white text-xs">
                    <PlayCircle className="h-3 w-3 mr-1" />
                    {duration}
                  </Badge>
                </div>
              )}
            </>
          ) : (
            <>
              {asset.output_url && !imageError ? (
                <img
                  src={asset.output_url}
                  alt="Création"
                  className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  width={400}
                  height={500}
                  onError={handleImageError}
                  loading="lazy"
                />
              ) : asset.thumbnail_url && !imageError ? (
                <img
                  src={asset.thumbnail_url}
                  alt="Miniature"
                  className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  width={400}
                  height={500}
                  onError={handleImageError}
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                  {imageError ? (
                    <>
                      <AlertCircle className="h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground">Erreur de chargement</p>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-16 w-16 text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground">Génération…</p>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Info */}
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{createdAgo}</span>
            {fileSize && <span>{fileSize}</span>}
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-3 pt-0 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 min-w-[100px] touch-target min-h-[44px]"
          onClick={onDownload}
          disabled={asset.type === "video" && !asset.output_url}
          title={asset.type === "video" && !asset.output_url ? "Vidéo en cours de génération" : "Télécharger"}
          aria-disabled={(asset.type === "video" && !asset.output_url) || undefined}
        >
          <Download className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">{asset.type === "video" && !asset.output_url ? "En génération…" : "Télécharger"}</span>
        </Button>
        
        {/* Bouton Canva - uniquement pour les images */}
        {asset.type !== "video" && asset.output_url && (
          <CanvaButton
            imageUrl={asset.output_url}
            size="sm"
            variant="outline"
            className="touch-target min-h-[44px] min-w-[44px] sm:min-w-0 sm:px-3"
            label=""
            showToast={true}
          >
            <ExternalLink className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Canva</span>
          </CanvaButton>
        )}
        
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="text-destructive hover:text-destructive touch-target min-w-[44px] min-h-[44px]"
          title="Supprimer"
          aria-label="Supprimer"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
