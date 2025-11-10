export interface BrandPalette {
  primary: string;
  secondary?: string;
  accent?: string;
  background?: string;
  foreground?: string;
}

export interface BrandFonts {
  heading?: string;
  body?: string;
}

export interface BrandQuotas {
  images?: number;
  carousels?: number;
  videos?: number;
}

export interface Brand {
  id: string;
  name: string;
  palette?: BrandPalette;
  fonts?: BrandFonts;
  plan?: 'free' | 'pro' | 'enterprise' | string;
  quotas?: BrandQuotas;
}
