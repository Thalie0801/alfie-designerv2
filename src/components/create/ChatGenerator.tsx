import { useState, useRef, useEffect, useMemo } from "react";
import { Sparkles, ImagePlus, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseSafeClient";
import { useBrandKit } from "@/hooks/useBrandKit";
import { cn } from "@/lib/utils";
import { uploadToChatBucket } from "@/lib/chatUploads";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VIDEO_ENGINE_CONFIG } from "@/config/videoEngine";
import { generateImage } from "@/features/studio/hooks/useGenerateImage";

type GeneratedAsset = {
  type: "image" | "video";
  url: string;
  prompt: string;
  format: AspectRatio;
};

type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "4:5";
type ContentType = "image" | "video";

type UploadedSource = {
  type: ContentType;
  url: string;
  name: string;
};

const MEDIA_URL_KEYS = [
  "videoUrl",
  "video_url",
  "url",
  "output",
  "outputUrl",
  "output_url",
  "downloadUrl",
  "download_url",
  "resultUrl",
  "result_url",
  "fileUrl",
  "file_url",
  "assetUrl",
  "asset_url",
] as const;

const STATUS_URL_KEYS = [
  "statusUrl",
  "status_url",
  "pollUrl",
  "poll_url",
  "resultUrl",
  "result_url",
  "progressUrl",
  "progress_url",
  "checkUrl",
  "check_url",
] as const;

const ASPECT_TO_TW: Record<AspectRatio, string> = {
  "1:1": "aspect-square",
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
  "4:3": "aspect-[4/3]",
  "3:4": "aspect-[3/4]",
  "4:5": "aspect-[4/5]",
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const extractMediaUrl = (payload: unknown): string | null => {
  if (!payload) return null;

  if (typeof payload === "string") {
    const s = payload.trim();
    return s.startsWith("http") ? s : null;
  }
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = extractMediaUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (isRecord(payload)) {
    for (const key of MEDIA_URL_KEYS) {
      const found = extractMediaUrl(payload[key]);
      if (found) return found;
    }
    if ("data" in payload) {
      const found = extractMediaUrl(payload["data"]);
      if (found) return found;
    }
    if ("result" in payload) {
      const found = extractMediaUrl(payload["result"]);
      if (found) return found;
    }
  }
  return null;
};

const extractStatusUrls = (payload: unknown): string[] => {
  const out: string[] = [];
  if (!isRecord(payload)) return out;

  for (const key of STATUS_URL_KEYS) {
    const v = payload[key];
    if (typeof v === "string" && v.startsWith("http")) out.push(v);
  }
  const list = (payload as any).statusUrls ?? (payload as any).status_urls;
  if (Array.isArray(list)) {
    for (const url of list) if (typeof url === "string" && url.startsWith("http")) out.push(url);
  }

  // jobId → endpoints du backend
  const jobId =
    (typeof payload.jobId === "string" && payload.jobId) ||
    (typeof payload.job_id === "string" && payload.job_id) ||
    (typeof payload.id === "string" && payload.id) ||
    (typeof payload.taskId === "string" && payload.taskId) ||
    (typeof payload.task_id === "string" && payload.task_id) ||
    null;

  if (jobId && VIDEO_ENGINE_CONFIG?.FFMPEG_BACKEND_URL) {
    const base = VIDEO_ENGINE_CONFIG.FFMPEG_BACKEND_URL.replace(/\/+$/, "");
    out.push(`${base}/api/jobs/${jobId}`);
    out.push(`${base}/api/status/${jobId}`);
  }
  return Array.from(new Set(out));
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pollForVideoUrl(
  candidateUrls: string[],
  {
    maxAttempts = 12,
    intervalMs = 5000,
    signal,
  }: { maxAttempts?: number; intervalMs?: number; signal?: AbortSignal } = {},
): Promise<string | null> {
  const unique = Array.from(new Set(candidateUrls.filter(Boolean)));
  for (const url of unique) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (signal?.aborted) return null;
      try {
        const res = await fetch(url, { method: "GET", signal });
        if (!res.ok) {
          await delay(intervalMs);
          continue;
        }
        const text = await res.text();
        if (!text) {
          await delay(intervalMs);
          continue;
        }
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          await delay(intervalMs);
          continue;
        }

        const finalUrl = extractMediaUrl(data);
        if (finalUrl) return finalUrl;

        const statusRaw =
          (isRecord(data) && typeof data.status === "string" && data.status) ||
          (isRecord(data) && typeof data.state === "string" && data.state) ||
          null;
        const status = statusRaw?.toLowerCase();

        if (status && ["failed", "error", "cancelled", "canceled"].includes(status)) {
          const msg =
            (isRecord(data) && typeof data.error === "string" && data.error) || "La génération vidéo a échoué.";
          throw new Error(msg);
        }
      } catch (e) {
        if ((e as any)?.name === "AbortError") return null;
        console.warn("[Video poll] error:", e);
      }
      await delay(intervalMs);
    }
  }
  return null;
}

