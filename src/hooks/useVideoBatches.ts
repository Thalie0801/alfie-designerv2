// src/hooks/useVideoBatches.ts
// Hook for managing video batches - loading, actions, realtime updates

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface BatchClip {
  id: string;
  clipIndex: number;
  status: "queued" | "processing" | "done" | "error";
  error?: string;
  anchorUrl?: string;
  clipUrl?: string;
  durationSeconds: number;
}

export interface ClipText {
  title?: string;
  subtitle?: string;
}

export interface BatchVideoTexts {
  // Dynamic clips (1-10)
  clips?: ClipText[];
  // Legacy format support
  clip1Title?: string;
  clip1Subtitle?: string;
  clip2Title?: string;
  clip2Subtitle?: string;
  clip3Title?: string;
  clip3Subtitle?: string;
  // Common fields
  caption?: string;
  cta?: string;
}

export interface BatchVideo {
  id: string;
  video_index: number;
  title?: string;
  status: "queued" | "processing" | "done" | "error";
  error?: string;
  clips: BatchClip[];
  texts?: BatchVideoTexts;
  progress: number;
  completedClips: number;
  totalClips: number;
}

export interface VideoBatch {
  id: string;
  inputPrompt: string;
  settings: {
    videos_count: number;
    clips_per_video?: number; // NEW - default 3, max 10
    ratio: string;
    language: string;
    sfx_transition: string;
    style_lock?: string;
  };
  status: "queued" | "processing" | "done" | "error";
  error?: string;
  createdAt: string;
  updatedAt: string;
  videos: BatchVideo[];
  progress: number;
  completedClips: number;
  errorClips: number;
  totalClips: number;
}

export function useVideoBatches(userId?: string, brandId?: string) {
  const [batches, setBatches] = useState<VideoBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  // Load all batches for user
  const loadBatches = useCallback(async () => {
    if (!userId) {
      setBatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get all batches
      let query = supabase
        .from("video_batches")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (brandId) {
        query = query.eq("brand_id", brandId);
      }

      const { data: batchesData, error: batchesError } = await query;

      if (batchesError) throw batchesError;

      // For each batch, load full status via edge function
      const fullBatches: VideoBatch[] = [];
      
      for (const batch of batchesData || []) {
        try {
          const { data, error: statusError } = await supabase.functions.invoke(
            "video-batch-status",
            { body: { batchId: batch.id } }
          );

          if (statusError) {
            console.error(`[useVideoBatches] Status error for batch ${batch.id}:`, statusError);
            continue;
          }

          if (data?.batch) {
            fullBatches.push({
              id: data.batch.id,
              inputPrompt: data.batch.inputPrompt,
              settings: data.batch.settings,
              status: data.batch.status,
              error: data.batch.error,
              createdAt: data.batch.createdAt,
              updatedAt: data.batch.updatedAt,
              videos: data.videos || [],
              progress: data.progress || 0,
              completedClips: data.completedClips || 0,
              errorClips: data.errorClips || 0,
              totalClips: data.totalClips || 0,
            });
          }
        } catch (e) {
          console.error(`[useVideoBatches] Failed to load batch ${batch.id}:`, e);
        }
      }

      if (mounted.current) {
        setBatches(fullBatches);
        setError(null);
      }
    } catch (e) {
      console.error("[useVideoBatches] Load error:", e);
      if (mounted.current) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
        setBatches([]);
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [userId, brandId]);

  // Initial load
  useEffect(() => {
    mounted.current = true;
    loadBatches();
    return () => {
      mounted.current = false;
    };
  }, [loadBatches]);

  // Realtime subscription for batches updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`video_batches_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "video_batches",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Reload all batches on any change
          loadBatches();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "batch_clips",
        },
        () => {
          // Reload on clip updates
          loadBatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadBatches]);

  // Retry a clip
  const retryClip = useCallback(async (clipId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("video-clip-retry", {
        body: { clipId },
      });

      if (error) throw error;

      toast.success("Clip remis en file d'attente");
      loadBatches();
      return data;
    } catch (e) {
      console.error("[useVideoBatches] Retry error:", e);
      toast.error("Erreur lors de la re-génération");
      throw e;
    }
  }, [loadBatches]);

  // Download CSV
  const downloadCSV = useCallback(async (batchId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("video-batch-csv", {
        body: { batchId },
      });

      if (error) throw error;

      // Create download link
      const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `batch-${batchId.slice(0, 8)}-canva.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("CSV exporté !");
    } catch (e) {
      console.error("[useVideoBatches] CSV error:", e);
      toast.error("Erreur lors de l'export CSV");
    }
  }, []);

  // Download ZIP
  const downloadZIP = useCallback(async (batchId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("video-batch-zip", {
        body: { batchId },
      });

      if (error) throw error;

      // Use JSZip to create the ZIP client-side
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Add files from response
      if (data.files) {
        for (const [path, content] of Object.entries(data.files)) {
          zip.file(path, content as string);
        }
      }

      // Generate and download
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename || `batch-${batchId.slice(0, 8)}.zip`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("ZIP téléchargé !");
    } catch (e) {
      console.error("[useVideoBatches] ZIP error:", e);
      toast.error("Erreur lors du téléchargement ZIP");
    }
  }, []);

  // Copy all texts (supports dynamic N clips)
  const copyAllTexts = useCallback((batch: VideoBatch) => {
    const clipsPerVideo = batch.settings?.clips_per_video || 3;
    let allTexts = `📹 BATCH VIDÉOS - ${batch.videos.length} vidéos × ${clipsPerVideo} clips\n`;
    allTexts += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (const video of batch.videos) {
      allTexts += `🎬 VIDÉO ${video.video_index}: ${video.title || 'Sans titre'}\n\n`;
      
      if (video.texts?.caption) {
        allTexts += `📝 Caption:\n${video.texts.caption}\n\n`;
      }
      
      if (video.texts?.cta) {
        allTexts += `🎯 CTA: ${video.texts.cta}\n\n`;
      }

      allTexts += `Clips:\n`;
      // Dynamic clips support
      for (let i = 1; i <= clipsPerVideo; i++) {
        const clipTitle = video.texts?.clips?.[i - 1]?.title || 
                         (video.texts as Record<string, unknown>)?.[`clip${i}Title`] as string || '-';
        const clipSubtitle = video.texts?.clips?.[i - 1]?.subtitle || 
                            (video.texts as Record<string, unknown>)?.[`clip${i}Subtitle`] as string || '-';
        allTexts += `${i}. ${clipTitle} | ${clipSubtitle}\n`;
      }
      allTexts += `\n---\n\n`;
    }

    navigator.clipboard.writeText(allTexts.trim());
    toast.success("Textes copiés !");
  }, []);

  return {
    batches,
    loading,
    error,
    refetch: loadBatches,
    retryClip,
    downloadCSV,
    downloadZIP,
    copyAllTexts,
  };
}
