import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getAuthHeader } from '@/lib/auth';

export interface LibraryAsset {
  id: string;
  type: 'image' | 'video';
  output_url: string;
  thumbnail_url?: string;
  prompt?: string;
  engine?: string;
  duration_seconds?: number;
  file_size_bytes?: number;
  woofs: number;
  created_at: string;
  expires_at: string;
  is_source_upload: boolean;
  brand_id?: string;
  status?: string;
  metadata?: any;
  job_id?: string;
}

export function useLibraryAssets(userId: string | undefined, type: 'images' | 'videos') {
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssets = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const assetType = type === 'images' ? 'image' : 'video';
      
      // Optimized query with limit to avoid timeouts
      const { data, error } = await supabase
        .from('media_generations')
        .select('id, type, status, output_url, thumbnail_url, prompt, engine, woofs, created_at, expires_at, metadata, job_id, is_source_upload, brand_id')
        .eq('user_id', userId)
        .eq('type', assetType)
        .order('created_at', { ascending: false })
        .limit(50); // Reduced limit to improve performance

      if (error) throw error;

      setAssets((data || []) as LibraryAsset[]);

      // Vérifier et débloquer les vidéos "processing" (si prédiction connue)
      if (type === 'videos' && data && data.length > 0) {
        const authHeader = await getAuthHeader();
        const processing = (data as any[]).filter(
          a => a.type === 'video' && ((a.status === 'processing') || !a.output_url)
        );
        for (const a of processing) {
          const genId = a.metadata?.predictionId || a.metadata?.id;
          const provider = a.engine || a.metadata?.provider || 'sora';
          const jobId = a.job_id || a.metadata?.jobId;
          if (!genId) continue;
          try {
            const { data: statusData, error: statusError } = await supabase.functions.invoke('generate-video', {
              body: { generationId: genId, provider, jobId },
              headers: authHeader,
            });
            if (!statusError && statusData?.status === 'succeeded') {
              const videoUrl = Array.isArray(statusData.output) ? statusData.output[0] : statusData.output;
              await supabase
                .from('media_generations')
                .update({ output_url: videoUrl, status: 'completed' })
                .eq('id', a.id);
            }
          } catch (e) {
            console.warn('Verification vidéo échouée pour', a.id, e);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast.error('Erreur lors du chargement des assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [userId, type]);

  // Auto-refresh when videos are processing
  useEffect(() => {
    if (type === 'videos' && assets.some(a => a.type === 'video' && !a.output_url)) {
      const id = setInterval(fetchAssets, 10000);
      return () => clearInterval(id);
    }
  }, [assets, type]);

  const deleteAsset = async (assetId: string) => {
    try {
      const { error } = await supabase
        .from('media_generations')
        .delete()
        .eq('id', assetId);

      if (error) throw error;

      setAssets(prev => prev.filter(a => a.id !== assetId));
      toast.success('Asset supprimé');
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const downloadAsset = async (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    if (!asset.output_url) {
      toast.info(asset.type === 'video' ? 'Vidéo encore en génération… réessayez dans quelques minutes.' : "Fichier indisponible");
      return;
    }

    try {
      let blob: Blob;
      
      // Si c'est une image base64, la convertir en blob
      if (asset.output_url.startsWith('data:')) {
        const base64Data = asset.output_url.split(',')[1];
        const mimeType = asset.output_url.match(/data:([^;]+);/)?.[1] || 'image/png';
        const byteString = atob(base64Data);
        const arrayBuffer = new ArrayBuffer(byteString.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        
        for (let i = 0; i < byteString.length; i++) {
          uint8Array[i] = byteString.charCodeAt(i);
        }
        
        blob = new Blob([arrayBuffer], { type: mimeType });
      } else {
        // Sinon, télécharger depuis l'URL
        const response = await fetch(asset.output_url);
        if (!response.ok) throw new Error('Erreur lors du téléchargement');
        blob = await response.blob();
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Extension basée sur le type
      const extension = asset.type === 'image' ? 'png' : 'mp4';
      const timestamp = new Date().toISOString().slice(0, 10);
      a.download = `${asset.type}-${timestamp}-${asset.id.slice(0, 8)}.${extension}`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Téléchargement démarré');
    } catch (error) {
      console.error('Error downloading asset:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const downloadMultiple = async (assetIds: string[]) => {
    toast.info(`Téléchargement de ${assetIds.length} asset(s)...`);
    
    for (const id of assetIds) {
      await downloadAsset(id);
      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    toast.success('Téléchargements terminés');
  };

  const cleanupProcessingVideos = async () => {
    try {
      // Try backend function first
      const { data, error } = await supabase.functions.invoke('cleanup-processing-videos', {
        headers: await getAuthHeader(),
      });
      
      if (error) {
        console.warn('Backend cleanup failed, using client-side fallback:', error);
        // Fallback: delete directly via client
        if (!userId) return;
        
        const { data: deletedData, error: deleteError } = await supabase
          .from('media_generations')
          .delete()
          .eq('user_id', userId)
          .eq('type', 'video')
          .eq('status', 'processing')
          .select();

        if (deleteError) throw deleteError;
        
        const count = deletedData?.length || 0;
        toast.success(`${count} vidéo(s) en processing supprimée(s)`);
      } else {
        toast.success(data.message || 'Vidéos bloquées nettoyées');
      }
      
      await fetchAssets();
    } catch (error) {
      console.error('Error cleaning up videos:', error);
      toast.error('Erreur lors du nettoyage');
    }
  };

  return {
    assets,
    loading,
    deleteAsset,
    downloadAsset,
    downloadMultiple,
    cleanupProcessingVideos,
    refetch: fetchAssets
  };
}
