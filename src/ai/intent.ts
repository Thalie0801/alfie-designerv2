import { z } from "zod";

export const AlfieIntentSchema = z.object({
  brandId: z.string().min(1, "brandId manquant"),
  kind: z.enum(["image", "carousel", "video", "text"], {
    invalid_type_error: "Type d'intention invalide",
  }),
  language: z.enum(["fr", "en", "es"]).default("fr"),
  goal: z.enum(["awareness", "lead", "sale"]).default("awareness"),
  ratio: z.enum(["1:1", "4:5", "9:16", "16:9", "3:4"]).default("1:1"),
  slides: z
    .number()
    .int()
    .positive()
    .max(20)
    .nullable()
    .default(null),
  templateId: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .default(null),
  copyBrief: z.string().min(3, "Brief trop court"),
  cta: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .default(null),
  campaign: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .default(null),
  paletteLock: z.boolean().default(true),
  typographyLock: z.boolean().default(false),
  assetsRefs: z.array(z.string().min(1)).default([]),
  quality: z.enum(["fast", "high"]).default("fast"),
  tone_pack: z
    .enum(["brand_default", "apple_like", "playful", "b2b_crisp"])
    .default("brand_default"),
});

export type AlfieIntent = z.infer<typeof AlfieIntentSchema>;

type NormalizeInput = Partial<AlfieIntent> & Pick<AlfieIntent, "brandId" | "kind" | "copyBrief">;

const DEFAULTS: Omit<AlfieIntent, "brandId" | "kind" | "copyBrief"> = {
  language: "fr",
  goal: "awareness",
  ratio: "1:1",
  slides: null,
  templateId: null,
  cta: null,
  campaign: null,
  paletteLock: true,
  typographyLock: false,
  assetsRefs: [],
  quality: "fast",
  tone_pack: "brand_default",
};

function sanitizeString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeStringArray(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0),
    ),
  );
}

export function normalizeIntent(payload: NormalizeInput): AlfieIntent {
  const baseSlides = payload.kind === "carousel" ? payload.slides ?? 5 : null;
  const merged = {
    ...DEFAULTS,
    ...payload,
    slides: payload.kind === "carousel" ? baseSlides : null,
    templateId: sanitizeString(payload.templateId ?? null),
    cta: sanitizeString(payload.cta ?? null),
    campaign: sanitizeString(payload.campaign ?? null),
    assetsRefs: sanitizeStringArray(payload.assetsRefs),
    copyBrief: payload.copyBrief.trim(),
  } satisfies Partial<AlfieIntent>;

  return AlfieIntentSchema.parse(merged);
}

export type { NormalizeInput as AlfieIntentInput };
