import { Download, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Asset {
  id: string;
  url: string;
  slideIndex: number;
  type: string;
  format?: string;
}

// Helper pour déterminer la classe d'aspect ratio
const getAspectClass = (format?: string): string => {
  switch (format) {
    case '9:16': return 'aspect-[9/16]';
    case '16:9': return 'aspect-video';
    case '1:1':  return 'aspect-square';
    case '5:4':  return 'aspect-[5/4]';
    default:     return 'aspect-[4/5]';
  }
};

interface OrderResultsProps {
  assets: Asset[];
  total: number;
  orderId: string;
}

export function OrderResults({ assets, total, orderId }: OrderResultsProps) {
  const isComplete = assets.length === total && total > 0;
  const isLoading = total > 0 && assets.length < total;
  const [isOpen, setIsOpen] = useState(true);

  // Grouper par type
  const images = assets.filter(a => a.type === 'image');
  const carouselSlides = assets.filter(a => a.type === 'carousel_slide').sort((a, b) => a.slideIndex - b.slideIndex);

  return (
    <Card className="mt-2 mb-2">
      <CardContent className="p-3">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          {/* Header - toujours visible */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                {isComplete ? '✅ Génération terminée !' : '⏳ Génération en cours...'}
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
                  onClick={() => window.open(`/library?order=${orderId}`, '_blank')}
                  className="text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Bibliothèque
                </Button>
              )}
              
              <CollapsibleTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          
          {/* Contenu collapsible avec hauteur limitée */}
          <CollapsibleContent>
            <div className="mt-3 space-y-3 max-h-[35vh] overflow-y-auto">

              {/* Images */}
              {images.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground">Images ({images.length})</h4>
                  <div className="grid gap-2">
                    {images.map(img => (
                      <div key={img.id} className="relative group">
                        <img
                          src={img.url}
                          alt={`Image ${img.slideIndex + 1}`}
                          className="w-full rounded-lg max-h-48 object-cover"
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
                  <h4 className="text-xs font-medium text-muted-foreground">Carrousel ({carouselSlides.length} slides)</h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {carouselSlides.map(slide => (
                      <div key={slide.id} className="relative group">
                        {/* Wrapper avec aspect ratio */}
                        <div className={`relative w-full ${getAspectClass(slide.format)} rounded-lg overflow-hidden`}>
                          {/* Image en absolute pour remplir le wrapper */}
                          <img
                            src={slide.url}
                            alt={`Slide ${slide.slideIndex + 1}`}
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy"
                          />
                          {/* Badge du numéro de slide */}
                          <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded z-10">
                            {slide.slideIndex + 1}
                          </div>
                        </div>
                        
                        {/* Bouton de téléchargement au hover */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Button
                            size="sm"
                            onClick={() => window.open(slide.url, '_blank')}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
