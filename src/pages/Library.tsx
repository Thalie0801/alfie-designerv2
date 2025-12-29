import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Download, Trash2, Eye, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLibraryAssets } from '@/hooks/useLibraryAssets';
import { AssetCard } from '@/components/library/AssetCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AccessGuard } from '@/components/AccessGuard';
import { CarouselsTab } from '@/components/library/CarouselsTab';
import { VideoBatchesTab } from '@/components/library/VideoBatchesTab';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function Library() {
  const { user } = useAuth();
  const location = useLocation();
  
  // Lire le paramètre ?order= pour filtrer par commande
  const orderIdFromQuery = new URLSearchParams(location.search).get('order');
  
  // Si ?order= est présent, afficher l'onglet carrousels par défaut
  const [activeTab, setActiveTab] = useState<'images' | 'videos' | 'carousels' | 'thumbnails' | 'pinterest' | 'video-batches'>(
    orderIdFromQuery ? 'carousels' : 'images'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Map tab to asset type for hook (video-batches uses its own hook, default to 'images')
  const assetTypeForHook: 'images' | 'videos' | 'thumbnails' | 'pinterest' = 
    activeTab === 'carousels' || activeTab === 'video-batches' ? 'images' 
    : activeTab === 'pinterest' ? 'pinterest' 
    : activeTab;
  
  const { 
    assets, 
    loading, 
    errorMessage,
    deleteAsset, 
    downloadAsset,
    downloadMultiple,
    cleanupProcessingVideos,
    refetch
  } = useLibraryAssets(user?.id, assetTypeForHook);

  // Mobile session check on mount
  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      supabase.auth.getSession().then(({ data, error }) => {
        if (error || !data.session) {
          console.warn('[Library] Mobile session invalid:', error);
          toast.error("Session expirée – reconnectez-vous");
        }
      });
    }
  }, []);

  // Loading timeout warning (10 seconds)
  useEffect(() => {
    if (loading) {
      loadingTimeoutRef.current = setTimeout(() => {
        toast.info("Chargement long… vérifiez votre connexion");
      }, 10000);
    } else {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    }
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [loading]);

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

      {/* Error Alert */}
      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'images' | 'videos' | 'carousels' | 'thumbnails' | 'pinterest' | 'video-batches')}>
        <TabsList className="flex-wrap h-auto min-h-[4.5rem] sm:min-h-10 gap-1 justify-start w-full">
          <TabsTrigger value="images" className="text-xs sm:text-sm shrink-0">🖼️ Images</TabsTrigger>
          <TabsTrigger value="pinterest" className="text-xs sm:text-sm shrink-0">📌 Pinterest</TabsTrigger>
          <TabsTrigger value="thumbnails" className="text-xs sm:text-sm shrink-0">📺 Miniatures YT</TabsTrigger>
          <TabsTrigger value="videos" className="text-xs sm:text-sm shrink-0">🎬 Vidéos</TabsTrigger>
          <TabsTrigger value="carousels" className="text-xs sm:text-sm shrink-0">📱 Carrousels</TabsTrigger>
          <TabsTrigger value="video-batches" className="text-xs sm:text-sm shrink-0">🎬 Batches Vidéo</TabsTrigger>
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
        <TabsContent value="images" className="mt-6 min-h-[300px]">
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
        <TabsContent value="videos" className="mt-6 min-h-[300px]">
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
        <TabsContent value="carousels" className="mt-6 min-h-[300px]">
          <CarouselsTab orderId={orderIdFromQuery} />
        </TabsContent>

        {/* Video Batches Tab */}
        <TabsContent value="video-batches" className="mt-6 min-h-[300px]">
          <VideoBatchesTab orderId={orderIdFromQuery} />
        </TabsContent>

        {/* Pinterest Tab */}
        <TabsContent value="pinterest" className="mt-6 min-h-[300px]">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-lg" />
              ))}
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune image Pinterest pour l'instant.</p>
              <p className="text-sm">Générez au format "2:3 Pinterest" depuis le Studio</p>
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

        {/* YouTube Thumbnails Tab */}
        <TabsContent value="thumbnails" className="mt-6 min-h-[300px]">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-lg" />
              ))}
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune miniature YouTube pour l'instant.</p>
              <p className="text-sm">Générez depuis le Studio au format "Miniature YouTube (16:9)"</p>
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
      </Tabs>
    </div>
    </AccessGuard>
  );
}
