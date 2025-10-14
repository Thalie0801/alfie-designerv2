import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ExternalLink, Trash2, Palette, Sparkles, MessageSquare } from 'lucide-react';
import { BrandDialog } from '@/components/BrandDialog';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { BrandManager } from '@/components/BrandManager';
import { BrandQuotaDisplay } from '@/components/BrandQuotaDisplay';
import { NewsFeed } from '@/components/NewsFeed';
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

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      const [postsRes, brandsRes] = await Promise.all([
        supabase
          .from('posts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('brands')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      ]);

      setPosts(postsRes.data || []);
      setBrands(brandsRes.data || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
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
    if (hour < 12) return "Bonjour";
    if (hour < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            {getGreeting()} {user?.email?.split('@')[0] || 'créateur'} 👋
          </h1>
          <p className="text-muted-foreground">
            Voici un aperçu de votre activité Alfie Designer
          </p>
        </div>
        <Button 
          disabled 
          className="gap-2 gradient-hero text-white shadow-medium opacity-50 cursor-not-allowed"
          title="En attente de la réponse de l'API Canva"
        >
          <ExternalLink className="h-4 w-4" />
          Connecter Canva
        </Button>
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
              onClick={() => navigate('/app')}
              className="gap-2 bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90"
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
            <BrandDialog onSuccess={loadData} />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Chargement...
            </p>
          ) : brands.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune marque configurée. Cliquez sur "Ajouter" ci-dessus pour créer votre première marque.
            </p>
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
