import { supabase } from '@/integrations/supabase/client';

interface SignedUrlOptions {
  bucket: string;
  storageKey: string;
  userId: string;
  expiresIn?: number;
}

function normalizeStoragePath(bucket: string, storageKey: string): string {
  if (!storageKey) {
    return '';
  }

  return storageKey.startsWith(`${bucket}/`)
    ? storageKey.slice(bucket.length + 1)
    : storageKey;
}

/**
 * ✅ SECURITY: Creates signed URLs for private storage buckets
 * Validates user ownership before generating URL
 * @param bucket - Storage bucket name
 * @param storageKey - Path to file in storage
 * @param userId - User ID for ownership verification
 * @param expiresIn - URL expiration in seconds (default: 1 hour)
 */
export async function createSignedUrlForStorageKey({
  bucket,
  storageKey,
  userId,
  expiresIn = 3600,
}: SignedUrlOptions): Promise<string> {
  const normalizedPath = normalizeStoragePath(bucket, storageKey);

  if (!normalizedPath) {
    throw new Error('Chemin de stockage invalide');
  }

  const [owner] = normalizedPath.split('/');
  if (owner !== userId) {
    throw new Error('Accès non autorisé au fichier demandé');
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(normalizedPath, expiresIn);

  if (error || !data?.signedUrl) {
    throw error ?? new Error('Impossible de générer une URL signée');
  }

  return data.signedUrl;
}

/**
 * ✅ SECURITY: Helper for media-generations bucket
 * Generates 1-hour signed URLs for user-owned media
 */
export async function getSignedMediaUrl(
  path: string, 
  userId: string,
  expiresIn = 3600
): Promise<string> {
  return createSignedUrlForStorageKey({
    bucket: 'media-generations',
    storageKey: path,
    userId,
    expiresIn
  });
}

/**
 * ✅ SECURITY: Helper for chat-uploads bucket
 * Generates 1-hour signed URLs for user-owned uploads
 */
export async function getSignedChatUploadUrl(
  path: string,
  userId: string,
  expiresIn = 3600
): Promise<string> {
  return createSignedUrlForStorageKey({
    bucket: 'chat-uploads',
    storageKey: path,
    userId,
    expiresIn
  });
}
