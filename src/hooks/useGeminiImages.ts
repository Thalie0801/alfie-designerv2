'use client';

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type AR = '1:1' | '9:16' | '16:9' | '3:4';

type GenerateOptions = {
  prompt: string;
  aspectRatio?: AR;
  count?: number;
  seed?: number;
};

export function useGeminiImages() {
  const [loading, setLoading] = useState(false);
  const [urls, setUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generate = async (promptOrOptions: string | GenerateOptions, aspectRatio?: AR, count = 1, seed?: number) => {
    const options: GenerateOptions =
      typeof promptOrOptions === 'string'
        ? { prompt: promptOrOptions, aspectRatio, count, seed }
        : promptOrOptions;

    setError(null);
    setLoading(true);
    setUrls([]);

    try {
      const body = {
        prompt: options.prompt,
        aspectRatio: options.aspectRatio ?? '1:1',
        count: options.count ?? 1,
        seed: options.seed,
      };

      const { data, error } = await supabase.functions.invoke('generate-image', { body });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Échec génération');
      setUrls(data.urls || []);
      return (data.urls as string[]) ?? [];
    } catch (e: any) {
      setError(e?.message || 'Erreur génération');
      return [];
    } finally {
      setLoading(false);
    }
  };

  return { loading, urls, error, generate };
}
