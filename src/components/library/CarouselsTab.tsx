import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBrandKit } from '@/hooks/useBrandKit';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Download, FileArchive, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { slideUrl } from '@/lib/cloudinary/imageUrls';

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
    bullets?: string[];
    [k: string]: any;
  } | null;
  metadata?: {
    cloudinary_base_url?: string;
    [k: string]: any;
  } | null;
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

  useEffect(() => {
    loadSlides();
  }, [activeBrandId, orderId]);

  const loadSlides = async () => {
    if (!user?.id || !activeBrandId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    let query = supabase
      .from('library_assets')
      .select('id, cloudinary_url, cloudinary_public_id, metadata, text_json, slide_index, carousel_id, order_id, created_at, format')
      .eq('user_id', user.id)
      .eq('type', 'carousel_slide')
      .order('created_at', { ascending: false })
      .order('slide_index', { ascending: true });
    
    // Filtre par brand_id seulement si aucun orderId spécifique n'est demandé
    if (!orderId && activeBrandId) {
      query = query.eq('brand_id', activeBrandId);
    }

    // Filtre par order_id si fourni
    if (orderId) {
      query = query.eq('order_id', orderId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[CarouselsTab] Error loading slides:', error);
    } else {
      setSlides((data || []) as CarouselSlide[]);
    }

    setLoading(false);
  };

  const handleDownloadZip = async (carouselKey: string, carouselSlides: CarouselSlide[]) => {
    setDownloadingZip(carouselKey);
    
    try {
      const carouselId = carouselSlides[0]?.carousel_id;
      const orderId = carouselSlides[0]?.order_id;
      
      if (!carouselId && !orderId) {
        throw new Error('No carousel or order ID found');
      }

      console.log('[CarouselsTab] Downloading ZIP for:', { carouselId, orderId });

      const { data, error } = await supabase.functions.invoke('download-job-set-zip', {
        body: { 
          carouselId: carouselId || undefined,
          orderId: orderId || undefined
        }
      });

      if (error) {
        console.error('[CarouselsTab] ZIP download error:', error);
        throw error;
      }

      if (!data?.url) {
        throw new Error('No ZIP URL returned');
      }

      // Open ZIP download in new tab
      window.open(data.url, '_blank');
      
      const sizeInMB = (data.size / (1024 * 1024)).toFixed(2);
      toast.success(`ZIP téléchargé : ${data.filename} (${sizeInMB} MB)`);
      
    } catch (err: any) {
      console.error('[CarouselsTab] ZIP download failed:', err);
      toast.error(`Échec du téléchargement : ${err.message || 'Erreur inconnue'}`);
    } finally {
      setDownloadingZip(null);
    }
  };

  // Utility functions for robust fallback
  const buildBaseUrlFromOriginal = (originalUrl: string): string | null => {
    try {
      const url = new URL(originalUrl);
      // Remove all transformations after /image/upload/ and keep version path
      const match = url.pathname.match(/^(\/[^/]+)\/image\/upload(?:\/[^/]+)?(\/v\d+\/.+)$/);
      if (match) {
        return `${url.origin}${match[1]}/image/upload${match[2]}`;
      }
      // If no version, try without transform part
      const noTransform = url.pathname.replace(/(\/image\/upload)\/[^/]+(\/.+)/, '$1$2');
      return `${url.origin}${noTransform}`;
    } catch {
      return null;
    }
  };

  const buildBaseUrlFromPublicId = (originalUrl: string, publicId?: string | null): string | null => {
    if (!publicId) return null;
    try {
      const url = new URL(originalUrl);
      const segments = url.pathname.split('/');
      const cloudName = segments[1];
      if (!cloudName) return null;
      return `${url.origin}/${cloudName}/image/upload/${publicId}.png`;
    } catch {
      return null;
    }
  };

  // Grouper les slides par carousel_id ou order_id
  const groupedCarousels = slides.reduce((acc, slide) => {
    const key = slide.carousel_id || slide.order_id || 'unknown';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(slide);
    return acc;
  }, {} as Record<string, CarouselSlide[]>);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-96 rounded-lg" />
        ))}
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Aucun carrousel pour l'instant.</p>
        <p className="text-sm">Générez depuis le chat, ils arrivent ici automatiquement.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(groupedCarousels).map(([carouselKey, carouselSlides]) => (
        <div key={carouselKey} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Carrousel</h3>
              <Badge variant="secondary">{carouselSlides.length} slides</Badge>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownloadZip(carouselKey, carouselSlides)}
                disabled={downloadingZip === carouselKey}
              >
                {downloadingZip === carouselKey ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileArchive className="h-4 w-4 mr-2" />
                )}
                Télécharger en ZIP
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  // Télécharger toutes les slides individuellement (fallback)
                  carouselSlides.forEach((slide, index) => {
                    setTimeout(() => {
                      window.open(slide.cloudinary_url, '_blank');
                    }, index * 200);
                  });
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Individual
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {carouselSlides
              .sort((a, b) => (a.slide_index ?? 0) - (b.slide_index ?? 0))
              .map((slide) => {
                // Mapper l'aspect ratio dynamiquement selon le format
                const format = slide.format || '4:5';
                const aspectClass = 
                  format === '9:16' ? 'aspect-[9/16]' :
                  format === '16:9' ? 'aspect-video' :
                  format === '1:1' ? 'aspect-square' :
                  format === '4:5' ? 'aspect-[4/5]' :
                  'aspect-[9/16]'; // Défaut portrait
                
                return (
                  <div key={slide.id} className="relative group">
                    <img
                      src={slide.cloudinary_url}
                      alt={`Slide ${(slide.slide_index ?? 0) + 1}`}
                      className={`w-full rounded-lg ${aspectClass} object-cover border`}
                      onError={async (e) => {
                        const img = e.currentTarget;
                        const alreadyRepaired = img.dataset.repaired === 'true';
                        const alreadyTried = img.dataset.fallbackTried === 'true';
                        
                        if (alreadyTried) return; // Prevent infinite loop

                        const original = slide.cloudinary_url;
                        
                        // Try to regenerate URL using SDK (Phase 3 new architecture)
                        if (!alreadyRepaired && slide.cloudinary_public_id && slide.text_json) {
                          try {
                            console.log('[CarouselsTab] Regenerating slide URL with SDK:', slide.id);
                            img.dataset.repaired = 'true'; // Mark as repaired to prevent loops
                            
                            const regeneratedUrl = slideUrl(slide.cloudinary_public_id, {
                              title: slide.text_json.title,
                              subtitle: slide.text_json.subtitle,
                              bulletPoints: slide.text_json.bullets?.filter(b => b) || [],
                              aspectRatio: slide.format || '9:16',
                            });
                            
                            if (regeneratedUrl) {
                              console.log('[CarouselsTab] ✅ URL regenerated with SDK, reloading image');
                              img.src = regeneratedUrl;
                              return; // Success, no need for fallback
                            }
                          } catch (regenerateError) {
                            console.warn('[CarouselsTab] SDK regeneration failed:', regenerateError);
                          }
                        } else {
                          console.log('[CarouselsTab] Skipping SDK regeneration - missing public_id or text_json');
                        }
                        
                        // If SDK regeneration failed or was already tried, use fallback
                        const metaBase = slide.metadata?.cloudinary_base_url || null;
                        const baseFromOriginal = buildBaseUrlFromOriginal(original);
                        const baseFromPublicId = buildBaseUrlFromPublicId(original, slide.cloudinary_public_id);

                        // Priority order for fallback
                        const fallback = metaBase || baseFromOriginal || baseFromPublicId;
                        
                        if (fallback && img.src !== fallback) {
                          console.log('[CarouselsTab] Using fallback image');
                          img.dataset.fallbackTried = 'true';
                          img.src = fallback;
                        } else {
                          console.warn('[CarouselsTab] No fallback available for slide:', slide.id);
                        }
                      }}
                    />
                  <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {(slide.slide_index ?? 0) + 1}
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button
                      size="sm"
                      onClick={() => window.open(slide.cloudinary_url, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
