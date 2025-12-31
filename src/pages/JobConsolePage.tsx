/**
 * JobConsolePage - Page dédiée au suivi d'un job
 */
import { useParams, Link } from 'react-router-dom';
import { JobConsole } from '@/components/job/JobConsole';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useJobProgress } from '@/hooks/useJobProgress';
import { rerunJob } from '@/lib/jobClient';
import { useState } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function JobConsolePage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { progress } = useJobProgress(jobId || null);
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
          <div>
            <h1 className="text-2xl font-bold">Console Job</h1>
            <p className="text-sm text-muted-foreground font-mono">
              {jobId?.slice(0, 8)}...
            </p>
          </div>
        </div>

        {progress?.status === 'completed' || progress?.status === 'failed' ? (
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
        ) : null}
      </div>

      {/* Console */}
      <JobConsole jobId={jobId || null} className="min-h-[400px]" />

      {/* Deliverables section when completed */}
      {progress?.status === 'completed' && progress.assets && progress.assets.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-4">Livrables</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {progress.assets.map((asset, idx) => (
              <a
                key={idx}
                href={asset.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-lg border hover:border-primary transition-colors text-center"
              >
                <p className="font-medium capitalize">{asset.type}</p>
                <p className="text-xs text-muted-foreground mt-1">Télécharger</p>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
