import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, X, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export type JobStatus =
  | 'queued'
  | 'running'
  | 'processing'
  | 'checking'
  | 'ready'
  | 'completed'
  | 'failed'
  | 'canceled';

interface JobPlaceholderProps {
  jobId: string;
  shortId?: string;
  status: JobStatus;
  progress?: number;
  type: 'image' | 'video';
  onCancel?: () => void;
}

const statusConfig: Record<JobStatus, {
  icon: typeof Loader2;
  label: string;
  color: string;
  bgColor: string;
}> = {
  queued: {
    icon: Clock,
    label: 'En file',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted'
  },
  running: {
    icon: Loader2,
    label: 'En génération',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950'
  },
  processing: {
    icon: Loader2,
    label: 'En génération',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950'
  },
  checking: {
    icon: Loader2,
    label: 'Vérification',
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-950'
  },
  ready: {
    icon: CheckCircle2,
    label: 'Prête',
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950'
  },
  completed: {
    icon: CheckCircle2,
    label: 'Prête',
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950'
  },
  failed: {
    icon: AlertCircle,
    label: 'Échec',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10'
  },
  canceled: {
    icon: X,
    label: 'Annulé',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted'
  }
};

export function JobPlaceholder({
  jobId,
  shortId,
  status,
  progress = 0,
  type,
  onCancel
}: JobPlaceholderProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const isActive = status === 'running' || status === 'processing' || status === 'checking';
  const canCancel = status === 'queued' || status === 'running' || status === 'processing';
  const displayShortId = shortId || `${jobId.slice(0, 4).toUpperCase()}…${jobId.slice(-4).toUpperCase()}`;

  return (
    <Card className={`${config.bgColor} border-2`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon 
              className={`h-5 w-5 ${config.color} ${isActive ? 'animate-spin' : ''}`} 
            />
            {type === 'video' ? 'Vidéo' : 'Image'} en cours…
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {displayShortId}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Status */}
        <div className="flex items-center gap-2">
          <Badge className={config.color}>
            {config.label}
          </Badge>
        </div>

        {/* Progress bar */}
        {isActive && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progression</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Long running message */}
        {(status === 'running' || status === 'processing') && progress === 0 && (
          <p className="text-xs text-muted-foreground">
            ⏳ Génération en cours, cela peut prendre quelques minutes...
          </p>
        )}

        {/* Actions */}
        {canCancel && onCancel && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onCancel}
            className="w-full"
          >
            <X className="h-4 w-4 mr-2" />
            Annuler
          </Button>
        )}

        {/* Retry button for failed */}
        {status === 'failed' && (
          <div className="space-y-2">
            <p className="text-xs text-destructive">
              La génération a échoué. Réessayez ou contactez le support si le problème persiste.
            </p>
            <Button variant="outline" size="sm" className="w-full">
              Re-générer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
