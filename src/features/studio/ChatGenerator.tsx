import { useState, useCallback } from "react";
import { Upload, Wand2, Download, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { VIDEO_ENGINE_CONFIG } from "@/config/videoEngine";
import { imageToVideoUrl, spliceVideoUrl, extractCloudNameFromUrl } from '@/lib/cloudinary/videoSimple';

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

const MEDIA_URL_KEYS = [
  "imageUrl",
  "image_url",
  "url",
  "outputUrl",
  "output_url",
  "videoUrl",
  "video_url",
];

const STATUS_URL_KEYS = [
  "statusUrl",
  "status_url",
  "pollUrl",
  "poll_url",
  "jobUrl",
  "job_url",
];

const ASPECT_TO_TW: Record<AspectRatio, string> = {
  "1:1": "aspect-square",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
};

const IMAGE_SIZE_MAP: Record<AspectRatio, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "9:16": { width: 1024, height: 1820 },
  "16:9": { width: 1820, height: 1024 },
};

function extractMediaUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const obj = payload as Record<string, unknown>;
  for (const key of MEDIA_URL_KEYS) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) {
      return val.trim();
    }
  }

  for (const v of Object.values(obj)) {
    if (typeof v === "object" && v !== null) {
      const nested = extractMediaUrl(v);
      if (nested) return nested;
    }
  }
  return null;
}

function extractStatusUrls(payload: unknown): string[] {
  const urls: string[] = [];
  if (!payload || typeof payload !== "object") return urls;

  const obj = payload as Record<string, unknown>;
  for (const key of STATUS_URL_KEYS) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) {
      urls.push(val.trim());
    }
  }

  for (const v of Object.values(obj)) {
    if (typeof v === "object" && v !== null) {
      urls.push(...extractStatusUrls(v));
    }
  }
  return urls;
}

