import type { AlfieIntent } from '@/lib/types/alfie';

export function buildCloudinaryTags(intent: AlfieIntent, orderId: string): string[] {
  const ratio = intent.ratio ?? '1:1';
  const campaign = (intent.campaign ?? 'default').trim().toLowerCase() || 'default';

  return [
    `brand:${intent.brandId}`,
    `order:${orderId}`,
    `type:${intent.kind}`,
    `ratio:${ratio}`,
    `lang:${intent.language}`,
    `campaign:${campaign}`,
  ];
}
