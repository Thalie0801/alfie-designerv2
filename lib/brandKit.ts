export interface BrandKitTypography {
  heading: string;
  body: string;
  accent?: string;
}

export interface BrandKit {
  tone: string;
  voice: string;
  colors: string[];
  typography: BrandKitTypography;
}

let cachedBrandKit: BrandKit | null = null;

export async function getBrandKit(): Promise<BrandKit> {
  if (cachedBrandKit) {
    return cachedBrandKit;
  }

  const tone = process.env.BRAND_TONE ?? "Chaleureux, direct, expert sans jargon.";
  const voice = process.env.BRAND_VOICE ?? "Alfie parle comme un directeur artistique impliqué, positif et orienté solutions.";
  const colors = (process.env.BRAND_COLORS ?? "#4C6EF5,#1C1F33,#F2F5FF").split(",").map(color => color.trim()).filter(Boolean);
  const typography: BrandKitTypography = {
    heading: process.env.BRAND_FONT_HEADING ?? "Sora, sans-serif",
    body: process.env.BRAND_FONT_BODY ?? "Inter, sans-serif",
    accent: process.env.BRAND_FONT_ACCENT ?? undefined,
  };

  cachedBrandKit = {
    tone,
    voice,
    colors,
    typography,
  };

  return cachedBrandKit;
}
