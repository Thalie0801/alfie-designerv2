import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Download, Loader2, Images, CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CarouselProgressCardProps {
  total: number;
  done: number;
  items: Array<{ id: string; url: string; index: number; }>;
  onDownloadZip?: () => void;
  onRetry?: () => void;
}

interface JobStatus {
  id: string;
  index: number;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  error?: string;
  retry_count?: number;
}

export function CarouselProgressCard({ total, done, items, onDownloadZip, onRetry }: CarouselProgressCardProps) {
  const safeTotal = Math.max(0, total);
  const safeDone = Math.min(done, safeTotal);
  const progress = safeTotal === 0 ? 0 : Math.round((safeDone / safeTotal) * 100);
  const isComplete = safeDone >= safeTotal && safeTotal > 0;
  const [jobStatuses, setJobStatuses] = useState<JobStatus[]>([]);
  
  // Charger les statuts des jobs depuis la DB
  useEffect(() => {
    if (items.length === 0) return;
    
    const loadJobStatuses = async () => {
      // Extraire job_set_id depuis les items (supposé dans meta ou via query)
      const { data, error } = await supabase
        .from('jobs')
        .select('id, index_in_set, status, error, retry_count')
        .order('index_in_set', { ascending: true });
      
      if (error) {
        console.error('[CarouselProgress] Failed to load job statuses:', error);
        return;
      }
      
      if (data) {
        setJobStatuses(data.map(j => ({
          id: j.id,
          index: j.index_in_set || 0,
          status: j.status as any,
          error: j.error || undefined,
          retry_count: j.retry_count || 0
        })));
      }
    };
    
    loadJobStatuses();
  }, [items.length, done]);

  const getStatusIcon = (index: number) => {
    const job = jobStatuses.find(j => j.index === index);
    const hasAsset = items.some(item => item.index === index);
    
    if (hasAsset) {
      return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    }
    
    if (job?.status === 'failed') {
      return <XCircle className="w-3 h-3 text-red-500" />;
    }
    
    if (job?.status === 'running') {
      return <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />;
    }
    
    return <div className="w-3 h-3 rounded-full border-2 border-muted" />;
  };
  
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
            {isComplete && onDownloadZip ? (
              <button
                onClick={onDownloadZip}
                className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Télécharger le ZIP
              </button>
            ) : null}
            {!isComplete && (typeof onRetry === 'function') ? (
              <button
                onClick={onRetry}
                className="text-xs px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
              >
                Relancer le traitement
              </button>
            ) : null}
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
              .map((item) => {
                const job = jobStatuses.find(j => j.index === item.index);
                return (
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
                    
                    {/* Status icon */}
                    <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm rounded-full p-1">
                      {getStatusIcon(item.index)}
                    </div>
                    
                    {/* Index + retry count */}
                    <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-medium">
                      #{item.index + 1}
                      {job && (job.retry_count || 0) > 0 && (
                        <span className="ml-1 text-orange-500">↻{job.retry_count || 0}</span>
                      )}
                    </div>
                    
                    {/* Error message */}
                    {job?.error && (
                      <div className="absolute bottom-8 left-1 right-1 bg-red-500/90 text-white text-[10px] rounded px-1.5 py-0.5 truncate">
                        {job.error}
                      </div>
                    )}
                    
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
                );
              })}
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
