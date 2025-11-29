import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useBrandKit } from '@/hooks/useBrandKit';
import { useAlfieIntent } from '@/hooks/useAlfieIntent';
import { GenerationError, triggerGenerationFromChat } from '@/lib/alfie/generation';
import { BrandSelector } from '@/components/BrandSelector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const RATIO_OPTIONS: Array<{ label: string; value: '1:1' | '4:5' | '9:16' }> = [
  { label: 'Carré 1:1', value: '1:1' },
  { label: 'Portrait 4:5', value: '4:5' },
  { label: 'Vertical 9:16', value: '9:16' },
];

const PLATFORM_OPTIONS: Array<{ label: string; value: 'instagram' | 'linkedin' | 'tiktok' }> = [
  { label: 'Instagram', value: 'instagram' },
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'TikTok', value: 'tiktok' },
];

export default function Creator() {
  const { user } = useAuth();
  const { activeBrandId } = useBrandKit();
  const { intent, setField, resetIntent } = useAlfieIntent({ brandId: activeBrandId ?? '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (activeBrandId && intent.brandId !== activeBrandId) {
      setField('brandId', activeBrandId);
    }
  }, [activeBrandId, intent.brandId, setField]);

  const formattedCount = useMemo(() => Math.max(1, Math.min(20, intent.count || 1)), [intent.count]);

  const handleCountChange = (value: string) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      setField('count', 1);
      return;
    }
    setField('count', Math.max(1, Math.min(20, parsed)));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user?.id) {
      toast.error('Vous devez être connecté pour lancer une génération.');
      return;
    }

    if (!intent.brandId) {
      toast.error('Sélectionnez une marque avant de lancer une génération.');
      return;
    }

    if (!intent.prompt?.trim() && !intent.topic?.trim()) {
      toast.error('Ajoutez un sujet ou une idée pour lancer la génération.');
      return;
    }

    setIsSubmitting(true);
    setLastOrderId(null);

    try {
      // Convert to full UnifiedAlfieIntent for API
      const payload = {
        id: `intent_${Date.now()}`,
        brandId: intent.brandId || '',
        kind: intent.kind || 'image',
        count: formattedCount,
        platform: intent.platform || 'instagram',
        ratio: intent.ratio || '4:5',
        title: intent.prompt || intent.topic || '',
        goal: intent.goal || 'engagement',
        tone: intent.tone || 'professionnel',
        prompt: intent.prompt || intent.topic || '',
      };
      const { orderId } = await triggerGenerationFromChat(user.id, payload as any);
      setLastOrderId(orderId);
      toast.success('Génération lancée !', {
        description: `Commande ${orderId} créée. Tu seras notifié dès que c'est prêt.`,
      });
      resetIntent();
    } catch (error) {
      if (error instanceof GenerationError && error.code === 'quota_exceeded') {
        const quotaMessage = "Tu as dépassé ton quota d'images pour ce mois. Réduis le nombre de visuels ou upgrade ton plan.";
        toast.error(quotaMessage);
      } else {
        toast.error(error instanceof Error ? error.message : 'Erreur lors de la génération.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const planName = 'Plan actuel';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Générateur visuel</h1>
          <p className="text-muted-foreground">
            Configure ton brief et déclenche une génération immédiate pour ta marque active.
          </p>
        </div>
        <BrandSelector />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Paramètres de génération</CardTitle>
          <CardDescription>
            Alfie produira automatiquement {formattedCount} {intent.kind === 'image' ? 'image(s)' : 'carrousel(s)'}
            à partir de ton sujet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="kind">Format</Label>
                <Select value={intent.kind} onValueChange={(value: 'image' | 'carousel') => setField('kind', value)}>
                  <SelectTrigger id="kind">
                    <SelectValue placeholder="Choisir un format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="carousel">Carrousel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="count">Nombre de visuels</Label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={20}
                  value={formattedCount}
                  onChange={(event) => handleCountChange(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Entre 1 et 20 visuels par commande.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ratio">Ratio</Label>
                <Select
                  value={intent.ratio ?? ''}
                  onValueChange={(value) => setField('ratio', value || '4:5')}
                >
                  <SelectTrigger id="ratio">
                    <SelectValue placeholder="Optionnel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Par défaut</SelectItem>
                    {RATIO_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform">Plateforme</Label>
                <Select
                  value={intent.platform ?? ''}
                  onValueChange={(value) => setField('platform', value || 'instagram')}
                >
                  <SelectTrigger id="platform">
                    <SelectValue placeholder="Optionnel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Toutes plateformes</SelectItem>
                    {PLATFORM_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Sujet</Label>
              <Textarea
                id="prompt"
                rows={4}
                placeholder="Décris le sujet, le ton ou les éléments à intégrer"
                value={intent.prompt || intent.topic || ''}
                onChange={(event) => {
                  setField('prompt', event.target.value);
                  setField('topic', event.target.value); // Legacy compatibility
                }}
              />
              <p className="text-xs text-muted-foreground">
                Indique le thème principal, des angles ou messages clés pour guider Alfie.
              </p>
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Génération en cours…' : 'Lancer la génération'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {lastOrderId && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Commande en file d'attente</p>
              <p className="text-lg font-semibold">Order #{lastOrderId}</p>
              <p className="text-sm text-muted-foreground">Plan : <Badge variant="outline">{planName}</Badge></p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" asChild>
                <Link to={`/studio?order=${lastOrderId}`}>Ouvrir dans Studio</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to={`/library?order=${lastOrderId}`}>Voir la bibliothèque</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
