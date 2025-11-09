import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type RecentAsset = {
  id: string;
  type: string;
  url: string;
  created_at: string | null;
  thumbnail_url?: string | null;
  order_id?: string | null;
};

interface UseRecentAssetsResult {
  assets: RecentAsset[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRecentAssets(limit = 8): UseRecentAssetsResult {
  const { user } = useAuth();
  const [assets, setAssets] = useState<RecentAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadAssets = useCallback(async () => {
    if (!user?.id) {
      if (mountedRef.current) {
        setAssets([]);
        setIsLoading(false);
        setError(null);
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("media_generations")
        .select("id, type, output_url, render_url, thumbnail_url, created_at, order_id, status")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (queryError) throw queryError;

      const parsed = (data ?? [])
        .map((row: any) => {
          const url = row.render_url || row.output_url;
          if (!url) return null;
          return {
            id: row.id,
            type: row.type,
            url,
            created_at: row.created_at,
            thumbnail_url: row.thumbnail_url ?? undefined,
            order_id: row.order_id ?? undefined,
          };
        })
        .filter((asset): asset is NonNullable<typeof asset> => asset !== null) as RecentAsset[];

      if (mountedRef.current) {
        setAssets(parsed);
      }
    } catch (err: any) {
      console.error("[useRecentAssets] Failed to load assets", err);
      if (mountedRef.current) {
        setError("Impossible de charger les derniers visuels.");
        setAssets([]);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [limit, user?.id]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  return {
    assets,
    isLoading,
    error,
    refresh: loadAssets,
  };
}
