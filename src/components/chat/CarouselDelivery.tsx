import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Download, ExternalLink, Copy, CheckCheck, RotateCcw, PlayCircle, Image as ImageIcon, Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { generateCarouselVideoFromJobSet } from "@/lib/cloudinary/carouselToVideo";

interface CarouselDeliveryProps {
  jobSetId: string;
}

type JobRow = {
  id: string;
  output_url?: string | null;
  thumbnail_url?: string | null;
  width?: number | null;
  height?: number | null;
  metadata?: any;
  type?: "image" | "video" | null; // si présent
};

type JobSetRow = {
  id: string;
  metadata?: any;
  jobs?: JobRow[];
};

const ASPECT_TO_CLASS: Record<string, string> = {
  "4:5": "aspect-[4/5]",
  "1:1": "aspect-square",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
};

function inferType(job: JobRow): "image" | "video" {
  if (job.type === "image" || job.type === "video") return job.type;
  const rt = job.metadata?.resource_type as string | undefined;
  if (rt === "video") return "video";
  if (rt === "image") return "image";
  const url = job.output_url || "";
  if (/\.(mp4|mov|webm)(\?|$)/i.test(url)) return "video";
  return "image";
}

function cloudinaryPosterFromVideoUrl(url?: string | null): string | undefined {
  if (!url) return;
  const m = url.match(/(https?:\/\/res\.cloudinary\.com\/[^/]+)\/video\/upload\/(.+?)\/([^/]+)\.(mp4|mov|webm)/i);
  if (!m) return;
  const [, root, path, pid] = m;
  return `${root}/video/upload/so_1/${path}/${pid}.jpg`;
}

function aspectClassFrom(job?: JobRow, setMetaAspect?: string): string {
  if (setMetaAspect && ASPECT_TO_CLASS[setMetaAspect]) return ASPECT_TO_CLASS[setMetaAspect];
  const w = Number(job?.width ?? 0);
  const h = Number(job?.height ?? 0);
  if (w > 0 && h > 0) {
    const r = Number((w / h).toFixed(2));
    if (Math.abs(r - 1) < 0.05) return ASPECT_TO_CLASS["1:1"];
    if (Math.abs(r - 4 / 5) < 0.05) return ASPECT_TO_CLASS["4:5"];
    if (Math.abs(r - 9 / 16) < 0.05) return ASPECT_TO_CLASS["9:16"];
    if (Math.abs(r - 16 / 9) < 0.05) return ASPECT_TO_CLASS["16:9"];
  }
  return ASPECT_TO_CLASS["4:5"];
}

