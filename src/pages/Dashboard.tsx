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
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      const { data: brandsData } = await supabase
        .from('brands')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setBrands(brandsData || []);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Retrouvez vos créations et gérez vos marques
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

      {/* Alfie Designer Card */}
      <Card className="border-primary/30 shadow-strong bg-gradient-subtle">
        <CardHeader className="bg-gradient-to-br from-primary/10 to-secondary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-primary to-secondary p-3 rounded-xl shadow-glow">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Alfie Designer</CardTitle>
                <CardDescription>Ton assistant créatif IA</CardDescription>
              </div>
            </div>
            <Button 
              onClick={() => navigate('/app')}
              className="gap-2 bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90"
            >
              <MessageSquare className="h-4 w-4" />
              Ouvrir le chat
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 p-4 rounded-lg border-2 border-primary/20 bg-background/50 max-w-md">
            <Palette className="h-8 w-8 text-secondary" />
            <div>
              <p className="text-2xl font-bold">{brands.length}</p>
              <p className="text-sm text-muted-foreground">Brand Kits</p>
            </div>
          </div>
          <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-sm text-muted-foreground">
              💡 <strong>Astuce :</strong> Discute avec Alfie pour générer des visuels IA ou adapter des templates Canva à ton Brand Kit. 
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
