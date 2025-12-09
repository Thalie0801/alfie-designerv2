import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, User, Mail, CreditCard, Download, Trash2, AlertTriangle } from 'lucide-react';
import { useCustomerPortal } from '@/hooks/useCustomerPortal';
import { useNavigate } from 'react-router-dom';
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
} from "@/components/ui/alert-dialog";

export default function Profile() {
  const { user, profile, signOut } = useAuth();
  const { openCustomerPortal, loading: portalLoading } = useCustomerPortal();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setEmail(profile.email || '');
    }
  }, [profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Profil mis à jour avec succès');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-user-data');
      
      if (error) throw error;

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alfie-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Données exportées avec succès');
    } catch (error: any) {
      console.error('Error exporting data:', error);
      toast.error('Erreur lors de l\'export des données');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'SUPPRIMER') {
      toast.error('Veuillez taper SUPPRIMER pour confirmer');
      return;
    }

    setDeleteLoading(true);
    try {
      const { error } = await supabase.functions.invoke('delete-own-account');
      
      if (error) throw error;

      toast.success('Compte supprimé avec succès');
      await signOut();
      navigate('/');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error('Erreur lors de la suppression du compte');
    } finally {
      setDeleteLoading(false);
    }
  };

  const getPlanLabel = (plan: string) => {
    const labels: Record<string, string> = {
      starter: 'Starter',
      pro: 'Pro',
      business: 'Business',
      enterprise: 'Enterprise'
    };
    return labels[plan] || plan;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Mon Profil
        </h1>
        <p className="text-muted-foreground">
          Gérez vos informations personnelles
        </p>
      </div>

      {/* Profile Information */}
      <Card className="border-primary/20 shadow-medium">
        <CardHeader className="bg-gradient-subtle">
          <CardTitle className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-2 rounded-lg">
              <User className="h-5 w-5 text-white" />
            </div>
            Informations personnelles
          </CardTitle>
          <CardDescription>
            Mettez à jour vos informations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nom complet</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Votre nom"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                L'email ne peut pas être modifié
              </p>
            </div>

            <Button type="submit" disabled={loading} className="gradient-hero text-white shadow-medium">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              💾 Enregistrer
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Subscription Info */}
      <Card className="border-secondary/20 shadow-medium">
        <CardHeader className="bg-gradient-warm/10">
          <CardTitle className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-orange-500 to-pink-500 p-2 rounded-lg">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            Abonnement
          </CardTitle>
          <CardDescription>
            Informations sur votre plan actuel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Plan actuel</span>
            <Badge className={
              profile?.plan === 'enterprise' ? 'bg-purple-500' :
              profile?.plan === 'studio' ? 'bg-blue-500' :
              profile?.plan === 'pro' ? 'bg-green-500' :
              'bg-orange-500'
            }>
              {getPlanLabel(profile?.plan || 'starter')}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Visuels par mois</span>
            <span className="text-sm text-muted-foreground">
              {profile?.quota_visuals_per_month || 20}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Marques autorisées</span>
            <span className="text-sm text-muted-foreground">
              {profile?.quota_brands || 1}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.location.href = '/billing'}
            >
              Voir les détails de facturation
            </Button>
            
            {profile?.plan && profile.plan !== 'none' && (
              <Button 
                variant="outline" 
                className="w-full border-red-500 text-red-500 hover:bg-red-50"
                onClick={openCustomerPortal}
                disabled={portalLoading}
              >
                {portalLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Chargement...
                  </>
                ) : (
                  'Gérer mon abonnement / Se désabonner'
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* RGPD - Data Rights */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-muted-foreground" />
            Vos droits RGPD
          </CardTitle>
          <CardDescription>
            Exportez ou supprimez vos données personnelles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data Export (Art. 20 RGPD - Portabilité) */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">Exporter mes données</p>
              <p className="text-sm text-muted-foreground">
                Téléchargez toutes vos données au format JSON
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleExportData}
              disabled={exportLoading}
            >
              {exportLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Exporter
                </>
              )}
            </Button>
          </div>

          {/* Account Deletion (Art. 17 RGPD - Droit à l'oubli) */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <div>
              <p className="font-medium text-destructive">Supprimer mon compte</p>
              <p className="text-sm text-muted-foreground">
                Action irréversible. Toutes vos données seront supprimées.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Supprimer définitivement votre compte ?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <p>
                      Cette action est <strong>irréversible</strong>. Toutes vos données seront supprimées :
                    </p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>Profil et informations personnelles</li>
                      <li>Marques et Brand Kits</li>
                      <li>Visuels et médias générés</li>
                      <li>Historique de conversations</li>
                      <li>Abonnement et facturation</li>
                    </ul>
                    <div className="pt-4">
                      <Label htmlFor="confirmDelete">
                        Tapez <strong>SUPPRIMER</strong> pour confirmer :
                      </Label>
                      <Input
                        id="confirmDelete"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="SUPPRIMER"
                        className="mt-2"
                      />
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>
                    Annuler
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={deleteLoading || deleteConfirmText !== 'SUPPRIMER'}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Supprimer définitivement'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
