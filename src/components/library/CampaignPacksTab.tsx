import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, ExternalLink, Package, Image, Video, LayoutGrid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface CampaignPackJob {
  id: string;
  status: string;
  created_at: string;
  spec_json: {
    campaign_name?: string;
    image_count?: number;
    slides_count?: number;
    clip_count?: number;
  } | null;
  kind: string;
}

interface JobStep {
  id: string;
  step_type: string;
  status: string;
  output_json: {
    imageUrl?: string;
    slideUrl?: string;
    clipUrl?: string;
    deliveredUrl?: string;
  } | null;
}

interface Props {
  orderId?: string | null;
}

export function CampaignPacksTab({ orderId: _orderId }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<CampaignPackJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobSteps, setJobSteps] = useState<Record<string, JobStep[]>>({});
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    async function fetchJobs() {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('job_queue')
        .select('id, status, created_at, spec_json, kind')
        .eq('user_id', user!.id)
        .eq('kind', 'campaign_pack')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error('Failed to fetch campaign packs:', error);
        toast.error('Erreur lors du chargement');
      } else {
        setJobs((data || []) as CampaignPackJob[]);
      }
      
      setLoading(false);
    }
    
    fetchJobs();
  }, [user?.id]);

  const [jobCarousels, setJobCarousels] = useState<Record<string, Array<{ carouselId: string; slideUrls: string[] }>>>({});

  const fetchJobSteps = async (jobId: string) => {
    if (jobSteps[jobId]) {
      setExpandedJob(expandedJob === jobId ? null : jobId);
      return;
    }
    
    // Fetch job steps
    const { data: stepsData, error } = await supabase
      .from('job_steps')
      .select('id, step_type, status, output_json, input_json')
      .eq('job_id', jobId)
      .order('step_index', { ascending: true });
    
    if (!error && stepsData) {
      setJobSteps(prev => ({ ...prev, [jobId]: stepsData as JobStep[] }));
      
      // ✅ FIXED: Fetch carousels by order_id = jobId (most reliable method)
      const { data: slidesData } = await supabase
        .from('library_assets')
        .select('cloudinary_url, carousel_id, slide_index')
        .eq('order_id', jobId)
        .eq('type', 'carousel_slide')
        .not('carousel_id', 'is', null)
        .order('carousel_id')
        .order('slide_index', { ascending: true });
      
      if (slidesData && slidesData.length > 0) {
        const carouselMap = new Map<string, string[]>();
        for (const slide of slidesData) {
          if (!slide.carousel_id) continue;
          if (!carouselMap.has(slide.carousel_id)) {
            carouselMap.set(slide.carousel_id, []);
          }
          carouselMap.get(slide.carousel_id)!.push(slide.cloudinary_url);
        }
        
        const carousels = Array.from(carouselMap.entries()).map(([carouselId, slideUrls]) => ({
          carouselId,
          slideUrls,
        }));
        
        setJobCarousels(prev => ({ ...prev, [jobId]: carousels }));
        console.log(`[CampaignPacksTab] Found ${carousels.length} carousels for job ${jobId}`);
      }
    }
    
    setExpandedJob(expandedJob === jobId ? null : jobId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Terminé</Badge>;
      case 'running':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse">En cours</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Échec</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground">En attente</Badge>;
    }
  };

  const getAssetUrls = (steps: JobStep[]) => {
    const assets: { type: string; url: string }[] = [];
    
    for (const step of steps) {
      if (step.status === 'completed' && step.output_json) {
        if (step.output_json.imageUrl) assets.push({ type: 'image', url: step.output_json.imageUrl });
        if (step.output_json.slideUrl) assets.push({ type: 'slide', url: step.output_json.slideUrl });
        if (step.output_json.clipUrl) assets.push({ type: 'video', url: step.output_json.clipUrl });
        if (step.output_json.deliveredUrl) assets.push({ type: 'final', url: step.output_json.deliveredUrl });
      }
    }
    
    return assets;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Aucun Pack Campagne pour l'instant.</p>
        <p className="text-sm">Créez-en un depuis Studio Multi → Pack Campagne</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {jobs.map(job => {
        const spec = job.spec_json || {};
        const steps = jobSteps[job.id] || [];
        const assets = getAssetUrls(steps);
        const isExpanded = expandedJob === job.id;
        
        return (
          <Card key={job.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium truncate">
                  {spec.campaign_name || 'Pack Campagne'}
                </CardTitle>
                {getStatusBadge(job.status)}
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(job.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {/* Specs */}
              <div className="flex gap-3 text-sm text-muted-foreground">
                {spec.image_count ? (
                  <span className="flex items-center gap-1">
                    <Image className="h-4 w-4" />
                    {spec.image_count} images
                  </span>
                ) : null}
                {spec.slides_count ? (
                  <span className="flex items-center gap-1">
                    <LayoutGrid className="h-4 w-4" />
                    {spec.slides_count} slides
                  </span>
                ) : null}
                {spec.clip_count ? (
                  <span className="flex items-center gap-1">
                    <Video className="h-4 w-4" />
                    {spec.clip_count} clips
                  </span>
                ) : null}
              </div>
              
              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchJobSteps(job.id)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {isExpanded ? 'Masquer' : 'Voir assets'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/jobs/${job.id}`)}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Console
                </Button>
              </div>
              
              {/* Expanded assets */}
              {isExpanded && (steps.length > 0 || (jobCarousels[job.id] && jobCarousels[job.id].length > 0)) && (
                <div className="pt-3 border-t space-y-4">
                  {/* Images */}
                  {assets.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-2">Images ({assets.length})</p>
                      <div className="grid grid-cols-3 gap-2">
                        {assets.slice(0, 6).map((asset, i) => (
                          <a
                            key={i}
                            href={asset.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="aspect-square rounded overflow-hidden bg-muted hover:opacity-80 transition-opacity"
                          >
                            {asset.type === 'video' ? (
                              <video src={asset.url} className="w-full h-full object-cover" muted />
                            ) : (
                              <img src={asset.url} alt={asset.type} className="w-full h-full object-cover" />
                            )}
                          </a>
                        ))}
                        {assets.length > 6 && (
                          <div className="aspect-square rounded bg-muted flex items-center justify-center text-sm text-muted-foreground">
                            +{assets.length - 6}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Carousels */}
                  {jobCarousels[job.id] && jobCarousels[job.id].length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-2">Carrousels ({jobCarousels[job.id].length})</p>
                      <div className="space-y-3">
                        {jobCarousels[job.id].map((carousel, i) => (
                          <div key={carousel.carouselId} className="rounded border p-2">
                            <p className="text-xs text-muted-foreground mb-2">
                              Carrousel {i + 1} ({carousel.slideUrls.length} slides)
                            </p>
                            <div className="flex gap-1 overflow-x-auto pb-1">
                              {carousel.slideUrls.map((url, slideIdx) => (
                                <a
                                  key={slideIdx}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-shrink-0 w-10 h-12 rounded overflow-hidden hover:opacity-80 transition-opacity"
                                >
                                  <img src={url} alt={`Slide ${slideIdx + 1}`} className="w-full h-full object-cover" />
                                </a>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
