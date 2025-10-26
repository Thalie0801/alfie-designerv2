import { useState, useRef, useEffect } from 'react';
import { Sparkles, ImagePlus, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useBrandKit } from '@/hooks/useBrandKit';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAuthHeader } from '@/lib/auth';
import { VIDEO_ENGINE_CONFIG } from '@/config/videoEngine';

type GeneratedAsset = {
  type: 'image' | 'video';
  url: string;
  prompt: string;
  format: string;
};

type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
type ContentType = 'image' | 'video';

type UploadedSource = {
  type: ContentType;
  url: string;
  name: string;
};

const MEDIA_URL_KEYS = [
  'videoUrl',
  'video_url',
  'url',
  'output',
  'outputUrl',
  'output_url',
  'downloadUrl',
  'download_url',
  'resultUrl',
  'result_url',
  'fileUrl',
  'file_url'
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const extractMediaUrl = (payload: unknown): string | null => {
  if (!payload) return null;

  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    return trimmed.startsWith('http') ? trimmed : null;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const extracted = extractMediaUrl(item);
      if (extracted) return extracted;
    }
    return null;
  }

  if (isRecord(payload)) {
    for (const key of MEDIA_URL_KEYS) {
      const candidate = payload[key];
      const extracted = extractMediaUrl(candidate);
      if (extracted) return extracted;
    }

    if ('data' in payload) {
      const extracted = extractMediaUrl((payload as Record<string, unknown>).data);
      if (extracted) return extracted;
    }

    if ('result' in payload) {
      const extracted = extractMediaUrl((payload as Record<string, unknown>).result);
      if (extracted) return extracted;
    }
  }

  return null;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const pollForVideoUrl = async (candidateUrls: string[], maxAttempts = 12, intervalMs = 5000): Promise<string | null> => {
  const uniqueUrls = Array.from(new Set(candidateUrls.filter(Boolean)));

  for (const url of uniqueUrls) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(url, { method: 'GET' });
        if (!response.ok) {
          await delay(intervalMs);
          continue;
        }

        const text = await response.text();
        if (!text) {
          await delay(intervalMs);
          continue;
        }

        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch (error) {
          console.warn('Impossible de parser la réponse de statut vidéo', error);
          await delay(intervalMs);
          continue;
        }

        const mediaUrl = extractMediaUrl(data);
        if (mediaUrl) {
          return mediaUrl;
        }

        const status =
          (isRecord(data) && typeof data.status === 'string' && data.status.toLowerCase()) ||
          (isRecord(data) && typeof data.state === 'string' && data.state.toLowerCase()) ||
          null;

        if (status && ['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
          const errorMessage =
            (isRecord(data) && typeof data.error === 'string' && data.error) ||
            'La génération vidéo a échoué.';
          throw new Error(errorMessage);
        }
      } catch (error) {
        console.warn('Erreur lors du suivi de la génération vidéo', error);
      }

      await delay(intervalMs);
    }
  }

  return null;
};

interface VideoGenerationParams {
  prompt: string;
  aspectRatio: AspectRatio;
  source?: UploadedSource | null;
}

const generateVideoWithFfmpeg = async ({ prompt, aspectRatio, source }: VideoGenerationParams) => {
  const headers = await getAuthHeader();

  const trimmedPrompt = typeof prompt === 'string' ? prompt.trim() : '';

  const body: Record<string, unknown> = {
    prompt: trimmedPrompt,
    aspectRatio,
    source: source
      ? {
          type: source.type,
          url: source.url,
          name: source.name,
        }
      : null,
  };

  let responseData: unknown = null;

  try {
    const { data, error } = await supabase.functions.invoke('chat-generate-video', {
      body,
      headers,
    });

    if (error) {
      throw new Error(error.message || 'Erreur lors de la génération vidéo');
    }

    responseData = data;
  } catch (error) {
    if (error instanceof Error && /fetch/i.test(error.message)) {
      throw new Error("Connexion impossible avec le moteur vidéo. Réessayez dans un instant.");
    }

    throw error;
  }

  const directUrl = extractMediaUrl(responseData);
  if (directUrl) {
    return directUrl;
  }

  const statusUrls: string[] = [];
  if (isRecord(responseData)) {
    const possibleStatusFields = [
      'statusUrl',
      'status_url',
      'pollUrl',
      'poll_url',
      'resultUrl',
      'result_url',
      'progressUrl',
      'progress_url',
    ];

    for (const key of possibleStatusFields) {
      const value = responseData[key];
      if (typeof value === 'string') {
        statusUrls.push(value);
      }
    }

    const statusUrlList = Array.isArray(responseData.statusUrls)
      ? responseData.statusUrls
      : Array.isArray(responseData.status_urls)
      ? responseData.status_urls
      : null;

    if (Array.isArray(statusUrlList)) {
      for (const url of statusUrlList) {
        if (typeof url === 'string') {
          statusUrls.push(url);
        }
      }
    }

    const jobId =
      (typeof responseData.jobId === 'string' && responseData.jobId) ||
      (typeof responseData.job_id === 'string' && responseData.job_id) ||
      (typeof responseData.id === 'string' && responseData.id) ||
      (typeof responseData.taskId === 'string' && responseData.taskId) ||
      (typeof responseData.task_id === 'string' && responseData.task_id) ||
      null;

    if (jobId) {
      statusUrls.push(`${VIDEO_ENGINE_CONFIG.FFMPEG_BACKEND_URL}/api/jobs/${jobId}`);
      statusUrls.push(`${VIDEO_ENGINE_CONFIG.FFMPEG_BACKEND_URL}/api/status/${jobId}`);
    }
  }

  const videoUrl = await pollForVideoUrl(statusUrls);
  if (videoUrl) {
    return videoUrl;
  }

  throw new Error('La vidéo est en cours de préparation. Réessayez dans quelques instants.');
};

