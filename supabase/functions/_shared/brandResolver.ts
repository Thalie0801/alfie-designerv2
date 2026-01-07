import { createClient } from "npm:@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./env.ts";

const admin = createClient(
  SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ✅ Brand Kit V2 - Interface enrichie avec tous les champs
export interface BrandSnapshot {
  // V1 - Champs existants
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
  
  // V2 - Nouveaux champs d'identité
  name?: string;
  niche?: string;
  pitch?: string;
  adjectives?: string[];
  tagline?: string;
  
  // V2 - Ton et communication
  tone_sliders?: {
    fun: number;       // 0-10 (0 = sérieux, 10 = fun)
    accessible: number; // 0-10 (0 = corporate, 10 = accessible)
    energetic: number; // 0-10 (0 = calme, 10 = énergique)
    direct: number;    // 0-10 (0 = nuancé, 10 = direct)
  };
  person?: string;         // "je" | "nous" | "tu" | "vous"
  language_level?: string; // "familier" | "courant" | "soutenu"
  
  // V2 - Préférences visuelles
  visual_types?: string[];  // ["illustrations_2d", "photos", "mockups", etc.]
  visual_mood?: string[];   // ["coloré", "minimaliste", "pastel", etc.]
  avoid_in_visuals?: string; // Texte libre des éléments à éviter
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
    // V1
    primary_color,
    secondary_color,
    accent_color,
    logo_url: data.logo_url,
    voice: data.voice,
    fonts: data.fonts,
    
    // V2 - Identité
    name: data.name,
    niche: data.niche,
    pitch: data.pitch,
    adjectives: data.adjectives,
    tagline: data.tagline,
    
    // V2 - Ton
    tone_sliders: data.tone_sliders,
    person: data.person,
    language_level: data.language_level,
    
    // V2 - Visuel
    visual_types: data.visual_types,
    visual_mood: data.visual_mood,
    avoid_in_visuals: data.avoid_in_visuals,
  };
}

export function enrichPromptWithBrand(basePrompt: string, brand: BrandSnapshot): string {
  let enhanced = basePrompt.trim();

  // === V1: Couleurs (CRITICAL) ===
  if (brand.primary_color) {
    const colors = [brand.primary_color, brand.secondary_color, brand.accent_color]
      .filter(Boolean)
      .join(', ');
    enhanced += ` CRITICAL: Use ONLY these exact brand colors: ${colors}. `;
  }

  // === V2: Secteur d'activité ===
  if (brand.niche) {
    enhanced += `Industry/Niche: ${brand.niche}. `;
  }

  // === V2: Pitch de marque ===
  if (brand.pitch) {
    enhanced += `Brand essence: ${brand.pitch}. `;
  }

  // === V2: Adjectifs de personnalité ===
  if (brand.adjectives?.length) {
    enhanced += `Brand personality: ${brand.adjectives.join(', ')}. `;
  }

  // === V1: Style de marque ===
  if (brand.voice) {
    enhanced += `Brand voice/style: ${brand.voice}. `;
  }

  // === V2: Ton de communication (sliders) ===
  if (brand.tone_sliders) {
    const tone = brand.tone_sliders;
    const toneDescriptions: string[] = [];
    
    if (tone.fun !== undefined) {
      toneDescriptions.push(tone.fun > 5 ? 'fun and playful' : 'serious and professional');
    }
    if (tone.accessible !== undefined) {
      toneDescriptions.push(tone.accessible > 5 ? 'approachable and friendly' : 'corporate and formal');
    }
    if (tone.energetic !== undefined) {
      toneDescriptions.push(tone.energetic > 5 ? 'energetic and dynamic' : 'calm and composed');
    }
    if (tone.direct !== undefined) {
      toneDescriptions.push(tone.direct > 5 ? 'direct and straightforward' : 'nuanced and subtle');
    }
    
    if (toneDescriptions.length > 0) {
      enhanced += `Communication style: ${toneDescriptions.join(', ')}. `;
    }
  }

  // === V2: Niveau de langage ===
  if (brand.language_level) {
    const levels: Record<string, string> = {
      familier: 'casual, friendly, relaxed',
      courant: 'standard, professional',
      soutenu: 'formal, sophisticated, elegant'
    };
    enhanced += `Language style: ${levels[brand.language_level] || 'professional'}. `;
  }

  // === V2: Style visuel préféré ===
  if (brand.visual_types?.length) {
    const typeLabels: Record<string, string> = {
      illustrations_2d: '2D illustrations',
      illustrations_3d: '3D renders',
      photos: 'photography',
      mockups: 'product mockups',
      doodle: 'hand-drawn doodle style',
      corporate: 'corporate/professional'
    };
    const types = brand.visual_types.map(t => typeLabels[t] || t).join(', ');
    enhanced += `Preferred visual style: ${types}. `;
  }

  // === V2: Ambiance visuelle ===
  if (brand.visual_mood?.length) {
    enhanced += `Visual mood/atmosphere: ${brand.visual_mood.join(', ')}. `;
  }

  // === V1: Logo ===
  if (brand.logo_url) {
    enhanced += `Include subtle brand logo elements. `;
  }

  // === V2: Éléments à éviter (CRITIQUE) ===
  if (brand.avoid_in_visuals) {
    enhanced += `CRITICAL - AVOID in visuals: ${brand.avoid_in_visuals}. `;
  }

  // === V1: Termes interdits ===
  if (brand.rules?.forbidden_terms && brand.rules.forbidden_terms.length > 0) {
    enhanced += `AVOID these terms: ${brand.rules.forbidden_terms.join(', ')}. `;
  }

  // === V2: Tagline de référence ===
  if (brand.tagline) {
    enhanced += `Reference tagline: "${brand.tagline}". `;
  }

  return enhanced.trim();
}

export function calculateBrandScore(imageUrl: string, brand: BrandSnapshot): number {
  // Version simplifiée : retourner un score basique
  let score = 50; // Base

  if (brand.primary_color) score += 15;
  if (brand.voice) score += 10;
  if (brand.logo_url) score += 10;
  if (brand.pitch) score += 5;
  if (brand.adjectives?.length) score += 5;
  if (brand.visual_types?.length) score += 5;

  return Math.min(100, score);
}
