import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Download, Loader2, Images } from 'lucide-react';

interface CarouselProgressCardProps {
  total: number;
  done: number;
  items: Array<{ id: string; url: string; index: number; }>;
  onDownloadZip?: () => void;
}

export function CarouselProgressCard({ total, done, items, onDownloadZip }: CarouselProgressCardProps) {
  const safeTotal = Math.max(0, total);
  const safeDone = Math.min(done, safeTotal);
  const progress = safeTotal === 0 ? 0 : Math.round((safeDone / safeTotal) * 100);
  const isComplete = safeDone >= safeTotal && safeTotal > 0;
  
  return (
    <Card className="p-4 border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isComplete ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <span>✅</span>}
            <span className="text-sm font-medium">
              {isComplete ? 'Carrousel terminé' : 'Génération en cours…'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {safeDone}/{safeTotal} ({progress}%)
            </span>
            {onDownloadZip && isComplete && (
              <button
                onClick={onDownloadZip}
                className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Télécharger le ZIP
              </button>
            )}
          </div>
        </div>
        
        {/* Progress bar */}
        <Progress value={progress} className="h-2" />

        {/* Empty state */}
        {items.length === 0 && !isComplete && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Images className="w-4 h-4" /> En attente des premières images…
          </div>
        )}
        
        {/* Images grid */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
            {items
              .slice()
              .sort((a, b) => a.index - b.index)
              .map((item) => (
                <figure 
                  key={item.id} 
                  className="relative rounded-lg overflow-hidden border border-primary/10 group hover:border-primary/30 transition-colors"
                >
                  <img 
                    src={item.url} 
                    alt={`Slide ${item.index + 1}`} 
                    className="w-full h-auto block"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }}
                    loading="eager"
                  />
                  <figcaption 
                    className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-hidden="true"
                  >
                    <div className="absolute bottom-2 left-2 text-white text-xs font-medium">
                      Slide {item.index + 1}
                    </div>
                    <a 
                      href={item.url} 
                      download 
                      className="absolute bottom-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs flex items-center gap-1 hover:bg-primary/90 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      DL
                    </a>
                  </figcaption>
                </figure>
              ))}
          </div>
        )}
        
        {/* Completion message */}
        {isComplete && (
          <div className="text-center text-sm text-muted-foreground pt-2">
            🎉 Toutes tes slides sont prêtes ! Télécharge-les ou retrouve-les dans ta bibliothèque.
          </div>
        )}
      </div>
    </Card>
  );
}
