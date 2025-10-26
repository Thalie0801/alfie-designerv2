import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Trash2, Palette, Sparkles, MessageSquare, Award } from 'lucide-react';
import { BrandDialog } from '@/components/BrandDialog';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { NewsWidget } from '@/components/NewsWidget';
import { FeatureRequestDialog } from '@/components/FeatureRequestDialog';
import { AccessGuard } from '@/components/AccessGuard';
import { AlertBanner } from '@/components/dashboard/AlertBanner';
import { ActiveBrandCard } from '@/components/dashboard/ActiveBrandCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ActivityCard } from '@/components/dashboard/ActivityCard';
import { RecentCreations } from '@/components/dashboard/RecentCreations';
import { ProfileProgress } from '@/components/dashboard/ProfileProgress';
import { useAffiliateStatus } from '@/hooks/useAffiliateStatus';
import { useBrandKit } from '@/hooks/useBrandKit';
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
  const { affiliate } = useAffiliateStatus();
  const { activeBrandId } = useBrandKit();
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
    <AccessGuard>
      <div className="space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Bienvenue sur votre Dashboard
              </h1>
              {affiliate && (
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white gap-1.5 px-3 py-1">
                  <Award className="h-4 w-4" />
                  Ambassadeur {affiliate.affiliate_status === 'leader' ? '· Leader' : affiliate.affiliate_status === 'mentor' ? '· Mentor' : ''}
                </Badge>
              )}
            </div>
            <p className="text-base text-muted-foreground max-w-2xl">
              Gérez vos marques, générez du contenu créatif avec Alfie et suivez vos quotas
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <NewsWidget />
            <FeatureRequestDialog />
          </div>
        </div>

        {/* Alert Banner */}
        <AlertBanner />

        {/* Alfie Designer Hero Card */}
        <Card className="border-none shadow-strong overflow-hidden relative group">
          <div className="absolute inset-0 gradient-hero opacity-10"></div>
          <CardContent className="relative p-8">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="absolute inset-0 gradient-hero blur-xl opacity-50 animate-pulse-soft"></div>
                  <div className="relative gradient-hero p-4 rounded-2xl shadow-glow">
                    <Sparkles className="h-10 w-10 text-white" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl lg:text-3xl font-bold">Alfie Designer</h2>
                  <p className="text-muted-foreground text-lg">Votre assistant créatif IA nouvelle génération</p>
                </div>
              </div>
              <Button 
                onClick={() => navigate('/app')}
                size="lg"
                className="gap-3 gradient-hero text-white shadow-strong hover:shadow-glow transition-all px-8 py-6 text-base font-semibold"
              >
                <MessageSquare className="h-5 w-5" />
                Commencer à créer
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <QuickActions />

        {/* Main Grid - Active Brand + Activity */}
        <div className="grid lg:grid-cols-2 gap-6">
          <ActiveBrandCard />
          <ActivityCard activeBrandId={activeBrandId} />
        </div>

        {/* Recent Creations */}
        <RecentCreations />

        {/* Bottom Grid - Profile Progress + Pro Tip */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ProfileProgress />
          
          <Card className="border-secondary/20 shadow-medium md:col-span-2 lg:col-span-2">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-secondary/10 flex-shrink-0">
                  <Sparkles className="h-6 w-6 text-secondary" />
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-lg">💡 Conseil Pro</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Configurez vos Brand Kits avec votre palette de couleurs, typographie et voix de marque. 
                    Alfie s'en servira pour générer du contenu parfaitement adapté à votre identité visuelle.
                    Plus votre Brand Kit est complet, plus les créations seront personnalisées et cohérentes avec votre image de marque.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Brand List */}
        <Card className="border-primary/10 shadow-medium">
          <CardHeader className="border-b bg-gradient-subtle">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Palette className="h-5 w-5 text-primary" />
                  </div>
                  Mes marques
                </CardTitle>
                <CardDescription className="mt-2">Gérez et organisez vos Brand Kits</CardDescription>
              </div>
              <BrandDialog onSuccess={loadData} />
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-32 mx-auto"></div>
                  <div className="h-3 bg-muted rounded w-48 mx-auto"></div>
                </div>
              </div>
            ) : brands.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <div className="p-4 rounded-full bg-muted/50 w-20 h-20 mx-auto flex items-center justify-center">
                  <Palette className="h-10 w-10 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-semibold">Aucune marque créée</p>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Créez votre première marque pour commencer à générer du contenu personnalisé avec Alfie
                  </p>
                </div>
                <BrandDialog onSuccess={loadData} />
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {brands.map((brand) => (
                  <Card key={brand.id} className="group hover:shadow-strong hover:border-primary/40 transition-all border-2 overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 gradient-hero opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <CardHeader className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {brand.logo_url && (
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 border-border bg-background">
                              <img 
                                src={brand.logo_url} 
                                alt={brand.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 space-y-2">
                            <h3 className="font-bold text-lg truncate">{brand.name}</h3>
                            {brand.plan && (
                              <Badge variant="secondary" className="text-xs font-medium">
                                {brand.plan.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <BrandDialog brand={brand} onSuccess={loadData} />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
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
                      
                      {brand.voice && (
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                          {brand.voice}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={brand.canva_connected ? "default" : "outline"}
                          className={`text-xs ${brand.canva_connected ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'border-orange-500/20 text-orange-600'}`}
                        >
                          {brand.canva_connected ? '✓ Canva' : '○ Canva'}
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AccessGuard>
  );
}