interface VideoGenerationParams {
  prompt: string;
  aspectRatio: AspectRatio;
  source?: UploadedSource | null;
  signal?: AbortSignal;
}

async function generateVideoWithFfmpeg({ prompt, aspectRatio, source, signal }: VideoGenerationParams) {
  const trimmedPrompt = (prompt ?? "").trim();
  const body: Record<string, unknown> = {
    prompt: trimmedPrompt || "Creative social video",
    aspectRatio,
    source: source ? { type: source.type, url: source.url, name: source.name } : null,
  };

  let responseData: unknown = null;

  try {
    const { data, error } = await supabase.functions.invoke("chat-generate-video", { body });
    if (error) throw new Error(error.message || "Erreur lors de la génération vidéo");
    responseData = data;
  } catch (e: any) {
    if (/fetch/i.test(e?.message || "")) {
      throw new Error("Connexion impossible avec le moteur vidéo. Réessayez dans un instant.");
    }
    throw e;
  }

  // 1) tentative d’URL directe
  const direct = extractMediaUrl(responseData);
  if (direct) return direct;

  // 2) polling
  const statusUrls = extractStatusUrls(responseData);
  const videoUrl = await pollForVideoUrl(statusUrls, { signal });
  if (videoUrl) return videoUrl;

  // 3) pas (encore) prêt
  throw new Error("La vidéo est en cours de préparation. Réessayez dans quelques instants.");
}

