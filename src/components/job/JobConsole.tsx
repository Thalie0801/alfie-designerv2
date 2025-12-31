/**
 * JobConsole - Console unifiée pour tous types de jobs
 * Remplace VideoJobConsole avec support de tous les step types
 */
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, XCircle, Clock, RefreshCw, Play, Image, Film, Music, Wand2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useJobProgress } from '@/hooks/useJobProgress';

interface JobConsoleProps {
  jobId: string | null;
  className?: string;
}

const STEP_LABELS: Record<string, string> = {
  // Video steps
  gen_keyframe: 'Génération image clé',
  animate_clip: 'Animation clip',
  voiceover: 'Voix-off',
  music: 'Musique',
  mix_audio: 'Mixage audio',
  concat_clips: 'Assemblage clips',
  // Image/Carousel steps
  gen_image: 'Génération image',
  gen_slide: 'Génération slide',
  plan_slides: 'Planification slides',
  assemble_carousel: 'Assemblage carrousel',
  // Campaign pack steps
  plan_script: 'Planification script',
  plan_assets: 'Planification assets',
  render_variant: 'Rendu variante',
  extract_thumbnails: 'Extraction miniatures',
  render_cover: 'Rendu couverture',
  // Common
  deliver: 'Livraison',
};

const STEP_ICONS: Record<string, typeof Image> = {
  gen_keyframe: Image,
  gen_image: Image,
  gen_slide: Image,
  animate_clip: Film,
  voiceover: Music,
  music: Music,
  mix_audio: Music,
  concat_clips: Film,
  plan_slides: Wand2,
  plan_script: Wand2,
  plan_assets: Wand2,
  assemble_carousel: Package,
  render_variant: Film,
  extract_thumbnails: Image,
  render_cover: Image,
  deliver: Package,
};

function StepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'queued':
      return <Play className="h-4 w-4 text-amber-500" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

export function JobConsole({ jobId, className }: JobConsoleProps) {
  const { progress, loading, error, refresh, retryStep } = useJobProgress(jobId);

  if (!jobId) {
    return (
      <div className={cn('rounded-lg border bg-card p-6 text-center', className)}>
        <p className="text-muted-foreground">Aucun job sélectionné</p>
      </div>
    );
  }

  if (loading && !progress) {
    return (
      <div className={cn('rounded-lg border bg-card p-6 flex items-center justify-center', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('rounded-lg border bg-card p-6', className)}>
        <p className="text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={refresh} className="mt-2">
          <RefreshCw className="h-4 w-4 mr-2" />
          Réessayer
        </Button>
      </div>
    );
  }

  if (!progress) return null;

  const kindLabels: Record<string, string> = {
    multi_clip_video: 'Vidéo Multi-Clips',
    campaign_pack: 'Pack Campagne',
    single_image: 'Image',
    carousel: 'Carrousel',
  };

  return (
    <div className={cn('rounded-lg border bg-card overflow-hidden', className)}>
      {/* Header */}
      <div className="p-4 border-b bg-muted/50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">
            {kindLabels[progress.kind] || 'Pipeline'}
          </h3>
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        
        <Progress value={progress.percentComplete} className="h-2" />
        
        <p className="text-sm text-muted-foreground mt-2">
          {progress.completedSteps}/{progress.totalSteps} étapes • {progress.percentComplete}%
        </p>
      </div>

      {/* Steps */}
      <ScrollArea className="h-64">
        <div className="p-4 space-y-2">
          {progress.steps.map((step) => {
            const StepIcon = STEP_ICONS[step.step_type] || Wand2;
            
            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-md transition-colors',
                  step.status === 'running' && 'bg-primary/10',
                  step.status === 'completed' && 'bg-green-500/10',
                  step.status === 'failed' && 'bg-destructive/10',
                  step.status === 'pending' && 'opacity-50'
                )}
              >
                <StepStatusIcon status={step.status} />
                
                <StepIcon className="h-4 w-4 text-muted-foreground" />
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    {STEP_LABELS[step.step_type] || step.step_type}
                  </p>
                  {step.error && (
                    <p className="text-xs text-destructive truncate">{step.error}</p>
                  )}
                  {step.ended_at && (
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(step.ended_at), { addSuffix: true, locale: fr })}
                    </p>
                  )}
                </div>

                {step.status === 'failed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => retryStep(step.id)}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Assets Gallery */}
      {progress.assets && progress.assets.length > 0 && (
        <div className="border-t">
          <div className="p-2 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">Assets générés</p>
          </div>
          <div className="p-2 flex flex-wrap gap-2">
            {progress.assets.map((asset, idx) => (
              <a 
                key={idx} 
                href={asset.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                {asset.type}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Job error */}
      {progress.error && (
        <div className="p-4 border-t bg-destructive/10">
          <p className="text-sm text-destructive font-medium">Erreur: {progress.error}</p>
        </div>
      )}
    </div>
  );
}