async function pollForVideoUrl(
  urls: string[],
  maxAttempts = 60,
  intervalMs = 2000,
  signal?: AbortSignal
): Promise<string | null> {
  if (urls.length === 0) return null;

  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) throw new Error("Polling cancelled");

    for (const url of urls) {
      try {
        const res = await fetch(url, { signal });
        if (!res.ok) continue;
        const data = await res.json();

        const status =
          data.status ||
          data.state ||
          data.jobStatus ||
          data.job_status ||
          "";
        if (
          status.toLowerCase() === "completed" ||
          status.toLowerCase() === "succeeded" ||
          status.toLowerCase() === "success"
        ) {
          const mediaUrl = extractMediaUrl(data);
          if (mediaUrl) return mediaUrl;
        }

        if (
          status.toLowerCase() === "failed" ||
          status.toLowerCase() === "error"
        ) {
          throw new Error(data.error || "Video generation failed");
        }
      } catch (err: any) {
        if (err.message === "Polling cancelled") throw err;
        continue;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Polling timeout exceeded");
}

interface VideoGenerationParams {
  prompt?: string;
  aspectRatio: string;
  source?: UploadedSource;
  duration?: number;
  fps?: number;
}

async function generateVideoWithFfmpeg(
  params: VideoGenerationParams,
  signal?: AbortSignal
): Promise<string> {
  const backendUrl = VIDEO_ENGINE_CONFIG.FFMPEG_BACKEND_URL;

  // Message d'erreur amélioré si backend non configuré (Phase 3)
  if (!backendUrl) {
    throw new Error(
      "Backend vidéo non configuré. Veuillez configurer FFMPEG_BACKEND_URL dans les variables d'environnement."
    );
  }

  const { data, error } = await supabase.functions.invoke(
    "chat-generate-video",
    {
      body: {
        prompt: params.prompt || "",
        aspectRatio: params.aspectRatio,
        source: params.source || null,
        duration: params.duration || null,
        fps: params.fps || null,
      },
    }
  );

  if (error) throw error;

  const directUrl = extractMediaUrl(data);
  if (directUrl) return directUrl;

  const statusUrls = extractStatusUrls(data);
  if (statusUrls.length === 0) {
    throw new Error("No video URL or status URL in response");
  }

  const videoUrl = await pollForVideoUrl(statusUrls, 60, 2000, signal);
  if (!videoUrl) {
    throw new Error("Could not retrieve video URL after polling");
  }

  return videoUrl;
}

export function ChatGenerator() {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [contentType, setContentType] = useState<ContentType>("image");
  const [uploadedSource, setUploadedSource] = useState<UploadedSource | null>(
    null
  );
  const [generatedAsset, setGeneratedAsset] = useState<GeneratedAsset | null>(
    null
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const { toast } = useToast();

  const handleSourceUpload = useCallback(
    async (file: File) => {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) {
        toast({
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

        const safeName = file.name.replace(/\s+/g, "_");
        const fileName = `${Date.now()}_${safeName}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-uploads")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: signed, error: signedError } = await supabase.storage
          .from("chat-uploads")
          .createSignedUrl(filePath, 60 * 60);
        if (signedError) throw signedError;

        const uploadedSourceUrl = signed?.signedUrl;
        if (!uploadedSourceUrl) throw new Error("Impossible de générer l’URL signée");

        setUploadedSource({
          type: isImage ? "image" : "video",
          url: uploadedSourceUrl,
          name: file.name,
        });

        toast({
          title: "Média uploadé",
          description: "Prêt à être utilisé",
        });
      } catch (err: any) {
        console.error("Upload error:", err);
        toast({
          title: "Erreur d'upload",
          description: err.message,
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() && !uploadedSource) {
      toast({
        title: "Prompt requis",
        description: "Veuillez entrer un prompt ou uploader un média",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    setGeneratedAsset(null);

    try {
      if (contentType === "image") {
        const targetFunction = uploadedSource
          ? "alfie-generate-ai-image"
          : "alfie-render-image";

        const payload: Record<string, unknown> = {
          prompt: prompt || "transform this",
          aspectRatio,
        };

        if (uploadedSource) {
          payload.sourceUrl = uploadedSource.url;
        } else {
          const size = IMAGE_SIZE_MAP[aspectRatio];
          payload.width = size.width;
          payload.height = size.height;
        }

        const { data, error } = await supabase.functions.invoke(
          targetFunction,
          { body: payload }
        );

        if (error) throw error;

        const imageUrl = extractMediaUrl(data);
        if (!imageUrl) throw new Error("No image URL in response");

        setGeneratedAsset({ url: imageUrl, type: "image" });
        toast({ title: "Image générée !", description: "Prête à télécharger" });
      } else {
        const ffmpegBackend = VIDEO_ENGINE_CONFIG.FFMPEG_BACKEND_URL;
        
        // ✅ NOUVEAU : Si pas de backend FFmpeg → Cloudinary-only
        if (!ffmpegBackend) {
          // 1️⃣ Récupérer cloudName
          const envCloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
          const guessed = extractCloudNameFromUrl(uploadedSource?.url);
          const cloudName = guessed || envCloud;
          
          if (!cloudName) {
            throw new Error("Cloudinary cloudName manquant. Configurez VITE_CLOUDINARY_CLOUD_NAME dans .env.local");
          }

          let videoUrl: string;

          // 2️⃣ Cas 1 : Utilisateur a uploadé une IMAGE
          if (uploadedSource?.type === 'image') {
            // Extraire publicId depuis l'URL Cloudinary
            const publicId = uploadedSource.url.replace(
              /^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/[^/]*\//i, 
              ''
            ).replace(/\.[^.]+$/, '');

            videoUrl = imageToVideoUrl({
              cloudName,
              imagePublicId: publicId,
              aspect: aspectRatio as any,
              durationSec: 3,
              zoomPercent: 18,
              pan: 'center',
              title: prompt.slice(0, 80) || 'Alfie Studio',
              subtitle: undefined,
              cta: 'Découvrir',
            });
          }
          // 3️⃣ Cas 2 : Utilisateur a uploadé une VIDÉO
          else if (uploadedSource?.type === 'video') {
            const publicId = uploadedSource.url.replace(
              /^https?:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/[^/]*\//i, 
              ''
            ).replace(/\.[^.]+$/, '');

            videoUrl = spliceVideoUrl({
              cloudName,
              items: [{ type: 'video', publicId }],
              aspect: aspectRatio as any,
              title: prompt.slice(0, 80) || 'Alfie Studio',
            });
          }
          // 4️⃣ Cas 3 : Pas de média uploadé → fallback
          else {
            throw new Error("Veuillez uploader une image ou vidéo pour générer une vidéo (Cloudinary-only)");
          }

          setGeneratedAsset({ url: videoUrl, type: "video" });
          toast({ title: "Vidéo générée via Cloudinary ✨" });
          return;
        }

        // ⏭️ Sinon : continuer avec generateVideoWithFfmpeg (backend FFmpeg)
        const abortController = new AbortController();

        const videoUrl = await generateVideoWithFfmpeg(
          {
            prompt: prompt.trim(),
            aspectRatio,
            source: uploadedSource || undefined,
          },
          abortController.signal
        );

        setGeneratedAsset({ url: videoUrl, type: "video" });
        toast({ title: "Vidéo générée !", description: "Prête à télécharger" });
      }
    } catch (err: any) {
      console.error("Generation error:", err);
      toast({
        title: "Erreur de génération",
        description: err.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }, [prompt, contentType, uploadedSource, aspectRatio, toast]);

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

      toast({
        title: "Téléchargement réussi",
        description: `${
          contentType === "image" ? "Image" : "Vidéo"
        } sauvegardée`,
      });
    } catch (err: any) {
      console.error("Download error:", err);
      toast({
        title: "Erreur de téléchargement",
        description: err.message,
        variant: "destructive",
      });
    }
  }, [generatedAsset, contentType, toast]);

  // Handler pour insérer un prompt suggéré (Phase 3)
  const handleExampleClick = (example: string) => {
    setPrompt(example);
  };

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
            onClick={handleGenerate}
            disabled={generating || (!prompt.trim() && !uploadedSource)}
            size="lg"
            className="w-full"
          >
            {generating ? (
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
