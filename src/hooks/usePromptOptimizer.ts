import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OptimizationResult {
  optimizedPrompt: string;
  reasoning: string;
  negativePrompt: string;
  suggestedAspectRatio: string;
  estimatedGenerationTime: string;
  brandAlignment: string;
}

interface OptimizeParams {
  prompt: string;
  type: "image" | "carousel" | "video";
  brandId?: string;
  aspectRatio?: string;
}

export function usePromptOptimizer() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const optimize = async (params: OptimizeParams) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("alfie-optimize-prompt", {
        body: params,
      });

      if (fnError) {
        setError(fnError.message);
        return null;
      }

      if (data?.data) {
        setResult(data.data);
        return data.data;
      } else if (data) {
        setResult(data);
        return data;
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'optimisation");
    } finally {
      setIsLoading(false);
    }

    return null;
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return { optimize, isLoading, result, error, reset };
}
