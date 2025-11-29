/**
 * Nettoie une URL Cloudinary en supprimant les transformations problématiques
 * (e_zoompan, e_loop, e_reverse, etc.) qui peuvent causer des 404
 */
export function cleanCloudinaryUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  
  // Si ce n'est pas une URL Cloudinary, retourner tel quel
  if (!url.includes('res.cloudinary.com')) return url;
  
  // Transformations problématiques à supprimer
  const problematicTransforms = [
    /,?e_zoompan:[^/,]+/gi,
    /,?e_loop:[^/,]+/gi,
    /,?e_reverse/gi,
    /,?du_\d+/gi
  ];
  
  let cleaned = url;
  for (const regex of problematicTransforms) {
    cleaned = cleaned.replace(regex, '');
  }
  
  // Nettoyer les virgules ou slashes en double
  cleaned = cleaned.replace(/\/+/g, '/').replace(/,+/g, ',').replace(/,\//g, '/');
  
  return cleaned;
}

/**
 * Vérifie si une URL média est valide (HTTP/HTTPS ou data URL)
 */
export function isValidMediaUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:');
}

/**
 * Sélectionne la meilleure URL disponible entre output_url et thumbnail_url
 */
export function getBestAvailableUrl(
  outputUrl: string | undefined | null,
  thumbnailUrl: string | undefined | null
): string | null {
  // Priorité à output_url si c'est une URL valide
  if (outputUrl && isValidMediaUrl(outputUrl)) {
    return outputUrl;
  }
  // Fallback sur thumbnail_url
  if (thumbnailUrl && isValidMediaUrl(thumbnailUrl)) {
    return thumbnailUrl;
  }
  return null;
}
