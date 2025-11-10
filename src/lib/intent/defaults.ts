import type { AlfieIntent } from '@/lib/types/alfie';

export function withIntentDefaults(
  intent: Partial<AlfieIntent> & Pick<AlfieIntent, 'kind' | 'brandId'>,
): AlfieIntent {
  const ratio = intent.ratio ?? '1:1';
  const language = intent.language ?? 'fr';
  const slides = intent.kind === 'carousel' ? intent.slides ?? 5 : undefined;
  const quality = intent.quality ?? 'fast';

  return {
    ...intent,
    ratio,
    language,
    slides,
    quality,
  } as AlfieIntent;
}
