import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Download, Trash2, Eye } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLibraryAssets } from '@/hooks/useLibraryAssets';
import { AssetCard } from '@/components/library/AssetCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { VideoDiagnostic } from '@/components/VideoDiagnostic';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Library() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'images' | 'videos'>('images');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [periodFilter, setPeriodFilter] = useState<'all' | 'current'>('all');

  const { 
    assets, 
    loading, 
    deleteAsset, 
    downloadAsset,
    downloadMultiple,
    cleanupProcessingVideos
  } = useLibraryAssets(user?.id, activeTab);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    const periodParam = params.get('period');

    if (tabParam === 'images' || tabParam === 'videos') {
      setActiveTab(tabParam);
    }

    if (periodParam === 'current') {
      setPeriodFilter('current');
    } else {
      setPeriodFilter('all');
    }
  }, [location.search]);

  const startOfMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);

  // Auto cleanup when switching to videos tab
  useEffect(() => {
    if (activeTab === 'videos') {
      cleanupProcessingVideos();
    }
  }, [activeTab]);

  const filteredAssets = assets
    .filter(asset => {
      if (periodFilter !== 'current') return true;
      const assetDate = new Date(asset.created_at);
      return assetDate >= startOfMonth;
    })
    .filter(asset =>
      !searchQuery ||
      asset.prompt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.engine?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleTabChange = (value: 'images' | 'videos') => {
    setActiveTab(value);
    const params = new URLSearchParams(location.search);
    params.set('tab', value);
    if (periodFilter === 'all') {
      params.delete('period');
    }
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  const clearPeriodFilter = () => {
    setPeriodFilter('all');
    const params = new URLSearchParams(location.search);
    params.delete('period');
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

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
    const now = new Date();
    const expiry = new Date(expiresAt);
    const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const handleDebugGenerate = async () => {
    if (!user?.id) {
      toast.error('Vous devez être connecté.');
      return;
    }
    const prompt = 'Golden retriever in a playful Halloween scene, cinematic';
    try {
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: { prompt, aspectRatio: '9:16' }
      });
      if (error || data?.error) {
        const msg = (error as any)?.message || data?.error || 'Erreur inconnue';
        toast.error(`Échec génération: ${msg}`);
        return;
      }
      const predictionId = data?.id as string | undefined;
      const provider = data?.provider as 'sora' | 'seededance' | 'kling' | undefined;
      const jobId = data?.jobId as string | undefined;
      const jobShortId = data?.jobShortId as string | undefined;

      if (!predictionId || !provider || !jobId) {
        toast.error('Réponse invalide du backend (identifiants manquants)');
        return;
      }
      await supabase
        .from('media_generations')
        .insert({
          user_id: user.id,
          type: 'video',
          engine: provider,
          status: 'processing',
          prompt,
          woofs: 1,
          output_url: '',
          job_id: null, // HOTFIX: éviter tout cast UUID pendant la migration
          metadata: { predictionId, provider, jobId, jobShortId }
        });
      toast.success(`Génération vidéo lancée (${provider})`);
    } catch (e: any) {
      console.error('Debug generate error:', e);
      toast.error(e.message || 'Erreur lors du lancement');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          📚 Bibliothèque
        </h1>
        <p className="text-muted-foreground">
          Toutes vos créations en un seul endroit. Stockage 30 jours.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as 'images' | 'videos')}>
        <TabsList>
          <TabsTrigger value="images">🖼️ Images</TabsTrigger>
          <TabsTrigger value="videos">🎬 Vidéos</TabsTrigger>
        </TabsList>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {periodFilter === 'current' && (
            <Badge variant="outline" className="flex items-center gap-2 px-3 py-1">
              Période : mois en cours
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                onClick={clearPeriodFilter}
                aria-label="Retirer le filtre période"
              >
                ✕
              </Button>
            </Badge>
          )}

          {activeTab === 'videos' && (
            <>
              <Button 
                size="sm" 
                variant="outline"
                onClick={cleanupProcessingVideos}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Nettoyer les vidéos bloquées
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDebugGenerate}
              >
                Génération vidéo (debug)
              </Button>
            </>
          )}

          {selectedAssets.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selectedAssets.length} sélectionné(s)</Badge>
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleDownloadSelected}
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
            </div>
          )}

          {filteredAssets.length > 0 && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleSelectAll}
            >
              {selectedAssets.length === filteredAssets.length ? 'Désélectionner tout' : 'Tout sélectionner'}
            </Button>
          )}
        </div>

        {/* Images Tab */}
        <TabsContent value="images" className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
  );
}
