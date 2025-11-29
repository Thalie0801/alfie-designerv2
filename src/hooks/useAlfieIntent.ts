import { useCallback, useState } from 'react';
import type { UnifiedAlfieIntent } from '@/lib/types/alfie';

// Legacy default intent for backward compatibility with Creator.tsx
const DEFAULT_INTENT: Partial<UnifiedAlfieIntent> & { topic?: string; format?: 'image' | 'carousel' } = {
  brandId: '',
  kind: 'image',
  count: 1,
  platform: 'instagram',
  ratio: '4:5',
  title: '',
  goal: 'engagement',
  tone: 'professionnel',
  prompt: '',
  // Legacy fields for backward compatibility
  topic: '',
};

export function useAlfieIntent(initial?: Partial<UnifiedAlfieIntent> & { topic?: string; format?: 'image' | 'carousel' }) {
  const [intent, setIntent] = useState<typeof DEFAULT_INTENT>(() => ({
    ...DEFAULT_INTENT,
    ...initial,
  }));

  const setField = useCallback(<K extends keyof typeof DEFAULT_INTENT>(key: K, value: any) => {
    setIntent((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const resetIntent = useCallback(() => {
    setIntent((prev) => ({
      ...DEFAULT_INTENT,
      brandId: prev.brandId,
    }));
  }, []);

  return {
    intent,
    setField,
    resetIntent,
  };
}
