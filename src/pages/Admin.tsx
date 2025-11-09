import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabaseSafeClient';
import { Users, Activity, ArrowLeft, Sparkles, Plus, ExternalLink, Trash2, Edit2, Search, RefreshCw, TrendingUp, UserCheck, UserX, Award, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { NewsManager } from '@/components/NewsManager';
import { VideoDiagnostic } from '@/components/VideoDiagnostic';

export default function Admin() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [designs, setDesigns] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingDesign, setEditingDesign] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [designDialogOpen, setDesignDialogOpen] = useState(false);
  const [resettingJobs, setResettingJobs] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      const [usersRes, affiliatesRes, conversionsRes, payoutsRes, designsRes, suggestionsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('affiliates').select('*').order('created_at', { ascending: false }),
        supabase
          .from('affiliate_conversions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('affiliate_payouts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('canva_designs').select('*').order('created_at', { ascending: false }),
        supabase
          .from('contact_requests')
          .select('*')
          .ilike('message', '[SUGGESTION DE FONCTIONNALITÉ]%')
          .order('created_at', { ascending: false })
      ]);

      setUsers(usersRes.data || []);
      setAffiliates(affiliatesRes.data || []);
      setConversions(conversionsRes.data || []);
      setPayouts(payoutsRes.data || []);
      setDesigns(designsRes.data || []);
      setSuggestions(suggestionsRes.data || []);
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteDesign = async (id: string) => {
    try {
      const { error } = await supabase.from('canva_designs').delete().eq('id', id);
      if (error) throw error;
      
      toast.success('Design supprimé');
      loadAdminData();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          plan: editingUser.plan,
          quota_brands: editingUser.quota_brands,
          quota_visuals_per_month: editingUser.quota_visuals_per_month,
          granted_by_admin: editingUser.granted_by_admin,
        })
        .eq('id', editingUser.id);

      if (error) throw error;
      
      toast.success('Utilisateur mis à jour');
      setDialogOpen(false);
      setEditingUser(null);
      loadAdminData();
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleUpdateDesign = async () => {
    if (!editingDesign) return;
    
    try {
      const { error } = await supabase
        .from('canva_designs')
        .update({
          title: editingDesign.title,
          category: editingDesign.category,
          description: editingDesign.description,
        })
        .eq('id', editingDesign.id);

      if (error) throw error;
      
      toast.success('Design mis à jour');
      setDesignDialogOpen(false);
      setEditingDesign(null);
      loadAdminData();
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleToggleAffiliateStatus = async (affiliateId: string, nextStatus: 'active' | 'inactive') => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({ status: nextStatus })
        .eq('id', affiliateId);

      if (error) throw error;

      toast.success(
        nextStatus === 'active' ? 'Affilié réactivé' : 'Affilié désactivé'
      );
      loadAdminData();
    } catch (error) {
      console.error('Affiliate status update error:', error);
      toast.error('Impossible de mettre à jour le statut de l\'affilié');
    }
  };

  const handleRemoveAffiliate = async (affiliateId: string) => {
    if (!confirm('⚠️ Confirmer la suppression complète de cet utilisateur ? (profil, affilié, compte) Cette action est irréversible.')) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { targetUserId: affiliateId }
      });

      if (error) throw error;

      toast.success(data.message || 'Utilisateur supprimé complètement');
      loadAdminData();
    } catch (error: any) {
      console.error('User deletion error:', error);
      toast.error(error.message || 'Erreur lors de la suppression de l\'utilisateur');
    }
  };

  const parseSuggestion = (message: string) => {
    const titleMatch = message.match(/Titre:\s*(.+?)(?:\n|$)/);
    const descMatch = message.match(/Description:\s*\n(.+)/s);
    return {
      title: titleMatch?.[1]?.trim() || 'Sans titre',
      description: descMatch?.[1]?.trim() || message
    };
  };

  const handleUpdateSuggestionStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('contact_requests')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      toast.success('Statut mis à jour');
      loadAdminData();
    } catch (error) {
      console.error('Update suggestion status error:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleDeleteSuggestion = async (id: string) => {
    if (!confirm('Supprimer cette suggestion ?')) return;

    try {
      const { error } = await supabase
        .from('contact_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Suggestion supprimée');
      loadAdminData();
    } catch (error) {
      console.error('Delete suggestion error:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleResetStuckJobs = async () => {
    if (!confirm('Débloquer tous les jobs bloqués depuis plus de 5 minutes ?')) return;
    
    setResettingJobs(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-stuck-jobs', {
        body: {}
      });

      if (error) throw error;

      toast.success(data.message || 'Jobs débloqués avec succès');
      console.log('[ADMIN] Reset result:', data);
    } catch (error: any) {
      console.error('Reset stuck jobs error:', error);
      toast.error(error.message || 'Erreur lors du déblocage des jobs');
    } finally {
      setResettingJobs(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRevenue = conversions
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);

  const activeSubscriptions = users.filter(u => u.plan && u.plan !== 'none').length;

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'starter': return 'bg-orange-500';
      case 'pro': return 'bg-green-500';
      case 'studio': return 'bg-blue-500';
      case 'enterprise': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'paid': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
          <p className="text-muted-foreground">
            Gérez les utilisateurs, affiliés et paiements
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            onClick={handleResetStuckJobs} 
            variant="outline" 
            className="gap-2 border-orange-500 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950"
            disabled={resettingJobs}
          >
            <Unlock className="h-4 w-4" />
            {resettingJobs ? 'Déblocage...' : 'Débloquer jobs'}
          </Button>
          <Button onClick={() => navigate('/admin/reset-password')} variant="outline" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Reset mot de passe
          </Button>
          <Button onClick={() => navigate('/admin/ambassadors')} variant="outline" className="gap-2">
            <Award className="h-4 w-4" />
            Gérer Ambassadeurs
          </Button>
          <Button onClick={() => navigate('/admin/create-customer')} className="gap-2">
            <Plus className="h-4 w-4" />
            Créer un client
          </Button>
          <Button variant="outline" onClick={() => navigate('/app')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour Client
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{users.length}</div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {activeSubscriptions} avec abonnement
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenu Total</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700 dark:text-green-300">{totalRevenue.toFixed(0)}€</div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              {conversions.filter(c => c.status === 'paid').length} conversions payées
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Designs Canva</CardTitle>
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">{designs.length}</div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              Catalogue complet
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Affiliés Actifs</CardTitle>
            <Activity className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-700 dark:text-orange-300">
              {affiliates.filter(a => a.status === 'active').length}
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              sur {affiliates.length} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="affiliates">Affiliés</TabsTrigger>
          <TabsTrigger value="conversions">Conversions</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="catalog">Catalogue Canva</TabsTrigger>
          <TabsTrigger value="suggestions">
            Suggestions
            {suggestions.filter(s => s.status === 'pending').length > 0 && (
              <Badge className="ml-2" variant="destructive">
                {suggestions.filter(s => s.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="news">Actualités</TabsTrigger>
          <TabsTrigger value="diagnostic">Diagnostic</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Utilisateurs ({filteredUsers.length})</CardTitle>
                  <CardDescription>Gérez les utilisateurs et leurs abonnements</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-[250px]"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={loadAdminData}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-4">Chargement...</p>
              ) : filteredUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Aucun utilisateur trouvé</p>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover:shadow-sm transition group"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{user.full_name || 'Sans nom'}</p>
                          <Badge className={getPlanBadgeColor(user.plan)} variant="secondary">
                            {user.plan || 'none'}
                          </Badge>
                          {user.granted_by_admin && (
                            <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-300">
                              ✓ Accès manuel
                            </Badge>
                          )}
                          {user.stripe_subscription_id && (
                            <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-300">
                              Stripe
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span>📊 {user.quota_visuals_per_month || 0} visuels/mois</span>
                          <span>🎨 {user.quota_brands || 0} marques</span>
                          <span>📅 {new Date(user.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition"
                        onClick={() => {
                          setEditingUser(user);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Modifier
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Affiliates Tab */}
        <TabsContent value="affiliates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Affiliés</CardTitle>
              <CardDescription>Tous les comptes affiliés actifs</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-4">Chargement...</p>
              ) : affiliates.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Aucun affilié</p>
              ) : (
                <div className="space-y-2">
                  {affiliates.map((affiliate) => (
                    <div
                      key={affiliate.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover:shadow-sm transition"
                    >
                      <div>
                        <p className="font-medium">{affiliate.name}</p>
                        <p className="text-sm text-muted-foreground">{affiliate.email}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={affiliate.status === 'active' ? 'default' : 'secondary'}>
                            {affiliate.status}
                          </Badge>
                          {affiliate.payout_method && (
                            <span className="text-sm text-muted-foreground">
                              {affiliate.payout_method}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleToggleAffiliateStatus(
                                affiliate.id,
                                affiliate.status === 'active' ? 'inactive' : 'active'
                              )
                            }
                          >
                            {affiliate.status === 'active' ? (
                              <UserX className="h-4 w-4 mr-2" />
                            ) : (
                              <UserCheck className="h-4 w-4 mr-2" />
                            )}
                            {affiliate.status === 'active' ? 'Désactiver' : 'Activer'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveAffiliate(affiliate.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Purger
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conversions Tab */}
        <TabsContent value="conversions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conversions</CardTitle>
              <CardDescription>Suivi des conversions affiliés</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-4">Chargement...</p>
              ) : conversions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Aucune conversion</p>
              ) : (
                <div className="space-y-2">
                  {conversions.map((conversion: any) => (
                    <div
                      key={conversion.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover:shadow-sm transition"
                    >
                      <div>
                        <p className="font-medium">Utilisateur: {conversion.user_id.substring(0, 8)}...</p>
                        <p className="text-sm text-muted-foreground">
                          Plan: {conversion.plan} • {new Date(conversion.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusBadgeColor(conversion.status)}>
                          {conversion.status}
                        </Badge>
                        <span className="font-medium">{conversion.amount}€</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payouts</CardTitle>
              <CardDescription>Gérer les paiements aux affiliés</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-4">Chargement...</p>
              ) : payouts.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Aucun payout</p>
              ) : (
                <div className="space-y-2">
                  {payouts.map((payout: any) => (
                    <div
                      key={payout.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover:shadow-sm transition"
                    >
                      <div>
                        <p className="font-medium">Affilié: {payout.affiliate_id.substring(0, 8)}...</p>
                        <p className="text-sm text-muted-foreground">
                          Période: {payout.period}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={getStatusBadgeColor(payout.status)}>
                          {payout.status}
                        </Badge>
                        <span className="font-bold">{payout.amount}€</span>
                        {payout.paid_at && (
                          <span className="text-sm text-muted-foreground">
                            {new Date(payout.paid_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Catalog Tab */}
        <TabsContent value="catalog" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Designs du catalogue ({designs.length})</CardTitle>
              <CardDescription>Tous les designs visibles par les clients</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="aspect-[4/3] bg-muted rounded-lg mb-2" />
                      <div className="h-4 bg-muted rounded mb-2" />
                      <div className="h-3 bg-muted rounded w-2/3" />
                    </div>
                  ))}
                </div>
              ) : designs.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucun design</h3>
                  <p className="text-muted-foreground">
                    Ajoutez votre premier design Canva ci-dessus
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {designs.map((design) => (
                    <Card key={design.id} className="overflow-hidden group">
                      <div className="relative aspect-[4/3] bg-muted">
                        <img
                          src={design.image_url}
                          alt={design.title}
                          className="w-full h-full object-cover"
                        />
                        {design.category && (
                          <Badge className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm">
                            {design.category}
                          </Badge>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-1 line-clamp-1">{design.title}</h4>
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                          {design.description || 'Aucune description'}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(design.canva_url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Voir
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingDesign(design);
                              setDesignDialogOpen(true);
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteDesign(design.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suggestions Tab */}
        <TabsContent value="suggestions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Suggestions de fonctionnalités</CardTitle>
                  <CardDescription>Idées et demandes des utilisateurs</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={loadAdminData}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-4">Chargement...</p>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucune suggestion</h3>
                  <p className="text-muted-foreground">
                    Les suggestions apparaîtront ici
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions.map((suggestion) => {
                    const parsed = parseSuggestion(suggestion.message);
                    return (
                      <Card key={suggestion.id} className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-lg">{parsed.title}</h4>
                              <Badge variant={
                                suggestion.status === 'pending' ? 'default' :
                                suggestion.status === 'reviewed' ? 'secondary' :
                                'outline'
                              }>
                                {suggestion.status === 'pending' ? '⏳ En attente' :
                                 suggestion.status === 'reviewed' ? '✓ Vu' :
                                 suggestion.status === 'implemented' ? '✅ Implémenté' :
                                 suggestion.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {parsed.description}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                              <span>📧 {suggestion.email || 'Email non fourni'}</span>
                              <span>📅 {new Date(suggestion.created_at).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            {suggestion.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpdateSuggestionStatus(suggestion.id, 'reviewed')}
                              >
                                Marquer vu
                              </Button>
                            )}
                            {suggestion.status === 'reviewed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpdateSuggestionStatus(suggestion.id, 'implemented')}
                              >
                                Marquer fait
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteSuggestion(suggestion.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* News Tab */}
        <TabsContent value="news" className="space-y-4">
          <NewsManager />
        </TabsContent>

        {/* Diagnostic Tab */}
        <TabsContent value="diagnostic" className="space-y-4">
          <VideoDiagnostic />
        </TabsContent>
      </Tabs>

      {/* User Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>
              Modifiez les paramètres d'abonnement de {editingUser?.email}
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="plan">Plan</Label>
                <Select
                  value={editingUser.plan || 'none'}
                  onValueChange={(value) => setEditingUser({ ...editingUser, plan: value })}
                >
                  <SelectTrigger id="plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="studio">Studio</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="brands">Quota Marques</Label>
                <Input
                  id="brands"
                  type="number"
                  value={editingUser.quota_brands || 0}
                  onChange={(e) => setEditingUser({ ...editingUser, quota_brands: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="visuals">Quota Visuels/mois</Label>
                <Input
                  id="visuals"
                  type="number"
                  value={editingUser.quota_visuals_per_month || 0}
                  onChange={(e) => setEditingUser({ ...editingUser, quota_visuals_per_month: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <Label htmlFor="grantAccess">Accès manuel (sans Stripe)</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Accorder l'accès complet sans abonnement Stripe
                  </p>
                </div>
                <input
                  id="grantAccess"
                  type="checkbox"
                  checked={editingUser.granted_by_admin || false}
                  onChange={(e) => setEditingUser({ ...editingUser, granted_by_admin: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateUser}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Design Edit Dialog */}
      <Dialog open={designDialogOpen} onOpenChange={setDesignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le design</DialogTitle>
            <DialogDescription>
              Modifiez les informations du design Canva
            </DialogDescription>
          </DialogHeader>
          {editingDesign && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Titre</Label>
                <Input
                  id="title"
                  value={editingDesign.title}
                  onChange={(e) => setEditingDesign({ ...editingDesign, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="category">Niche / Catégorie</Label>
                <Select
                  value={editingDesign.category || ''}
                  onValueChange={(value) => setEditingDesign({ ...editingDesign, category: value })}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Sélectionner une niche" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="e-commerce">E-commerce</SelectItem>
                    <SelectItem value="coaching">Coaching</SelectItem>
                    <SelectItem value="immobilier">Immobilier</SelectItem>
                    <SelectItem value="restauration">Restauration</SelectItem>
                    <SelectItem value="mode">Mode & Beauté</SelectItem>
                    <SelectItem value="tech">Tech & SaaS</SelectItem>
                    <SelectItem value="sport">Sport & Fitness</SelectItem>
                    <SelectItem value="sante">Santé & Bien-être</SelectItem>
                    <SelectItem value="education">Éducation</SelectItem>
                    <SelectItem value="general">Général</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={editingDesign.description || ''}
                  onChange={(e) => setEditingDesign({ ...editingDesign, description: e.target.value })}
                  placeholder="Optionnel"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDesignDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateDesign}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
