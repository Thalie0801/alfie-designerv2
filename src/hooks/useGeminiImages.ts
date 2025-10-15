'use client';

import { useState } from 'react';

type AR = '1:1' | '9:16' | '16:9' | '3:4';

export function useGeminiImages() {
  const [loading, setLoading] = useState(false);
  const [urls, setUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generate = async (prompt: string, aspectRatio: AR = '1:1', count = 1, seed?: number) => {
    setLoading(true);
    setError(null);
    setUrls([]);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspectRatio, count, seed }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setUrls(data.urls || []);
      return data.urls as string[];
    } catch (e: any) {
      setError(e?.message || 'Erreur génération');
      return [];
    } finally {
      setLoading(false);
    }
  };

  return { loading, urls, error, generate };
}
