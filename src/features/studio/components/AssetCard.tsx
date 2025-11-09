import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle, Download, ExternalLink, Image as ImageIcon, PlayCircle } from "lucide-react";

type NormalizedStatus = "queued" | "running" | "done" | "error" | "unknown";

interface AssetCardProps {
  asset: {
    id: string;
    type: string;
    status: string;
    createdAt: string;
    previewUrl?: string | null;
    assetUrl?: string | null;
    downloadUrl?: string | null;
    videoUrl?: string | null;
    woofs?: number | null;
    engine?: string | null;
  };
  onMissingUrl?: () => void;
}

const STATUS_STYLES: Record<NormalizedStatus, { label: string; className: string }> = {
  queued: {
    label: "En attente",
    className: "bg-amber-100 text-amber-800 border border-amber-200",
  },
  running: {
    label: "En cours",
    className: "bg-sky-100 text-sky-700 border border-sky-200",
  },
  done: {
    label: "Terminé",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  },
  error: {
    label: "Erreur",
    className: "bg-red-100 text-red-700 border border-red-200",
  },
  unknown: {
    label: "Statut inconnu",
    className: "bg-secondary text-secondary-foreground",
  },
};

function normalizeStatus(status?: string | null): NormalizedStatus {
  if (!status) return "unknown";
  const value = status.toLowerCase();
  if (value === "queued" || value === "pending") return "queued";
  if (value === "running" || value === "processing") return "running";
  if (value === "done" || value === "completed" || value === "ready") return "done";
  if (value === "failed" || value === "error") return "error";
  return "unknown";
}

function sanitizeId(id: string) {
  return id.replace(/[^a-z0-9_-]/gi, "_");
}

function buildDownloadUrl(assetUrl: string, assetId: string, assetType: string, providedDownloadUrl?: string | null) {
  if (providedDownloadUrl) return providedDownloadUrl;
  if (!assetUrl) return null;

  const safeId = sanitizeId(assetId);
  const extension = assetType === "video" ? "mp4" : "png";

  try {
    const url = new URL(assetUrl);
    if (url.hostname.includes("res.cloudinary.com") && url.pathname.includes("/upload/")) {
      const [prefix, suffix] = url.pathname.split("/upload/");
      if (suffix) {
        const cleanedSuffix = suffix.replace(/^\/+/, "");
        url.pathname = `${prefix}/upload/fl_attachment:alfie_${safeId}.${extension}/${cleanedSuffix}`;
        return url.toString();
      }
    }
    const query = url.search ? `${url.search}&fl_attachment` : "?fl_attachment";
    return `${url.origin}${url.pathname}${query}${url.hash}`;
  } catch {
    const joiner = assetUrl.includes("?") ? "&" : "?";
    return `${assetUrl}${joiner}fl_attachment`;
  }
}

export function AssetCard({ asset, onMissingUrl }: AssetCardProps) {
  const normalizedStatus = normalizeStatus(asset.status);
  const statusConfig = STATUS_STYLES[normalizedStatus];
  const hasAssetUrl = Boolean(asset.assetUrl);
  const sanitizedId = useMemo(() => sanitizeId(asset.id), [asset.id]);
  const downloadUrl = useMemo(
    () =>
      asset.assetUrl
        ? buildDownloadUrl(asset.assetUrl, asset.id, asset.type, asset.downloadUrl)
        : asset.downloadUrl ?? null,
    [asset.assetUrl, asset.downloadUrl, asset.id, asset.type],
  );
  const hasDownload = Boolean(downloadUrl);
  const downloadFileName = `alfie_${sanitizedId}.${asset.type === "video" ? "mp4" : "png"}`;

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-medium capitalize">{asset.type}</p>
          <p className="text-xs text-muted-foreground">{asset.createdAt}</p>
          {typeof asset.woofs === "number" && asset.woofs >= 0 && (
            <p className="text-xs text-muted-foreground">Woofs consommés : {asset.woofs}</p>
          )}
          {asset.engine && (
            <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wide">
              {asset.engine}
            </Badge>
          )}
        </div>
        <Badge variant="secondary" className={cn("uppercase tracking-wide text-[11px]", statusConfig.className)}>
          {statusConfig.label}
        </Badge>
      </div>

      <div className="overflow-hidden rounded-md bg-muted">
        {asset.type === "video" ? (
          asset.videoUrl ? (
            <video src={asset.videoUrl} controls className="w-full" poster={asset.previewUrl ?? undefined} />
          ) : asset.previewUrl ? (
            <img src={asset.previewUrl} alt="Aperçu vidéo" className="w-full" />
          ) : (
            <div className="flex h-40 items-center justify-center flex-col text-muted-foreground">
              <PlayCircle className="h-10 w-10 mb-2" />
              <p className="text-xs">Aperçu indisponible</p>
            </div>
          )
        ) : asset.previewUrl ? (
          <img src={asset.previewUrl} alt="Media généré" className="w-full" />
        ) : (
          <div className="flex h-40 items-center justify-center flex-col text-muted-foreground">
            <ImageIcon className="h-10 w-10 mb-2" />
            <p className="text-xs">Aperçu indisponible</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {hasAssetUrl ? (
          <Button asChild size="sm" variant="outline" className="flex-1 min-w-[140px]">
            <a href={asset.assetUrl!} target="_blank" rel="noopener">
              <ExternalLink className="h-4 w-4 mr-2" />
              Ouvrir l’asset
            </a>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 min-w-[140px] opacity-60 cursor-not-allowed"
            aria-disabled={true}
            onClick={onMissingUrl}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Ouvrir l’asset
          </Button>
        )}

        {hasDownload ? (
          <Button asChild size="sm" className="flex-1 min-w-[140px]">
            <a
              href={downloadUrl!}
              target="_blank"
              rel="noopener"
              download={downloadFileName}
            >
              <Download className="h-4 w-4 mr-2" />
              Télécharger
            </a>
          </Button>
        ) : (
          <Button
            size="sm"
            className="flex-1 min-w-[140px] opacity-60 cursor-not-allowed"
            aria-disabled={true}
            onClick={onMissingUrl}
          >
            <Download className="h-4 w-4 mr-2" />
            Télécharger
          </Button>
        )}
      </div>

      {normalizedStatus === "error" && (
        <div className="flex items-center gap-2 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Échec de génération</span>
        </div>
      )}
    </div>
  );
}
