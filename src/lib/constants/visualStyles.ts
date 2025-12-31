import type { VisualStyle } from "@/lib/types/vision";

export const VISUAL_STYLE_OPTIONS: { value: VisualStyle; label: string; description: string }[] = [
  { value: 'photorealistic', label: 'Photoréaliste', description: 'Photos ultra-réalistes' },
  { value: 'cinematic_photorealistic', label: 'Cinématique', description: 'Ambiance film hollywoodien' },
  { value: '3d_pixar_style', label: '3D Pixar', description: 'Personnages et scènes 3D cartoon' },
  { value: 'flat_illustration', label: 'Illustration plate', description: 'Style graphique moderne 2D' },
  { value: 'minimalist_vector', label: 'Minimaliste', description: 'Formes simples et épurées' },
  { value: 'digital_painting', label: 'Peinture digitale', description: 'Effet peinture artistique' },
  { value: 'comic_book', label: 'Bande dessinée', description: 'Style comics / manga' },
];
