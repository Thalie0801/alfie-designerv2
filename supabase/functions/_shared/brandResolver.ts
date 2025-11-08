import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./env.ts";

const admin = createClient(
  SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export interface BrandSnapshot {
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  logo_url?: string;
  voice?: string;
  fonts?: any;
  rules?: {
    forbidden_terms?: string[];
    min_contrast_ratio?: number;
    protected_zones?: string[];
  };
}

export async function resolveBrandKit(brandId: string): Promise<BrandSnapshot> {
  const { data } = await admin
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .maybeSingle();

  if (!data) return {};

  // Extraire les couleurs de la palette
  const palette = data.palette || [];
  const primary_color = palette[0]?.color || palette[0];
  const secondary_color = palette[1]?.color || palette[1];
  const accent_color = palette[2]?.color || palette[2];

  return {
    primary_color,
    secondary_color,
    accent_color,
    logo_url: data.logo_url,
    voice: data.voice,
    fonts: data.fonts
  };
}

export function enrichPromptWithBrand(basePrompt: string, brand: BrandSnapshot): string {
  let enhanced = basePrompt.trim();

  // Couleurs (CRITICAL)
  if (brand.primary_color) {
    const colors = [brand.primary_color, brand.secondary_color, brand.accent_color]
      .filter(Boolean)
      .join(', ');
    enhanced += ` CRITICAL: Use ONLY these exact brand colors: ${colors}. `;
  }

  // Style de marque
  if (brand.voice) {
    enhanced += `Brand style: ${brand.voice}. `;
  }

  // Logo (si applicable)
  if (brand.logo_url) {
    enhanced += `Include subtle brand logo elements. `;
  }

  // Garde-fous
  if (brand.rules?.forbidden_terms && brand.rules.forbidden_terms.length > 0) {
    enhanced += `AVOID these terms: ${brand.rules.forbidden_terms.join(', ')}. `;
  }

  return enhanced.trim();
}

export function calculateBrandScore(imageUrl: string, brand: BrandSnapshot): number {
  // Version simplifiée : retourner un score basique
  // En production, analyser l'image pour vérifier :
  // - Présence des couleurs brand (via histogramme)
  // - Contraste (WCAG AA)
  // - Position du logo (si présent)
  
  let score = 50; // Base

  if (brand.primary_color) score += 20;
  if (brand.voice) score += 15;
  if (brand.logo_url) score += 15;

  return Math.min(100, score);
}
