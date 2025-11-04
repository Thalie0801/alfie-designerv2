import { Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Asset {
  id: string;
  url: string;
  slideIndex: number;
  type: string;
}

interface OrderResultsProps {
  assets: Asset[];
  total: number;
  orderId: string;
}

export function OrderResults({ assets, total, orderId }: OrderResultsProps) {
  if (assets.length === 0) return null;

  const isComplete = assets.length === total && total > 0;

  // Grouper par type
  const images = assets.filter(a => a.type === 'image');
  const carouselSlides = assets.filter(a => a.type === 'carousel_slide').sort((a, b) => a.slideIndex - b.slideIndex);

  return (
    <Card className="mt-4">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">
              {isComplete ? '✅ Génération terminée !' : '⏳ Génération en cours...'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {assets.length} / {total} assets
            </p>
          </div>
          {isComplete && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`/library?order=${orderId}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Voir dans la bibliothèque
            </Button>
          )}
        </div>

        {/* Images */}
        {images.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Images ({images.length})</h4>
            <div className="grid gap-2">
              {images.map(img => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.url}
                    alt={`Image ${img.slideIndex + 1}`}
                    className="w-full rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button
                      size="sm"
                      onClick={() => window.open(img.url, '_blank')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Carrousel */}
        {carouselSlides.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Carrousel ({carouselSlides.length} slides)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {carouselSlides.map(slide => (
                <div key={slide.id} className="relative group">
                  <img
                    src={slide.url}
                    alt={`Slide ${slide.slideIndex + 1}`}
                    className="w-full rounded-lg aspect-[4/5] object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {slide.slideIndex + 1}
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button
                      size="sm"
                      onClick={() => window.open(slide.url, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
