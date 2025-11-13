import { useCallback, useState } from 'react';
import type { AlfieIntent } from '@/lib/types/alfie';

const DEFAULT_INTENT: AlfieIntent = {
  brandId: '',
  format: 'image',
  count: 1,
  topic: '',
};

export function useAlfieIntent(initial?: Partial<AlfieIntent>) {
  const [intent, setIntent] = useState<AlfieIntent>(() => ({
    ...DEFAULT_INTENT,
    ...initial,
  }));

  const setField = useCallback(<K extends keyof AlfieIntent>(key: K, value: AlfieIntent[K]) => {
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
