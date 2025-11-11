import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

function sanitizeDescription(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  // Strip HTML tags to avoid script injection
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

export type PaymentMetadata = z.infer<typeof PaymentMetadataSchema>;
