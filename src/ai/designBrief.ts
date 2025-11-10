import { z } from "zod";

const TONE_PACKS = ["brand_default", "apple_like", "playful", "b2b_crisp"] as const;

export const DesignBriefSchema = z.object({
  brandId: z.string().min(1, "brandId requis"),
  kind: z.enum(["image", "carousel", "video"]),
  objective: z.enum(["acquisition", "conversion", "awareness"]),
  format: z.enum(["1:1", "4:5", "9:16", "16:9"]),
  style: z.enum(["minimal", "vibrant", "professional", "brand"]),
  prompt: z.string().min(1, "prompt requis"),
  slides: z
    .number({ invalid_type_error: "slides doit être un nombre" })
    .int("slides doit être un entier")
    .min(1, "au moins une slide")
    .max(30, "maximum 30 slides")
    .nullable(),
  templateId: z
    .string({ invalid_type_error: "templateId doit être une chaîne" })
    .min(1, "templateId vide")
    .nullable(),
  tone_pack: z.enum(TONE_PACKS),
});

export type DesignBrief = z.infer<typeof DesignBriefSchema>;

export type PartialDesignBrief = Partial<Omit<DesignBrief, "slides" | "templateId">> & {
  slides?: number | null;
  templateId?: string | null;
};

export function isDesignBrief(value: unknown): value is DesignBrief {
  return DesignBriefSchema.safeParse(value).success;
}

export function normalizeSlides(kind: DesignBrief["kind"], slides: number | null | undefined): number | null {
  if (kind !== "carousel") return null;
  if (typeof slides !== "number" || !Number.isFinite(slides)) return null;
  const rounded = Math.max(1, Math.min(30, Math.round(slides)));
  return rounded;
}
