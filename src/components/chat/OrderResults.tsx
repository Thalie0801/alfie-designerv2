import { Download, ExternalLink, ChevronDown, ChevronUp, PlayCircle, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMemo, useState } from "react";
import type { LibraryAsset } from "@/types/chat";
import { getAspectClass } from "@/types/chat";
import { cn } from "@/lib/utils";

interface OrderResultsProps {
  assets: LibraryAsset[];
  total: number;
  orderId: string;
}

/** Tente d’inférer un poster Cloudinary pour une vidéo si `thumbnailUrl` absent */
function cloudinaryPosterFromVideoUrl(url?: string | null): string | undefined {
  if (!url) return;
  const m = url.match(/(https?:\/\/res\.cloudinary\.com\/[^/]+)\/video\/upload\/(.+?)\/([^/]+)\.(mp4|mov|webm)/i);
  if (!m) return;
  const [, root, path, pid] = m;
  return `${root}/video/upload/so_1/${path}/${pid}.jpg`;
}

/** Détermine une classe d’aspect sur la base d’indices (fallback 4:5) */
function aspectClassFromAsset(a: LibraryAsset) {
  // 1) s’il y a un format explicite (4:5, 1:1, 9:16, 16:9), on délègue
  if (a.format) return getAspectClass(a.format as any);

  // 2) heuristiques sur l’URL (ex: 1080x1920, 16x9…)
  const u = a.url ?? "";
  if (/16x9|16-9|1920x1080/i.test(u)) return "aspect-video";
  if (/9x16|9-16|1080x1920/i.test(u)) return "aspect-[9/16]";
  if (/1x1|1-1|1080x1080/i.test(u)) return "aspect-square";

  // 3) fallback Instagram feed
  return "aspect-[4/5]";
}

export function OrderResults({ assets, total, orderId }: OrderResultsProps) {
  const isComplete = assets.length === total && total > 0;
  const isLoading = total > 0 && assets.length < total;
  const [isOpen, setIsOpen] = useState(true);

  // Grouper par type (on garde l’ordre des slides)
  const images = useMemo(() => assets.filter((a) => a.type === "image"), [assets]);
  const videos = useMemo(() => assets.filter((a) => a.type === "video"), [assets]);
  const carouselSlides = useMemo(
    () => assets.filter((a) => a.type === "carousel_slide").sort((a, b) => (a.slideIndex ?? 0) - (b.slideIndex ?? 0)),
    [assets],
  );

  return (
    <Card className="mt-2 mb-2">
      <CardContent className="p-3">
        <div data-collapsible>
          {/* Header - toujours visible */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                {isComplete ? "✅ Génération terminée !" : "⏳ Génération en cours..."}
                {isLoading && <span className="text-xs text-muted-foreground animate-pulse">(chargement...)</span>}
              </h3>
              <p className="text-xs text-muted-foreground">
                {assets.length} / {total} assets
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isComplete && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`/library?order=${orderId}`, "_blank")}
                  className="text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Bibliothèque
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => setIsOpen((v) => !v)}
                aria-expanded={isOpen}
                aria-controls="order-results-body"
              >
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Contenu collapsible avec hauteur limitée */}
          {isOpen && (
            <div id="order-results-body" className="mt-3 space-y-3 max-h-[35vh] overflow-y-auto">
              {/* Images */}
              {images.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground">Images ({images.length})</h4>
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {images.map((img) => (
                      <div key={img.id} className="relative group">
                        <div
                          className={cn("relative w-full rounded-lg overflow-hidden border", aspectClassFromAsset(img))}
                        >
                          <img
                            src={img.url}
                            alt={img.text?.title ?? `Image ${img.slideIndex != null ? img.slideIndex + 1 : ""}`}
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Button size="sm" onClick={() => window.open(img.url, "_blank")}>
                            <Download className="h-4 w-4 mr-2" />
                            Télécharger
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Vidéos */}
              {videos.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground">Vidéos ({videos.length})</h4>
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {videos.map((vid) => {
                      const poster = cloudinaryPosterFromVideoUrl(vid.url);
                      return (
                        <div key={vid.id} className="relative group">
                          <div
                            className={cn(
                              "relative w-full rounded-lg overflow-hidden border bg-muted",
                              aspectClassFromAsset(vid),
                            )}
                          >
                            {vid.url ? (
                              <video
                                src={vid.url}
                                poster={poster}
                                className="absolute inset-0 w-full h-full object-cover"
                                controls
                                playsInline
                              />
                            ) : (
                              <div className="absolute inset-0 grid place-items-center">
                                <PlayCircle className="h-10 w-10 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Button size="sm" onClick={() => window.open(vid.url, "_blank")}>
                              <Download className="h-4 w-4 mr-2" />
                              Télécharger
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Carrousel */}
              {carouselSlides.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground">
                    Carrousel ({carouselSlides.length} slides)
                  </h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {carouselSlides.map((slide) => (
                      <div key={slide.id} className="relative group">
                        {/* Wrapper avec aspect ratio (basé sur format) */}
                        <div
                          className={cn(
                            "relative w-full rounded-lg overflow-hidden border",
                            getAspectClass(slide.format || "4:5"),
                          )}
                        >
                          {/* Image en absolute pour remplir le wrapper */}
                          {slide.url ? (
                            <img
                              src={slide.url}
                              alt={`Slide ${slide.slideIndex + 1}`}
                              className="absolute inset-0 w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="absolute inset-0 grid place-items-center bg-muted">
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}

                          {/* Badge du numéro de slide */}
                          <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded z-10">
                            {slide.slideIndex + 1}
                          </div>
                        </div>

                        {/* Bouton de téléchargement au hover */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Button size="sm" onClick={() => window.open(slide.url, "_blank")}>
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Rien à montrer */}
              {images.length === 0 && videos.length === 0 && carouselSlides.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun média pour l’instant…</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
