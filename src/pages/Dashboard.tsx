import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ExternalLink, Trash2, Palette, Sparkles, MessageSquare, ActivitySquare, AlertTriangle, Plus } from 'lucide-react';
import { BrandDialog } from '@/components/BrandDialog';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { BrandManager } from '@/components/BrandManager';
import { BrandQuotaDisplay } from '@/components/BrandQuotaDisplay';
import { NewsFeed } from '@/components/NewsFeed';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useBrandKit } from '@/hooks/useBrandKit';
import { trackDashboardEvent } from '@/utils/analytics';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { activeBrandId } = useBrandKit();
  const [posts, setPosts] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [generationStats, setGenerationStats] = useState({
    thisMonth: 0,
    failures: 0,
    lastAction: 'Aucune activité',
  });
  const [recentActivities, setRecentActivities] = useState<
    { id: string; label: string; description: string; created_at: string; status: 'success' | 'failed' | 'info' }[]
  >([]);

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    if (user && activeBrandId) {
      trackDashboardEvent('dashboard_view', {
        userId: user.id,
        brandId: activeBrandId,
        context: { source: 'dashboard' }
      });
    }
  }, [user, activeBrandId]);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      setKpiLoading(false);
      return;
    }

    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [postsRes, brandsRes, generationsRes] = await Promise.all([
        supabase
          .from('posts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('brands')
          .select('*, canva_connected_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('generation_logs')
          .select('id, type, status, created_at, error_code, metadata')
          .eq('user_id', user.id)
          .gte('created_at', startOfMonth.toISOString())
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      const postsData = postsRes.data || [];
      const brandsData = brandsRes.data || [];

      setPosts(postsData);
      setBrands(brandsData);

      const generationLogs = generationsRes.data || [];
      const successGenerations = generationLogs.filter(log => log.status === 'success').length;
      const failedGenerations = generationLogs.filter(log => log.status === 'failed').length;

      const activities = [
        ...generationLogs.map((log: any) => ({
          id: `generation-${log.id}`,
          label: log.status === 'failed' ? 'Échec de génération' : log.type === 'video' ? 'Vidéo générée' : 'Visuel généré',
          description:
            log.status === 'failed'
              ? log.error_code ? `Code erreur ${log.error_code}` : 'Réessayez dans quelques instants'
              : log.type === 'video'
                ? 'Ajoutée à la bibliothèque vidéos'
                : 'Disponible dans vos visuels',
          created_at: log.created_at,
          status: log.status === 'failed' ? 'failed' : 'success'
        })),
        ...postsData.map((post: any) => ({
          id: `post-${post.id}`,
          label: 'Publication enregistrée',
          description: post.title || 'Draft sauvegardée dans Alfie',
          created_at: post.created_at,
          status: 'info' as const
        }))
      ]
        .filter(Boolean)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3);

      setRecentActivities(activities);

      const lastActivity = activities[0];
      setGenerationStats({
        thisMonth: successGenerations,
        failures: failedGenerations,
        lastAction: lastActivity
          ? `${lastActivity.label} · ${formatDate(lastActivity.created_at)}`
          : 'Aucune activité ce mois-ci'
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setKpiLoading(false);
    }
  };

  const handleDeleteBrand = async (brandId: string) => {
    try {
      const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', brandId)
        .eq('user_id', user!.id);

      if (error) throw error;

      toast.success('Marque supprimée');
      loadData();
    } catch (error: any) {
      console.error('Error deleting brand:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const firstName = useMemo(() => {
    if (profile?.first_name) return profile.first_name;
    if (profile?.full_name) return profile.full_name.split(' ')[0];
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name.split(' ')[0];
    if (user?.email) return user.email.split('@')[0];
    return 'créateur';
  }, [profile, user]);

  const formatBadge = (activity: (typeof recentActivities)[number]) => {
    if (activity.status === 'failed') {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Échec
        </Badge>
      );
    }
    if (activity.status === 'success') {
      return (
        <Badge variant="secondary" className="text-xs">
          ✅ Succès
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        ℹ️ Info
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            {getGreeting()}, {firstName} 👋
          </h1>
          <p className="text-muted-foreground">
            Voici un aperçu de votre activité Alfie Designer
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2 text-muted-foreground border-dashed bg-muted/40 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          title="Connexion Canva bientôt disponible"
          onClick={() => {
            if (user && activeBrandId) {
              trackDashboardEvent('cta_click', {
                userId: user.id,
                brandId: activeBrandId,
                action: 'connecter_canva',
                context: { location: 'dashboard_header' }
              });
            }
            toast.info('Connexion Canva en cours de finalisation ✨');
          }}
        >
          <ExternalLink className="h-4 w-4" />
          Connecter Canva
        </Button>
      </div>

      {/* KPI Mini Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[{
          title: 'Générations ce mois',
          value: generationStats.thisMonth,
          description: 'Visuels & vidéos réussis'
        }, {
          title: 'Échecs',
          value: generationStats.failures,
          description: 'Tentatives à relancer'
        }, {
          title: 'Dernière action',
          value: generationStats.lastAction,
          description: 'Résumé des 24h'
        }].map((item, index) => (
          <Card key={item.title} className="border-primary/10 shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium uppercase text-muted-foreground tracking-wide">{item.title}</p>
              {kpiLoading ? (
                <Skeleton className="h-6 w-24 mt-2" />
              ) : index === 2 ? (
                <p className="text-sm font-semibold mt-2 text-foreground/80">{item.value}</p>
              ) : (
                <p className="text-2xl font-bold mt-2">{item.value}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-primary/20 shadow-medium">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Brand Kits actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{brands.length}</div>
            <p className="text-xs text-muted-foreground mt-1">marques configurées</p>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 shadow-medium">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Créations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{posts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">visuels générés</p>
          </CardContent>
        </Card>

        <Card className="border-secondary/20 shadow-medium">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Statut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">Actif</div>
            <p className="text-xs text-muted-foreground mt-1">compte vérifié</p>
          </CardContent>
        </Card>
      </div>

      {/* Alfie Designer Card */}
      <Card className="border-primary/30 shadow-strong bg-gradient-subtle">
        <CardHeader className="bg-gradient-to-br from-primary/10 to-secondary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-primary to-secondary p-3 rounded-xl shadow-glow">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Créer avec Alfie</CardTitle>
                <CardDescription>Votre assistant créatif IA</CardDescription>
              </div>
            </div>
            <Button
              onClick={() => {
                if (user && activeBrandId) {
                  trackDashboardEvent('cta_click', {
                    userId: user.id,
                    brandId: activeBrandId,
                    action: 'open_chat',
                    context: { location: 'hero_card' }
                  });
                }
                navigate('/app');
              }}
              className="gap-2 bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            >
              <MessageSquare className="h-4 w-4" />
              Créer maintenant
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-sm text-muted-foreground">
              💡 <strong>Astuce :</strong> Alfie génère des visuels IA adaptés à ton Brand Kit. 
              Les quotas (visuels, vidéos, Woofs) sont gérés par marque.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quotas de la marque active */}
      <BrandQuotaDisplay />

      {/* Brand Manager */}
      <BrandManager />

      {/* News Feed */}
      <NewsFeed />

      {/* Recent activity */}
      <Card className="border-primary/20 shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ActivitySquare className="h-5 w-5 text-primary" />
            Dernières activités
          </CardTitle>
          <CardDescription>3 actions récentes : génération, upload ou connexion</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune activité pour le moment. Lance une génération pour remplir ce flux ✨</p>
          ) : (
            <div className="space-y-3">
              {recentActivities.map(activity => (
                <div key={activity.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">{activity.label}</p>
                    <p className="text-xs text-muted-foreground">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(activity.created_at)}</p>
                  </div>
                  {formatBadge(activity)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Brands */}
      <Card className="border-primary/20 shadow-medium">
        <CardHeader className="bg-gradient-subtle">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Mes marques
              </CardTitle>
              <CardDescription>Gérez vos Brand Kits</CardDescription>
            </div>
            <BrandDialog onSuccess={loadData}>
              <Button
                size="sm"
                className="gap-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                onClick={() => {
                  if (user && activeBrandId) {
                    trackDashboardEvent('cta_click', {
                      userId: user.id,
                      brandId: activeBrandId,
                      action: 'add_brand',
                      context: { location: 'brand_list_header' }
                    });
                  }
                }}
              >
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </BrandDialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Chargement...
            </p>
          ) : brands.length === 0 ? (
            <div className="grid place-items-center gap-4 py-8 text-center">
              <div className="max-w-sm space-y-3">
                <h3 className="text-lg font-semibold">Crée ta première marque</h3>
                <p className="text-sm text-muted-foreground">
                  Définis ton logo, tes couleurs et ta voix pour débloquer des générations 100% alignées.
                </p>
                <div className="rounded-xl overflow-hidden border">
                  <video
                    className="w-full h-48 object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                    poster="/images/hero-preview.jpg"
                  >
                    <source src="https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4" type="video/mp4" />
                  </video>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {brands.map((brand) => (
                <Card key={brand.id} className="group hover:shadow-strong hover:border-primary/30 transition-all border-2">
                  <CardHeader className="bg-gradient-subtle">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {brand.logo_url && (
                            <img
                              src={brand.logo_url}
                              alt={brand.name}
                              className="w-8 h-8 object-contain rounded"
                              loading="lazy"
                            />
                          )}
                          <CardTitle className="text-lg">{brand.name}</CardTitle>
                        </div>
                        <div className="space-y-2">
                          <Badge 
                            className={brand.canva_connected ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'}
                          >
                            {brand.canva_connected ? '✓ Canva connecté' : '○ Non connecté'}
                          </Badge>
                          {brand.voice && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {brand.voice}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <BrandDialog brand={brand} onSuccess={loadData} />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer la marque ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. La marque "{brand.name}" sera définitivement supprimée.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteBrand(brand.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}
