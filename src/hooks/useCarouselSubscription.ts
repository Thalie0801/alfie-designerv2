import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface CarouselItem {
  id: string;
  url: string;
  index: number;
}

export function useCarouselSubscription(jobSetId: string, total: number) {
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [done, setDone] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!jobSetId) return;

    // 1️⃣ Charger les assets existants (page refresh)
    const loadExistingAssets = async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('id, index_in_set, storage_key, meta')
        .eq('job_set_id', jobSetId)
        .order('index_in_set', { ascending: true });

      if (error) {
        console.error('[Carousel] Failed to load existing assets:', error);
        return;
      }

      if (data && data.length > 0) {
        const mapped: CarouselItem[] = data.map(row => {
          const meta = row.meta as { public_url?: string } | null;
          return {
            id: row.id,
            index: row.index_in_set ?? 0,
            url: meta?.public_url || makePublicUrl(row.storage_key)
          };
        });
        setItems(mapped);
        setDone(mapped.length);
      }
    };

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
          const newAsset = payload.new;
          const meta = newAsset.meta as { public_url?: string } | null;
          const newItem: CarouselItem = {
            id: newAsset.id,
            index: newAsset.index_in_set ?? 0,
            url: meta?.public_url || makePublicUrl(newAsset.storage_key)
          };

          setItems(prev => {
            // Déduplication
            if (prev.some(p => p.id === newItem.id)) return prev;
            
            const next = [...prev, newItem].sort((a, b) => a.index - b.index);
            setDone(next.length);
            return next;
          });
        }
      )
      .subscribe((status) => {
        console.log('[Carousel] Realtime status:', status);
      });

    channelRef.current = channel;

    // 3️⃣ Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [jobSetId]);

  return { items, done, total };
}

// Helper pour construire l'URL publique depuis storage_key
function makePublicUrl(storageKey: string): string {
  const bucket = 'media-generations';
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  if (storageKey?.startsWith(`${bucket}/`)) {
    const path = storageKey.replace(`${bucket}/`, '');
    return `${baseUrl}/storage/v1/object/public/${bucket}/${path}`;
  }
  
  // Fallback
  return `${baseUrl}/storage/v1/object/public/${bucket}/${storageKey}`;
}
