import { useState, useCallback, useEffect, useMemo } from "react";
import { Upload, Wand2, Download, X, Sparkles, Loader2, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { createGeneration, forceProcessJobs } from "@/api/alfie";
import { useToast } from "@/hooks/use-toast";
import { uploadToChatBucket } from "@/lib/chatUploads";
import { useLocation } from "react-router-dom";
import { useBrandKit } from "@/hooks/useBrandKit";
import { toast } from "sonner";
import { useQueueMonitor } from "@/hooks/useQueueMonitor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { JobCard } from "./components/JobCard";
import { AssetCard as StudioAssetCard } from "./components/AssetCard";
import type { JobEntry, MediaEntry } from "./types";

const inferKindFromType = (type?: string): "image" | "carousel" | "video" => {
  switch (type) {
    case "render_carousels":
    case "generate_carousel":
    case "carousel":
      return "carousel";
    case "generate_video":
    case "render_video":
    case "video":
      return "video";
    case "render_images":
    case "generate_images":
    case "generate_image":
    default:
      return "image";
  }
};

type GeneratedAsset = {
  url: string;
  type: "image" | "video";
};

type AspectRatio = "1:1" | "9:16" | "16:9";
type ContentType = "image" | "video" | "carousel";

type UploadedSource = {
  type: "image" | "video";
  url: string;
  name: string;
};

// Exemples de prompts suggérés (Phase 3)
const PROMPT_EXAMPLES = {
  image: [
    "Une plage tropicale au coucher du soleil avec des palmiers",
    "Un café parisien avec des tables en terrasse, style aquarelle",
    "Un paysage de montagne enneigé avec un lac gelé",
    "Une rue animée de Tokyo la nuit avec des néons",
  ],
  carousel: [
    "5 slides pour une masterclass marketing sur les réseaux sociaux",
    "Carrousel LinkedIn présentant une nouvelle offre B2B",
    "Présentation en 4 slides d'un produit de beauté haut de gamme",
    "Tutoriel en 3 étapes pour utiliser une application mobile",
  ],
  video: [
    "Une cascade qui coule dans une forêt tropicale",
    "Des nuages qui défilent rapidement au-dessus d'une ville",
    "Un feu de camp qui crépite la nuit sous les étoiles",
    "Une route qui traverse un désert au lever du soleil",
  ],
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  image: "Image",
  carousel: "Carrousel",
  video: "Vidéo",
};

const ASPECT_TO_TW: Record<AspectRatio, string> = {
  "1:1": "aspect-square",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
};

const UNKNOWN_REFRESH_ERROR = "Erreur inconnue pendant le rafraîchissement";

function resolveRefreshErrorMessage(error: unknown): string {
  if (!error) return UNKNOWN_REFRESH_ERROR;

  if (error instanceof Error && error.message?.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (typeof error === "object") {
    const candidate = error as Record<string, unknown>;
    const status =
      typeof candidate.status === "number"
        ? candidate.status
        : typeof candidate.code === "number"
          ? candidate.code
          : undefined;

    const messages: Array<unknown> = [
      candidate.message,
      candidate.error_description,
      candidate.error,
      candidate.details,
      candidate.hint,
    ];

    for (const value of messages) {
      if (typeof value === "string" && value.trim()) {
        return status ? `${value} (code ${status})` : value;
      }
    }
  }

  return UNKNOWN_REFRESH_ERROR;
}

function fetchWithTimeoutPromise<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("Timeout: La requête prend trop de temps")), ms);
    promise
      .then((value) => {
        clearTimeout(id);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(id);
        reject(error);
      });
  });
}

function parseFlag(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "on", "enabled", "yes"].includes(normalized);
}