export function ChatGenerator() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [contentType, setContentType] = useState<ContentType>("image");
  const [uploadedSource, setUploadedSource] = useState<UploadedSource | null>(null);
  const [uploadingSource, setUploadingSource] = useState(false);
  const [generatedAsset, setGeneratedAsset] = useState<GeneratedAsset | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const showGenerationError = (err: unknown) => {
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
  };
  const { brandKit } = useBrandKit();

  // Forcer des ratios valides pour la vidéo
  useEffect(() => {
    if (contentType === "video" && (aspectRatio === "4:3" || aspectRatio === "3:4" || aspectRatio === "4:5")) {
      setAspectRatio("9:16");
    }
  }, [contentType, aspectRatio]);

  // Reset preview lors du changement de type
  useEffect(() => {
    setGeneratedAsset(null);
  }, [contentType]);

  const canGenerate = useMemo(() => {
    return !isGenerating && (!!prompt.trim() || !!uploadedSource);
  }, [isGenerating, prompt, uploadedSource]);

  const handleSourceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isVideo && !isImage) {
      toast.error("Format non supporté. Choisissez une image ou une vidéo.");
      return;
    }

    const maxSize = isVideo ? 200 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(isVideo ? "Vidéo trop volumineuse (max 200MB)" : "Image trop volumineuse (max 10MB)");
      return;
    }

    setUploadingSource(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      const { signedUrl: uploadedSourceUrl } = await uploadToChatBucket(file, supabase, user.id);

      const src: UploadedSource = {
        type: isVideo ? ("video" as const) : ("image" as const),
        url: uploadedSourceUrl,
        name: file.name,
      };
      setUploadedSource(src);

      if (isVideo) setContentType("video");

      toast.success(isVideo ? "Vidéo ajoutée ! 🎬" : "Image ajoutée ! 📸");
    } catch (error: unknown) {
      console.error("Upload error:", error);
      let message: string;
      if (error instanceof Error) {
        message = error.message;
      } else {
        try {
          message = JSON.stringify(error);
        } catch {
          message = String(error);
        }
      }
      toast.error(`Erreur lors de l'upload${message ? ` : ${message}` : ""}`);
    } finally {
      setUploadingSource(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleGenerate = async () => {
    if (isGenerating) {
      return;
    }

    if (!prompt.trim() && !uploadedSource) {
      toast.error("Ajoutez un prompt ou un média");
      return;
    }
    if (contentType === "image" && uploadedSource?.type === "video") {
      toast.error("Veuillez sélectionner une image pour générer une image.");
      return;
    }

    setIsGenerating(true);
    setGeneratedAsset(null);

    // abort précédent
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      if (!brandKit?.id) {
        toast.error("Sélectionnez une marque avant de générer.");
        return;
      }

      if (contentType === "image") {
        const promptText = prompt || "Creative social image";
        const referenceUrl = uploadedSource?.type === "image" ? uploadedSource.url : undefined;
        const safeRatio: "1:1" | "9:16" | "16:9" | "3:4" =
          aspectRatio === "1:1" || aspectRatio === "9:16" || aspectRatio === "16:9" || aspectRatio === "3:4"
            ? aspectRatio
            : "1:1";

        const imageUrl = await generateImage({
          prompt: promptText,
          brandId: brandKit.id,
          ratio: safeRatio,
          mode: "image",
          imageUrl: referenceUrl,
        });

        setGeneratedAsset({
          type: "image",
          url: imageUrl,
          prompt: promptText,
          format: aspectRatio,
        });

        if (brandKit?.id) {
          await supabase.from("media_generations").insert({
            user_id: user.id,
            brand_id: brandKit.id,
            type: "image",
            prompt: promptText,
            input_url: referenceUrl ?? null,
            output_url: imageUrl,
            status: "completed",
            metadata: { aspectRatio, sourceType: referenceUrl ? "image" : "prompt" },
          } as any);
        }

        toast.success("Image générée avec succès ! ✨");
      } else {
        const videoUrl = await generateVideoWithFfmpeg({
          prompt: prompt || "Creative social video",
          aspectRatio,
          source: uploadedSource,
          signal: abortRef.current.signal,
        });

        setGeneratedAsset({ type: "video", url: videoUrl, prompt: prompt || "Vidéo générée", format: aspectRatio });

        if (brandKit?.id) {
          await supabase.from("media_generations").insert({
            user_id: user.id,
            brand_id: brandKit.id,
            type: "video",
            prompt: prompt || "Vidéo générée",
            input_url: uploadedSource?.url ?? null,
            output_url: videoUrl,
            status: "completed",
            metadata: {
              aspectRatio,
              sourceType: uploadedSource ? uploadedSource.type : "prompt",
              engine: "ffmpeg-backend",
            },
          } as any);
        }

        toast.success("Vidéo générée avec succès ! 🎬");
      }
    } catch (error: unknown) {
      console.error("Generation error:", error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "";

      if (/Session expirée|reconnecter/i.test(message)) {
        toast.error(message, { action: { label: "Se reconnecter", onClick: () => (window.location.href = "/auth") } });
      } else if (contentType === "video" && /préparation/i.test(message)) {
        toast.info(message);
      } else if (message?.includes("Timeout: génération trop longue")) {
        toast.error("Timeout: la génération dépasse 90s");
      } else if (message?.includes("AbortError")) {
        // silencieux : action utilisateur/unmount
      } else {
        showGenerationError(error);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleDownload = () => {
    if (!generatedAsset) return;
    (async () => {
      try {
        const res = await fetch(generatedAsset.url);
        if (!res.ok) throw new Error("Download failed");
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const ext = generatedAsset.type === "video" ? "mp4" : "png";
        link.href = blobUrl;
        link.download = `alfie-${Date.now()}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        toast.success("Téléchargement lancé ! 📥");
      } catch (e) {
        console.error("Download error:", e);
        toast.error("Impossible de télécharger le fichier");
      }
    })();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <Sparkles className="h-12 w-12 sm:h-16 sm:w-16 text-primary animate-pulse" />
              <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight">ALFIE STUDIO</h1>
          <p className="text-muted-foreground text-sm sm:text-base md:text-lg">
            Créez des visuels époustouflants en quelques secondes
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
          {/* Generated Asset Preview */}
          {generatedAsset && (
            <div className="relative rounded-2xl overflow-hidden bg-card border border-border backdrop-blur-sm animate-fade-in">
              <div className={cn("relative", ASPECT_TO_TW[generatedAsset.format || "4:5"] || ASPECT_TO_TW["4:5"])}>
                {generatedAsset.type === "image" ? (
                  <img
                    src={generatedAsset.url}
                    alt="Création générée"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <video src={generatedAsset.url} controls className="absolute inset-0 w-full h-full object-cover" />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Type : {generatedAsset.type === "video" ? "Vidéo" : "Image"} • Format :{" "}
                    {generatedAsset.format || "4:5"}
                  </p>
                  <Button onClick={handleDownload} className="w-full bg-primary hover:bg-primary/90">
                    <Download className="mr-2 h-4 w-4" />
                    {generatedAsset.type === "video" ? "Télécharger la vidéo" : "Télécharger l'image"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Input Section */}
          <div className="rounded-2xl bg-card border border-border backdrop-blur-sm p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Uploaded Media Preview */}
            {uploadedSource && (
              <div className="relative rounded-xl overflow-hidden bg-muted/50 border border-border">
                <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
                  {uploadedSource.type === "image" ? (
                    <img
                      src={uploadedSource.url}
                      alt="Média source"
                      className="h-16 w-16 sm:h-24 sm:w-24 object-cover rounded-lg"
                    />
                  ) : (
                    <video
                      src={uploadedSource.url}
                      className="h-16 w-16 sm:h-24 sm:w-24 object-cover rounded-lg"
                      autoPlay
                      loop
                      muted
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                      {uploadedSource.type === "video" ? "Vidéo source ajoutée" : "Image source ajoutée"}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadedSource(null)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs sm:text-sm"
                    >
                      Retirer
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Type Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Type de rendu</label>
              <Select value={contentType} onValueChange={(v) => setContentType(v as ContentType)}>
                <SelectTrigger className="bg-muted/50 border-border">
                  <SelectValue placeholder="Sélectionnez un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Vidéo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Format Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Format du rendu</label>
              <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
                <SelectTrigger className="bg-muted/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1">Carré (1:1)</SelectItem>
                  <SelectItem value="16:9">Paysage (16:9)</SelectItem>
                  <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                  <SelectItem value="4:3">Standard (4:3)</SelectItem>
                  <SelectItem value="3:4">Portrait (3:4)</SelectItem>
                  <SelectItem value="4:5">Feed (4:5)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prompt Input */}
            <div className="relative">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  contentType === "video"
                    ? "Décrivez la scène vidéo que vous imaginez, ou ajoutez un média pour l'animer..."
                    : "Décrivez la scène que vous imaginez, ou uploadez une image pour la transformer..."
                }
                className="min-h-[120px] bg-muted/50 border-border resize-none text-base"
                disabled={isGenerating}
              />
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleSourceUpload}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="ghost"
                  size="sm"
                  disabled={uploadingSource || isGenerating}
                  className="text-xs sm:text-sm"
                >
                  {uploadingSource ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ImagePlus className="h-4 w-4 mr-2" />
                  )}
                  <span className="hidden sm:inline">{uploadingSource ? "Upload..." : "Ajouter un média"}</span>
                  <span className="sm:hidden">{uploadingSource ? "Upload..." : "Média"}</span>
                </Button>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={cn(
                  "bg-primary hover:bg-primary/90",
                  "font-semibold px-6 sm:px-8 w-full sm:w-auto text-sm sm:text-base",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {contentType === "video" ? "Générer la vidéo" : "Générer"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
