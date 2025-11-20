import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// Validation schemas for edge functions

export const CreateUserBody = z.object({
  email: z.string().email(),
  fullName: z.string().optional(),
  plan: z.string().min(1),
  sendInvite: z.boolean().default(true),
  grantedByAdmin: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export const GrantAccessBody = z.object({
  user_id: z.string().min(1),
  plan: z.string().min(1).optional(),
  granted_by_admin: z.boolean().optional(),
  quota_visuals_per_month: z.number().int().min(0).optional(),
  quota_brands: z.number().int().min(0).optional(),
  quota_videos: z.number().int().min(0).optional(),
  quota_woofs: z.number().int().min(0).optional(),
});

export const ResetPasswordBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const generateVideoSchema = z.object({
  prompt: z.string().min(3, 'Prompt trop court').max(5000, 'Prompt limité à 5000 caractères'),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional(),
  imageUrl: z.string().url('URL image invalide').optional(),
  videoUrl: z.string().url('URL vidéo invalide').optional(),
  duration_seconds: z.number().int().min(5).max(60).optional(),
});

export const alfieMessageSchema = z.object({
  conversationId: z.string().uuid('ID de conversation invalide'),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1, 'Message vide').max(10000, 'Message trop long'),
      imageUrl: z.string().url('URL image invalide').optional(),
    })
  ).max(100, 'Trop de messages dans la conversation'),
  brandId: z.string().uuid('ID de marque invalide').optional(),
});

export const generateImageSchema = z.object({
  prompt: z.string().min(3, 'Prompt trop court').max(5000, 'Prompt limité à 5000 caractères'),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3', '3:4']).optional(),
  templateImageUrl: z.string().url('URL template invalide').optional(),
  brandKit: z.object({
    palette: z.array(z.string()).optional(),
    logo: z.string().url('URL logo invalide').optional(),
  }).optional(),
});

export const createVideoSchema = z.object({
  title: z.string().min(1, 'Titre requis').max(200, 'Titre limité à 200 caractères'),
  duration: z.number().int().min(5, 'Durée minimale 5s').max(60, 'Durée maximale 60s'),
  ratio: z.enum(['16:9', '9:16', '1:1']).optional(),
  brandId: z.string().uuid('ID de marque invalide').optional(),
  assets: z.array(
    z.object({
      type: z.enum(['image', 'video', 'text']),
      url: z.string().url('URL asset invalide').optional(),
      content: z.string().optional(),
    })
  ).max(50, 'Maximum 50 assets par vidéo'),
});

export const deliverableSchema = z.object({
  format: z.enum(['image', 'video', 'carousel', 'reel']),
  objective: z.string().min(3, 'Objectif trop court').max(500, 'Objectif limité à 500 caractères').optional(),
  styleChoice: z.string().max(100, 'Style limité à 100 caractères').optional(),
  brandId: z.string().uuid('ID de marque invalide'),
});

// Payment validation schemas
export const CheckoutSchema = z.object({
  plan: z.enum(['starter', 'pro', 'studio', 'enterprise'], { 
    errorMap: () => ({ message: 'Plan invalide' })
  }),
  billing_period: z.enum(['monthly', 'annual']).default('monthly'),
  affiliate_ref: z.union([
    z.string().uuid('Référence affilié invalide'),
    z.literal(''),
    z.null()
  ]).optional(),
  brand_name: z.string()
    .trim()
    .min(1, 'Nom de marque requis')
    .max(100, 'Nom de marque trop long (max 100 caractères)')
    .regex(/^[a-zA-Z0-9\s\-_'\.]+$/, 'Nom de marque contient des caractères non autorisés')
    .optional()
    .or(z.literal('')),
  email: z.string().email('Email invalide').optional(),
});

export const VerifyPaymentSchema = z.object({
  session_id: z.string().min(1, 'Session ID requis'),
});

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, error: messages };
    }
    return { success: false, error: 'Validation error' };
  }
}
