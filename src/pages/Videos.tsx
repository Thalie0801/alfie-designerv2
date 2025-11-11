import { useState, useEffect } from 'react';
import { AppLayoutWithSidebar } from '@/components/AppLayoutWithSidebar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useVideoQuota } from '@/hooks/useVideoQuota';
import { Video, Upload, Download, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { woofsForVideo } from '@/lib/woofs';

const VIDEO_TEMPLATES = [
  { id: 'promo', name: 'Promo rapide', description: 'Texte, fade, CTA' },
  { id: 'lookbook', name: 'Lookbook', description: 'Présentation produits' },
  { id: 'ugc', name: 'UGC vertical', description: 'Format Stories' }
];

const DURATION_VALUES = [8, 15, 30, 60] as const;

const DURATIONS = DURATION_VALUES.map((value) => ({
  value,
  label: `${value} secondes`,
  woofs: woofsForVideo(value),
}));

export default function Videos() {
  const { user } = useAuth();
  const { quota, loading: quotaLoading, refetch } = useVideoQuota();
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState<number>(8);
  const [template, setTemplate] = useState('promo');
  const [ratio, setRatio] = useState('16:9');
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(true);

  const woofsNeeded = woofsForVideo(duration);
  const canGenerate = quota && quota.woofsRemaining >= woofsNeeded;

  useEffect(() => {
    if (user) {
      loadVideos();
    }
  }, [user]);

  const loadVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (error: any) {
      console.error('Error loading videos:', error);
      toast.error('Erreur lors du chargement des vidéos');
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleCreateVideo = async () => {
    if (!title.trim()) {
      toast.error('Veuillez entrer un titre');
      return;
    }

    if (selectedAssets.length === 0) {
      toast.error('Veuillez sélectionner au moins une image');
      return;
    }

    if (!canGenerate) {
      toast.error(`Woofs insuffisants. Vous avez besoin de ${woofsNeeded} Woofs`);
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.functions.invoke('create-video', {
        body: {
          title,
          duration,
          ratio,
          template_id: template,
          assets: selectedAssets
        }
      });

      if (error) throw error;

      toast.success('Génération vidéo lancée !');
      setTitle('');
      setSelectedAssets([]);
      await refetch();
      await loadVideos();
    } catch (error: any) {
      console.error('Error creating video:', error);
      toast.error(error.message || 'Erreur lors de la création de la vidéo');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      queued: 'secondary',
      rendering: 'default',
      completed: 'success',
      failed: 'destructive'
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  return (
    <AppLayoutWithSidebar>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Génération de Vidéos</h1>
            <p className="text-muted-foreground">Créez des vidéos courtes à partir de vos visuels</p>
          </div>
          {!quotaLoading && quota && (
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Woofs restants</div>
              <div className="text-2xl font-bold">{quota.woofsRemaining} / {quota.woofsTotal}</div>
            </Card>
          )}
        </div>

        {!quotaLoading && quota && quota.woofsRemaining < woofsNeeded && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Vous n'avez pas assez de Woofs pour créer une vidéo de {duration}s (besoin de {woofsNeeded} Woofs).
              Veuillez acheter un pack de Woofs ou choisir une durée plus courte.
            </AlertDescription>
          </Alert>
        )}

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Nouvelle vidéo</h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Titre de la vidéo</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ma nouvelle vidéo"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Durée</Label>
                <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map(d => (
                      <SelectItem key={d.value} value={d.value.toString()}>
                        {d.label} ({d.woofs} Woof{d.woofs > 1 ? 's' : ''})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Format</Label>
                <Select value={ratio} onValueChange={setRatio}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9 (Paysage)</SelectItem>
                    <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                    <SelectItem value="1:1">1:1 (Carré)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Template</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_TEMPLATES.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} - {t.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Images (placeholder - à implémenter)</Label>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Sélectionnez 3-6 images depuis votre bibliothèque
                </p>
              </div>
            </div>

            <span className="text-xs text-muted-foreground">
              Coût estimé : {woofsNeeded} Woof{woofsNeeded > 1 ? 's' : ''}
            </span>

            <Button
              onClick={handleCreateVideo}
              disabled={loading || !canGenerate}
              className="w-full"
            >
              <Video className="mr-2 h-4 w-4" />
              {loading ? 'Génération en cours...' : `Générer (${woofsNeeded} Woof${woofsNeeded > 1 ? 's' : ''})`}
            </Button>
          </div>
        </Card>

        <div>
          <h2 className="text-xl font-semibold mb-4">Historique des vidéos</h2>
          
          {loadingVideos ? (
            <div className="text-center py-8">Chargement...</div>
          ) : videos.length === 0 ? (
            <Card className="p-8 text-center">
              <Video className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Aucune vidéo générée pour le moment</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {videos.map((video) => (
                <Card key={video.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{video.title}</h3>
                        {getStatusBadge(video.status)}
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {video.duration}s
                        </span>
                        <span>{video.ratio}</span>
                        <span>{video.woofs_cost} Woof{video.woofs_cost > 1 ? 's' : ''}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Créée le {new Date(video.created_at).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                    
                    {video.status === 'completed' && video.video_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={video.video_url} download>
                          <Download className="h-4 w-4 mr-2" />
                          Télécharger
                        </a>
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayoutWithSidebar>
  );
}