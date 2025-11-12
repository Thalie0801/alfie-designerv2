import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface CarouselItem {
  id: string;
  url: string;
  index: number;
}

// Helper pour construire l'URL publique de manière robuste via l'API Supabase
function makePublicUrlRobust(storageKey: string): string {
  console.log('[makePublicUrlRobust] Input storageKey:', storageKey);
  
  const bucket = 'media-generations';
  
  // Normaliser le chemin (retirer le préfixe bucket s'il existe)
  let path = storageKey;
  if (path.startsWith(`${bucket}/`)) {
    path = path.replace(`${bucket}/`, '');
  }
  
  // Utiliser l'API officielle
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  
  console.log('[makePublicUrlRobust] Generated URL:', data.publicUrl);
  return data.publicUrl;
}

export function useCarouselSubscription(jobSetId: string, total: number) {
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [done, setDone] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // 🔄 RÉINITIALISER quand jobSetId change
  useEffect(() => {
    console.log('[Carousel] jobSetId changed:', jobSetId);
    setItems([]);
    setDone(0);
  }, [jobSetId]);

  // 1️⃣ Fonction de chargement des assets existants (extractée pour être réutilisable)
  const loadExistingAssets = useCallback(async () => {
    if (!jobSetId) return;
    
    // Defensive: join job_sets to ensure we only see assets from our brands
    const { data, error } = await supabase
      .from('assets')
      .select(`
        id, 
        storage_key, 
        index_in_set, 
        meta,
        job_sets!inner(brand_id)
      `)
      .eq('job_set_id', jobSetId)
      .order('index_in_set', { ascending: true });

    if (error) {
      console.error('[Carousel] Failed to load existing assets:', error);
      return;
    }

    if (data && data.length > 0) {
      const mapped: CarouselItem[] = data.map(row => {
        const meta = row.meta as { public_url?: string } | null;
        // Priorité à meta.public_url, sinon utiliser l'API robuste
        const url = meta?.public_url || makePublicUrlRobust(row.storage_key);
        return {
          id: row.id,
          index: row.index_in_set ?? 0,
          url
        };
      });
      setItems(mapped);
      setDone(mapped.length);
    }
  }, [jobSetId]);

  useEffect(() => {
    console.log('[useCarouselSubscription] Hook triggered with jobSetId:', jobSetId);
    
    if (!jobSetId) {
      console.log('[useCarouselSubscription] No jobSetId, skipping');
      return;
    }

    // Charger les assets existants au montage
    console.log('[useCarouselSubscription] Loading existing assets...');
    loadExistingAssets();

    // 2️⃣ S'abonner au Realtime
    const channel = supabase
      .channel(`jobset:${jobSetId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'assets',
          filter: `job_set_id=eq.${jobSetId}`
        },
        (payload: any) => {
          console.log('[useCarouselSubscription] New asset received:', payload.new);
          
          const newAsset = payload.new;
          const meta = newAsset.meta as { public_url?: string } | null;
          const newItem: CarouselItem = {
            id: newAsset.id,
            index: newAsset.index_in_set ?? 0,
            url: meta?.public_url || makePublicUrlRobust(newAsset.storage_key)
          };

          setItems(prev => {
            // Déduplication
            if (prev.some(p => p.id === newItem.id)) {
              console.log('[useCarouselSubscription] Duplicate asset, skipping:', newItem.id);
              return prev;
            }
            
            const next = [...prev, newItem].sort((a, b) => a.index - b.index);
            setDone(next.length);
            console.log('[useCarouselSubscription] Asset added, total:', next.length);
            return next;
          });
        }
      )
      .subscribe((status) => {
        console.log('[useCarouselSubscription] Realtime channel status:', status);
      });

    channelRef.current = channel;

    // 3️⃣ Polling fallback (every 2s for 2 minutes)
    let pollCount = 0;
    const maxPolls = 60; // 2 minutes (60 × 2s)
    
    const pollingInterval = setInterval(async () => {
      pollCount++;
      
      // Stop polling if we've reached the total or max time
      if (pollCount >= maxPolls || done >= total) {
        clearInterval(pollingInterval);
        return;
      }
      
      console.log(`[Carousel] Polling fallback (${pollCount}/${maxPolls})...`);
      await loadExistingAssets();
    }, 2000);

    // 4️⃣ Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      clearInterval(pollingInterval);
    };
  }, [jobSetId, loadExistingAssets, done, total]);

  return { items, done, total, refresh: loadExistingAssets };
}
