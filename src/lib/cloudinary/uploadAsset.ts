export type UploadResult = {
  public_id: string;
  resource_type: 'image' | 'video' | 'raw' | 'auto';
  secure_url: string;
  bytes: number;
  width?: number;
  height?: number;
  format?: string;
  duration?: number;
};

/**
 * Signer un upload Cloudinary côté serveur
 */
export async function signAsset(params: Record<string, any> = {}) {
  const r = await fetch('/functions/v1/cloudinary-asset', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'sign', params }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{
    signature: string;
    timestamp: number;
    api_key: string;
    cloud_name: string;
  }>;
}

/**
 * Upload universel (image/vidéo auto-détecté)
 */
export async function uploadAsset(
  file: File,
  opts: {
    folder?: string;
    public_id?: string;
    largeThresholdMB?: number;
  } = {}
): Promise<UploadResult> {
  const resource_type = 'auto';
  const { cloud_name, api_key, signature, timestamp } = await signAsset({
    folder: opts.folder,
    public_id: opts.public_id,
    resource_type,
  });

  const form = new FormData();
  form.append('file', file);
  form.append('timestamp', String(timestamp));
  form.append('api_key', api_key);
  form.append('signature', signature);
  form.append('resource_type', resource_type);
  if (opts.folder) form.append('folder', opts.folder);
  if (opts.public_id) form.append('public_id', opts.public_id);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/auto/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
