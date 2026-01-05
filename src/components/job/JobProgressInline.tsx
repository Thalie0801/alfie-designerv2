/**
 * JobProgressInline - Composant compact de suivi de progression inline
 * Affiche la progression en temps réel sans redirection
 */
import { useJobProgress } from '@/hooks/useJobProgress';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, Clock, ExternalLink, X, Library } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface JobProgressInlineProps {
  jobId: string;
  onClose?: () => void;
  onComplete?: () => void;
}

export function JobProgressInline({ jobId, onClose, onComplete }: JobProgressInlineProps) {
  const navigate = useNavigate();
  const { progress, loading, error } = useJobProgress(jobId);
  const previousStatusRef = useRef<string | null>(null);

  // Notifier quand le job se termine
  useEffect(() => {
    if (!progress) return;
    
    const prevStatus = previousStatusRef.current;
    const currentStatus = progress.status;
    
    // Détecter le changement de status vers completed ou failed
    if (prevStatus && prevStatus !== currentStatus) {
      if (currentStatus === 'completed') {
        toast.success('Génération terminée ! 🎉', {
          description: 'Ton contenu est prêt',
          duration: 10000,
          action: {
            label: 'Voir',
            onClick: () => navigate('/library'),
          },
        });
        onComplete?.();
      } else if (currentStatus === 'failed') {
        toast.error('Génération échouée', {
          description: progress.error || 'Une erreur est survenue',
          duration: 10000,
        });
      }
    }
    
    previousStatusRef.current = currentStatus;
  }, [progress?.status, navigate, onComplete, progress?.error]);

  if (loading && !progress) {
    return (
      <Card className="border-primary/20 bg-card/50 backdrop-blur">
        <CardContent className="py-6 flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-muted-foreground">Chargement...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !progress) {
    return (
      <Card className="border-destructive/20 bg-destructive/5">
        <CardContent className="py-6 flex items-center justify-between">
          <span className="text-destructive">{error || 'Erreur de chargement'}</span>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const isRunning = progress.status === 'running' || progress.status === 'queued';
  const isCompleted = progress.status === 'completed';
  const isFailed = progress.status === 'failed';

  const getStatusBadge = () => {
    switch (progress.status) {
      case 'queued':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> En attente</Badge>;
      case 'running':
        return <Badge className="gap-1 bg-primary animate-pulse"><Loader2 className="h-3 w-3 animate-spin" /> En cours</Badge>;
      case 'completed':
        return <Badge className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> Terminé</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Échec</Badge>;
      default:
        return <Badge variant="secondary">{progress.status}</Badge>;
    }
  };

  const currentStep = progress.steps.find(s => s.status === 'running');

  return (
    <Card className={cn(
      "border-primary/20 transition-all duration-300",
      isCompleted && "border-green-500/30 bg-green-500/5",
      isFailed && "border-destructive/30 bg-destructive/5"
    )}>
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <CardTitle className="text-sm font-medium">
            Job en cours
          </CardTitle>
          {getStatusBadge()}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => navigate(`/jobs/${jobId}`)}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Détails
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="py-3 px-4 space-y-3">
        {/* Barre de progression */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {isRunning && currentStep ? (
                <span className="text-foreground">{formatStepType(currentStep.step_type)}</span>
              ) : (
                `${progress.completedSteps}/${progress.totalSteps} étapes`
              )}
            </span>
            <span className="font-mono">{progress.percentComplete}%</span>
          </div>
          <Progress 
            value={progress.percentComplete} 
            className={cn(
              "h-2",
              isCompleted && "[&>div]:bg-green-500",
              isFailed && "[&>div]:bg-destructive"
            )}
          />
        </div>

        {/* Liste des étapes récentes */}
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {progress.steps.slice(0, 5).map((step) => (
            <div 
              key={step.id} 
              className={cn(
                "flex items-center gap-2 text-xs py-0.5",
                step.status === 'running' && "text-primary font-medium",
                step.status === 'completed' && "text-green-600",
                step.status === 'failed' && "text-destructive",
                step.status === 'pending' && "text-muted-foreground"
              )}
            >
              {step.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
              {step.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
              {step.status === 'failed' && <XCircle className="h-3 w-3" />}
              {step.status === 'pending' && <Clock className="h-3 w-3" />}
              {step.status === 'queued' && <Clock className="h-3 w-3" />}
              <span>{formatStepType(step.step_type)}</span>
            </div>
          ))}
        </div>

        {/* Erreur */}
        {isFailed && progress.error && (
          <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
            {progress.error}
          </p>
        )}

        {/* Actions terminé */}
        {isCompleted && (
          <Button 
            size="sm" 
            className="w-full gap-2"
            onClick={() => navigate('/library')}
          >
            <Library className="h-4 w-4" />
            Voir dans la bibliothèque
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function formatStepType(stepType: string): string {
  const labels: Record<string, string> = {
    plan_script: 'Planification du script',
    plan_slides: 'Planification des slides',
    plan_images: 'Planification des images',
    gen_keyframe: 'Génération keyframe',
    gen_image: 'Génération image',
    gen_slide: 'Génération slide',
    animate_clip: 'Animation clip',
    generate_voiceover: 'Génération voix',
    generate_music: 'Génération musique',
    concatenate: 'Assemblage vidéo',
    assemble_carousel: 'Assemblage carrousel',
    mix_audio: 'Mixage audio',
    render_variant: 'Rendu variante',
    extract_thumbnails: 'Extraction thumbnails',
    deliver: 'Livraison',
  };
  return labels[stepType] || stepType.replace(/_/g, ' ');
}
