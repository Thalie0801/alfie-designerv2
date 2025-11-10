import { z } from 'zod';
import type { AlfieIntent, Kind, Language, Quality, Ratio } from '@/lib/types/alfie';

export const RatioEnum = z.enum(['1:1', '9:16', '16:9', '3:4']) as z.ZodType<Ratio>;
export const KindEnum = z.enum(['carousel', 'image', 'video', 'text']) as z.ZodType<Kind>;
export const LangEnum = z.enum(['fr', 'en', 'es']) as z.ZodType<Language>;
export const QualEnum = z.enum(['fast', 'high']) as z.ZodType<Quality>;

const Base = z.object({
  kind: KindEnum,
  brandId: z.string().min(1),
  campaign: z.string().optional(),
  language: LangEnum.default('fr'),
  audience: z.string().optional(),
  goal: z.enum(['awareness', 'lead', 'sale']).optional(),
  slides: z.number().int().positive().optional(),
  ratio: RatioEnum.optional(),
  templateId: z.string().optional(),
  copyBrief: z.string().optional(),
  cta: z.string().optional(),
  paletteLock: z.boolean().optional(),
  typographyLock: z.boolean().optional(),
  assetsRefs: z.array(z.string()).optional(),
  quality: QualEnum.optional(),
});

export const IntentSchema = Base.superRefine((val, ctx) => {
  if (val.kind === 'carousel' && typeof val.slides !== 'number') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'slides est requis pour un carrousel',
      path: ['slides'],
    });
  }
});

export type IntentInput = z.input<typeof IntentSchema>;
export type IntentOutput = AlfieIntent;
