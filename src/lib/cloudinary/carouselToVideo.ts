import { supabase } from '@/lib/supabase';
import { spliceVideoUrl } from './videoSimple';
import { getCloudName } from './config';

type Aspect = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '4:5';

interface CarouselVideoParams {
  carouselId?: string;
  orderId?: string;
  jobSetId?: string;
  aspect?: Aspect;
  title?: string;
  subtitle?: string;
  cta?: string;
  durationPerSlide?: number;
  audioPublicId?: string;
}

/** Générer une vidéo depuis les slides d'un carrousel (library_assets) */
export async function generateCarouselVideoFromLibrary(params: CarouselVideoParams): Promise<string> {
  const { carouselId, orderId, aspect = '4:5', title, subtitle, cta, durationPerSlide = 2, audioPublicId } = params;

  if (!carouselId && !orderId) {
    throw new Error('carouselId ou orderId requis');
  }

  // Charger les slides depuis library_assets
  let query = supabase
    .from('library_assets')
    .select('cloudinary_public_id, text_json, slide_index, cloudinary_url, metadata')
    .eq('type', 'carousel_slide')
    .order('slide_index', { ascending: true });

  if (carouselId) query = query.eq('carousel_id', carouselId);
  else if (orderId) query = query.eq('order_id', orderId);

  const { data: slides, error } = await query;

  if (error) throw error;
  if (!slides || slides.length === 0) {
    throw new Error('Aucune slide trouvée pour ce carrousel');
  }

  // Extraire cloudName
  const firstSlideUrl = slides[0]?.cloudinary_url;
  const cloudName = getCloudName(firstSlideUrl);

  // Construire les items
  const items = slides
    .filter(s => s.cloudinary_public_id)
    .map(s => ({
      type: 'image' as const,
      publicId: s.cloudinary_public_id!,
      durationSec: durationPerSlide,
    }));

  if (items.length === 0) {
    throw new Error('Aucun public_id valide trouvé');
  }

  // Générer l'URL vidéo
  return spliceVideoUrl({
    cloudName,
    items,
    aspect,
    title: title || (slides[0]?.text_json as any)?.title,
    subtitle,
    cta,
    audioPublicId,
  });
}

/** Générer une vidéo depuis un job_set_id (assets récents) */
export async function generateCarouselVideoFromJobSet(params: CarouselVideoParams): Promise<string> {
  const { jobSetId, aspect = '4:5', title, subtitle, cta, durationPerSlide = 2, audioPublicId } = params;

  if (!jobSetId) {
    throw new Error('jobSetId requis');
  }

  // Charger les assets depuis assets table
  const { data: assets, error } = await supabase
    .from('assets')
    .select('storage_key, meta, index_in_set')
    .eq('job_set_id', jobSetId)
    .order('index_in_set', { ascending: true });

  if (error) throw error;
  if (!assets || assets.length === 0) {
    throw new Error('Aucun asset trouvé pour ce job_set');
  }

  // Extraire publicId depuis storage_key (format: "alfie/brand123/slide_001.jpg")
  const items = assets.map(a => {
    const publicId = a.storage_key.replace(/\.[^.]+$/, ''); // enlever extension
    return {
      type: 'image' as const,
      publicId,
      durationSec: durationPerSlide,
    };
  });

  // Essayer de récupérer cloudName depuis les assets metadata
  const firstAssetUrl = typeof assets[0]?.meta === 'object' && assets[0]?.meta !== null 
    ? (assets[0].meta as any)?.cloudinary_url 
    : undefined;
  const cloudName = getCloudName(firstAssetUrl);

  return spliceVideoUrl({
    cloudName,
    items,
    aspect,
    title,
    subtitle,
    cta,
    audioPublicId,
  });
}
