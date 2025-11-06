import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AspectFormat, LibraryAsset } from '@/types/chat';

// Normaliser les formats pour éviter les surprises
const normalizeFormat = (v?: string): AspectFormat => {
  if (!v) return '4:5';
  const s = v.toLowerCase();
  if (s.includes('1080x1350') || s.includes('4:5')) return '4:5';
  if (s.includes('9:16') || s.includes('portrait')) return '9:16';
  if (s.includes('16:9') || s.includes('landscape')) return '16:9';
  if (s.includes('1:1') || s.includes('square')) return '1:1';
  return '4:5';
};

/**
 * Hook pour s'abonner aux assets d'un order en temps réel
 * et gérer le fallback polling
 */
export function useLibraryAssetsSubscription(orderId: string | null) {
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [total, setTotal] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Réinitialiser quand orderId change
  useEffect(() => {
    console.log('[LibraryAssets] orderId changed:', orderId);
    setAssets([]);
    setTotal(0);
  }, [orderId]);

  // Fonction pour charger le total attendu depuis order_items
  const loadExpectedTotal = useCallback(async () => {
    if (!orderId) return 0;

    const { data, error } = await supabase
      .from('order_items')
      .select('id, type, brief_json')
      .eq('order_id', orderId);

    if (error) {
      console.error('[LibraryAssets] Failed to load order_items:', error);
      return 0;
    }

    if (!data) return 0;

    // Calculer le total attendu
    // carousel items -> nombre de slides dans brief_json
    // image items -> 1 par item
    let expectedTotal = 0;
    for (const item of data) {
      if (item.type === 'carousel') {
        const brief = item.brief_json as any;
        // Check multiple possible locations for slide count
        const slideCount = 
          brief?.slideCount || 
          brief?.slides?.length || 
          brief?.briefs?.[0]?.numSlides ||
          brief?.count ||
          5;
        expectedTotal += slideCount;
      } else if (item.type === 'image') {
        const brief = item.brief_json as any;
        expectedTotal += brief?.count || 1;
      }
    }

    console.log('[LibraryAssets] Expected total:', expectedTotal);
    setTotal(expectedTotal);
    return expectedTotal;
  }, [orderId]);

  // Fonction pour charger les assets existants
  const loadExistingAssets = useCallback(async () => {
    if (!orderId) return;

    const { data, error } = await supabase
      .from('library_assets')
      .select('id, cloudinary_url, slide_index, type, format')
      .eq('order_id', orderId)
      .order('slide_index', { ascending: true });

    if (error) {
      console.error('[LibraryAssets] Failed to load existing assets:', error);
      return;
    }

    if (data && data.length > 0) {
      const mapped: LibraryAsset[] = data.map(row => ({
        id: row.id,
        url: row.cloudinary_url,
        slideIndex: row.slide_index ?? 0,
        type: row.type,
        format: normalizeFormat(row.format ?? undefined)
      }));

      setAssets(mapped);
      console.log('[LibraryAssets] Loaded existing assets:', mapped.length);
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) {
      console.log('[LibraryAssets] No orderId, skipping');
      return;
    }

    console.log('[LibraryAssets] Starting subscription for order:', orderId);

    // 1. Charger le total attendu
    loadExpectedTotal();

    // 2. Charger les assets existants
    loadExistingAssets();

    // 3. S'abonner au Realtime
    const channel = supabase
      .channel(`library_assets:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'library_assets',
          filter: `order_id=eq.${orderId}`
        },
        (payload: any) => {
          console.log('[LibraryAssets] New asset received:', payload.new);

          const newAsset = payload.new;
          const newItem: LibraryAsset = {
            id: newAsset.id,
            url: newAsset.cloudinary_url,
            slideIndex: newAsset.slide_index ?? 0,
            type: newAsset.type,
            format: normalizeFormat(newAsset.format ?? undefined)
          };

          setAssets(prev => {
            // Déduplication
            if (prev.some(p => p.id === newItem.id)) {
              console.log('[LibraryAssets] Duplicate asset, skipping:', newItem.id);
              return prev;
            }

            const next = [...prev, newItem].sort((a, b) => a.slideIndex - b.slideIndex);
            console.log('[LibraryAssets] Asset added, total:', next.length);
            return next;
          });
        }
      )
      .subscribe((status) => {
        console.log('[LibraryAssets] Realtime channel status:', status);
      });

    channelRef.current = channel;

    // 4. Polling fallback (every 3s, max 100 times = 5 minutes)
    let pollCount = 0;
    const maxPolls = 100;

    pollingIntervalRef.current = setInterval(async () => {
      pollCount++;

      if (pollCount >= maxPolls) {
        console.log('[LibraryAssets] Max polling reached, stopping');
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        return;
      }

      console.log(`[LibraryAssets] Polling fallback (${pollCount}/${maxPolls})...`);
      await loadExistingAssets();
    }, 3000);

    // 5. Cleanup
    return () => {
      if (channelRef.current) {
        console.log('[LibraryAssets] Cleaning up subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [orderId, loadExistingAssets, loadExpectedTotal]);

  return {
    assets,
    done: assets.length,
    total,
    refresh: loadExistingAssets
  };
}
