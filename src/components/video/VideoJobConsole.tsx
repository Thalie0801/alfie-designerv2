import { useVideoJobEvents, JobStep } from '@/hooks/useVideoJobEvents';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, XCircle, Clock, RefreshCw, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface VideoJobConsoleProps {
  jobId: string | null;
  className?: string;
}

const STEP_LABELS: Record<string, string> = {
  gen_keyframe: 'Génération image clé',
  animate_clip: 'Animation clip',
  voiceover: 'Voix-off',
  music: 'Musique',
  mix_audio: 'Mixage audio',
  concat_clips: 'Assemblage clips',
  deliver: 'Livraison',
};

function StepStatusIcon({ status }: { status: JobStep['status'] }) {
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

export function VideoJobConsole({ jobId, className }: VideoJobConsoleProps) {
  const { progress, loading, error, refresh, retryStep } = useVideoJobEvents(jobId);

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

  return (
    <div className={cn('rounded-lg border bg-card overflow-hidden', className)}>
      {/* Header */}
      <div className="p-4 border-b bg-muted/50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Pipeline Vidéo</h3>
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
          {progress.steps.map((step) => (
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
          ))}
        </div>
      </ScrollArea>

      {/* Events log */}
      {progress.events.length > 0 && (
        <div className="border-t">
          <div className="p-2 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">Événements récents</p>
          </div>
          <ScrollArea className="h-32">
            <div className="p-2 space-y-1">
              {progress.events.slice(0, 10).map((event) => (
                <div key={event.id} className="text-xs font-mono text-muted-foreground">
                  <span className="text-foreground/70">{event.event_type}</span>
                  {event.message && <span className="ml-2">{event.message}</span>}
                </div>
              ))}
            </div>
          </ScrollArea>
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
