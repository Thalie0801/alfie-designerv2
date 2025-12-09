import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Plus, Award, Trash2 } from 'lucide-react';
import { MaskableEmail } from '@/components/MaskableEmail';

export default function ManageAmbassadors() {
  const [ambassadors, setAmbassadors] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [customQuotaVisuals, setCustomQuotaVisuals] = useState('450');
  const [customQuotaBrands, setCustomQuotaBrands] = useState('1');
  const [customQuotaVideos, setCustomQuotaVideos] = useState('45');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ambassadorsRes, usersRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('granted_by_admin', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, email, full_name, plan, granted_by_admin')
          .order('email')
      ]);

      setAmbassadors(ambassadorsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAmbassador = async () => {
    if (!selectedUser) {
      toast.error('Veuillez sélectionner un utilisateur');
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('admin-grant-access', {
        body: {
          user_id: selectedUser,
          plan: selectedPlan,
          granted_by_admin: true,
          quota_visuals_per_month: parseInt(customQuotaVisuals),
          quota_brands: parseInt(customQuotaBrands),
          quota_videos: parseInt(customQuotaVideos)
        },
      });

      if (error) throw error;

      toast.success('Ambassadeur ajouté avec succès');
      setDialogOpen(false);
      setSelectedUser('');
      loadData();
    } catch (error: any) {
      console.error('Error adding ambassador:', error);
      toast.error('Erreur lors de l\'ajout : ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handleRevokeAccess = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir révoquer l\'accès ambassadeur ?')) {
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('admin-grant-access', {
        body: {
          user_id: userId,
          granted_by_admin: false
        },
      });

      if (error) throw error;

      toast.success('Accès révoqué');
      loadData();
    } catch (error: any) {
      console.error('Error revoking access:', error);
      toast.error('Erreur lors de la révocation');
    }
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'starter': return 'bg-orange-500';
      case 'pro': return 'bg-green-500';
      case 'studio': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const handlePlanChange = (plan: string) => {
    setSelectedPlan(plan);
    // Set default quotas based on plan
    switch (plan) {
      case 'starter':
        setCustomQuotaVisuals('150');
        setCustomQuotaVideos('15');
        setCustomQuotaBrands('1');
        break;
      case 'pro':
        setCustomQuotaVisuals('450');
        setCustomQuotaVideos('45');
        setCustomQuotaBrands('1');
        break;
      case 'studio':
        setCustomQuotaVisuals('1000');
        setCustomQuotaVideos('100');
        setCustomQuotaBrands('1');
        break;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Ambassadeurs</h1>
          <p className="text-muted-foreground">Gérez les accès ambassadeurs spéciaux</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un ambassadeur
        </Button>
      </div>

      <div className="grid gap-4">
        {ambassadors.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                Aucun ambassadeur avec accès spécial pour le moment
              </p>
            </CardContent>
          </Card>
        ) : (
          ambassadors.map((amb) => (
            <Card key={amb.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {amb.full_name || amb.email}
                      <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                        🎖️ Ambassadeur
                      </Badge>
                    </CardTitle>
                    <CardDescription><MaskableEmail email={amb.email} /></CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getPlanBadgeColor(amb.plan)}>
                      {amb.plan?.toUpperCase()}
                    </Badge>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleRevokeAccess(amb.id)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Révoquer
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Visuels/mois</p>
                    <p className="font-medium">{amb.quota_visuals_per_month}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Marques</p>
                    <p className="font-medium">{amb.quota_brands}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Woofs</p>
                    <p className="font-medium">{amb.quota_videos}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-500" />
              Ajouter un ambassadeur
            </DialogTitle>
            <DialogDescription>
              Accordez un accès ambassadeur spécial à un utilisateur
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user">Utilisateur</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un utilisateur" />
                </SelectTrigger>
                <SelectContent>
                  {users.filter(u => !u.granted_by_admin).map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.email?.substring(0, 3)}***@{user.email?.split('@')[1]} {user.full_name && `(${user.full_name})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <Select value={selectedPlan} onValueChange={handlePlanChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="studio">Studio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="visuals">Visuels/mois</Label>
                <Input
                  id="visuals"
                  type="number"
                  value={customQuotaVisuals}
                  onChange={(e) => setCustomQuotaVisuals(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brands">Marques</Label>
                <Input
                  id="brands"
                  type="number"
                  value={customQuotaBrands}
                  onChange={(e) => setCustomQuotaBrands(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="videos">Woofs</Label>
                <Input
                  id="videos"
                  type="number"
                  value={customQuotaVideos}
                  onChange={(e) => setCustomQuotaVideos(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddAmbassador} className="gap-2">
              <Award className="h-4 w-4" />
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