export function CarouselDelivery({ jobSetId }: CarouselDeliveryProps) {
  const [jobSet, setJobSet] = useState<JobSetRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [imgErrorIds, setImgErrorIds] = useState<Record<string, boolean>>({});
  const [vidPosterErrorIds, setVidPosterErrorIds] = useState<Record<string, boolean>>({});
  const [generatingVideo, setGeneratingVideo] = useState(false);

  const loadJobSet = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("job_sets").select(`*, jobs:jobs(*)`).eq("id", jobSetId).single();

      if (error) throw error;
      setJobSet(data as unknown as JobSetRow);
    } catch (error) {
      console.error("Error loading jobSet:", error);
      toast.error("Erreur lors du chargement");
      setJobSet(null);
    } finally {
      setLoading(false);
    }
  }, [jobSetId]);

  useEffect(() => {
    loadJobSet();
  }, [loadJobSet]);

  const copyCaption = async () => {
    const caption = jobSet?.metadata?.caption as string | undefined;
    if (!caption) return;
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      toast.success("Caption copiée !");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erreur lors de la copie");
    }
  };

  const handleExportToVideo = async () => {
    if (!jobSetId) return;
    
    setGeneratingVideo(true);
    try {
      const aspect = (meta.aspect_ratio as string) || '4:5';
      const videoUrl = await generateCarouselVideoFromJobSet({
        jobSetId,
        aspect: aspect as any,
        title: 'Mon Carrousel',
        durationPerSlide: 2,
      });

      // Ouvrir la vidéo dans un nouvel onglet
      window.open(videoUrl, '_blank');
      toast.success('Vidéo générée avec succès ! 🎬');
    } catch (err: any) {
      console.error('[CarouselDelivery] Video generation failed:', err);
      toast.error(`Échec de la génération : ${err.message || 'Erreur inconnue'}`);
    } finally {
      setGeneratingVideo(false);
    }
  };

  const meta = jobSet?.metadata ?? {};
  const jobs = (jobSet?.jobs ?? []).filter((j) => !!j?.output_url);

  const setAspect = (meta.aspect_ratio as string | undefined) || undefined;

  const gridColsClass = useMemo(() => {
    // si 9:16, on garde 3 colonnes mais on peut réduire l’écart si besoin
    return "grid grid-cols-3 gap-3";
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!jobSet) {
    return (
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>❌ Introuvable</CardTitle>
          <Button size="sm" variant="outline" onClick={loadJobSet}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reload
          </Button>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Le lot demandé n’a pas été trouvé ou une erreur est survenue.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>✅ Carrousel prêt !</CardTitle>
        <Button size="sm" variant="outline" onClick={loadJobSet}>
          <RotateCcw className="h-4 w-4 mr-1" />
          Reload
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Galerie des slides */}
        {jobs.length > 0 ? (
          <div className={gridColsClass}>
            {jobs.map((job, idx) => {
              const t = inferType(job);
              const aspectCls = aspectClassFrom(job, setAspect);
              const outUrl = job.output_url ?? undefined;
              const poster =
                job.thumbnail_url || (!vidPosterErrorIds[job.id] ? cloudinaryPosterFromVideoUrl(outUrl) : undefined);

              return (
                <div key={job.id} className="relative group">
                  <div
                    className={cn("relative w-full overflow-hidden rounded-lg border shadow-sm bg-muted", aspectCls)}
                  >
                    {t === "video" ? (
                      <>
                        {outUrl ? (
                          <video
                            src={outUrl}
                            poster={poster}
                            className="absolute inset-0 w-full h-full object-cover"
                            controls
                            playsInline
                            onError={() => setVidPosterErrorIds((s) => ({ ...s, [job.id]: true }))}
                          />
                        ) : (
                          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary/10 to-secondary/10">
                            <PlayCircle className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {outUrl && !imgErrorIds[job.id] ? (
                          <img
                            src={outUrl}
                            alt={job.metadata?.altText || `Slide ${idx + 1}`}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={() => setImgErrorIds((s) => ({ ...s, [job.id]: true }))}
                          />
                        ) : (
                          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary/10 to-secondary/10">
                            <ImageIcon className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="absolute top-2 left-2 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs font-medium border">
                    {idx + 1}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Aucun média trouvé dans ce lot.</div>
        )}

        {/* Actions de téléchargement */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={handleExportToVideo} 
            disabled={!jobSet || generatingVideo}
            variant="default"
          >
            <Film className="h-4 w-4 mr-2" />
            {generatingVideo ? 'Génération...' : 'Exporter en vidéo'}
          </Button>

          {meta.zipUrl && (
            <Button asChild variant="outline">
              <a href={meta.zipUrl as string} download>
                <Download className="h-4 w-4 mr-2" />
                ZIP
              </a>
            </Button>
          )}

          {meta.pdfUrl && (
            <Button asChild variant="outline">
              <a href={meta.pdfUrl as string} download>
                <Download className="h-4 w-4 mr-2" />
                PDF LinkedIn
              </a>
            </Button>
          )}

          {meta.canvaUrl && (
            <Button asChild variant="outline">
              <a href={meta.canvaUrl as string} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Ouvrir dans Canva
              </a>
            </Button>
          )}
        </div>

        {/* Caption prête à publier */}
        {meta.caption && typeof meta.caption === "string" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Caption (prête à publier)</Label>
              <Button size="sm" variant="ghost" onClick={copyCaption} className="gap-2">
                {copied ? (
                  <>
                    <CheckCheck className="h-4 w-4" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copier
                  </>
                )}
              </Button>
            </div>
            <Textarea readOnly value={meta.caption as string} rows={8} className="font-mono text-sm" />
          </div>
        )}

        {/* Alt-texts (accessibilité) */}
        {jobs.length > 0 && jobs.some((j) => j.metadata?.altText) && (
          <Accordion type="single" collapsible>
            <AccordionItem value="alts">
              <AccordionTrigger>Alt-texts (accessibilité)</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {jobs.map((job, i) =>
                    job.metadata?.altText ? (
                      <div key={job.id} className="space-y-1">
                        <strong className="text-sm">Slide {i + 1}:</strong>
                        <code className="block text-xs bg-muted p-2 rounded break-words">{job.metadata.altText}</code>
                      </div>
                    ) : null,
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
