// src/components/library/VideoBatchesTab.tsx
// Video batches tab - displays all video batches with clips

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBrandKit } from "@/hooks/useBrandKit";
import { useVideoBatches, BatchVideo } from "@/hooks/useVideoBatches";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Eye, 
  Download, 
  FileSpreadsheet, 
  Copy, 
  FileArchive, 
  RefreshCw, 
  Loader2,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Clock,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VideoClipPlayer } from "./VideoClipPlayer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface VideoBatchesTabProps {
  orderId?: string | null;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "done":
      return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" /> Prêt</Badge>;
    case "processing":
      return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> En cours</Badge>;
    case "error":
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Erreur</Badge>;
    case "queued":
    default:
      return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> En attente</Badge>;
  }
}

function VideoCard({ 
  video, 
  onRetryClip 
}: { 
  video: BatchVideo; 
  onRetryClip: (clipId: string) => void;
}) {
  const [retrying, setRetrying] = useState<string | null>(null);

  const handleRetryClip = async (clipId: string) => {
    setRetrying(clipId);
    try {
      await onRetryClip(clipId);
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-primary text-primary-foreground text-sm font-bold px-2 py-1 rounded">
            {video.video_index}
          </span>
          <h4 className="font-medium">{video.title || `Vidéo ${video.video_index}`}</h4>
        </div>
        {getStatusBadge(video.status)}
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <Progress value={video.progress} className="h-2" />
        <p className="text-xs text-muted-foreground">
          {video.completedClips}/{video.totalClips} clips générés
        </p>
      </div>

      {/* Video Player */}
      <VideoClipPlayer 
        clips={video.clips}
        className="max-w-[200px] mx-auto"
      />

      {/* Clips status - dynamic grid */}
      <div className={cn(
        "grid gap-2",
        video.totalClips <= 4 ? `grid-cols-${video.totalClips}` : 
        video.totalClips <= 6 ? "grid-cols-3" : "grid-cols-4"
      )}>
        {video.clips.map((clip) => (
          <div 
            key={clip.id} 
            className={cn(
              "text-center p-2 rounded text-xs",
              clip.status === "done" && "bg-green-100 text-green-800",
              clip.status === "processing" && "bg-blue-100 text-blue-800",
              clip.status === "error" && "bg-red-100 text-red-800",
              clip.status === "queued" && "bg-gray-100 text-gray-600"
            )}
          >
            <span className="font-medium">Clip {clip.clipIndex}</span>
            {clip.status === "error" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 mt-1"
                onClick={() => handleRetryClip(clip.id)}
                disabled={retrying === clip.id}
              >
                {retrying === clip.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Download clips button */}
      {video.status === "done" && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => {
            const urls = video.clips.filter(c => c.clipUrl).map(c => c.clipUrl!);
            if (urls.length === 0) {
              toast.error("Aucun clip disponible");
              return;
            }
            // Open each in new tab
            urls.forEach((url, i) => {
              setTimeout(() => window.open(url, "_blank"), i * 500);
            });
            toast.success(`${urls.length} clips ouverts`);
          }}
        >
          <Download className="h-4 w-4 mr-2" />
          Télécharger clips
        </Button>
      )}
    </div>
  );
}

export function VideoBatchesTab({ orderId: _orderId }: VideoBatchesTabProps) {
  const { user } = useAuth();
  const { activeBrandId } = useBrandKit();
  const { 
    batches, 
    loading, 
    error, 
    refetch, 
    retryClip, 
    downloadCSV, 
    downloadZIP, 
    copyAllTexts 
  } = useVideoBatches(user?.id, activeBrandId ?? undefined);

  const [downloadingCSV, setDownloadingCSV] = useState<string | null>(null);
  const [downloadingZIP, setDownloadingZIP] = useState<string | null>(null);

  const handleDownloadCSV = async (batchId: string) => {
    setDownloadingCSV(batchId);
    try {
      await downloadCSV(batchId);
    } finally {
      setDownloadingCSV(null);
    }
  };

  const handleDownloadZIP = async (batchId: string) => {
    setDownloadingZIP(batchId);
    try {
      await downloadZIP(batchId);
    } finally {
      setDownloadingZIP(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
        <p>Erreur: {error}</p>
        <Button variant="outline" className="mt-4" onClick={refetch}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Réessayer
        </Button>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Aucun batch vidéo pour l'instant.</p>
        <p className="text-sm">Demandez à Alfie de créer plusieurs vidéos, elles apparaîtront ici.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {batches.map((batch) => (
        <div key={batch.id} className="border rounded-lg p-4 space-y-4">
          {/* Batch header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">Batch {batch.id.slice(0, 8)}</h3>
              {getStatusBadge(batch.status)}
              <Badge variant="secondary">{batch.videos.length} vidéos</Badge>
              <Badge variant="outline">{batch.settings?.clips_per_video || 3} clips/vidéo</Badge>
              <Badge variant="outline">{batch.settings?.ratio || "9:16"}</Badge>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownloadCSV(batch.id)}
                disabled={downloadingCSV === batch.id}
              >
                {downloadingCSV === batch.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                CSV Canva
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => copyAllTexts(batch)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copier textes
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownloadZIP(batch.id)}
                disabled={downloadingZIP === batch.id}
              >
                {downloadingZIP === batch.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileArchive className="h-4 w-4 mr-2" />
                )}
                ZIP
              </Button>
            </div>
          </div>

          {/* Overall progress */}
          <div className="space-y-1">
            <Progress value={batch.progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {batch.completedClips}/{batch.totalClips} clips • 
              {batch.errorClips > 0 && <span className="text-destructive"> {batch.errorClips} erreurs</span>}
            </p>
          </div>

          {/* Prompt */}
          <p className="text-sm text-muted-foreground truncate" title={batch.inputPrompt}>
            📝 {batch.inputPrompt.slice(0, 100)}{batch.inputPrompt.length > 100 ? "..." : ""}
          </p>

          {/* Video cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {batch.videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onRetryClip={retryClip}
              />
            ))}
          </div>

          {/* Texts section */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  📝 Textes des vidéos
                </span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Vidéo</TableHead>
                      {/* Dynamic clip headers based on clips_per_video */}
                      {Array.from({ length: batch.settings?.clips_per_video || 3 }, (_, i) => (
                        <TableHead key={i}>Clip {i + 1}</TableHead>
                      ))}
                      <TableHead>CTA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batch.videos.map((video) => {
                      const clipsPerVideo = batch.settings?.clips_per_video || 3;
                      return (
                        <TableRow key={video.id}>
                          <TableCell className="font-medium">{video.video_index}</TableCell>
                          {/* Dynamic clip cells */}
                          {Array.from({ length: clipsPerVideo }, (_, i) => {
                            const clipIndex = i + 1;
                            // Support both new format (clips array) and legacy format
                            const clipTitle = video.texts?.clips?.[i]?.title || 
                                            (video.texts as Record<string, unknown>)?.[`clip${clipIndex}Title`] as string || "-";
                            const clipSubtitle = video.texts?.clips?.[i]?.subtitle ||
                                                (video.texts as Record<string, unknown>)?.[`clip${clipIndex}Subtitle`] as string || "";
                            return (
                              <TableCell key={i}>
                                <div className="text-sm">
                                  <p className="font-medium">{clipTitle}</p>
                                  <p className="text-muted-foreground text-xs">{clipSubtitle}</p>
                                </div>
                              </TableCell>
                            );
                          })}
                          <TableCell>
                            <span className="text-sm">{video.texts?.cta || "-"}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      ))}
    </div>
  );
}
