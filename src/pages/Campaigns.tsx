import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Download, 
  Trash2, 
  Eye, 
  RefreshCw, 
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Image as ImageIcon,
  Film,
  LayoutGrid
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCampaigns, useDeleteCampaign, useUpdateCampaign } from '@/hooks/useCampaigns';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { AccessGuard } from '@/components/AccessGuard';
import type { Campaign, Asset, AssetStatus, AssetType } from '@/types/campaign';

// Asset status badge component
function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const variants = {
    pending: { icon: Clock, color: 'bg-gray-500', label: 'En attente' },
    generating: { icon: Loader2, color: 'bg-blue-500', label: 'Génération...' },
    ready: { icon: CheckCircle2, color: 'bg-green-500', label: 'Prêt' },
    failed: { icon: XCircle, color: 'bg-red-500', label: 'Échec' },
  };

  const { icon: Icon, color, label } = variants[status];

  return (
    <Badge variant="secondary" className="gap-1">
      <Icon className={`w-3 h-3 ${status === 'generating' ? 'animate-spin' : ''}`} />
      {label}
    </Badge>
  );
}

// Asset type icon component
function AssetTypeIcon({ type }: { type: AssetType }) {
  const icons = {
    image: ImageIcon,
    carousel: LayoutGrid,
    video: Film,
  };

  const Icon = icons[type];
  return <Icon className="w-4 h-4" />;
}

// Campaign card component
function CampaignCard({ 
  campaign, 
  onDelete, 
  onView 
}: { 
  campaign: Campaign & { assets?: Asset[] }; 
  onDelete: (id: string) => void;
  onView: (id: string) => void;
}) {
  const assets = campaign.assets || [];
  
  // Count assets by status
  const statusCounts = {
    pending: assets.filter(a => a.status === 'pending').length,
    generating: assets.filter(a => a.status === 'generating').length,
    ready: assets.filter(a => a.status === 'ready').length,
    failed: assets.filter(a => a.status === 'failed').length,
  };

  // Count assets by type
  const typeCounts = {
    image: assets.filter(a => a.type === 'image').length,
    carousel: assets.filter(a => a.type === 'carousel').length,
    video: assets.filter(a => a.type === 'video').length,
  };

  const totalAssets = assets.length;
  const readyAssets = statusCounts.ready;
  const progress = totalAssets > 0 ? (readyAssets / totalAssets) * 100 : 0;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{campaign.name}</CardTitle>
            <CardDescription className="mt-1">
              Créée le {new Date(campaign.created_at).toLocaleDateString('fr-FR')}
            </CardDescription>
          </div>
          <Badge variant={campaign.status === 'done' ? 'default' : 'secondary'}>
            {campaign.status === 'draft' && 'Brouillon'}
            {campaign.status === 'running' && 'En cours'}
            {campaign.status === 'done' && 'Terminée'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar */}
        {totalAssets > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progression</span>
              <span className="font-medium">{readyAssets} / {totalAssets}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Asset type counts */}
        <div className="flex gap-4 text-sm">
          {typeCounts.image > 0 && (
            <div className="flex items-center gap-1">
              <AssetTypeIcon type="image" />
              <span>{typeCounts.image} image{typeCounts.image > 1 ? 's' : ''}</span>
            </div>
          )}
          {typeCounts.carousel > 0 && (
            <div className="flex items-center gap-1">
              <AssetTypeIcon type="carousel" />
              <span>{typeCounts.carousel} carrousel{typeCounts.carousel > 1 ? 's' : ''}</span>
            </div>
          )}
          {typeCounts.video > 0 && (
            <div className="flex items-center gap-1">
              <AssetTypeIcon type="video" />
              <span>{typeCounts.video} vidéo{typeCounts.video > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Status counts */}
        {totalAssets > 0 && (
          <div className="flex flex-wrap gap-2">
            {statusCounts.generating > 0 && (
              <AssetStatusBadge status="generating" />
            )}
            {statusCounts.pending > 0 && (
              <AssetStatusBadge status="pending" />
            )}
            {statusCounts.failed > 0 && (
              <AssetStatusBadge status="failed" />
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onView(campaign.id)}
          className="flex-1"
        >
          <Eye className="w-4 h-4 mr-2" />
          Voir les détails
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          disabled={readyAssets === 0}
          className="flex-1"
        >
          <Download className="w-4 h-4 mr-2" />
          Télécharger ZIP
        </Button>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => onDelete(campaign.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}

// Main Campaigns page component
export default function Campaigns() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'running' | 'done'>('all');

  const { data: campaigns, isLoading, refetch } = useCampaigns();
  const deleteCampaignMutation = useDeleteCampaign();

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette campagne ? Tous les assets seront également supprimés.')) {
      return;
    }

    try {
      await deleteCampaignMutation.mutateAsync(id);
      toast.success('Campagne supprimée avec succès');
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast.error('Erreur lors de la suppression de la campagne');
    }
  };

  const handleView = (id: string) => {
    navigate(`/campaigns/${id}`);
  };

  // Filter campaigns
  const filteredCampaigns = (campaigns || []).filter(campaign => {
    // Filter by tab
    if (activeTab !== 'all' && campaign.status !== activeTab) {
      return false;
    }

    // Filter by search query
    if (searchQuery && !campaign.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    return true;
  });

  return (
    <AccessGuard>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Mes Campagnes</h1>
            <p className="text-muted-foreground mt-2">
              Gérez vos campagnes d'images, carrousels et vidéos
            </p>
          </div>
          <Button onClick={() => navigate('/create')}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle campagne
          </Button>
        </div>

        {/* Search and filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Rechercher une campagne..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">Toutes</TabsTrigger>
            <TabsTrigger value="running">En cours</TabsTrigger>
            <TabsTrigger value="done">Terminées</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? 'Aucune campagne trouvée pour cette recherche.' 
                : 'Vous n\'avez pas encore de campagne.'}
            </p>
            <Button onClick={() => navigate('/create')}>
              <Plus className="w-4 h-4 mr-2" />
              Créer ma première campagne
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onDelete={handleDelete}
                onView={handleView}
              />
            ))}
          </div>
        )}
      </div>
    </AccessGuard>
  );
}