export function ChatGenerator() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [contentType, setContentType] = useState<ContentType>('image');
  const [uploadedSource, setUploadedSource] = useState<UploadedSource | null>(null);
  const [uploadingSource, setUploadingSource] = useState(false);
  const [generatedAsset, setGeneratedAsset] = useState<GeneratedAsset | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { brandKit } = useBrandKit();

  useEffect(() => {
    if (contentType === 'video' && (aspectRatio === '4:3' || aspectRatio === '3:4')) {
      setAspectRatio('9:16');
    }
  }, [contentType, aspectRatio]);

  useEffect(() => {
    setGeneratedAsset(null);
  }, [contentType]);

  const handleSourceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      toast.error('Format non supporté. Choisissez une image ou une vidéo.');
      return;
    }

    const maxSize = isVideo ? 200 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(
        isVideo ? 'Vidéo trop volumineuse (max 200MB)' : 'Image trop volumineuse (max 10MB)'
      );
      return;
    }

    setUploadingSource(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Vous devez être connecté');
        return;
      }

      const fileName = `${user.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-uploads')
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-uploads')
        .getPublicUrl(fileName);

      setUploadedSource({
        type: isVideo ? 'video' : 'image',
        url: publicUrl,
        name: file.name,
      });

      if (isVideo) {
        setContentType('video');
      }

      toast.success(isVideo ? 'Vidéo ajoutée ! 🎬' : 'Image ajoutée ! 📸');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erreur lors de l\'upload');
    } finally {
      setUploadingSource(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !uploadedSource) {
      toast.error('Ajoutez un prompt ou un média');
      return;
    }

    if (contentType === 'image' && uploadedSource?.type === 'video') {
      toast.error('Veuillez sélectionner une image pour générer une image.');
      return;
    }

    setIsGenerating(true);
    setGeneratedAsset(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Vous devez être connecté');
        return;
      }

      if (contentType === 'image') {
        if (uploadedSource?.type === 'image') {
          const { data, error } = await supabase.functions.invoke('alfie-generate-ai-image', {
            body: {
              templateImageUrl: uploadedSource.url,
              brandKit: brandKit,
              prompt: prompt || 'Transform this image with a creative style',
            },
            headers: await getAuthHeader(),
          });

          if (error) throw error;

          if (!data?.imageUrl) {
            throw new Error('Aucune image générée');
          }

          setGeneratedAsset({
            type: 'image',
            url: data.imageUrl,
            prompt: prompt || 'Image transformation',
            format: aspectRatio,
          });

          await supabase.from('media_generations').insert({
            user_id: user.id,
            type: 'image',
            prompt: prompt || 'Image transformation',
            input_url: uploadedSource.url,
            output_url: data.imageUrl,
            status: 'completed',
            brand_id: brandKit?.id || null,
            metadata: {
              aspectRatio,
              sourceType: uploadedSource.type,
            },
          });

          toast.success('Image générée avec succès ! ✨');
        } else {
          const { data, error } = await supabase.functions.invoke('generate-ai-image', {
            body: {
              prompt: prompt,
              aspectRatio: aspectRatio,
            },
            headers: await getAuthHeader(),
          });

          if (error) throw error;

          if (!data?.imageUrl) {
            throw new Error('Aucune image générée');
          }

          setGeneratedAsset({
            type: 'image',
            url: data.imageUrl,
            prompt: prompt,
            format: aspectRatio,
          });

          await supabase.from('media_generations').insert({
            user_id: user.id,
            type: 'image',
            prompt: prompt,
            output_url: data.imageUrl,
            status: 'completed',
            brand_id: brandKit?.id || null,
            metadata: {
              aspectRatio,
              sourceType: uploadedSource ? uploadedSource.type : 'prompt',
            },
          });

          toast.success('Image générée avec succès ! ✨');
        }
      } else {
        const videoUrl = await generateVideoWithFfmpeg({
          prompt: prompt || 'Creative social video',
          aspectRatio,
          source: uploadedSource,
        });

        setGeneratedAsset({
          type: 'video',
          url: videoUrl,
          prompt: prompt || 'Vidéo générée',
          format: aspectRatio,
        });

        await supabase.from('media_generations').insert({
          user_id: user.id,
          type: 'video',
          prompt: prompt || 'Vidéo générée',
          input_url: uploadedSource?.url ?? null,
          output_url: videoUrl,
          status: 'completed',
          brand_id: brandKit?.id || null,
          metadata: {
            aspectRatio,
            sourceType: uploadedSource ? uploadedSource.type : 'prompt',
            engine: 'ffmpeg-backend',
          },
        });

        toast.success('Vidéo générée avec succès ! 🎬');
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      const message = error?.message || 'Erreur lors de la génération';
      
      if (message.includes('Session expirée') || message.includes('reconnecter')) {
        toast.error(message, {
          action: {
            label: 'Se reconnecter',
            onClick: () => {
              window.location.href = '/auth';
            }
          }
        });
      } else if (contentType === 'video' && /préparation/i.test(message)) {
        toast.info(message);
      } else {
        toast.error(message);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedAsset) return;

    (async () => {
      try {
        const response = await fetch(generatedAsset.url);
        if (!response.ok) {
          throw new Error('Download failed');
        }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `alfie-${Date.now()}.${generatedAsset.type === 'video' ? 'mp4' : 'png'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);

        toast.success('Téléchargement lancé ! 📥');
      } catch (error) {
        console.error('Download error:', error);
        toast.error('Impossible de télécharger le fichier');
      }
    })();
  };

  const promptPlaceholder =
    contentType === 'video'
      ? "Décrivez la scène vidéo que vous imaginez, ou ajoutez un média pour l'animer..."
      : 'Décrivez la scène que vous imaginez, ou uploadez une image pour la transformer...';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <Sparkles className="h-12 w-12 sm:h-16 sm:w-16 text-primary animate-pulse" />
              <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse"></div>
            </div>
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight">
            ALFIE STUDIO
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base md:text-lg">
            Créez des visuels époustouflants en quelques secondes
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
          {/* Generated Asset Preview */}
          {generatedAsset && (
            <div className="relative rounded-2xl overflow-hidden bg-card border border-border backdrop-blur-sm animate-fade-in">
              <div className={cn(
                "relative",
                generatedAsset.format === '1:1' && "aspect-square",
                generatedAsset.format === '16:9' && "aspect-video",
                generatedAsset.format === '9:16' && "aspect-[9/16]",
                generatedAsset.format === '4:3' && "aspect-[4/3]",
                generatedAsset.format === '3:4' && "aspect-[3/4]"
              )}>
                {generatedAsset.type === 'image' ? (
                  <img
                    src={generatedAsset.url}
                    alt={generatedAsset.prompt}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    src={generatedAsset.url}
                    controls
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-6 space-y-3">
                  <p className="text-sm text-muted-foreground">{generatedAsset.prompt}</p>
                  <p className="text-xs text-muted-foreground">
                    Type : {generatedAsset.type === 'video' ? 'Vidéo' : 'Image'} • Format : {generatedAsset.format}
                  </p>
                  <Button
                    onClick={handleDownload}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {generatedAsset.type === 'video' ? 'Télécharger la vidéo' : "Télécharger l'image"}
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
                  {uploadedSource.type === 'image' ? (
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
                      {uploadedSource.type === 'video' ? 'Vidéo source ajoutée' : 'Image source ajoutée'}
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
              <Select value={contentType} onValueChange={(value) => setContentType(value as ContentType)}>
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
              <Select value={aspectRatio} onValueChange={(value) => setAspectRatio(value as AspectRatio)}>
                <SelectTrigger className="bg-muted/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1">Carré (1:1)</SelectItem>
                  <SelectItem value="16:9">Paysage (16:9)</SelectItem>
                  <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                  <SelectItem value="4:3">Standard (4:3)</SelectItem>
                  <SelectItem value="3:4">Portrait (3:4)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prompt Input */}
            <div className="relative">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={promptPlaceholder}
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
                  <span className="hidden sm:inline">{uploadingSource ? 'Upload...' : 'Ajouter un média'}</span>
                  <span className="sm:hidden">{uploadingSource ? 'Upload...' : 'Média'}</span>
                </Button>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || (!prompt.trim() && !uploadedSource)}
                className={cn(
                  "bg-primary hover:bg-primary/90",
                  "font-semibold px-6 sm:px-8 w-full sm:w-auto text-sm sm:text-base",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
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
                    {contentType === 'video' ? 'Générer la vidéo' : 'Générer'}
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
