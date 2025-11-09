import { useState, useCallback, useEffect, useMemo } from "react";
import { Upload, Wand2, Download, X, Sparkles, Loader2, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { createGeneration, forceProcess } from "@/api/alfie";
import { useToast } from "@/hooks/use-toast";
import { uploadToChatBucket } from "@/lib/chatUploads";
import { useLocation } from "react-router-dom";
import { useBrandKit } from "@/hooks/useBrandKit";
import { toast } from "sonner";
import { useQueueMonitor } from "@/hooks/useQueueMonitor";
import { Alert, AlertDescription } from "@/components/ui/alert";

type GeneratedAsset = {
  url: string;
  type: "image" | "video";
};

type AspectRatio = "1:1" | "9:16" | "16:9";
type ContentType = "image" | "video";

type UploadedSource = {
  type: "image" | "video";
  url: string;
  name: string;
};

type JobEntry = {
  id: string;
  type: string;
  status: string;
  order_id: string | null;
  created_at: string;
  updated_at: string;
  error?: string | null;
  error_message?: string | null;
  payload?: unknown;
  user_id: string;
  retry_count: number;
};

type MediaEntry = {
  id: string;
  type: string;
  status: string;
  output_url: string | null;
  thumbnail_url?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
};

// Exemples de prompts suggérés (Phase 3)
const PROMPT_EXAMPLES = {
  image: [
    "Une plage tropicale au coucher du soleil avec des palmiers",
    "Un café parisien avec des tables en terrasse, style aquarelle",
    "Un paysage de montagne enneigé avec un lac gelé",
    "Une rue animée de Tokyo la nuit avec des néons",
  ],
  video: [
    "Une cascade qui coule dans une forêt tropicale",
    "Des nuages qui défilent rapidement au-dessus d'une ville",
    "Un feu de camp qui crépite la nuit sous les étoiles",
    "Une route qui traverse un désert au lever du soleil",
  ],
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

export function ChatGenerator() {
  const { activeBrandId } = useBrandKit();
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
  const [isTriggeringWorker, setIsTriggeringWorker] = useState(false);

  const { toast: showToast } = useToast();

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

  const jobBadgeVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (status) {
      case "queued":
        return "secondary";
      case "running":
        return "default";
      case "failed":
        return "destructive";
      case "completed":
      default:
        return "outline";
    }
  };

  const mediaBadgeVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (status) {
      case "queued":
        return "secondary";
      case "running":
        return "default";
      case "failed":
        return "destructive";
      case "completed":
      default:
        return "outline";
    }
  };

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

      // ✅ Simplifier les requêtes pour éviter les timeouts
      let jobsQuery = supabase
        .from("job_queue")
        .select("id, type, status, order_id, created_at, updated_at, error, payload, user_id, retry_count")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(30);

      let assetsQuery = supabase
        .from("media_generations")
        .select("id, type, status, output_url, thumbnail_url, metadata, created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (orderId) {
        jobsQuery = jobsQuery.eq("order_id", orderId);
      }

      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("Timeout: La requête prend trop de temps")), 10000)
      );

      const [jobsResponse, assetsResponse] = await Promise.race([
        Promise.all([jobsQuery, assetsQuery]),
        timeoutPromise
      ]);

      if (jobsResponse.error) throw jobsResponse.error;
      if (assetsResponse.error) throw assetsResponse.error;

      setJobs((jobsResponse.data as JobEntry[]) ?? []);
      setAssets((assetsResponse.data || []) as MediaEntry[]);
    } catch (err) {
      console.error("[Studio] refetchAll error:", err);
      const message = resolveRefreshErrorMessage(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let debounceTimer: NodeJS.Timeout | null = null;

    // ✅ Debounce refetch pour éviter trop d'appels
    const debouncedRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (mounted) void refetchAll();
      }, 1000);
    };

    (async () => {
      await refetchAll();

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
          { event: "*", schema: "public", table: "media_generations", filter: `user_id=eq.${currentUser.id}` },
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

        const { error: insertError } = await supabase.from("job_queue").insert([{
          order_id: job.order_id,
          type: job.type,
          status: "queued" as const,
          payload,
        }] as any);

        if (insertError) throw insertError;

        showToast({
          title: "Job relancé",
          description: "Le job a été renvoyé en file d'attente",
        });

        await refetchAll();
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
        type: "image" as const,
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

      const res = await createGeneration(activeBrandId, payload);
      toast.success(`Commande créée #${res.order_id}`);

      await refetchAll();
    } catch (err: unknown) {
      console.error("[Studio] image generation error:", err);
      const message = err instanceof Error ? err.message : "Une erreur est survenue";
      toast.error(`Génération impossible: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [activeBrandId, aspectRatio, prompt, refetchAll, showToast, uploadedSource]);

  const handleGenerateVideo = useCallback(async () => {
    const promptText = (prompt || "").trim();

    try {
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
        type: "video" as const,
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

      const res = await createGeneration(activeBrandId, payload);
      toast.success(`Commande créée #${res.order_id}`);

      await refetchAll();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[Studio] generate video error:", err);
      toast.error(`Génération impossible: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [activeBrandId, aspectRatio, prompt, refetchAll, uploadedSource, videoDuration]);

  const handleGenerate = useCallback(() => {
    if (contentType === "image") {
      return handleGenerateImage();
    }
    return handleGenerateVideo();
  }, [contentType, handleGenerateImage, handleGenerateVideo]);

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

  // ✅ Trigger manual worker
  const onForce = useCallback(async () => {
    setIsTriggeringWorker(true);
    try {
      const result = await forceProcess();
      const processed =
        typeof result?.processed === "number" ? result.processed : 0;
      toast.success(`Traitement forcé: ${processed} job(s).`);

      await refetchAll();
    } catch (err) {
      console.error("[Studio] trigger worker error:", err);
      const message =
        err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Forçage échoué: ${message}`);
    } finally {
      setIsTriggeringWorker(false);
    }
  }, [forceProcess, refetchAll]);

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
                  <strong>{queueData.counts.running}</strong> en cours
                </span>
                {queueData.counts.failed > 0 && (
                  <span className="text-sm text-destructive">
                    <AlertCircle className="inline w-3 h-3 mr-1" />
                    <strong>{queueData.counts.failed}</strong> échecs
                  </span>
                )}
                {queueData.counts.completed_24h !== undefined && (
                  <span className="text-sm text-muted-foreground">
                    <CheckCircle className="inline w-3 h-3 mr-1" />
                    {queueData.counts.completed_24h} générés (24h)
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onForce}
                disabled={isTriggeringWorker || queueData.counts.queued === 0}
              >
                {isTriggeringWorker ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  'Forcer le traitement'
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
              <Button
                variant={contentType === "image" ? "default" : "outline"}
                onClick={() => setContentType("image")}
              >
                Image
              </Button>
              <Button
                variant={contentType === "video" ? "default" : "outline"}
                onClick={() => setContentType("video")}
              >
                Vidéo
              </Button>
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
              {PROMPT_EXAMPLES[contentType].map((example, idx) => (
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
            disabled={
              isSubmitting ||
              (contentType === "image" && !prompt.trim() && !uploadedSource)
            }
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
                    void refetchAll();
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
                    onClick={handleTriggerWorker}
                    disabled={isTriggeringWorker}
                  >
                    Forcer le traitement
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
                  const jobError = job.error_message || job.error;

                  return (
                    <div key={job.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {job.type.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDate(job.created_at)}</p>
                        </div>
                        <Badge variant={jobBadgeVariant(job.status)} className="uppercase">
                          {job.status}
                        </Badge>
                      </div>
                      {job.order_id && (
                        <p className="mt-1 text-xs text-muted-foreground">Order #{job.order_id}</p>
                      )}
                      {jobError && (
                        <div className="mt-2 text-xs text-red-600 flex flex-wrap items-center gap-2">
                          <span className="break-words flex-1">{jobError}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Retenter"
                            onClick={() => {
                              void requeueJob(job);
                            }}
                          >
                            Retenter
                          </Button>
                        </div>
                      )}
                    </div>
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
                  void refetchAll();
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
                  const previewUrl = item.thumbnail_url || item.output_url || "";
                  const woofs =
                    typeof item.metadata === "object" && item.metadata && "woofs" in item.metadata
                      ? (item.metadata as Record<string, any>).woofs
                      : null;

                  return (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium capitalize">{item.type}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
                        </div>
                        <Badge variant={mediaBadgeVariant(item.status)} className="uppercase">
                          {item.status}
                        </Badge>
                      </div>
                      {previewUrl && (
                        <div className="mt-3 overflow-hidden rounded-md bg-muted">
                          {item.type === "video" ? (
                            <video
                              src={item.output_url ?? undefined}
                              controls
                              className="w-full"
                            />
                          ) : (
                            <img src={previewUrl} alt="Media généré" className="w-full" />
                          )}
                        </div>
                      )}
                      {woofs !== null && woofs !== undefined && (
                        <p className="mt-2 text-xs text-muted-foreground">Woofs consommés : {woofs}</p>
                      )}
                      {item.output_url && (
                        <div className="mt-2">
                          <Button asChild size="sm" variant="link" className="px-0">
                            <a href={item.output_url} target="_blank" rel="noopener noreferrer">
                              Ouvrir l’asset →
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
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
