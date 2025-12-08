import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useBrandKit } from "@/hooks/useBrandKit";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Download, FileArchive, Loader2, Copy, ChevronDown, FileSpreadsheet } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CarouselSlide {
  id: string;
  cloudinary_url: string;
  slide_index: number | null;
  carousel_id: string | null;
  order_id: string | null;
  created_at: string | null;
  format: string | null;
  cloudinary_public_id?: string | null;
  text_json?: {
    title?: string;
    subtitle?: string;
    body?: string;
    bullets?: string[];
    [k: string]: any;
  } | null;
  metadata?: {
    cloudinary_base_url?: string;
    [k: string]: any;
  } | null;
  // champs possibles selon ta table
  user_id?: string;
  brand_id?: string;
}


type Aspect = "4:5" | "1:1" | "9:16" | "16:9";
function aspectClassFor(format?: string | null) {
  const f = (format || "4:5") as Aspect;
  switch (f) {
    case "9:16":
      return "aspect-[9/16]";
    case "16:9":
      return "aspect-video";
    case "1:1":
      return "aspect-square";
    case "4:5":
    default:
      return "aspect-[4/5]";
  }
}

interface CarouselsTabProps {
  orderId: string | null;
}

export function CarouselsTab({ orderId }: CarouselsTabProps) {
  const { user } = useAuth();
  const { activeBrandId } = useBrandKit();
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingZip, setDownloadingZip] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadSlides = useCallback(async () => {
    if (!user?.id || !activeBrandId) {
      setSlides([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from("library_assets")
        .select(
          "id, cloudinary_url, cloudinary_public_id, metadata, text_json, slide_index, carousel_id, order_id, created_at, format, user_id, brand_id",
        )
        .eq("user_id", user.id)
        .eq("type", "carousel_slide")
        .order("created_at", { ascending: false })
        .order("slide_index", { ascending: true });

      // Filtre par brand si pas d’orderId
      if (!orderId) query = query.eq("brand_id", activeBrandId);
      // Filtre par order_id si fourni
      if (orderId) query = query.eq("order_id", orderId);

      const { data, error } = await query;
      if (error) throw error;
      if (mounted.current) setSlides((data || []) as CarouselSlide[]);
    } catch (e: any) {
      console.error("[CarouselsTab] loadSlides error:", e);
      toast.error("Impossible de charger les carrousels.");
      if (mounted.current) setSlides([]);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [user?.id, activeBrandId, orderId]);

  useEffect(() => {
    loadSlides();
  }, [loadSlides]);

  // Realtime—scope minimal en fonction des filtres actifs
  useEffect(() => {
    if (!user?.id) return;

    const filters: Record<string, string> = { user_id: `eq.${user.id}`, type: "eq.carousel_slide" };
    if (orderId) {
      filters["order_id"] = `eq.${orderId}`;
    } else if (activeBrandId) {
      filters["brand_id"] = `eq.${activeBrandId}`;
    }

    const channel = supabase
      .channel(`rt_carousel_slides_${user.id}_${orderId ?? activeBrandId ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "library_assets",
          filter: Object.entries(filters)
            .map(([k, v]) => `${k}=${v}`)
            .join(","),
        },
        (payload: any) => {
          const row = payload.new as CarouselSlide;
          const old = payload.old as CarouselSlide | undefined;

          setSlides((prev) => {
            const arr = prev ? [...prev] : [];
            switch (payload.eventType) {
              case "INSERT":
                if (!arr.some((s) => s.id === row.id)) {
                  arr.unshift(row);
                }
                break;
              case "UPDATE":
                return arr.map((s) => (s.id === row.id ? { ...s, ...row } : s));
              case "DELETE":
                return arr.filter((s) => s.id !== (old?.id || row.id));
            }
            return arr;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, activeBrandId, orderId]);

  // Grouping mémoïsé
  const grouped = useMemo(() => {
    const groups = new Map<string, CarouselSlide[]>();
    for (const s of slides) {
      const key = s.carousel_id || s.order_id || "unknown";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    // Tri interne par slide_index puis date (stable)
    for (const [k, arr] of groups) {
      arr.sort(
        (a, b) =>
          (a.slide_index ?? 0) - (b.slide_index ?? 0) ||
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      );
      groups.set(k, arr);
    }
    // Array pour map + titre
    return Array.from(groups.entries()).map(([k, arr]) => ({
      key: k,
      slides: arr,
      title: arr[0]?.order_id
        ? `Commande ${arr[0].order_id}`
        : arr[0]?.carousel_id
          ? `Carrousel ${arr[0].carousel_id}`
          : "Carrousel",
    }));
  }, [slides]);

  const handleDownloadSlide = useCallback((src: string, slideIndex: number) => {
    // Utiliser fl_attachment de Cloudinary pour forcer le téléchargement (évite CORS)
    const downloadUrl = src.includes('/upload/')
      ? src.replace('/upload/', `/upload/fl_attachment:carousel-slide-${slideIndex + 1}/`)
      : src;
    
    window.open(downloadUrl, '_blank');
    toast.success('Téléchargement démarré');
  }, []);

  const handleDownloadZip = useCallback(async (carouselKey: string, carouselSlides: CarouselSlide[]) => {
    if (!carouselSlides.length) return;
    setDownloadingZip(carouselKey);
    try {
      const carouselId = carouselSlides[0]?.carousel_id || undefined;
      const orderId = carouselSlides[0]?.order_id || undefined;
      if (!carouselId && !orderId) throw new Error("Aucun identifiant (carrousel / commande)");

      const { data, error } = await supabase.functions.invoke("download-job-set-zip", {
        body: { carouselId, orderId },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Aucune URL ZIP retournée");

      window.open(data.url, "_blank");
      const sizeInMB = data.size ? (data.size / (1024 * 1024)).toFixed(2) : "—";
      toast.success(`ZIP lancé : ${data.filename ?? "archive.zip"} (${sizeInMB} Mo)`);
    } catch (e: any) {
      console.error("[CarouselsTab] ZIP error:", e);
      toast.error(`Échec du téléchargement ZIP : ${e?.message ?? "Erreur inconnue"}`);
    } finally {
      setDownloadingZip(null);
    }
  }, []);

  // ✅ MÉTHODE C: Copier un texte de slide
  const handleCopySlideText = useCallback((slide: CarouselSlide) => {
    if (!slide.text_json) return;
    const { title, subtitle, body, bullets } = slide.text_json;
    let text = "";
    if (title) text += `Titre : ${title}\n`;
    if (subtitle) text += `Sous-titre : ${subtitle}\n`;
    if (body) text += `Corps : ${body}\n`;
    if (bullets?.length) {
      text += `Points clés :\n${bullets.map((b) => `  • ${b}`).join("\n")}`;
    }
    navigator.clipboard.writeText(text.trim());
    toast.success("Texte de la slide copié !");
  }, []);

  // ✅ MÉTHODE C: Copier tous les textes d'un carrousel
  const handleCopyAllTexts = useCallback((carouselSlides: CarouselSlide[]) => {
    const slidesWithTexts = carouselSlides.filter((s) => s.text_json);
    if (slidesWithTexts.length === 0) {
      toast.error("Aucun texte disponible pour ce carrousel");
      return;
    }

    let allTexts = "📱 CARROUSEL - Textes des slides\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

    slidesWithTexts.sort((a, b) => (a.slide_index ?? 0) - (b.slide_index ?? 0));

    for (const slide of slidesWithTexts) {
      const { title, subtitle, body, bullets } = slide.text_json!;
      const slideNum = (slide.slide_index ?? 0) + 1;

      allTexts += `📄 SLIDE ${slideNum}\n`;
      if (title) allTexts += `Titre : ${title}\n`;
      if (subtitle) allTexts += `Sous-titre : ${subtitle}\n`;
      if (body) allTexts += `Corps : ${body}\n`;
      if (bullets?.length) {
        allTexts += `Points clés :\n${bullets.map((b) => `  • ${b}`).join("\n")}\n`;
      }
      allTexts += "\n";
    }

    navigator.clipboard.writeText(allTexts.trim());
    toast.success("Tous les textes copiés !");
  }, []);

  // Vérifier si le carrousel a des textes
  const hasTexts = useCallback((carouselSlides: CarouselSlide[]) => {
    return carouselSlides.some((s) => s.text_json && (s.text_json.title || s.text_json.body));
  }, []);

  // ✅ Export CSV pour Canva Bulk Create avec limites de caractères
  const handleExportCSV = useCallback((carouselSlides: CarouselSlide[], carouselTitle: string) => {
    const slidesWithTexts = carouselSlides.filter((s) => s.text_json);
    if (slidesWithTexts.length === 0) {
      toast.error("Aucun texte à exporter");
      return;
    }

    // Troncature pour Canva Bulk Create
    const truncate = (str: string, max: number) => {
      const clean = (str || "").trim();
      return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
    };

    const headers = "slide,title,subtitle,body";
    const escapeCSV = (str: string) => `"${(str || "").replace(/"/g, '""')}"`;

    const rows = slidesWithTexts
      .sort((a, b) => (a.slide_index ?? 0) - (b.slide_index ?? 0))
      .map((slide) => {
        const { title, subtitle, body } = slide.text_json!;
        const slideNum = (slide.slide_index ?? 0) + 1;
        return [
          slideNum, 
          escapeCSV(truncate(title || "", 40)), 
          escapeCSV(truncate(subtitle || "", 60)), 
          escapeCSV(truncate(body || "", 120))
        ].join(",");
      })
      .join("\n");

    const csv = `${headers}\n${rows}`;
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${carouselTitle.replace(/[^a-zA-Z0-9]/g, "-")}-canva.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("CSV exporté ! Importe-le dans Canva Bulk Create");
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-96 rounded-lg" />
        ))}
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Aucun carrousel pour l’instant.</p>
        <p className="text-sm">Générez depuis le chat, ils apparaîtront ici automatiquement.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {grouped.map(({ key, slides: carouselSlides, title }) => {
        const slidesHaveTexts = hasTexts(carouselSlides);

        return (
          <div key={key} className="border rounded-lg p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{title}</h3>
                <Badge variant="secondary">{carouselSlides.length} slides</Badge>
                {carouselSlides[0]?.format && <Badge variant="outline">{carouselSlides[0].format}</Badge>}
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                {slidesHaveTexts && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExportCSV(carouselSlides, title)}
                      className="touch-target flex-1 sm:flex-none"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      CSV Canva
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyAllTexts(carouselSlides)}
                      className="touch-target flex-1 sm:flex-none"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copier textes
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownloadZip(key, carouselSlides)}
                  disabled={downloadingZip === key}
                  aria-label="Télécharger en ZIP"
                  className="touch-target flex-1 sm:flex-none"
                >
                  {downloadingZip === key ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileArchive className="h-4 w-4 mr-2" />
                  )}
                  ZIP
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {carouselSlides.map((slide) => {
                const aspect = aspectClassFor(slide.format);
                // ✅ CORRECTION: Prioriser cloudinary_base_url (image de fond SANS texte)
                // cloudinary_url peut maintenant être l'URL de base aussi, mais on garde le fallback
                const baseUrl = (slide.metadata?.cloudinary_base_url as string) || "";
                const primaryUrl = baseUrl || slide.cloudinary_url || "";

                return (
                  <div key={slide.id} className="relative group">
                    <img
                      src={primaryUrl}
                      alt={`Slide ${(slide.slide_index ?? 0) + 1}`}
                      className={cn("w-full rounded-lg object-cover border", aspect)}
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget;
                        // Fallback vers cloudinary_url si base_url échoue
                        const fallback = slide.cloudinary_url || "";
                        if (target.src !== fallback && fallback) {
                          console.info("[CarouselsTab] Fallback to cloudinary_url:", fallback);
                          target.src = fallback;
                        } else {
                          console.warn("[CarouselsTab] Image load error, no fallback:", target.src);
                        }
                      }}
                    />
                    <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      {(slide.slide_index ?? 0) + 1}
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleDownloadSlide(primaryUrl, slide.slide_index ?? 0)}
                        aria-label="Télécharger l'image"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {slide.text_json && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleCopySlideText(slide)}
                          aria-label="Copier le texte"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ✅ MÉTHODE C: Affichage des textes en tableau */}
            {slidesHaveTexts && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between mt-2">
                    <span className="flex items-center gap-2">
                      📝 Textes du carrousel
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Slide</TableHead>
                          <TableHead>Titre</TableHead>
                          <TableHead>Sous-titre</TableHead>
                          <TableHead>Corps</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {carouselSlides
                          .filter((s) => s.text_json)
                          .sort((a, b) => (a.slide_index ?? 0) - (b.slide_index ?? 0))
                          .map((slide) => {
                            const { title, subtitle, body } = slide.text_json!;
                            const slideNum = (slide.slide_index ?? 0) + 1;

                            return (
                              <TableRow key={slide.id}>
                                <TableCell className="font-medium">{slideNum}</TableCell>
                                <TableCell className="max-w-[200px] truncate">{title || "—"}</TableCell>
                                <TableCell className="max-w-[200px] truncate text-muted-foreground">{subtitle || "—"}</TableCell>
                                <TableCell className="max-w-[300px] truncate text-muted-foreground">{body || "—"}</TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleCopySlideText(slide)}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        );
      })}
    </div>
  );
}
