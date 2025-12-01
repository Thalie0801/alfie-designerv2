import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Download, Trash2, Eye, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLibraryAssets } from '@/hooks/useLibraryAssets';
import { AssetCard } from '@/components/library/AssetCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AccessGuard } from '@/components/AccessGuard';
import { CarouselsTab } from '@/components/library/CarouselsTab';

export default function Library() {
  const { user } = useAuth();
  const location = useLocation();
  
  // Lire le paramètre ?order= pour filtrer par commande
  const orderIdFromQuery = new URLSearchParams(location.search).get('order');
  
  // Si ?order= est présent, afficher l'onglet carrousels par défaut
  const [activeTab, setActiveTab] = useState<'images' | 'videos' | 'carousels'>(
    orderIdFromQuery ? 'carousels' : 'images'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);

  const { 
    assets, 
    loading, 
    deleteAsset, 
    downloadAsset,
    downloadMultiple,
    cleanupProcessingVideos,
    refetch
  } = useLibraryAssets(user?.id, activeTab === 'carousels' ? 'images' : activeTab);

  // Auto cleanup when switching to videos tab
  useEffect(() => {
    if (activeTab === 'videos') {
      cleanupProcessingVideos();
    }
  }, [activeTab]);

  const filteredAssets = assets
    .filter(asset => {
      // Filtre par order_id si présent dans l'URL
      if (orderIdFromQuery && activeTab !== 'carousels') {
        const assetOrderId = asset.metadata?.orderId;
        if (assetOrderId !== orderIdFromQuery) return false;
      }
      // Filtre par recherche
      if (searchQuery && !asset.engine?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });

  const handleSelectAsset = (assetId: string) => {
    setSelectedAssets(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  const handleSelectAll = () => {
    if (selectedAssets.length === filteredAssets.length) {
      setSelectedAssets([]);
    } else {
      setSelectedAssets(filteredAssets.map(a => a.id));
    }
  };

  const handleDownloadSelected = async () => {
    await downloadMultiple(selectedAssets);
    setSelectedAssets([]);
  };

  const handleDeleteSelected = async () => {
    for (const id of selectedAssets) {
      await deleteAsset(id);
    }
    setSelectedAssets([]);
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    // ✅ Vidéos permanentes (Cloudinary) n'ont pas d'expiration
    if (!expiresAt || expiresAt === 'null') return 9999;
    
    const now = new Date();
    const expiry = new Date(expiresAt);
    
    // Si date invalide, considérer comme permanent
    if (isNaN(expiry.getTime())) return 9999;
    
    const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <AccessGuard>
      <div className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          📚 Bibliothèque
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Toutes vos créations en un seul endroit. Stockage 30 jours.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'images' | 'videos' | 'carousels')}>
        <TabsList>
          <TabsTrigger value="images">🖼️ Images</TabsTrigger>
          <TabsTrigger value="videos">🎬 Vidéos</TabsTrigger>
          <TabsTrigger value="carousels">📱 Carrousels</TabsTrigger>
        </TabsList>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4">
          <div className="w-full sm:flex-1 sm:min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Rechercher..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                setSelectedAssets([]);
                refetch();
              }}
              className="touch-target"
            >
              <RefreshCw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Actualiser</span>
            </Button>

            {filteredAssets.length > 0 && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleSelectAll}
                className="touch-target"
              >
                {selectedAssets.length === filteredAssets.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </Button>
            )}

            {activeTab === 'videos' && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={cleanupProcessingVideos}
                className="touch-target"
              >
                <Trash2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Nettoyer</span>
              </Button>
            )}
          </div>

          {selectedAssets.length > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Badge variant="secondary" className="flex-shrink-0">{selectedAssets.length} sélectionné(s)</Badge>
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleDownloadSelected}
                className="flex-1 sm:flex-initial touch-target"
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={handleDeleteSelected}
                className="flex-1 sm:flex-initial touch-target"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
            </div>
          )}
        </div>

        {/* Images Tab */}
        <TabsContent value="images" className="mt-6">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-lg" />
              ))}
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune image pour l'instant.</p>
              <p className="text-sm">Générez depuis le chat, elles arrivent ici automatiquement.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {filteredAssets.map(asset => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  selected={selectedAssets.includes(asset.id)}
                  onSelect={() => handleSelectAsset(asset.id)}
                  onDownload={() => downloadAsset(asset.id)}
                  onDelete={() => deleteAsset(asset.id)}
                  daysUntilExpiry={getDaysUntilExpiry(asset.expires_at)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Videos Tab */}
        <TabsContent value="videos" className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-lg" />
              ))}
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune vidéo pour l'instant.</p>
              <p className="text-sm">Générez depuis le chat, elles arrivent ici automatiquement.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredAssets.map(asset => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  selected={selectedAssets.includes(asset.id)}
                  onSelect={() => handleSelectAsset(asset.id)}
                  onDownload={() => downloadAsset(asset.id)}
                  onDelete={() => deleteAsset(asset.id)}
                  daysUntilExpiry={getDaysUntilExpiry(asset.expires_at)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Carousels Tab */}
        <TabsContent value="carousels" className="mt-6">
          <CarouselsTab orderId={orderIdFromQuery} />
        </TabsContent>
      </Tabs>
    </div>
    </AccessGuard>
  );
}
