import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const MEDIA_URL_KEYS = [
  'videoUrl',
  'video_url',
  'url',
  'output',
  'outputUrl',
  'output_url',
  'downloadUrl',
  'download_url',
  'resultUrl',
  'result_url',
  'fileUrl',
  'file_url'
] as const;

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null;

const extractMediaUrl = (payload: unknown): string | null => {
  if (!payload) return null;

  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    return trimmed.startsWith('http') ? trimmed : null;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const extracted = extractMediaUrl(item);
      if (extracted) return extracted;
    }
    return null;
  }

  if (isRecord(payload)) {
    for (const key of MEDIA_URL_KEYS) {
      if (key in payload) {
        const extracted = extractMediaUrl(payload[key]);
        if (extracted) return extracted;
      }
    }

    if ('data' in payload) {
      const extracted = extractMediaUrl(payload.data);
      if (extracted) return extracted;
    }

    if ('result' in payload) {
      const extracted = extractMediaUrl(payload.result);
      if (extracted) return extracted;
    }
  }

  return null;
};

const extractDuration = (payload: unknown): number | null => {
  if (payload == null) return null;
  if (typeof payload === 'number' && Number.isFinite(payload)) {
    return payload;
  }

  if (typeof payload === 'string') {
    const parsed = Number(payload);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (isRecord(payload)) {
    const keys = ['duration', 'duration_seconds', 'durationSeconds', 'predict_time'];
    for (const key of keys) {
      if (key in payload) {
        const extracted = extractDuration(payload[key]);
        if (extracted !== null) {
          return extracted;
        }
      }
    }
  }

  return null;
};

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
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  const fetchAssets = async (isRetry = false) => {
    if (!userId) {
      console.warn('[LibraryAssets] No userId provided');
      return;
    }
    
    console.log(`[LibraryAssets] Fetching ${type} for user ${userId}${isRetry ? ` (retry ${retryCount + 1}/${MAX_RETRIES})` : ''}`);
    setLoading(true);
    
    try {
      // Get active brand
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_brand_id')
        .eq('id', userId)
        .single();

      const activeBrandId = profile?.active_brand_id;
      if (!activeBrandId) {
        console.warn('[useLibraryAssets] No active brand selected');
        setAssets([]);
        setLoading(false);
        return;
      }

      // Pour images : exclure les carousel_slide qui doivent apparaître uniquement dans l'onglet Carrousels
      let query = supabase
        .from('media_generations')
        .select('id, type, status, output_url, thumbnail_url, prompt, engine, woofs, created_at, expires_at, metadata, job_id, is_source_upload, brand_id, duration_seconds, file_size_bytes')
        .eq('user_id', userId);

      if (type === 'images') {
        // Images = type 'image' uniquement, PAS les carousel_slide, PAS les animated_image
        query = query
          .eq('type', 'image')
          .is('metadata->carousel_id', null)
          .is('metadata->isAnimatedVideo', null);
      } else {
        // Videos = type 'video' OU type 'image' avec tag animated_image
        // On utilise une approche en trois requêtes pour gérer les cas

        // 1. Vidéos classiques (type='video' SANS ken_burns)
        const { data: videoData, error: videoError } = await supabase
          .from('media_generations')
          .select('id, type, status, output_url, thumbnail_url, prompt, engine, woofs, created_at, expires_at, metadata, job_id, is_source_upload, brand_id, duration_seconds, file_size_bytes')
          .eq('user_id', userId)
          .eq('type', 'video')
          .is('metadata->animationType', null)
          .order('created_at', { ascending: false })
          .limit(20);

        if (videoError) {
          console.error('[LibraryAssets] Video query error:', videoError);
          throw videoError;
        }

        // 2. Vidéos animées Ken Burns depuis media_generations
        const { data: animatedFromMedia, error: mediaAnimError } = await supabase
          .from('media_generations')
          .select('id, type, status, output_url, thumbnail_url, prompt, engine, woofs, created_at, expires_at, metadata, job_id, is_source_upload, brand_id, duration_seconds, file_size_bytes')
          .eq('user_id', userId)
          .eq('type', 'video')
          .eq('metadata->animationType', 'ken_burns')
          .order('created_at', { ascending: false })
          .limit(20);

        if (mediaAnimError) {
          console.error('[LibraryAssets] Animated from media query error:', mediaAnimError);
        }

        // 3. Vidéos animées depuis library_assets (backup)
        const { data: animatedData, error: animatedError } = await supabase
          .from('library_assets')
          .select('id, type, cloudinary_url, metadata, created_at, brand_id, tags, format')
          .eq('user_id', userId)
          .contains('tags', ['animated_image'])
          .order('created_at', { ascending: false })
          .limit(20);

        if (animatedError) {
          console.error('[LibraryAssets] Animated from library query error:', animatedError);
        }

        // Fusionner les trois sources
        const combinedData = [
          ...(videoData || []),
          ...(animatedFromMedia || []),
          ...(animatedData || []).map(a => ({
            id: a.id,
            type: 'video' as const,
            status: 'completed',
            output_url: a.cloudinary_url,
            thumbnail_url: a.cloudinary_url?.replace('/video/', '/image/').replace('.mp4', '.jpg') || null,
            prompt: null,
            engine: null,
            woofs: 3,
            created_at: a.created_at || new Date().toISOString(),
            expires_at: null,
            metadata: a.metadata,
            job_id: null,
            is_source_upload: false,
            brand_id: a.brand_id,
            duration_seconds: (a.metadata as any)?.duration || 3,
            file_size_bytes: null,
          }))
        ].sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });

        console.log(`[LibraryAssets] Loaded ${videoData?.length || 0} videos + ${animatedFromMedia?.length || 0} ken_burns + ${animatedData?.length || 0} animated images`);
        
        const mappedAssets = combinedData.map(asset => ({
          ...asset,
          output_url: asset.output_url || asset.thumbnail_url || '',
          thumbnail_url: asset.thumbnail_url || undefined,
        })) as LibraryAsset[];
        
        setAssets(mappedAssets);
        setRetryCount(0);
        setLoading(false);
        return;
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('[LibraryAssets] Query error:', error);
        throw error;
      }

      console.log(`[LibraryAssets] Loaded ${data?.length || 0} ${type}`);
      
      // Map data with actual output_url from database
      const mappedAssets = (data || []).map(asset => ({
        ...asset,
        output_url: asset.output_url || asset.thumbnail_url || '',
        thumbnail_url: asset.thumbnail_url || undefined,
      })) as LibraryAsset[];
      
      setAssets(mappedAssets);
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error('[LibraryAssets] Fetch error:', error);
      
      // Retry logic
      if (retryCount < MAX_RETRIES) {
        console.log(`[LibraryAssets] Retrying in 2 seconds... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => fetchAssets(true), 2000);
        return;
      }
      
      // Detailed error messages
      let errorMessage = 'Erreur lors du chargement des assets';
      
      if (error?.message?.includes('timeout') || error?.code === 'ETIMEDOUT') {
        errorMessage = 'Timeout lors du chargement. Vos assets sont peut-être trop volumineux.';
      } else if (error?.message?.includes('auth') || error?.code === '401') {
        errorMessage = 'Erreur d\'authentification. Veuillez vous reconnecter.';
      } else if (error?.message?.includes('network')) {
        errorMessage = 'Erreur réseau. Vérifiez votre connexion.';
      } else if (error?.message) {
        errorMessage = `Erreur: ${error.message}`;
      }
      
      toast.error(errorMessage);
      setRetryCount(0); // Reset retry count
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
    if (!asset) {
      console.error('[Download] Asset not found in local state:', assetId);
      toast.error('Asset introuvable');
      return;
    }

    console.log('[Download] Starting download for asset:', assetId);
    console.log('[Download] Asset type:', asset.type);
    console.log('[Download] Asset status:', asset.status);

    try {
      // Load the full output_url from database (not in initial query to avoid heavy load)
      const { data: fullAsset, error } = await supabase
        .from('media_generations')
        .select('output_url, type, status')
        .eq('id', assetId)
        .single();
      
      console.log('[Download] DB query result:', { fullAsset, error });
      
      if (error) {
        console.error('[Download] Error loading asset from DB:', error);
        throw error;
      }
      
      const outputUrl = fullAsset?.output_url;
      
      console.log('[Download] Output URL:', outputUrl ? `${outputUrl.substring(0, 100)}...` : 'null');
      console.log('[Download] Output URL type:', outputUrl?.startsWith('data:') ? 'base64' : outputUrl?.startsWith('http') ? 'http' : 'unknown');
      
      if (!outputUrl) {
        console.warn('[Download] No output_url found in DB');
        toast.info(asset.type === 'video' ? 'Vidéo encore en génération… réessayez dans quelques minutes.' : "Fichier indisponible");
        return;
      }

      const SUPABASE_STORAGE_MARKER = '/storage/v1/object/public/media-generations/';
      if (outputUrl.includes(SUPABASE_STORAGE_MARKER)) {
        const [, pathPart] = outputUrl.split(SUPABASE_STORAGE_MARKER);
        if (pathPart) {
          const { data: signed, error: signedError } = await supabase.storage
            .from('media-generations')
            .createSignedUrl(pathPart, 60 * 60);
          if (!signedError && signed?.signedUrl) {
            window.open(signed.signedUrl, '_blank');
            toast.success('Téléchargement prêt');
            return;
          }
          if (signedError) {
            console.warn('[Download] Signed URL error:', signedError);
          }
        }
      }

      let blob: Blob;
      
      // Si c'est une image base64, la convertir en blob
      if (outputUrl.startsWith('data:')) {
        const base64Data = outputUrl.split(',')[1];
        const mimeType = outputUrl.match(/data:([^;]+);/)?.[1] || 'image/png';
        const byteString = atob(base64Data);
        const arrayBuffer = new ArrayBuffer(byteString.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        
        for (let i = 0; i < byteString.length; i++) {
          uint8Array[i] = byteString.charCodeAt(i);
        }
        
        blob = new Blob([arrayBuffer], { type: mimeType });
      } else {
        // Sinon, télécharger depuis l'URL
        const response = await fetch(outputUrl);
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
      const { data, error } = await supabase.functions.invoke('cleanup-processing-videos', {});
      
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
