/**
 * MiniFilmsTab - Displays multi-clip video jobs from the Job Engine
 * Shows jobs with kind = 'multi_clip_video' and their progress/deliverables
 */
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Download, Play, Eye, Film, Clock, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface MiniFilmJob {
  id: string;
  status: string;
  created_at: string;
  finished_at: string | null;
  spec_json: {
    campaign_name?: string;
    clip_count?: number;
    script?: string;
    ratio_master?: string;
  };
  error: string | null;
}

interface JobStep {
  id: string;
  job_id: string;
  step_type: string;
  step_index: number;
  status: string;
  output_json: unknown;
}

interface Delivery {
  id: string;
  job_id: string;
  type: string;
  url: string | null;
  status: string | null;
}

interface MiniFilmWithDetails extends MiniFilmJob {
  steps: JobStep[];
  deliveries: Delivery[];
}

export function MiniFilmsTab({ orderId: _orderId }: { orderId?: string | null }) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<MiniFilmWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const fetchJobs = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // Fetch jobs with kind = 'multi_clip_video'
      const { data: jobsData, error: jobsError } = await supabase
        .from('job_queue')
        .select('id, status, created_at, finished_at, spec_json, error')
        .eq('user_id', user.id)
        .eq('kind', 'multi_clip_video')
        .order('created_at', { ascending: false })
        .limit(50);

      if (jobsError) throw jobsError;

      if (!jobsData || jobsData.length === 0) {
        setJobs([]);
        setLoading(false);
        return;
      }

      // Fetch steps for all jobs
      const jobIds = jobsData.map(j => j.id);
      const { data: stepsData } = await supabase
        .from('job_steps')
        .select('id, job_id, step_type, step_index, status, output_json')
        .in('job_id', jobIds)
        .order('step_index', { ascending: true });

      // Fetch deliveries for all jobs
      const { data: deliveriesData } = await supabase
        .from('deliveries')
        .select('id, job_id, type, url, status')
        .in('job_id', jobIds);

      // Combine data
      const jobsWithDetails: MiniFilmWithDetails[] = jobsData.map(job => ({
        ...job,
        spec_json: job.spec_json as MiniFilmJob['spec_json'],
        steps: (stepsData || []).filter(s => s.job_id === job.id),
        deliveries: (deliveriesData || []).filter(d => d.job_id === job.id),
      }));

      setJobs(jobsWithDetails);
    } catch (error) {
      console.error('[MiniFilmsTab] Error fetching jobs:', error);
      toast.error('Erreur lors du chargement des mini-films');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    
    // Subscribe to real-time updates
    if (!user?.id) return;
    
    const channel = supabase
      .channel('mini-films-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_queue',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Terminé</Badge>;
      case 'running':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> En cours</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Échoué</Badge>;
      case 'queued':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> En attente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getProgress = (steps: JobStep[]): number => {
    if (steps.length === 0) return 0;
    const completed = steps.filter(s => s.status === 'completed').length;
    return Math.round((completed / steps.length) * 100);
  };

  const getMainVideoUrl = (job: MiniFilmWithDetails): string | null => {
    // First check deliveries
    const masterDelivery = job.deliveries.find(d => d.type === 'master_9x16' && d.url);
    if (masterDelivery?.url) return masterDelivery.url;

    // Then check step outputs for mixed or final video
    const mixStep = job.steps.find(s => s.step_type === 'mix_audio' && s.status === 'completed');
    const mixOutput = mixStep?.output_json as Record<string, unknown> | null;
    if (mixOutput?.mixedVideoUrl) return mixOutput.mixedVideoUrl as string;

    const concatStep = job.steps.find(s => s.step_type === 'concat_clips' && s.status === 'completed');
    const concatOutput = concatStep?.output_json as Record<string, unknown> | null;
    if (concatOutput?.finalVideoUrl) return concatOutput.finalVideoUrl as string;

    const deliverStep = job.steps.find(s => s.step_type === 'deliver' && s.status === 'completed');
    const deliverOutput = deliverStep?.output_json as Record<string, unknown> | null;
    if (deliverOutput?.finalVideoUrl) return deliverOutput.finalVideoUrl as string;

    return null;
  };

  const handleDownload = async (url: string, jobName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${jobName || 'mini-film'}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast.success('Téléchargement lancé');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-lg" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Film className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="font-medium">Aucun mini-film pour l'instant</p>
        <p className="text-sm mt-1">Créez un mini-film depuis le Studio Multi</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Refresh button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchJobs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Jobs grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {jobs.map((job) => {
          const videoUrl = getMainVideoUrl(job);
          const progress = getProgress(job.steps);
          const campaignName = job.spec_json?.campaign_name || 'Mini-Film';
          const clipCount = job.spec_json?.clip_count || 0;

          return (
            <Card key={job.id} className="overflow-hidden">
              {/* Video preview or placeholder */}
              <div className="relative aspect-[9/16] bg-muted">
                {videoUrl ? (
                  <>
                    {selectedVideo === job.id ? (
                      <video
                        src={videoUrl}
                        controls
                        autoPlay
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center cursor-pointer group"
                           onClick={() => setSelectedVideo(job.id)}>
                        <video
                          src={videoUrl}
                          className="w-full h-full object-cover"
                          muted
                        />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                          <Play className="h-12 w-12 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {job.status === 'running' ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <p className="text-sm text-muted-foreground">Génération en cours...</p>
                        <Progress value={progress} className="w-3/4 mt-2" />
                        <p className="text-xs text-muted-foreground mt-1">{progress}%</p>
                      </>
                    ) : job.status === 'failed' ? (
                      <>
                        <XCircle className="h-8 w-8 text-destructive mb-2" />
                        <p className="text-sm text-destructive">Échec de la génération</p>
                        {job.error && (
                          <p className="text-xs text-muted-foreground mt-1 px-4 text-center">{job.error}</p>
                        )}
                      </>
                    ) : (
                      <>
                        <Clock className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">En attente</p>
                      </>
                    )}
                  </div>
                )}

                {/* Status badge */}
                <div className="absolute top-2 right-2">
                  {getStatusBadge(job.status)}
                </div>
              </div>

              {/* Info */}
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm truncate">{campaignName}</h3>
                  <Badge variant="outline" className="text-xs">
                    {clipCount} clips
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground">
                  {format(new Date(job.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                </p>

                {/* Actions */}
                {videoUrl && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedVideo(selectedVideo === job.id ? null : job.id)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      {selectedVideo === job.id ? 'Fermer' : 'Voir'}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleDownload(videoUrl, campaignName)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Télécharger
                    </Button>
                  </div>
                )}

                {/* Deliverables count */}
                {job.deliveries.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      {job.deliveries.filter(d => d.url).length} fichier(s) disponible(s)
                    </p>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
