import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBrandKit } from '@/hooks/useBrandKit';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CarouselSlide {
  id: string;
  cloudinary_url: string;
  slide_index: number | null;
  carousel_id: string | null;
  order_id: string | null;
  created_at: string | null;
  format: string | null;
}

interface CarouselsTabProps {
  orderId: string | null;
}

export function CarouselsTab({ orderId }: CarouselsTabProps) {
  const { user } = useAuth();
  const { activeBrandId } = useBrandKit();
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [loading, setLoading] = useState(true);

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
      .select('id, cloudinary_url, slide_index, carousel_id, order_id, created_at, format')
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
      setSlides(data || []);
    }

    setLoading(false);
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // Télécharger toutes les slides (ouvrir dans nouvel onglet)
                carouselSlides.forEach((slide, index) => {
                  setTimeout(() => {
                    window.open(slide.cloudinary_url, '_blank');
                  }, index * 200); // Stagger downloads
                });
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Télécharger tout
            </Button>
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
