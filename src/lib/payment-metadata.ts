import { z } from 'zod';

function sanitizeDescription(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'text/html');
      return doc.body.textContent ?? '';
    } catch (error) {
      console.warn('[payment-metadata] Failed to sanitize description via DOMParser:', error);
    }
  }

  return trimmed.replace(/<[^>]*>/g, '');
}

export const PaymentMetadataSchema = z.object({
  amount: z.number().positive().max(1_000_000),
  currency: z.enum(['EUR', 'USD', 'GBP']),
  description: z
    .string()
    .max(500)
    .transform((val) => sanitizeDescription(val)),
  reference: z.string().regex(/^[A-Z0-9-]+$/),
  customerEmail: z.string().email(),
});

export type PaymentMetadataInput = z.input<typeof PaymentMetadataSchema>;
export type PaymentMetadata = z.infer<typeof PaymentMetadataSchema>;

export function sanitizePaymentMetadata(rawData: unknown): PaymentMetadata {
  try {
    return PaymentMetadataSchema.parse(rawData);
  } catch (error) {
    throw new Error('Données de paiement invalides');
  }
}
