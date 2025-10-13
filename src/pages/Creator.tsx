import { useEffect, useMemo, useRef, useState } from 'react';
import { AlfieChat, type AlfieChatHandle } from '@/components/AlfieChat';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, PenSquare, Presentation, Rocket, Wand2, Timer, Palette, BarChart3, Flame } from 'lucide-react';
import { useBrandKit } from '@/hooks/useBrandKit';
import { getQuotaStatus, type QuotaStatus } from '@/utils/quotaManager';

type FormatOption = 'carousel' | 'hero' | 'reel' | 'insight';
type ToneOption = 'dynamique' | 'expert' | 'fun';
type GoalOption = 'conversion' | 'engagement' | 'prelaunch';
type ChannelOption = 'linkedin' | 'instagram' | 'tiktok';

type QuickIdea = {
  title: string;
  description: string;
  prompt: string;
  autoSend?: boolean;
};

type TrendingPrompt = {
  title: string;
  prompt: string;
  tags: string[];
};

const QUICK_IDEAS: QuickIdea[] = [
  {
    title: 'Carrousel éducatif',
    description: '5 slides pour expliquer une méthode ou un framework.',
    prompt:
      "Prépare un carrousel LinkedIn de 5 slides sur {{ton sujet}}. Slide 1 accroche forte, slides 2-4 contenu éducatif, slide 5 appel à l'action. Ton dynamique, style premium, adapte à mon Brand Kit.",
    autoSend: true
  },
  {
    title: 'Annonce de lancement',
    description: 'Hero + copy pour teaser une nouveauté.',
    prompt:
      "Crée un visuel Hero pour annoncer {{ton offre}}. Inclure un titre impactant, bénéfice principal, CTA clair. Prévois aussi la caption LinkedIn associée.",
    autoSend: false
  },
  {
    title: 'Script Reels',
    description: 'Idées de scènes + hook pour une vidéo verticale 30s.',
    prompt:
      "Génère un script de Reel TikTok (30s) sur {{ton message clé}}. Détaille hook, étapes, CTA final. Ajoute des idées de transitions visuelles adaptées à mon branding.",
    autoSend: true
  }
];

const TRENDING_PROMPTS: TrendingPrompt[] = [
  {
    title: 'Plan éditorial 7 jours',
    prompt:
      "Élabore un planning de contenu sur 7 jours pour {{ton produit}}. Inclure format, angle, CTA, et suggestion de visuel pour chaque jour.",
    tags: ['Planning', 'Stratégie']
  },
  {
    title: 'Stat LinkedIn illustrée',
    prompt:
      "Trouve une statistique clé sur {{ton sujet}} et propose un visuel insight (format carré) + copy LinkedIn. Ton expert, style infographie moderne.",
    tags: ['Insight', 'LinkedIn']
  },
  {
    title: 'Séquence emails onboarding',
    prompt:
      "Rédige une séquence de 3 emails onboarding pour {{ton offre}}. Email 1 bienvenue, email 2 valeur ajoutée, email 3 activation/CTA.",
    tags: ['Copywriting', 'Lifecycle']
  }
];

const formatLabels: Record<FormatOption, { label: string; details: string }> = {
  carousel: { label: 'carrousel éducatif', details: '4-5 slides, storytelling pédagogique' },
  hero: { label: 'visuel hero', details: '1 visuel carré, annonce forte' },
  reel: { label: 'script vidéo verticale', details: '30 secondes, format 9:16' },
  insight: { label: 'visuel insight data', details: 'statistique clé + visualisation' }
};

const toneLabels: Record<ToneOption, string> = {
  dynamique: 'ton dynamique et motivant',
  expert: 'ton expert et rassurant',
  fun: 'ton fun avec touches d’humour'
};

const goalLabels: Record<GoalOption, string> = {
  conversion: 'générer des conversions',
  engagement: 'créer de l’engagement et des conversations',
  prelaunch: 'préparer un teasing avant lancement'
};

const channelLabels: Record<ChannelOption, string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  tiktok: 'TikTok'
};

