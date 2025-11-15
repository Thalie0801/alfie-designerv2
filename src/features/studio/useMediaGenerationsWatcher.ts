import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type MediaGenerationStatus =
  | 'queued'
  | 'running'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'pending';

export interface MediaGenerationRow {
  id: string;
  status: MediaGenerationStatus;
  output_url: string | null;
  render_url: string | null;
  thumbnail_url: string | null;
  metadata: Record<string, any> | null;
  type: string | null;
}

export type MediaGenerationUpdateHandler = (row: MediaGenerationRow) => void;

export function useMediaGenerationsWatcher(
  resourceIds: string[],
  onUpdate: MediaGenerationUpdateHandler,
) {
  useEffect(() => {
    if (!resourceIds.length) return;

    let isCancelled = false;

    const fetchInitial = async () => {
      const { data, error } = await supabase
        .from('media_generations')
        .select('id, status, output_url, render_url, thumbnail_url, metadata, type')
        .in('id', resourceIds);

      if (error) {
        console.error('[StudioV2] unable to fetch media_generations', error);
        return;
      }

      if (isCancelled) return;
      for (const row of data ?? []) {
        onUpdate({
          id: row.id,
          status: (row.status as MediaGenerationStatus) ?? 'pending',
          output_url: row.output_url ?? null,
          render_url: row.render_url ?? null,
          thumbnail_url: row.thumbnail_url ?? null,
          metadata: (row.metadata as Record<string, any> | null) ?? null,
          type: (row.type as string | null) ?? null,
        });
      }
    };

    fetchInitial();

    const quotedIds = resourceIds.map((id) => `'${id}'`).join(',');

    const channel = supabase
      .channel(`studio-v2-media-generations:${resourceIds.join(',')}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'media_generations',
          filter: `id=in.(${quotedIds})`,
        },
        (payload) => {
          const row = (payload.new || payload.old) as MediaGenerationRow | null;
          if (!row) return;
          onUpdate({
            id: row.id,
            status: (row.status as MediaGenerationStatus) ?? 'pending',
            output_url: row.output_url ?? null,
            render_url: row.render_url ?? null,
            thumbnail_url: row.thumbnail_url ?? null,
            metadata: (row.metadata as Record<string, any> | null) ?? null,
            type: (row.type as string | null) ?? null,
          });
        },
      )
      .subscribe();

    return () => {
      isCancelled = true;
      supabase.removeChannel(channel);
    };
  }, [resourceIds, onUpdate]);
}