export function ChatGenerator() {
  const { activeBrandId, brandKit } = useBrandKit();
  const location = useLocation();
  const orderId =
    useMemo(() => {
      const params = new URLSearchParams(location.search);
      return params.get("order");
    }, [location.search]) || null;
  const orderLabel = useMemo(
    () => (orderId ? `Commande ${orderId}` : "Toutes les commandes"),
    [orderId],
  );

  const enableCarousel = parseFlag(import.meta.env.VITE_FLAG_CAROUSEL);
  const enableVideo = parseFlag(import.meta.env.VITE_FLAG_VIDEO);

  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contentType, setContentType] = useState<ContentType>("image");
  const [uploadedSource, setUploadedSource] = useState<UploadedSource | null>(
    null,
  );
  const [generatedAsset, setGeneratedAsset] = useState<GeneratedAsset | null>(
    null,
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [assets, setAssets] = useState<MediaEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForcing, setIsForcing] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);

  const { toast: showToast } = useToast();

  const stylePreset = useMemo(() => {
    if (!brandKit) return null;

    const colors = Array.isArray(brandKit.palette)
      ? brandKit.palette.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];

    const preset: Record<string, unknown> = { colors };

    if (brandKit.fonts && typeof brandKit.fonts === "object") {
      const fonts: Record<string, string> = {};
      if (typeof brandKit.fonts.primary === "string" && brandKit.fonts.primary.trim()) {
        fonts.primary = brandKit.fonts.primary;
      }
      if (typeof brandKit.fonts.secondary === "string" && brandKit.fonts.secondary.trim()) {
        fonts.secondary = brandKit.fonts.secondary;
      }
      if (Object.keys(fonts).length > 0) {
        preset.fonts = fonts;
      }
    }

    if (typeof brandKit.voice === "string" && brandKit.voice.trim()) {
      preset.voice = brandKit.voice.trim();
    }

    return preset;
  }, [brandKit]);

  const contentTypeOptions = useMemo(() => {
    const base: ContentType[] = ["image"];
    if (enableCarousel) base.push("carousel");
    if (enableVideo) base.push("video");
    return base;
  }, [enableCarousel, enableVideo]);

  useEffect(() => {
    if (!enableVideo && contentType === "video") {
      setContentType("image");
    } else if (!enableCarousel && contentType === "carousel") {
      setContentType("image");
    }
  }, [contentType, enableCarousel, enableVideo]);

  const showGenerationError = useCallback((err: unknown) => {
    if (err instanceof Error && err.name === "AbortError") {
      toast.error("Timeout: la génération a pris trop de temps.");
      return;
    }
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "";
    toast.error(message || "Erreur de génération");
  }, []);

  // ✅ Monitor queue status
  const { data: queueData } = useQueueMonitor(true);

  // Calculate stuck jobs
  const stuckJobs = useMemo(() => {
    return jobs.filter(j => {
      if (j.status !== "queued") return false;
      const updatedAt = new Date(j.updated_at).getTime();
      const now = Date.now();
      const minutesSinceUpdate = (now - updatedAt) / (1000 * 60);
      return minutesSinceUpdate > 10; // Stuck if queued for >10 minutes
    });
  }, [jobs]);

  const hasSelection = selectedJobIds.length > 0;

  const promptExamples = useMemo(() => PROMPT_EXAMPLES[contentType] ?? PROMPT_EXAMPLES.image, [contentType]);

  const disableGenerate = useMemo(() => {
    const trimmedPrompt = prompt.trim();
    if (contentType === "image") {
      return isSubmitting || (!trimmedPrompt && !uploadedSource);
    }
    return isSubmitting || trimmedPrompt.length === 0;
  }, [contentType, isSubmitting, prompt, uploadedSource]);

  const formatDate = (value: string) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  };

  const refetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!currentUser) throw new Error("Non authentifié");

      let jobsQuery = supabase
        .from("job_queue")
        .select("id, type, status, order_id, created_at, updated_at, error, payload, user_id, retry_count, max_retries")
        .select(
          "id, type, kind, status, brand_id, order_id, created_at, updated_at, error, payload, user_id, retry_count, attempts, max_attempts"
        )
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (activeBrandId) {
        jobsQuery = jobsQuery.contains("payload", { brand_id: activeBrandId });
      }

      let assetsQuery = supabase
        .from("library_assets")
        .select("id, type, cloudinary_url, preview_url, created_at, brand_id, order_id, metadata")
        .select(
          "id, type, kind, cloudinary_url, secure_url, preview_url, created_at, brand_id, order_id, metadata, meta"
        )
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (activeBrandId) {
        assetsQuery = assetsQuery.eq("brand_id", activeBrandId);
      }

      if (orderId) {
        jobsQuery = jobsQuery.eq("order_id", orderId);
        assetsQuery = assetsQuery.eq("order_id", orderId);
      }

      const [jobsResponse, assetsResponse] = await Promise.all([jobsQuery, assetsQuery]);

      if (jobsResponse.error) throw jobsResponse.error;
      if (assetsResponse.error) throw assetsResponse.error;

      const jobRows = (jobsResponse.data as JobEntry[]) ?? [];
      const assetRows = (assetsResponse.data as MediaEntry[]) ?? [];

      setJobs(jobRows);
      setAssets(assetRows);
      setSelectedJobIds((prev) => prev.filter((id) => jobRows.some((job) => job.id === id)));
    } catch (err) {
      console.error("[Studio] refetchAll error:", err);
      const message = resolveRefreshErrorMessage(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeBrandId, orderId]);

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let debounceTimer: NodeJS.Timeout | null = null;

    // ✅ Debounce refetch pour éviter trop d'appels
    const debouncedRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (mounted) void fetchWithTimeoutPromise(refetchAll(), 15000);
      }, 1000);
    };

    (async () => {
      await fetchWithTimeoutPromise(refetchAll(), 15000);

      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (!mounted) return;
      if (authError) {
        console.error("[Studio] auth error after refetch:", authError);
        setError((prev) => prev ?? authError.message);
        return;
      }
      if (!currentUser) return;

      channel = supabase
        .channel("studio-stream")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "job_queue", filter: `user_id=eq.${currentUser.id}` },
          () => {
            if (mounted) debouncedRefetch();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "library_assets", filter: `user_id=eq.${currentUser.id}` },
          () => {
            if (mounted) debouncedRefetch();
          },
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [refetchAll]);

  const requeueJob = useCallback(
    async (job: JobEntry) => {
      try {
        let payload: unknown = job.payload ?? null;
        if (typeof payload === "string" && payload.trim()) {
          try {
            payload = JSON.parse(payload);
          } catch (parseError) {
            throw new Error("Impossible de relancer le job: payload invalide");
          }
        }

        if (payload == null) {
          throw new Error("Impossible de relancer ce job sans payload");
        }

        const payloadObj = payload as Record<string, any>;

        const { error: insertError } = await supabase.from("job_queue").insert([
          {
            order_id: job.order_id,
            brand_id: job.brand_id ?? payloadObj?.brandId ?? payloadObj?.brand_id ?? 'unassigned',
            type: job.type,
            kind: job.kind ?? inferKindFromType(job.type),
            status: "queued" as const,
            payload: payloadObj,
          },
        ] as any);

        if (insertError) throw insertError;

        showToast({
          title: "Job relancé",
          description: "Le job a été renvoyé en file d'attente",
        });

        await fetchWithTimeoutPromise(refetchAll(), 15000);
      } catch (err) {
        console.error("[Studio] requeueJob error:", err);
        showToast({
          title: "Échec du renvoi",
          description: err instanceof Error ? err.message : "Erreur inconnue lors du renvoi du job",
          variant: "destructive",
        });
      }
    },
    [refetchAll, showToast],
  );

  const handleSourceUpload = useCallback(
    async (file: File) => {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) {
        showToast({
          title: "Format non supporté",
          description: "Veuillez uploader une image ou une vidéo",
          variant: "destructive",
        });
        return;
      }

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("Utilisateur non authentifié");

        const { signedUrl: uploadedSourceUrl } = await uploadToChatBucket(file, supabase, user.id);

        setUploadedSource({
          type: isImage ? "image" : "video",
          url: uploadedSourceUrl,
          name: file.name,
        });

        showToast({
          title: "Média uploadé",
          description: "Prêt à être utilisé",
        });
      } catch (err: unknown) {
        console.error("Upload error:", err);
        let description = "";
        if (err instanceof Error) {
          description = err.message;
        } else {
          try {
            description = JSON.stringify(err);
          } catch {
            description = String(err);
          }
        }
        showToast({
          title: "Erreur d'upload",
          description,
          variant: "destructive",
        });
      }
    },
    [showToast]
  );

  const videoDuration = 12;

  const handleGenerateImage = useCallback(async () => {
    const trimmedPrompt = prompt.trim();

    if (isSubmitting) {
      return;
    }

    if (!activeBrandId) {
      toast.error("Sélectionne une marque avant de générer.");
      return;
    }

    if (!trimmedPrompt && !uploadedSource) {
      showToast({
        title: "Prompt requis",
        description: "Veuillez entrer un prompt ou uploader un média",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setGeneratedAsset(null);

    try {
      const resolutionMap: Record<AspectRatio, string> = {
        "1:1": "1024x1024",
        "9:16": "1080x1920",
        "16:9": "1920x1080",
      };

      const payload = {
        prompt: trimmedPrompt,
        aspect_ratio: aspectRatio,
        resolution: resolutionMap[aspectRatio],
        reference: uploadedSource
          ? {
              type: uploadedSource.type,
              url: uploadedSource.url,
              name: uploadedSource.name,
            }
          : null,
      };

      const res = await createGeneration(activeBrandId, {
        kind: "image",
        payload,
        stylePreset,
      });
      toast.success(`Commande créée #${res.order_id}`);

      await fetchWithTimeoutPromise(refetchAll(), 15000);
    } catch (err: unknown) {
      console.error("[Studio] image generation error:", err);
      showGenerationError(err);
    } finally {
      setIsSubmitting(false);
    }
  }, [activeBrandId, aspectRatio, isSubmitting, prompt, refetchAll, showGenerationError, showToast, uploadedSource]);

  const handleGenerateVideo = useCallback(async () => {
    const promptText = (prompt || "").trim();

    try {
      if (isSubmitting) {
        return;
      }

      setIsSubmitting(true);
      setGeneratedAsset(null);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("Tu dois être connecté pour lancer une génération.");
      if (!activeBrandId) throw new Error("Sélectionne une marque.");
      if (!promptText) throw new Error("Ajoute un prompt (1–2 phrases suffisent).");
      if (!aspectRatio) throw new Error("Choisis un format (9:16, 16:9, ...).");

      const durationSec = Number(videoDuration) > 0 ? Number(videoDuration) : 12;

      const payload = {
        prompt: promptText,
        aspect_ratio: aspectRatio,
        duration: durationSec,
        reference: uploadedSource
          ? {
              type: uploadedSource.type,
              url: uploadedSource.url,
              name: uploadedSource.name,
            }
          : null,
      };

      const res = await createGeneration(activeBrandId, {
        kind: "video",
        payload,
        stylePreset,
      });
      toast.success(`Commande créée #${res.order_id}`);

      await fetchWithTimeoutPromise(refetchAll(), 15000);
    } catch (err: unknown) {
      console.error("[Studio] generate video error:", err);
      showGenerationError(err);
    } finally {
      setIsSubmitting(false);
    }
  }, [activeBrandId, aspectRatio, isSubmitting, prompt, refetchAll, showGenerationError, stylePreset, uploadedSource, videoDuration]);

  const handleGenerateCarousel = useCallback(async () => {
    const promptText = prompt.trim();

    if (isSubmitting) {
      return;
    }

    if (!activeBrandId) {
      toast.error("Sélectionne une marque avant de générer.");
      return;
    }

    if (!promptText) {
      showToast({
        title: "Prompt requis",
        description: "Décris ton carrousel avant de lancer la génération",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setGeneratedAsset(null);

    try {
      const payload = {
        prompt: promptText,
        aspect_ratio: aspectRatio,
        slide_count: 5,
        slides: [],
      };

      const res = await createGeneration(activeBrandId, {
        kind: "carousel",
        payload,
        stylePreset,
      });

      toast.success(`Commande créée #${res.order_id}`);
      await fetchWithTimeoutPromise(refetchAll(), 15000);
    } catch (err: unknown) {
      console.error("[Studio] carousel generation error:", err);
      showGenerationError(err);
    } finally {
      setIsSubmitting(false);
    }
  }, [activeBrandId, aspectRatio, isSubmitting, prompt, refetchAll, showGenerationError, showToast, stylePreset]);

  const handleGenerate = useCallback(() => {
    if (contentType === "image") {
      return handleGenerateImage();
    }
    if (contentType === "carousel") {
      return handleGenerateCarousel();
    }
    return handleGenerateVideo();
  }, [contentType, handleGenerateCarousel, handleGenerateImage, handleGenerateVideo]);

  const handleDownload = useCallback(async () => {
    if (!generatedAsset) return;

    try {
      const response = await fetch(generatedAsset.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alfie-${contentType}-${Date.now()}.${
        contentType === "image" ? "png" : "mp4"
      }`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast({
        title: "Téléchargement réussi",
        description: `${
          contentType === "image" ? "Image" : "Vidéo"
        } sauvegardée`,
      });
    } catch (err: any) {
      console.error("Download error:", err);
      showToast({
        title: "Erreur de téléchargement",
        description: err.message,
        variant: "destructive",
      });
    }
  }, [generatedAsset, contentType, showToast]);

  // Handler pour insérer un prompt suggéré (Phase 3)
  const handleExampleClick = (example: string) => {
    setPrompt(example);
  };

  // ✅ Débloquer les jobs sélectionnés
  const handleUnblockSelection = useCallback(async () => {
    if (isForcing || selectedJobIds.length === 0) return;
    setIsForcing(true);
    try {
      const result = await forceProcessJobs(selectedJobIds);

      const processed = typeof result.updated === "number" ? result.updated : 0;
      if (processed > 0) {
        toast.success(`Jobs débloqués: ${processed}`);
      } else {
        toast.info("Aucun job à débloquer");
      }

      setSelectedJobIds((prev) => prev.filter((id) => !result.processedIds.includes(id)));
      await fetchWithTimeoutPromise(refetchAll(), 15000);
    } catch (err) {
      console.error("[Studio] unblock jobs error:", err);
      const errMsg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(errMsg);
    } finally {
      setIsForcing(false);
    }
  }, [isForcing, refetchAll, selectedJobIds]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold">Alfie Studio</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Créez des images et vidéos avec l'IA
          </p>
        </div>

        {/* ✅ Queue Monitor */}
        {queueData && (
          <Alert className="mb-6">
            <Clock className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm">
                  <strong>{queueData.counts.queued}</strong> en attente
                </span>
                <span className="text-sm">
                  <strong>{queueData.counts.processing}</strong> en cours
                </span>
                {queueData.counts.retrying ? (
                  <span className="text-sm text-amber-600">
                    <AlertCircle className="inline w-3 h-3 mr-1" />
                    <strong>{queueData.counts.retrying}</strong> en relance
                  </span>
                ) : null}
                {queueData.counts.error > 0 && (
                  <span className="text-sm text-destructive">
                    <AlertCircle className="inline w-3 h-3 mr-1" />
                    <strong>{queueData.counts.error}</strong> erreurs
                  </span>
                )}
                {queueData.counts.done_24h !== undefined && (
                  <span className="text-sm text-muted-foreground">
                    <CheckCircle2 className="inline w-3 h-3 mr-1" />
                    {queueData.counts.done_24h} générés (24h)
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnblockSelection}
                disabled={isForcing || !hasSelection}
              >
                {isForcing ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  hasSelection ? 'Forcer le traitement' : 'Sélectionne des jobs'
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Controls */}
        <Card className="p-6 mb-6 space-y-6">
          {/* Type selector */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Type de rendu
            </label>
            <div className="flex gap-2">
              {contentTypeOptions.map((type) => (
                <Button
                  key={type}
                  variant={contentType === type ? "default" : "outline"}
                  onClick={() => setContentType(type)}
                >
                  {CONTENT_TYPE_LABELS[type]}
                </Button>
              ))}
            </div>
          </div>

          {/* Aspect ratio */}
          <div>
            <label className="text-sm font-medium mb-2 block">Format</label>
            <div className="flex gap-2">
              {(["1:1", "9:16", "16:9"] as AspectRatio[]).map((ratio) => (
                <Button
                  key={ratio}
                  variant={aspectRatio === ratio ? "default" : "outline"}
                  onClick={() => setAspectRatio(ratio)}
                  size="sm"
                >
                  {ratio}
                </Button>
              ))}
            </div>
          </div>

          {/* Media upload */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Ajouter un média (optionnel)
            </label>
            {uploadedSource ? (
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted">
                <span className="flex-1 truncate text-sm">
                  {uploadedSource.name}
                </span>
                <Badge variant="secondary">{uploadedSource.type}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setUploadedSource(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="w-5 h-5" />
                <span className="text-sm">Cliquez pour uploader</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSourceUpload(file);
                  }}
                />
              </label>
            )}
          </div>

          {/* Prompt examples (Phase 3) */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Exemples de prompts
            </label>
            <div className="flex flex-wrap gap-2">
              {promptExamples.map((example, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => handleExampleClick(example)}
                  className="text-xs"
                >
                  {example.substring(0, 30)}...
                </Button>
              ))}
            </div>
          </div>

          {/* Prompt input */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Votre prompt
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                contentType === "video"
                  ? "Décrivez la scène vidéo que vous imaginez, ou ajoutez un média pour l'animer..."
                  : contentType === "carousel"
                    ? "Décrivez le thème et le plan de ton carrousel (nombre de slides, idée principale, CTA)..."
                    : "Décrivez la scène que vous imaginez, ou uploadez une image pour la transformer..."
              }
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Generate button */}
          <Button
            onClick={() => {
              void handleGenerate();
            }}
            disabled={disableGenerate}
            size="lg"
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Wand2 className="w-5 h-5 mr-2 animate-spin" />
                Génération en cours...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5 mr-2" />
                {contentType === "image"
                  ? "Générer l'image"
                  : contentType === "carousel"
                    ? "Générer le carrousel"
                    : "Générer la vidéo"}
              </>
            )}
          </Button>
        </Card>

        <div className="grid gap-6 mt-6 lg:grid-cols-2">
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Jobs en file</h3>
                <p className="text-xs text-muted-foreground">{orderLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void fetchWithTimeoutPromise(refetchAll(), 15000);
                  }}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-1 text-xs">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      …
                    </span>
                  ) : (
                    "Rafraîchir"
                  )}
                </Button>
              </div>
            </div>
            {error && <div className="text-xs text-red-600 mt-2">{error}</div>}

            {/* Stuck Jobs Alert */}
            {stuckJobs.length > 0 && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {stuckJobs.length} job{stuckJobs.length > 1 ? 's' : ''} bloqué{stuckJobs.length > 1 ? 's' : ''} détecté{stuckJobs.length > 1 ? 's' : ''} (&gt;10 min en attente).
                  <Button
                    variant="link"
                    size="sm"
                    className="ml-2 h-auto p-0 text-destructive underline"
                    onClick={handleUnblockSelection}
                    disabled={isForcing || !hasSelection}
                  >
                    {isForcing ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Traitement…
                      </span>
                    ) : (
                      hasSelection ? "Forcer le traitement" : "Sélectionne des jobs"
                    )}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement des jobs…
              </div>
            ) : jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun job {orderId ? "pour cette commande pour le moment." : "en cours pour le moment."}
              </p>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => {
                  const isJobStuck = stuckJobs.some((item) => item.id === job.id);
                  const isSelected = selectedJobIds.includes(job.id);
                  return (
                    <JobCard
                      key={job.id}
                      job={job}
                      createdAt={formatDate(job.created_at)}
                      isStuck={isJobStuck}
                      onRetry={(target) => {
                        void requeueJob(target);
                      }}
                      selectable
                      selected={isSelected}
                      onSelectionChange={(_, next) => {
                        setSelectedJobIds((prev) => {
                          if (next) {
                            if (prev.includes(job.id)) return prev;
                            return [...prev, job.id];
                          }
                          return prev.filter((id) => id !== job.id);
                        });
                      }}
                    />
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Médias générés</h3>
                <p className="text-xs text-muted-foreground">{orderLabel}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void fetchWithTimeoutPromise(refetchAll(), 15000);
                }}
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-1 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    …
                  </span>
                ) : (
                  "Rafraîchir"
                )}
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement des médias…
              </div>
            ) : assets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun média {orderId ? "pour cette commande." : "enregistré pour le moment."}
              </p>
            ) : (
              <div className="space-y-4">
                {assets.map((item) => {
                  const metadata = (item.metadata ?? item.meta ?? {}) as Record<string, unknown>;
                  const previewUrl =
                    (typeof item.preview_url === "string" ? item.preview_url : null) ??
                    item.preview_url ??
                    (typeof metadata.thumbnail_url === "string" ? metadata.thumbnail_url : null) ??
                    (typeof metadata.preview_url === "string" ? metadata.preview_url : null) ??
                    item.cloudinary_url ??
                    item.secure_url ??
                    undefined;
                  const assetStatus =
                    (typeof metadata.status === "string" ? metadata.status : null) ?? item.status ?? "done";
                  const woofs = typeof metadata.woofs === "number" ? metadata.woofs : null;
                  const downloadUrl = typeof metadata.download_url === "string" ? metadata.download_url : null;
                  const videoUrl = typeof metadata.video_url === "string" ? metadata.video_url : null;
                  const engine = typeof metadata.engine === "string" ? metadata.engine : null;

                  return (
                    <StudioAssetCard
                      key={item.id}
                      asset={{
                        id: item.id,
                        type: item.type,
                        status: assetStatus,
                        createdAt: formatDate(item.created_at),
                        previewUrl,
                        assetUrl: item.secure_url ?? item.cloudinary_url ?? undefined,
                        downloadUrl,
                        videoUrl,
                        woofs,
                        engine,
                      }}
                      onMissingUrl={() => {
                        toast.error("URL indisponible");
                      }}
                    />
                  );
                })}
              </div>
            )}
          </Card>
        </div>
        {/* Result preview */}
        {generatedAsset && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Résultat</h3>
              <Button onClick={handleDownload} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Télécharger
              </Button>
            </div>

            <div
              className={`w-full ${ASPECT_TO_TW[aspectRatio]} bg-muted rounded-lg overflow-hidden`}
            >
              {generatedAsset.type === "image" ? (
                <img
                  src={generatedAsset.url}
                  alt="Generated"
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={generatedAsset.url}
                  controls
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