export default function Creator() {
  const chatRef = useRef<AlfieChatHandle>(null);
  const [format, setFormat] = useState<FormatOption>('carousel');
  const [tone, setTone] = useState<ToneOption>('dynamique');
  const [goal, setGoal] = useState<GoalOption>('conversion');
  const [channel, setChannel] = useState<ChannelOption>('linkedin');

  const generatedBrief = useMemo(() => {
    const formatLabel = formatLabels[format];
    const toneLabel = toneLabels[tone];
    const goalLabel = goalLabels[goal];
    const channelLabel = channelLabels[channel];

    return [
      `Crée un ${formatLabel.label} adapté à mon Brand Kit.`,
      `Objectif : ${goalLabel}.`,
      `Ton : ${toneLabel}.`,
      `Publication sur ${channelLabel}.`,
      'Structure ton livrable avec recommandations visuelles + copy prête à publier.'
    ].join(' ');
  }, [format, tone, goal, channel]);

  const handleUseBrief = (sendDirect?: boolean) => {
    if (sendDirect) {
      chatRef.current?.sendPrompt(generatedBrief);
    } else {
      chatRef.current?.setPrompt(generatedBrief);
    }
  };

  const handleQuickIdea = (idea: QuickIdea) => {
    if (idea.autoSend) {
      chatRef.current?.sendPrompt(idea.prompt);
    } else {
      chatRef.current?.setPrompt(idea.prompt);
      chatRef.current?.focusInput();
    }
  };

  const handleTrendingPrompt = (prompt: string) => {
    chatRef.current?.sendPrompt(prompt);
  };

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="w-fit uppercase tracking-wide text-xs">Studio</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Chat Generator avec Alfie
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Compose ton brief idéal, sélectionne les bons formats et laisse Alfie produire visuels, vidéos ou copy.
              Le moteur de réponse reste piloté par Alfie pour la création et la livraison.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="bg-gradient-to-r from-primary to-secondary text-white shadow-sm">
            <Sparkles className="mr-1 h-4 w-4" /> Mode créatif avancé
          </Badge>
          <Badge variant="secondary">Brand Kit appliqué automatiquement</Badge>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <Card className="shadow-medium border-primary/20">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <PenSquare className="h-5 w-5 text-primary" />
                Brief express
              </CardTitle>
              <CardDescription>
                Combine les bons paramètres et envoie le brief complet à Alfie.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <section>
                <div className="mb-2 flex items-center justify-between text-sm font-medium">
                  <span>Format du livrable</span>
                  <Badge variant="outline" className="text-[10px] uppercase">Visuel & vidéo</Badge>
                </div>
                <ToggleGroup
                  type="single"
                  value={format}
                  onValueChange={(value) => value && setFormat(value as FormatOption)}
                  className="grid grid-cols-2 gap-2"
                >
                  <ToggleGroupItem value="carousel" className="justify-start gap-2">
                    <Presentation className="h-4 w-4" /> Carrousel
                  </ToggleGroupItem>
                  <ToggleGroupItem value="hero" className="justify-start gap-2">
                    <Rocket className="h-4 w-4" /> Hero
                  </ToggleGroupItem>
                  <ToggleGroupItem value="reel" className="justify-start gap-2">
                    <Timer className="h-4 w-4" /> Reel
                  </ToggleGroupItem>
                  <ToggleGroupItem value="insight" className="justify-start gap-2">
                    <BarChart3 className="h-4 w-4" /> Insight
                  </ToggleGroupItem>
                </ToggleGroup>
                <p className="mt-2 text-xs text-muted-foreground">{formatLabels[format].details}</p>
              </section>

              <section className="grid gap-4">
                <div>
                  <p className="mb-2 text-sm font-medium">Objectif</p>
                  <ToggleGroup
                    type="single"
                    value={goal}
                    onValueChange={(value) => value && setGoal(value as GoalOption)}
                    className="grid grid-cols-3 gap-2"
                  >
                    <ToggleGroupItem value="conversion">Conversion</ToggleGroupItem>
                    <ToggleGroupItem value="engagement">Engagement</ToggleGroupItem>
                    <ToggleGroupItem value="prelaunch">Pré-lancement</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Canal</p>
                  <ToggleGroup
                    type="single"
                    value={channel}
                    onValueChange={(value) => value && setChannel(value as ChannelOption)}
                    className="grid grid-cols-3 gap-2"
                  >
                    <ToggleGroupItem value="linkedin">LinkedIn</ToggleGroupItem>
                    <ToggleGroupItem value="instagram">Instagram</ToggleGroupItem>
                    <ToggleGroupItem value="tiktok">TikTok</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Ton</p>
                  <ToggleGroup
                    type="single"
                    value={tone}
                    onValueChange={(value) => value && setTone(value as ToneOption)}
                    className="grid grid-cols-3 gap-2"
                  >
                    <ToggleGroupItem value="dynamique">Dynamique</ToggleGroupItem>
                    <ToggleGroupItem value="expert">Expert</ToggleGroupItem>
                    <ToggleGroupItem value="fun">Fun</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </section>

              <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                <p className="font-medium text-foreground">Brief généré</p>
                <p className="mt-2 whitespace-pre-line text-muted-foreground">{generatedBrief}</p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1" onClick={() => handleUseBrief(false)} variant="secondary">
                  Pré-remplir dans le chat
                </Button>
                <Button className="flex-1" onClick={() => handleUseBrief(true)}>
                  Envoyer à Alfie
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-medium">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-secondary" />
                Idées rapides
              </CardTitle>
              <CardDescription>Inspirations prêtes à l’emploi. Alfie adapte tout à ta marque.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {QUICK_IDEAS.map((idea) => (
                <div key={idea.title} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{idea.title}</p>
                      <p className="text-sm text-muted-foreground">{idea.description}</p>
                    </div>
                    <Badge variant="outline">Suggestion</Badge>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Button variant="ghost" className="sm:flex-1" onClick={() => handleQuickIdea({ ...idea, autoSend: false })}>
                      Modifier le brief
                    </Button>
                    <Button className="sm:flex-1" onClick={() => handleQuickIdea(idea)}>
                      Lancer avec Alfie
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="order-first flex h-[calc(100vh-260px)] flex-col overflow-hidden border-primary/20 bg-gradient-to-br from-background to-muted/40 shadow-strong xl:order-none">
          <CardHeader className="border-b bg-background/80 backdrop-blur">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-xl">Espace conversationnel</CardTitle>
                <CardDescription>Discute avec Alfie, ajoute des images et suis la production en direct.</CardDescription>
              </div>
              <Badge variant="outline" className="gap-1">
                <Sparkles className="h-4 w-4" /> IA active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <AlfieChat ref={chatRef} className="bg-transparent" />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-medium border-primary/10">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                Prompts tendances
              </CardTitle>
              <CardDescription>Ce que les créateurs Alfie demandent le plus cette semaine.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {TRENDING_PROMPTS.map((item) => (
                <div key={item.title} className="rounded-lg border bg-muted/40 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px] uppercase tracking-wide">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleTrendingPrompt(item.prompt)}>
                      Utiliser
                    </Button>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{item.prompt}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <QuotaSummaryCard />

          <Card className="border-primary/10 bg-gradient-to-br from-primary/5 to-secondary/5 shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Astuce Alfie
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Combine deux requêtes : demande à Alfie un carrousel éducatif, puis enchaîne avec "Transforme-le en script vidéo"
                pour obtenir automatiquement un Reel cohérent.
              </p>
              <Separator />
              <p>
                💡 Pense à téléverser une image moodboard : Alfie s’en servira comme référence stylistique pour les prochaines
                générations.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuotaSummaryCard() {
  const { brandKit, activeBrandId } = useBrandKit();
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadQuotas = async () => {
      if (!activeBrandId) {
        if (isMounted) {
          setQuotaStatus(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const status = await getQuotaStatus(activeBrandId);
      if (isMounted) {
        setQuotaStatus(status);
        setLoading(false);
      }
    };

    loadQuotas();

    return () => {
      isMounted = false;
    };
  }, [activeBrandId]);

  if (loading) {
    return (
      <Card className="shadow-medium border-primary/10">
        <CardHeader>
          <CardTitle>Quotas de la marque</CardTitle>
          <CardDescription>Récupération en cours...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-[85%]" />
          <Skeleton className="h-3 w-[60%]" />
        </CardContent>
      </Card>
    );
  }

  if (!brandKit || !quotaStatus) {
    return (
      <Card className="shadow-medium border-primary/10">
        <CardHeader>
          <CardTitle>Aucune marque active</CardTitle>
          <CardDescription>Sélectionne ou crée un Brand Kit pour suivre tes quotas.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const resetDate = quotaStatus.resetsOn
    ? new Date(quotaStatus.resetsOn).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
    : '1er du mois';

  const visualsRemaining = Math.max(quotaStatus.visuals.limit - quotaStatus.visuals.used, 0);
  const videosRemaining = Math.max(quotaStatus.videos.limit - quotaStatus.videos.used, 0);

  return (
    <Card className="shadow-medium border-primary/10">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{brandKit.name}</span>
          <Badge variant="outline" className="uppercase tracking-wide text-[10px]">
            Reset {resetDate}
          </Badge>
        </CardTitle>
        <CardDescription>Suivi temps réel de tes quotas IA.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <div className="flex items-center justify-between">
            <span>Visuels IA</span>
            <span className="font-medium">{visualsRemaining}/{quotaStatus.visuals.limit}</span>
          </div>
          <Progress value={Math.min(quotaStatus.visuals.percentage, 100)} className="mt-2" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span>Vidéos IA</span>
            <span className="font-medium">{videosRemaining}/{quotaStatus.videos.limit}</span>
          </div>
          <Progress value={Math.min(quotaStatus.videos.percentage, 100)} className="mt-2" />
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="flex items-center justify-between text-sm">
            <span>Woofs disponibles</span>
            <span className="font-semibold">{quotaStatus.woofs.remaining}/{quotaStatus.woofs.limit}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            1 clip Sora = 1 Woof • Veo3 = 4 Woofs
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
