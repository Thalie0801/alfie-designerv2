import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, Check, Loader2, ExternalLink, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { trackEvent } from '@/utils/trackEvent';
import logo from '@/assets/alfie-logo-black.svg';

interface UpsellAsset {
  id: string;
  structure: string;
  variation_index: number;
  cloudinary_url: string | null;
  file_name: string | null;
}

interface UpsellOrder {
  id: string;
  status: string;
  total_visuals: number | null;
  generated_count: number | null;
  zip_url: string | null;
}

const STRUCTURE_LABELS: Record<string, { label: string; emoji: string }> = {
  benefit: { label: 'Bénéfice', emoji: '💡' },
  proof: { label: 'Preuve', emoji: '🏆' },
  offer: { label: 'Offre + CTA', emoji: '🚀' },
  problem_solution: { label: 'Problème → Solution', emoji: '🎯' },
  checklist_steps: { label: 'Checklist', emoji: '✅' },
};

export default function UpsellVisuelsDelivery() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<UpsellOrder | null>(null);
  const [assets, setAssets] = useState<UpsellAsset[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderId = searchParams.get('orderId');

  useEffect(() => {
    if (!orderId) {
      setError('ID de commande manquant');
      return;
    }

    fetchOrder();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel(`upsell-order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'upsell_orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          console.log('Order updated:', payload.new);
          setOrder(payload.new as UpsellOrder);
          
          if (payload.new.status === 'completed') {
            fetchAssets();
            trackEvent('upsell_visuels_completed', { orderId });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const fetchOrder = async () => {
    if (!orderId) return;

    const { data, error } = await supabase
      .from('upsell_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('Error fetching order:', error);
      setError('Commande non trouvée');
      return;
    }

    setOrder(data);
    
    if (data.status === 'completed') {
      fetchAssets();
    }
  };

  const fetchAssets = async () => {
    if (!orderId) return;

    const { data, error } = await supabase
      .from('upsell_assets')
      .select('*')
      .eq('upsell_order_id', orderId)
      .order('structure')
      .order('variation_index');

    if (error) {
      console.error('Error fetching assets:', error);
      return;
    }

    setAssets(data || []);
  };

  const handleDownloadZip = async () => {
    if (!orderId) return;
    
    setIsDownloading(true);
    trackEvent('upsell_visuels_download_started', { orderId });

    try {
      const { data, error } = await supabase.functions.invoke('download-upsell-zip', {
        body: { orderId },
      });

      if (error) {
        throw error;
      }

      if (data?.zipUrl) {
        window.open(data.zipUrl, '_blank');
        toast.success('Téléchargement lancé !');
        trackEvent('upsell_visuels_download_completed', { orderId });
      }
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Erreur lors du téléchargement');
    } finally {
      setIsDownloading(false);
    }
  };

  const progress = order 
    ? Math.round(((order.generated_count || 0) / (order.total_visuals || 30)) * 100) 
    : 0;

  const isGenerating = order?.status === 'generating' || order?.status === 'paid';
  const isCompleted = order?.status === 'completed';

  // Group assets by structure
  const assetsByStructure = assets.reduce((acc, asset) => {
    if (!acc[asset.structure]) {
      acc[asset.structure] = [];
    }
    acc[asset.structure].push(asset);
    return acc;
  }, {} as Record<string, UpsellAsset[]>);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-alfie-peach/20 via-background to-alfie-lilac/20 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-bold text-destructive">{error}</h1>
          <Button onClick={() => navigate('/library')}>
            Retour à la bibliothèque
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-alfie-peach/20 via-background to-alfie-lilac/20">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button 
            onClick={() => navigate('/library')} 
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Bibliothèque</span>
          </button>
          <img src={logo} alt="Alfie" className="h-7" />
          <div className="w-24" />
        </div>
      </header>

      <main className="px-4 py-8 max-w-6xl mx-auto">
        {/* Generating State */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto text-center space-y-8"
          >
            <div className="space-y-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-alfie-mint to-alfie-lilac flex items-center justify-center"
              >
                <span className="text-4xl">🎨</span>
              </motion.div>
              
              <h1 className="text-2xl font-bold">
                Ton pack 30 visuels est en création...
              </h1>
              <p className="text-muted-foreground">
                Alfie génère chaque visuel avec soin. Reste sur cette page !
              </p>
            </div>

            <div className="space-y-3">
              <Progress value={progress} className="h-3" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {order?.generated_count || 0} / {order?.total_visuals || 30} visuels
                </span>
                <span className="font-medium text-alfie-mint">{progress}%</span>
              </div>
            </div>

            {/* Current structure being generated */}
            {order && (order.generated_count || 0) > 0 && (
              <div className="p-4 rounded-xl bg-muted/50 text-sm">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Génération en cours...
              </div>
            )}
          </motion.div>
        )}

        {/* Completed State */}
        {isCompleted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* Success Header */}
            <div className="text-center space-y-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center"
              >
                <Check className="h-10 w-10 text-green-600" />
              </motion.div>
              
              <h1 className="text-3xl font-bold">Ton pack est prêt ! 🎉</h1>
              <p className="text-muted-foreground">
                30 visuels générés avec succès
              </p>
            </div>

            {/* Download Button */}
            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={handleDownloadZip}
                disabled={isDownloading}
                className="gap-2 bg-gradient-to-r from-alfie-mint to-alfie-pink text-foreground font-bold"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Préparation...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    Télécharger ZIP (30 visuels)
                  </>
                )}
              </Button>
            </div>

            {/* Assets Grid by Structure */}
            <div className="space-y-8">
              {Object.entries(STRUCTURE_LABELS).map(([key, { label, emoji }]) => {
                const structureAssets = assetsByStructure[key] || [];
                if (structureAssets.length === 0) return null;

                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{emoji}</span>
                      <h2 className="text-xl font-semibold">{label}</h2>
                      <Badge variant="outline">{structureAssets.length} visuels</Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                      {structureAssets.map((asset, index) => (
                        <motion.div
                          key={asset.id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.05 }}
                          className="group relative"
                        >
                          <div className="aspect-[4/5] bg-muted rounded-xl overflow-hidden border border-border">
                            {asset.cloudinary_url ? (
                              <img
                                src={asset.cloudinary_url}
                                alt={`${label} v${asset.variation_index}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                            <a
                              href={asset.cloudinary_url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                            >
                              <ExternalLink className="w-5 h-5 text-white" />
                            </a>
                          </div>

                          <p className="text-xs text-center text-muted-foreground mt-2">
                            V{asset.variation_index}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer Actions */}
            <div className="text-center pt-8 space-y-4">
              <p className="text-muted-foreground">
                Tu peux retrouver ces visuels dans ta bibliothèque Alfie.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => navigate('/library')}
                  className="gap-2"
                >
                  Voir ma bibliothèque
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/studio')}
                  className="gap-2"
                >
                  Créer plus de visuels
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading initial state */}
        {!order && !error && (
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="h-8 w-8 animate-spin text-alfie-mint" />
          </div>
        )}
      </main>
    </div>
  );
}
