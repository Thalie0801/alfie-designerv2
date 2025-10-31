import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Sparkles, Zap, DollarSign, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Provider {
  id: string;
  family: string;
  quality_score: number;
  avg_latency_s: number;
}

interface Render {
  id: string;
  modality: string;
  provider_id: string;
  render_url: string;
  brand_score: number | null;
  cost_woofs: number;
  created_at: string;
}

export default function AlfieStudio() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [modality, setModality] = useState<'image' | 'video'>('image');
  const [format, setFormat] = useState('1080x1080');
  const [duration, setDuration] = useState(10);
  const [quality, setQuality] = useState<'draft' | 'standard' | 'premium'>('standard');
  const [isGenerating, setIsGenerating] = useState(false);
  const [renders, setRenders] = useState<Render[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [quotaInfo, setQuotaInfo] = useState({ remaining: 0, total: 0 });
  const [decision, setDecision] = useState<any>(null);

  useEffect(() => {
    loadProviders();
    loadRenders();
    loadQuota();
  }, [user]);

  const loadProviders = async () => {
    const { data } = await supabase.from('providers').select('*').eq('enabled', true);
    if (data) setProviders(data as Provider[]);
  };

  const loadRenders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('media_generations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setRenders(data as Render[]);
  };

  const loadQuota = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('quota_videos, woofs_consumed_this_month')
      .eq('id', user.id)
      .single();
    if (data) {
      setQuotaInfo({
        total: data.quota_videos || 0,
        remaining: (data.quota_videos || 0) - (data.woofs_consumed_this_month || 0),
      });
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Entrez un prompt');
      return;
    }

    setIsGenerating(true);
    try {
      // 1. Sélectionner provider
      const { data: providerData, error: providerError } = await supabase.functions.invoke(
        'alfie-select-provider',
        {
          body: {
            brief: { use_case: 'ad', style: quality },
            modality,
            format,
            duration_s: duration,
            quality,
            budget_woofs: quotaInfo.remaining,
          },
        }
      );

      if (providerError) throw providerError;
      if (providerData.decision === 'KO') {
        toast.error('Impossible de générer', {
          description: providerData.suggestions?.join(', '),
        });
        setIsGenerating(false);
        return;
      }

      setDecision(providerData);

      // 2. Vérifier quota
      const { data: quotaCheck } = await supabase.functions.invoke('alfie-check-quota', {
        body: { cost_woofs: providerData.cost_woofs },
      });

      if (!quotaCheck?.ok) {
        toast.error('Quota insuffisant', {
          description: `Besoin de ${providerData.cost_woofs} woofs, reste ${quotaCheck?.remaining || 0}`,
        });
        setIsGenerating(false);
        return;
      }

      // 3. Consommer woofs
      await supabase.functions.invoke('alfie-consume-woofs', {
        body: {
          cost_woofs: providerData.cost_woofs,
          meta: { provider: providerData.provider, modality },
        },
      });

      // 4. Générer
      const endpoint = modality === 'image' ? 'alfie-render-image' : 'alfie-render-video';
      const { error: renderError } = await supabase.functions.invoke(endpoint, {
        body: {
          provider: selectedProvider || providerData.provider,
          prompt,
          format,
          duration_s: duration,
        },
      });

      if (renderError) {
        // Refund
        await supabase.functions.invoke('alfie-refund-woofs', {
          body: { amount: providerData.cost_woofs, meta: { reason: 'generation_failed' } },
        });
        throw renderError;
      }

      toast.success('Généré avec succès', {
        description: `Coût: ${providerData.cost_woofs} woofs`,
      });

      loadRenders();
      loadQuota();
    } catch (error: any) {
      console.error('Erreur génération:', error);
      toast.error('Erreur de génération', { description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Gauche - Chat */}
      <div className="w-1/4 border-r flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Alfie Studio
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Directeur Artistique IA</p>
        </div>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Type</label>
              <Select value={modality} onValueChange={(v: any) => setModality(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Vidéo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Format</label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1080x1080">1080x1080 (Carré)</SelectItem>
                  <SelectItem value="1080x1920">1080x1920 (Story)</SelectItem>
                  <SelectItem value="1920x1080">1920x1080 (Paysage)</SelectItem>
                  <SelectItem value="1200x628">1200x628 (FB/LinkedIn)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {modality === 'video' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Durée (secondes)</label>
                <Select value={duration.toString()} onValueChange={(v) => setDuration(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5s</SelectItem>
                    <SelectItem value="10">10s</SelectItem>
                    <SelectItem value="15">15s</SelectItem>
                    <SelectItem value="30">30s</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Qualité</label>
              <div className="flex gap-2">
                <Button
                  variant={quality === 'draft' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setQuality('draft')}
                >
                  Draft
                </Button>
                <Button
                  variant={quality === 'standard' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setQuality('standard')}
                >
                  Standard
                </Button>
                <Button
                  variant={quality === 'premium' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setQuality('premium')}
                >
                  Premium
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Prompt</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Décrivez votre création..."
                rows={6}
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Générer
                </>
              )}
            </Button>
          </div>
        </ScrollArea>
      </div>

      {/* Centre - Canvas */}
      <div className="flex-1 flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Rendus</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-6 grid grid-cols-2 lg:grid-cols-3 gap-4">
            {renders.map((render) => (
              <Card key={render.id} className="overflow-hidden">
                {render.modality === 'image' ? (
                  <img
                    src={render.render_url}
                    alt="Rendu"
                    className="w-full aspect-square object-cover"
                  />
                ) : (
                  <video
                    src={render.render_url}
                    className="w-full aspect-video object-cover"
                    controls
                  />
                )}
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <Badge variant="secondary">{render.provider_id}</Badge>
                    {render.brand_score && (
                      <span className="text-xs text-muted-foreground">Score: {render.brand_score}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <DollarSign className="w-3 h-3" />
                    {render.cost_woofs} woofs
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Droite - Production */}
      <div className="w-1/4 border-l flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Production</h2>
        </div>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            <Card className="p-4">
              <h3 className="font-medium mb-3">Quota Woofs</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Restant</span>
                  <span className="font-bold text-lg">{quotaInfo.remaining}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.max(0, (quotaInfo.remaining / quotaInfo.total) * 100)}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  {quotaInfo.remaining} / {quotaInfo.total}
                </div>
              </div>
            </Card>

            {decision && (
              <Card className="p-4">
                <h3 className="font-medium mb-3">Décision</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Moteur</span>
                    <Badge>{decision.provider}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Coût</span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {decision.cost_woofs} woofs
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">ETA</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ~{decision.eta_s}s
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Qualité</span>
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {Math.round(decision.quality_score * 100)}%
                    </span>
                  </div>
                </div>
              </Card>
            )}

            <Card className="p-4">
              <h3 className="font-medium mb-3">Override Moteur</h3>
              <Select
                value={selectedProvider || ''}
                onValueChange={(v) => setSelectedProvider(v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auto (recommandé)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Auto (recommandé)</SelectItem>
                  {providers
                    .filter((p) => p.family)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.id} ({p.family})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
