import { MediaType } from './types';

export type BatchRequestItem = {
  type: MediaType;
  count: number;
};

const typeMap: Record<string, MediaType> = {
  image: 'image',
  images: 'image',
  img: 'image',
  'image(s)': 'image',
  'image ': 'image',
  'images ': 'image',
  carrousel: 'carousel',
  carrousels: 'carousel',
  carousel: 'carousel',
  carousels: 'carousel',
  video: 'video',
  videos: 'video',
  vidéo: 'video',
  vidéos: 'video',
};

export function parseBatchRequest(
  text: string,
  defaultType: MediaType = 'image',
): BatchRequestItem[] {
  const lower = text.toLowerCase();
  const regex = /(\d+)\s*(images?|image|carrousels?|carrousel|carousel|carousels?|vidéos?|videos?|video|vidéo)/g;
  const items: BatchRequestItem[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(lower)) !== null) {
    const count = parseInt(match[1], 10);
    const word = match[2];
    const mappedType =
      Object.entries(typeMap).find(([key]) => word.startsWith(key))?.[1] ?? defaultType;
    items.push({ type: mappedType, count });
  }

  if (items.length === 0) {
    items.push({ type: defaultType, count: 1 });
  }

  return items;
}
