export type AlfieFormat = 'image' | 'carousel';

export interface AlfieIntent {
  brandId: string;
  format: AlfieFormat;
  count: number; // nombre de visuels à générer
  topic: string; // sujet / idée principale
  ratio?: '1:1' | '4:5' | '9:16';
  platform?: 'instagram' | 'linkedin' | 'tiktok';
}
