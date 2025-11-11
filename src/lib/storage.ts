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
