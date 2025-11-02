import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Download, ExternalLink, Copy, CheckCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface CarouselDeliveryProps {
  jobSetId: string;
}

export function CarouselDelivery({ jobSetId }: CarouselDeliveryProps) {
  const [jobSet, setJobSet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadJobSet();
  }, [jobSetId]);

  const loadJobSet = async () => {
    try {
      const { data, error } = await supabase
        .from('job_sets')
        .select(`
          *,
          jobs:jobs(*)
        `)
        .eq('id', jobSetId)
        .single();

      if (error) throw error;
      setJobSet(data);
    } catch (error) {
      console.error('Error loading jobSet:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const copyCaption = async () => {
    if (!jobSet?.metadata?.caption) return;
    
    try {
      await navigator.clipboard.writeText(jobSet.metadata.caption);
      setCopied(true);
      toast.success('Caption copiée !');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Erreur lors de la copie');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="aspect-[4/5] rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!jobSet) return null;

  const jobs = jobSet.jobs || [];
  const metadata = jobSet.metadata || {};

  return (
    <Card>
      <CardHeader>
        <CardTitle>✅ Carrousel prêt !</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Galerie des slides */}
        <div className="grid grid-cols-3 gap-3">
          {jobs.map((job: any, idx: number) => (
            <div key={job.id} className="relative group">
              <img
                src={job.output_url}
                alt={job.metadata?.altText || `Slide ${idx + 1}`}
                className="w-full rounded-lg border shadow-sm"
              />
              <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
                {idx + 1}
              </div>
            </div>
          ))}
        </div>

        {/* Actions de téléchargement */}
        <div className="flex flex-wrap gap-2">
          {metadata.zipUrl && (
            <Button asChild variant="default">
              <a href={metadata.zipUrl} download>
                <Download className="h-4 w-4 mr-2" />
                Télécharger ZIP
              </a>
            </Button>
          )}
          
          {metadata.pdfUrl && (
            <Button asChild variant="outline">
              <a href={metadata.pdfUrl} download>
                <Download className="h-4 w-4 mr-2" />
                PDF LinkedIn
              </a>
            </Button>
          )}
          
          {metadata.canvaUrl && (
            <Button asChild variant="outline">
              <a href={metadata.canvaUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Ouvrir dans Canva
              </a>
            </Button>
          )}
        </div>

        {/* Caption prête à publier */}
        {metadata.caption && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Caption (prête à publier)</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={copyCaption}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <CheckCheck className="h-4 w-4" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copier
                  </>
                )}
              </Button>
            </div>
            <Textarea
              readOnly
              value={metadata.caption}
              rows={8}
              className="font-mono text-sm"
            />
          </div>
        )}

        {/* Alt-texts (accessibilité) */}
        {jobs.length > 0 && jobs.some((j: any) => j.metadata?.altText) && (
          <Accordion type="single" collapsible>
            <AccordionItem value="alts">
              <AccordionTrigger>
                Alt-texts (accessibilité)
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {jobs.map((job: any, i: number) => (
                    job.metadata?.altText && (
                      <div key={job.id} className="space-y-1">
                        <strong className="text-sm">Slide {i + 1}:</strong>
                        <code className="block text-xs bg-muted p-2 rounded">
                          {job.metadata.altText}
                        </code>
                      </div>
                    )
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
