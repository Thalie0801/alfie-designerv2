/**
 * JobConsolePage - Page dédiée au suivi d'un job
 */
import { useParams, Link, useNavigate } from 'react-router-dom';
import { JobConsole } from '@/components/job/JobConsole';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Library, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { useJobProgress } from '@/hooks/useJobProgress';
import { rerunJob } from '@/lib/jobClient';
import { useState } from 'react';
import { toast } from 'sonner';

export default function JobConsolePage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { progress } = useJobProgress(jobId || null, {
    showNotifications: true, // Activer les notifications automatiques
    onComplete: () => {
      // Optionnel: action supplémentaire à la fin
    },
  });
  const [rerunning, setRerunning] = useState(false);

  const handleRerun = async () => {
    if (!jobId) return;
    
    setRerunning(true);
    try {
      const result = await rerunJob(jobId);
      toast.success('Job relancé !', {
        description: `Nouveau job ${result.jobId.slice(0, 8)}...`,
      });
      navigate(`/jobs/${result.jobId}`);
    } catch (err) {
      toast.error('Erreur lors du rerun', {
        description: err instanceof Error ? err.message : 'Erreur inconnue',
      });
    } finally {
      setRerunning(false);
    }
  };

  const getStatusBadge = () => {
    if (!progress) return null;
    
    switch (progress.status) {
      case 'queued':
        return <Badge variant="secondary" className="gap-1 text-sm"><Clock className="h-3 w-3" /> En attente</Badge>;
      case 'running':
        return <Badge className="gap-1 text-sm bg-primary animate-pulse"><Loader2 className="h-3 w-3 animate-spin" /> En cours</Badge>;
      case 'completed':
        return <Badge className="gap-1 text-sm bg-green-600"><CheckCircle2 className="h-3 w-3" /> Terminé</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1 text-sm"><XCircle className="h-3 w-3" /> Échec</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/studio">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold">Console Job</h1>
              <p className="text-sm text-muted-foreground font-mono">
                {jobId?.slice(0, 8)}...
              </p>
            </div>
            {getStatusBadge()}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {progress?.status === 'completed' && (
            <Button 
              variant="default"
              onClick={() => navigate('/library')}
              className="gap-2"
            >
              <Library className="h-4 w-4" />
              Bibliothèque
            </Button>
          )}
          
          {(progress?.status === 'completed' || progress?.status === 'failed') && (
            <Button 
              variant="outline" 
              onClick={handleRerun}
              disabled={rerunning}
            >
              {rerunning ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Relancer
            </Button>
          )}
        </div>
      </div>

      {/* Console */}
      <JobConsole jobId={jobId || null} className="min-h-[400px]" />

      {/* Deliverables section when completed */}
      {progress?.status === 'completed' && progress.assets && progress.assets.length > 0 && (() => {
        const imageAssets = progress.assets.filter(a => a.type === 'image' || a.type === 'final');
        const carouselAssets = progress.assets.filter(a => a.type === 'carousel');
        const videoAssets = progress.assets.filter(a => a.type === 'video' || a.type === 'clip');
        
        return (
          <div className="rounded-lg border bg-card p-6 space-y-6">
            <h2 className="font-semibold">Livrables</h2>
            
            {/* Images */}
            {imageAssets.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Images ({imageAssets.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {imageAssets.map((asset, idx) => (
                    <a
                      key={idx}
                      href={asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-lg border overflow-hidden hover:border-primary transition-colors"
                    >
                      <img src={asset.url} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            
            {/* Carousels */}
            {carouselAssets.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Carrousels ({carouselAssets.length})
                </h3>
                <div className="space-y-4">
                  {carouselAssets.map((carousel, idx) => (
                    <div key={idx} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">
                          Carrousel {idx + 1} ({carousel.slideUrls?.length || 0} slides)
                        </span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {carousel.slideUrls?.map((slideUrl, slideIdx) => (
                          <a
                            key={slideIdx}
                            href={slideUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 w-16 h-20 rounded overflow-hidden border hover:border-primary transition-colors"
                          >
                            <img src={slideUrl} alt={`Slide ${slideIdx + 1}`} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Videos */}
            {videoAssets.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Vidéos ({videoAssets.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {videoAssets.map((asset, idx) => (
                    <a
                      key={idx}
                      href={asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-video rounded-lg border overflow-hidden hover:border-primary transition-colors"
                    >
                      <video src={asset.url} className="w-full h-full object-cover" muted />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
