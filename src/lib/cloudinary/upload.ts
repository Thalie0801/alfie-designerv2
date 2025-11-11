import { supabase } from '@/integrations/supabase/client';

export interface SignParams {
  folder?: string;
  public_id?: string;
  resource_type?: 'image' | 'video' | 'raw' | 'auto';
  tags?: string[];
  context?: Record<string, string>;
}

export interface UploadOptions {
  folder?: string;
  public_id?: string;
  resource_type?: 'image' | 'video' | 'raw' | 'auto';
  tags?: string[];
  context?: Record<string, string>;
  onProgress?: (progress: number) => void;
}

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  format: string;
  resource_type: string;
  bytes: number;
  duration?: number;
  created_at: string;
}

/**
 * Generate a signature for frontend upload
 */
export async function sign(params: SignParams): Promise<{
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
}> {
  const timestamp = Math.round(Date.now() / 1000);
  
  const paramsToSign = {
    timestamp,
    ...params,
  };

  const { data, error } = await supabase.functions.invoke('cloudinary', {
    body: {
      action: 'sign',
      params: { paramsToSign },
    },
  });

  if (error) {
    console.error('[cloudinary/upload] Sign error:', error);
    throw new Error(`Failed to generate signature: ${error.message}`);
  }

  return data;
}

/**
 * Upload a file with server-side signature (recommended for security)
 */
export async function uploadSigned(
  file: File,
  options: UploadOptions = {}
): Promise<CloudinaryUploadResult> {
  try {
    // Convert file to base64
    const base64 = await fileToBase64(file);

    const { data, error } = await supabase.functions.invoke('cloudinary', {
      body: {
        action: 'upload',
        params: {
          file: base64,
          folder: options.folder,
          public_id: options.public_id,
          resource_type: options.resource_type || 'auto',
          tags: options.tags || [],
          context: options.context || {},
        },
      },
    });

    if (error) {
      console.error('[cloudinary/upload] Upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    console.log('[cloudinary/upload] Upload success:', data);
    return data;
  } catch (error: any) {
    console.error('[cloudinary/upload] Upload exception:', error);
    throw error;
  }
}

/**
 * Upload a large file (video) with chunked upload
 */
export async function uploadLarge(
  file: File,
  options: UploadOptions = {}
): Promise<CloudinaryUploadResult> {
  try {
    // For large files, we still need to convert to base64 but the edge function
    // will handle chunked upload to Cloudinary
    const base64 = await fileToBase64(file);

    const { data, error } = await supabase.functions.invoke('cloudinary', {
      body: {
        action: 'upload_large',
        params: {
          file: base64,
          folder: options.folder,
          public_id: options.public_id,
          resource_type: options.resource_type || 'video',
          chunk_size: 6000000, // 6MB chunks
        },
      },
    });

    if (error) {
      console.error('[cloudinary/upload] Large upload error:', error);
      throw new Error(`Large upload failed: ${error.message}`);
    }

    console.log('[cloudinary/upload] Large upload success:', data);
    return data;
  } catch (error: any) {
    console.error('[cloudinary/upload] Large upload exception:', error);
    throw error;
  }
}

/**
 * Upload unsigned with preset (optional - requires upload preset configuration)
 */
export async function uploadUnsigned(
  file: File,
  uploadPreset: string,
  folder?: string
): Promise<CloudinaryUploadResult> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  
  if (!cloudName) {
    throw new Error('VITE_CLOUDINARY_CLOUD_NAME not configured');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  
  if (folder) {
    formData.append('folder', folder);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Unsigned upload failed: ${error.error?.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Delete an asset from Cloudinary
 */
export async function deleteAsset(
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'image'
): Promise<{ result: string }> {
  const { data, error } = await supabase.functions.invoke('cloudinary', {
    body: {
      action: 'delete',
      params: {
        public_id: publicId,
        resource_type: resourceType,
      },
    },
  });

  if (error) {
    console.error('[cloudinary/upload] Delete error:', error);
    throw new Error(`Delete failed: ${error.message}`);
  }

  return data;
}

/**
 * Ping Cloudinary health check
 */
export async function ping(): Promise<{ ok: boolean; timestamp: string }> {
  const { data, error } = await supabase.functions.invoke('cloudinary', {
    body: { action: 'ping' },
  });

  if (error) {
    console.error('[cloudinary/upload] Ping error:', error);
    throw new Error(`Ping failed: ${error.message}`);
  }

  return data;
}

// Helper to convert File to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
