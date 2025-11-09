import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseSafeClient';
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

const COMPLETED_STATUSES = ['succeeded', 'completed', 'ready', 'success', 'finished'];

type ProviderEngine = 'sora' | 'seededance' | 'kling';

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

interface ProviderStatusInfo {
  provider: string;
  engine?: ProviderEngine;
}

const resolveProviderForStatus = (asset: any): ProviderStatusInfo => {
  const metadata = isRecord(asset?.metadata) ? asset.metadata : {};
  const candidates = [
    metadata.providerResolved,
    metadata.providerStatus,
    metadata.providerInternal,
    metadata.providerNormalized,
    metadata.provider,
    asset?.engine,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const value = candidate.trim().toLowerCase();
    if (!value) continue;

    if (['seededance', 'replicate', 'replicate-bytedance', 'bytedance', 'byte-dance'].includes(value)) {
      return { provider: 'seededance', engine: 'seededance' };
    }

    if (['kling', 'kie', 'kie.ai', 'kling-ai'].includes(value)) {
      return { provider: 'kling', engine: 'kling' };
    }

    if (['sora', 'sora2'].includes(value)) {
      return { provider: 'sora', engine: 'sora' };
    }

    if (['animate', 'ffmpeg-backend', 'animate-backend'].includes(value)) {
      return { provider: 'animate' };
    }
  }

  return { provider: 'seededance', engine: 'seededance' };
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

      const assetType = type === 'images' ? 'image' : 'video';
      
      // Optimized query: exclude output_url to avoid loading large base64 images
      // Output URL will be loaded individually when downloading
      const { data, error } = await supabase
        .from('media_generations')
        .select('id, type, status, thumbnail_url, prompt, engine, woofs, created_at, expires_at, metadata, job_id, is_source_upload, brand_id, duration_seconds, file_size_bytes')
        .eq('user_id', userId)
        .eq('type', assetType)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('[LibraryAssets] Query error:', error);
        throw error;
      }

      console.log(`[LibraryAssets] Loaded ${data?.length || 0} ${type}`);
      
      // Map data to include a placeholder output_url that will be loaded on demand
      const mappedAssets = (data || []).map(asset => ({
        ...asset,
        output_url: asset.thumbnail_url || '', // Use thumbnail for preview, load full on download
      })) as LibraryAsset[];
      
      setAssets(mappedAssets);
      setRetryCount(0); // Reset retry count on success

      // Vérifier et débloquer les vidéos "processing" (si prédiction connue)
      if (type === 'videos' && data && data.length > 0) {
        const processing = (data as any[]).filter(
          a => a.type === 'video' && ((a.status === 'processing') || !a.output_url)
        );
        for (const a of processing) {
          const genId = a.metadata?.predictionId || a.metadata?.id;
          const { provider: providerForStatus, engine: engineForDb } = resolveProviderForStatus(a);
          const jobId =
            a.job_id ||
            a.metadata?.jobId ||
            a.metadata?.job_id ||
            a.metadata?.taskId ||
            a.metadata?.task_id;
          if (!genId) continue;
          try {
            const { data: statusData, error: statusError } = await supabase.functions.invoke('generate-video', {
              body: { generationId: genId, provider: providerForStatus, jobId },
            });
            const hasBackendError = Boolean(statusData?.error);
            if (!statusError && !hasBackendError) {
              const rawStatus =
                (typeof statusData?.status === 'string' && statusData.status) ||
                (typeof statusData?.state === 'string' && statusData.state) ||
                '';
              const status = rawStatus.toLowerCase();
              const isCompleted = COMPLETED_STATUSES.includes(status);
              const isFailed = ['failed', 'error', 'cancelled', 'canceled'].includes(status);
              const videoUrl =
                extractMediaUrl(statusData?.output) ||
                extractMediaUrl(statusData?.metadata) ||
                extractMediaUrl(statusData);

              const updatePayload: Record<string, any> = {};

              const metadataUpdate: Record<string, any> = isRecord(a.metadata) ? { ...a.metadata } : {};
              metadataUpdate.providerResolved = providerForStatus;
              metadataUpdate.provider = metadataUpdate.provider ?? providerForStatus;
              metadataUpdate.providerInternal = metadataUpdate.providerInternal ?? providerForStatus;
              if (typeof statusData?.provider === 'string') {
                metadataUpdate.provider = statusData.provider;
              }
              if (typeof statusData?.providerInternal === 'string') {
                metadataUpdate.providerInternal = statusData.providerInternal;
              }
              metadataUpdate.lastStatus = status || rawStatus;
              metadataUpdate.statusCheckedAt = new Date().toISOString();

              if (videoUrl) {
                metadataUpdate.outputUrl = videoUrl;
              }

              const durationFromStatus =
                extractDuration(statusData?.metadata) ?? extractDuration(statusData?.duration) ?? extractDuration(statusData);
              if (durationFromStatus !== null) {
                updatePayload.duration_seconds = Math.round(durationFromStatus);
              }

              if (isCompleted && videoUrl) {
                updatePayload.output_url = videoUrl;
                updatePayload.status = 'completed';
                if (engineForDb) {
                  updatePayload.engine = engineForDb;
                  metadataUpdate.provider = metadataUpdate.provider ?? engineForDb;
                }
              } else if (isFailed) {
                updatePayload.status = 'failed';
              }

              if (Object.keys(metadataUpdate).length > 0) {
                updatePayload.metadata = metadataUpdate;
              }

              if (Object.keys(updatePayload).length > 0) {
                await supabase
                  .from('media_generations')
                  .update(updatePayload)
                  .eq('id', a.id);
              }
            }
          } catch (e) {
            console.warn('Verification vidéo échouée pour', a.id, e);
          }
        }
      }
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
      let downloadUrl = outputUrl;
      if (outputUrl.includes(SUPABASE_STORAGE_MARKER)) {
        const [, pathPart] = outputUrl.split(SUPABASE_STORAGE_MARKER);
        if (pathPart) {
          const { data: signed, error: signedError } = await supabase.storage
            .from('media-generations')
            .createSignedUrl(pathPart, 60 * 60);
          if (!signedError && signed?.signedUrl) {
            downloadUrl = signed.signedUrl;
          }
          if (signedError) {
            console.warn('[Download] Signed URL error:', signedError);
          }
        }
      }

      let blob: Blob;

      // Si c'est une image base64, la convertir en blob
      if (downloadUrl.startsWith('data:')) {
        const base64Data = downloadUrl.split(',')[1];
        const mimeType = downloadUrl.match(/data:([^;]+);/)?.[1] || 'image/png';
        const byteString = atob(base64Data);
        const arrayBuffer = new ArrayBuffer(byteString.length);
        const uint8Array = new Uint8Array(arrayBuffer);

        for (let i = 0; i < byteString.length; i++) {
          uint8Array[i] = byteString.charCodeAt(i);
        }

        blob = new Blob([arrayBuffer], { type: mimeType });
      } else {
        // Sinon, télécharger depuis l'URL
        const response = await fetch(downloadUrl);
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
