import { supabase } from "@/lib/supabaseClient";
import { useCallback } from "react";

type SyncResp = { imageUrl: string };
type AsyncResp = { jobId: string };

export function useGenerateImage() {
  const generate = useCallback(async (payload: {
    brandId: string;
    prompt: string;
    ratio: "1:1"|"9:16"|"16:9"|"3:4";
    mode: "image"|"carousel"|"video";
    imageUrl?: string;
    imageBase64?: string;
    count?: number;
    slidesPerCarousel?: number;
  }) => {
    const { data, error } = await supabase.functions.invoke("alfie-generate", {
      body: payload,
      headers: { "content-type":"application/json" },
    });

    if (error) throw new Error(error.message || "Edge Function error");

    if ((data as SyncResp)?.imageUrl) return (data as SyncResp).imageUrl;

    if ((data as AsyncResp)?.jobId) {
      const jobId = (data as AsyncResp).jobId;
      const started = Date.now();
      while (Date.now() - started < 90_000) {
        await new Promise(r=>setTimeout(r, 1500));
        // appelle ton endpoint /api/jobs/:id ou Supabase pour lire le job
        // if (status === "done") return imageUrl;
        // if (status === "error") throw new Error(error_text);
      }
      throw new Error("Timeout: la génération prend trop de temps");
    }

    throw new Error("Réponse inattendue (ni imageUrl ni jobId).");
  }, []);

  return { generate };
}
